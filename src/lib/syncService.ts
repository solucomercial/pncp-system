import { db } from "@/lib/db";
import { pncpLicitacao, syncLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pncp } from "./comprasApi";
import { analyzeLicitacao } from "./analyzeBids";

// Define um tipo para o objeto que vem da API, antes de ir para o DB
// Usamos o tipo 'Insert' do Drizzle, mas omitimos 'id' (autoincrement)
type NovaLicitacao = Omit<typeof pncpLicitacao.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;
// Define o tipo completo da licitação analisada (com campos da IA)
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
  let licitacoesDaPagina;

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
          (item: any): NovaLicitacao => ({
            // Mapeamento dos dados da API para o nosso schema Drizzle
            numeroControlePNCP: item.numeroControlePNCP,
            cnpjOrgao: item.orgao.cnpj,
            orgao: item.orgao.nome,
            unidadeOrgao: item.unidadeOrgao.nome,
            municipio: item.municipio.nome,
            uf: item.uf.sigla,
            anoCompra: item.anoCompra,
            sequencialCompra: item.sequencialCompra,
            modalidade: item.modalidade.nome,
            numeroProcesso: item.numeroProcesso,
            objetoCompra: item.objetoCompra,
            // O Drizzle (com 'pg') prefere strings para 'decimal'
            valorEstimado: item.valorEstimado ? String(item.valorEstimado) : null,
            dataPublicacaoPNCP: new Date(item.dataPublicacaoPNCP),
            dataAtualizacao: new Date(item.dataAtualizacao),
            situacao: item.situacao.nome,
            linkSistemaOrigem: item.linkSistemaOrigem,
            linkPNCP: item.linkPNCP,
            iaResumo: null,
            iaPalavrasChave: [],
            modoDisputa: item.modoDisputa ? item.modoDisputa.nome : null,
            criterioJulgamento: item.criterioJulgamento
              ? item.criterioJulgamento.nome
              : null,
            informacaoComplementar: item.informacaoComplementar,
            aceitaJustificativa: item.aceitaJustificativa,
            niSolicitante: item.niSolicitante,
            dataAutorizacao: item.dataAutorizacao
              ? new Date(item.dataAutorizacao)
              : null,
            justificativaPresencial: item.justificativaPresencial,
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
    
    // Prepara o objeto para o 'insert' (upsert)
    const licitacaoAnalisada: LicitacaoAnalisada = {
      ...licitacao,
      // Garante que os campos da IA sejam adicionados
      iaResumo: analysis?.resumo || "N/A",
      iaPalavrasChave: analysis?.palavrasChave || [],
      grauRelevanciaIA: analysis?.grauRelevanciaIA || "Média",
      justificativaRelevanciaIA: analysis?.justificativaRelevanciaIA || "N/A",
      // Define a data de atualização para o upsert
      updatedAt: new Date(),
    };
    
    licitacoesCompletas.push(licitacaoAnalisada);
  }
  return licitacoesCompletas;
}

async function upsertLicitacoes(licitacoes: LicitacaoAnalisada[]) {
  if (licitacoes.length === 0) return 0;

  console.log(`[SyncService] Salvando ${licitacoes.length} licitações no banco...`);

  // --- ATUALIZAÇÃO DRIZZLE (Upsert) ---
  // O Drizzle usa onConflictDoUpdate para simular o 'upsert'
  
  for (const licitacao of licitacoes) {
    try {
      await db.insert(pncpLicitacao)
        .values(licitacao)
        .onConflictDoUpdate({
          // O 'target' é a coluna 'unique' que define o conflito
          target: pncpLicitacao.numeroControlePNCP, 
          // 'set' define quais colunas devem ser atualizadas
          set: {
            ...licitacao,
            // Omite 'id' e 'numeroControlePNCP' do 'set'
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
  // --- FIM DA ATUALIZAÇÃO ---
  
  return licitacoes.length;
}

export async function processDate(targetDate: string): Promise<number> {
  let licitacoesDoDia: NovaLicitacao[] = [];
  try {
    // 1. Busca licitações da API PNCP
    licitacoesDoDia = await fetchLicitacoesFromPNCP(targetDate);

    if (licitacoesDoDia.length === 0) {
      console.log(`[SyncService] Nenhuma licitação nova para ${targetDate}.`);
      return 0;
    }

    // 2. Chama a análise da IA (agora usando Drizzle internamente)
    const licitacoesAnalisadas = await analyzeBidsForStorage(licitacoesDoDia);

    // 3. Guarda licitações na base de dados (agora usando Drizzle)
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
  
  // --- ATUALIZAÇÃO DRIZZLE (Log) ---
  // O 'returning' é necessário para obter o ID do log inserido
  const logEntries = await db.insert(syncLog)
    .values({
      date: new Date(dateString),
      status: "running",
      startTime: new Date(),
    })
    .returning({ id: syncLog.id });
  
  const log = logEntries[0];
  // --- FIM DA ATUALIZAÇÃO ---

  try {
    const recordsFetched = await processDate(dateString);
    
    // --- ATUALIZAÇÃO DRIZZLE (Log Success) ---
    await db.update(syncLog)
      .set({
        status: "success",
        endTime: new Date(),
        recordsFetched: recordsFetched,
      })
      .where(eq(syncLog.id, log.id));
    // --- FIM DA ATUALIZAÇÃO ---
    
    console.log(`[SyncService] runSync para ${dateString} concluído com sucesso.`);
  } catch (error: any) {
    
    // --- ATUALIZAÇÃO DRIZZLE (Log Failed) ---
    await db.update(syncLog)
      .set({
        status: "failed",
        endTime: new Date(),
        errorMessage: error.message,
      })
      .where(eq(syncLog.id, log.id));
    // --- FIM DA ATUALIZAÇÃO ---
    
    console.error(`[SyncService] runSync para ${dateString} falhou:`, error);
  }
}