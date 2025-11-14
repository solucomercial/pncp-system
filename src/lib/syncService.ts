import { db } from "@/lib/db";
import { pncpLicitacao, syncLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pncp } from "./comprasApi";
import { analyzeLicitacao } from "./analyzeBids";

type NovaLicitacao = Omit<typeof pncpLicitacao.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
type LicitacaoAnalisada = typeof pncpLicitacao.$inferInsert;


const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchLicitacoesFromPNCP(
  date: string,
): Promise<NovaLicitacao[]> {
  let pagina = 1;
  const todasLicitacoes: NovaLicitacao[] = [];
  let licitacoesDaPagina: Record<string, unknown>[] | null;

  console.log(
    `[SyncService] Iniciando busca no PNCP para data: ${date} (Página ${pagina})`,
  );

  do {
    let retries = 0;
    let success = false;
    licitacoesDaPagina = null;

    while (retries < MAX_RETRIES && !success) {
      try {
        const response = await pncp.getLicitacoes(date, pagina);
        licitacoesDaPagina = response.data;
        success = true;
      } catch (error) {
        retries++;
        console.error(
          `[SyncService] Erro ao buscar página ${pagina} (Tentativa ${retries}/${MAX_RETRIES}):`,
          error,
        );
        if (retries < MAX_RETRIES) {
          await delay(RETRY_DELAY);
        } else {
          console.error(
            `[SyncService] Falha permanente ao buscar página ${pagina} após ${MAX_RETRIES} tentativas.`,
          );
          throw error;
        }
      }
    }

    if (licitacoesDaPagina && licitacoesDaPagina.length > 0) {
      console.log(
        `[SyncService] Página ${pagina} processada, ${licitacoesDaPagina.length} licitações encontradas.`,
      );
      todasLicitacoes.push(
        ...licitacoesDaPagina.map(
          (item: Record<string, unknown>): NovaLicitacao => ({ // <-- CORRIGIDO AQUI
            numeroControlePNCP: item.numeroControlePNCP as string,
            cnpjOrgao: (item.orgao as Record<string, unknown>).cnpj as string,
            orgao: (item.orgao as Record<string, unknown>).nome as string,
            unidadeOrgao: (item.unidadeOrgao as Record<string, unknown>).nome as string,
            municipio: (item.municipio as Record<string, unknown>).nome as string,
            uf: (item.uf as Record<string, unknown>).sigla as string,
            anoCompra: item.anoCompra as number,
            sequencialCompra: item.sequencialCompra as number,
            modalidade: (item.modalidade as Record<string, unknown>).nome as string,
            numeroProcesso: item.numeroProcesso as string,
            objetoCompra: item.objetoCompra as string,
            valorEstimado: item.valorEstimado ? String(item.valorEstimado) : null,
            dataPublicacaoPNCP: new Date(item.dataPublicacaoPNCP as string),
            dataAtualizacao: new Date(item.dataAtualizacao as string),
            situacao: (item.situacao as Record<string, unknown>).nome as string,
            linkSistemaOrigem: item.linkSistemaOrigem as string,
            linkPNCP: item.linkPNCP as string,
            iaResumo: null,
            iaPalavrasChave: [],
            documentosLinks: [], 
            modoDisputa: item.modoDisputa ? (item.modoDisputa as Record<string, unknown>).nome as string : null,
            criterioJulgamento: item.criterioJulgamento
              ? (item.criterioJulgamento as Record<string, unknown>).nome as string
              : null,
            informacaoComplementar: item.informacaoComplementar as string,
            aceitaJustificativa: item.aceitaJustificativa as boolean,
            niSolicitante: item.niSolicitante as string,
            dataAutorizacao: item.dataAutorizacao
              ? new Date(item.dataAutorizacao as string)
              : null,
            justificativaPresencial: item.justificativaPresencial as string,
            grauRelevanciaIA: null,
            justificativaRelevanciaIA: null,
          }),
        ),
      );
      pagina++;
    }
  } while (licitacoesDaPagina && licitacoesDaPagina.length > 0);

  console.log(
    `[SyncService] Busca finalizada para ${date}. Total de ${todasLicitacoes.length} licitações.`,
  );
  return todasLicitacoes;
}

