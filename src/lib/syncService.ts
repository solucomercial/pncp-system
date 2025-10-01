import { PrismaClient } from "@prisma/client";
import { subDays, format } from "date-fns";
import { pncpApi } from "./comprasApi";
import { PncpLicitacao } from "./types";

const prisma = new PrismaClient();
const ALL_MODALITY_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// (As funções mapLicitacaoToPrisma e fetchLicitacoesFromPNCP continuam iguais)
function mapLicitacaoToPrisma(licitacao: PncpLicitacao) {
 return {
  numeroControlePNCP: licitacao.numeroControlePNCP,
  numeroCompra: licitacao.numeroCompra,
  anoCompra: licitacao.anoCompra,
  processo: licitacao.processo,
  modalidadeNome: licitacao.modalidadeNome,
  modoDisputaNome: licitacao.modoDisputaNome,
  situacaoCompraNome: licitacao.situacaoCompraNome,
  objetoCompra: licitacao.objetoCompra,
  informacaoComplementar: licitacao.informacaoComplementar,
  valorTotalEstimado: licitacao.valorTotalEstimado,
  valorTotalHomologado: licitacao.valorTotalHomologado,
  dataAberturaProposta: licitacao.dataAberturaProposta ? new Date(licitacao.dataAberturaProposta) : null,
  dataEncerramentoProposta: licitacao.dataEncerramentoProposta ? new Date(licitacao.dataEncerramentoProposta) : null,
  dataPublicacaoPncp: new Date(licitacao.dataPublicacaoPncp),
  dataInclusao: new Date(licitacao.dataInclusao),
  dataAtualizacao: new Date(licitacao.dataAtualizacao),
  cnpjOrgaoEntidade: licitacao.orgaoEntidade.cnpj,
  razaoSocialOrgaoEntidade: licitacao.orgaoEntidade.razaoSocial,
  codigoUnidadeOrgao: licitacao.unidadeOrgao.codigoUnidade,
  nomeUnidadeOrgao: licitacao.unidadeOrgao.nomeUnidade,
  municipioNomeUnidadeOrgao: licitacao.unidadeOrgao.municipioNome,
  ufSiglaUnidadeOrgao: licitacao.unidadeOrgao.ufSigla,
  linkSistemaOrigem: licitacao.linkSistemaOrigem,
  srp: licitacao.srp,
  amparoLegalNome: licitacao.amparoLegal?.nome,
 };
}

async function fetchLicitacoesFromPNCP(data: Date): Promise<PncpLicitacao[]> {
 console.log(`[SyncService] Buscando licitações para a data: ${format(data, "yyyy-MM-dd")}`);
 const dataFormatada = format(data, "yyyyMMdd");
 const todasLicitacoes: PncpLicitacao[] = [];

 for (const modalidade of ALL_MODALITY_CODES) {
  let pagina = 1;
  let totalPaginas = 1;

  while (pagina <= totalPaginas) {
   try {
    const params = {
     dataInicial: dataFormatada,
     dataFinal: dataFormatada,
     codigoModalidadeContratacao: modalidade,
     pagina: pagina,
     tamanhoPagina: 50,
    };

    const response = await pncpApi.get("/v1/contratacoes/publicacao", { params });

    if (response.data && response.data.data) {
     todasLicitacoes.push(...response.data.data);
     if (pagina === 1) {
      totalPaginas = response.data.totalPaginas || 1;
     }
     console.log(`[SyncService] Modalidade ${modalidade}: Página ${pagina}/${totalPaginas} carregada.`);
    } else {
     break;
    }

    pagina++;
    await new Promise(resolve => setTimeout(resolve, 500));
   } catch (error) {
    console.error(`[SyncService] Erro ao buscar Modalidade ${modalidade}, Página ${pagina}. Tentando novamente...`, error);
    await new Promise(resolve => setTimeout(resolve, 5000));
   }
  }
 }

 console.log(`[SyncService] Total de ${todasLicitacoes.length} licitações encontradas para ${format(data, "yyyy-MM-dd")}.`);
 return todasLicitacoes;
}

async function upsertLicitacoes(licitacoes: PncpLicitacao[]) {
 if (licitacoes.length === 0) {
  console.log("[SyncService] Nenhuma licitação para salvar.");
  return;
 }

 console.log(`[SyncService] Salvando/Atualizando ${licitacoes.length} licitações no banco de dados...`);

 const transacoes = licitacoes.map(lic => {
  const data = mapLicitacaoToPrisma(lic);
  return prisma.licitacao.upsert({
   where: { numeroControlePNCP: lic.numeroControlePNCP },
   update: data,
   create: data,
  });
 });

 await prisma.$transaction(transacoes);
 console.log("[SyncService] Dados salvos com sucesso.");
}

async function cleanupOldLicitacoes() {
 const dataLimite = subDays(new Date(), 30);
 console.log(`[SyncService] Removendo licitações publicadas antes de ${format(dataLimite, "yyyy-MM-dd")}`);

 const result = await prisma.licitacao.deleteMany({
  where: {
   dataPublicacaoPncp: {
    lt: dataLimite,
   },
  },
 });

 console.log(`[SyncService] ${result.count} licitações antigas removidas.`);
}


// --- AJUSTE PARA CARGA INICIAL ---
export async function runSync(isInitialLoad: boolean = false) {
 console.log(`--- [SyncService] INICIANDO SINCRONIZAÇÃO (${isInitialLoad ? 'CARGA INICIAL' : 'DIÁRIA'}) ---`);

 if (isInitialLoad) {
  // --- LÓGICA PARA CARGA INICIAL (30 dias) ---
  console.log("[SyncService] Executando carga inicial dos últimos 30 dias.");
  for (let i = 1; i <= 30; i++) {
   const targetDate = subDays(new Date(), i);
   try {
    console.log(`\n--- Processando dia ${i}/30: ${format(targetDate, 'dd/MM/yyyy')} ---`);
    const licitacoesDoDia = await fetchLicitacoesFromPNCP(targetDate);
    await upsertLicitacoes(licitacoesDoDia);
   } catch (error) {
    console.error(`[SyncService] Erro crítico ao processar a data ${format(targetDate, 'dd/MM/yyyy')}. Continuando para o próximo dia.`, error);
   }
  }
 } else {
  // --- LÓGICA PARA SINCRONIZAÇÃO DIÁRIA (padrão) ---
  try {
   const ontem = subDays(new Date(), 1);
   const licitacoesDoDia = await fetchLicitacoesFromPNCP(ontem);
   await upsertLicitacoes(licitacoesDoDia);
  } catch (error) {
   console.error("[SyncService] Erro crítico durante a busca diária.", error);
  }
 }

 // A limpeza ocorre em ambos os casos para manter a consistência
 try {
  await cleanupOldLicitacoes();
 } catch (error) {
  console.error("[SyncService] Erro crítico durante a limpeza de dados antigos.", error);
 }

 console.log("--- [SyncService] SINCRONIZAÇÃO CONCLUÍDA ---");
 await prisma.$disconnect();
 return { success: true, message: "Sincronização concluída." };
}