async function analyzeBidsForStorage(licitacoes: NovaLicitacao[]) {
  const licitacoesCompletas: LicitacaoAnalisada[] = [];
  
  for (const licitacao of licitacoes) {
    const analysis = await analyzeLicitacao(licitacao);

    const licitacaoAnalisada: LicitacaoAnalisada = {
      ...licitacao,
      iaResumo: analysis?.resumo || "N/A",
      iaPalavrasChave: analysis?.palavrasChave || [],
      grauRelevanciaIA: analysis?.grauRelevanciaIA || "Média",
      justificativaRelevanciaIA: analysis?.justificativaRelevanciaIA || "N/A",
      documentosLinks: analysis?.allFileUrls || [], 
      updatedAt: new Date(),
    };
    
    licitacoesCompletas.push(licitacaoAnalisada);
  }
  return licitacoesCompletas;
}

async function upsertLicitacoes(licitacoes: LicitacaoAnalisada[]) {
  if (licitacoes.length === 0) return 0;

  console.log(`[SyncService] Salvando ${licitacoes.length} licitações no banco...`);
  
  for (const licitacao of licitacoes) {
    try {
      await db.insert(pncpLicitacao)
        .values(licitacao)
        .onConflictDoUpdate({
          target: pncpLicitacao.numeroControlePNCP, 
          set: {
            ...licitacao,
            id: undefined,
            numeroControlePNCP: undefined,
          }
        });
    } catch (error) {
      console.error(
        `[SyncService] Erro ao salvar licitação ${licitacao.numeroControlePNCP}:`,
        error,
      );
    }
  }
  
  return licitacoes.length;
}

export async function processDate(targetDate: string): Promise<number> {
  let licitacoesDoDia: NovaLicitacao[] = [];
  try {
    licitacoesDoDia = await fetchLicitacoesFromPNCP(targetDate);

    if (licitacoesDoDia.length === 0) {
      console.log(`[SyncService] Nenhuma licitação nova para ${targetDate}.`);
      return 0;
    }

    const licitacoesAnalisadas = await analyzeBidsForStorage(licitacoesDoDia);

    const count = await upsertLicitacoes(licitacoesAnalisadas);
    console.log(
      `[SyncService] Sincronização de ${targetDate} concluída. ${count} registros salvos.`,
    );
    return count;
  } catch (error) {
    console.error(
      `[SyncService] Erro fatal no processamento de ${targetDate}:`,
      error,
    );
    throw error;
  }
}

export async function runSync(daysAgo: number = 1) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const dateString = targetDate.toISOString().split("T")[0];

  console.log(`[SyncService] Iniciando runSync para data: ${dateString}`);

  const logEntries = await db.insert(syncLog)
    .values({
      date: new Date(dateString),
      status: "running",
      startTime: new Date(),
    })
    .returning({ id: syncLog.id });
  
  const log = logEntries[0];

  try {
    const recordsFetched = await processDate(dateString);

    await db.update(syncLog)
      .set({
        status: "success",
        endTime: new Date(),
        recordsFetched: recordsFetched,
      })
      .where(eq(syncLog.id, log.id));
    
    console.log(`[SyncService] runSync para ${dateString} concluído com sucesso.`);
  } catch (error: unknown) { // <-- CORRIGIDO AQUI

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    await db.update(syncLog)
      .set({
        status: "failed",
        endTime: new Date(),
        errorMessage: errorMessage,
      })
      .where(eq(syncLog.id, log.id));
    
    console.error(`[SyncService] runSync para ${dateString} falhou:`, error);
  }
}