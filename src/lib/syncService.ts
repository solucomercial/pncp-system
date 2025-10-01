import { PrismaClient } from "@prisma/client";
import { subDays, format } from "date-fns";
import { pncpApi, handleApiError } from "./comprasApi";
import { PncpLicitacao } from "./types";

const prisma = new PrismaClient();
const ALL_MODALITY_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/**
 * Mapeia os dados da API para o schema do Prisma.
 */
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
 };
}

/**
 * Busca licitações de uma data específica na API do PNCP.
 */
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
     break; // Sai do loop se não houver mais dados
    }

    pagina++;
    // Adiciona um pequeno delay para não sobrecarregar a API
    await new Promise(resolve => setTimeout(resolve, 500));
   } catch (error) {
    console.error(`[SyncService] Erro ao buscar Modalidade ${modalidade}, Página ${pagina}. Tentando novamente...`, error);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos antes de tentar novamente a mesma página
   }
  }
 }

 console.log(`[SyncService] Total de ${todasLicitacoes.length} licitações encontradas para ${format(data, "yyyy-MM-dd")}.`);
 return todasLicitacoes;
}

/**
 * Salva ou atualiza uma lista de licitações no banco de dados.
 */
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

 // Executa todas as operações de upsert em uma única transação
 await prisma.$transaction(transacoes);
 console.log("[SyncService] Dados salvos com sucesso.");
}

/**
 * Remove licitações com data de publicação maior que 30 dias.
 */
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

/**
 * Função principal que orquestra a sincronização.
 */
export async function runSync() {
 console.log("--- [SyncService] INICIANDO SINCRONIZAÇÃO DIÁRIA ---");
 try {
  // 1. Busca as licitações do dia anterior
  const ontem = subDays(new Date(), 1);
  const licitacoesDoDia = await fetchLicitacoesFromPNCP(ontem);

  // 2. Salva os dados no banco
  await upsertLicitacoes(licitacoesDoDia);

  // 3. Limpa os dados antigos
  await cleanupOldLicitacoes();

  console.log("--- [SyncService] SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO ---");
  return { success: true, message: `Sincronização concluída. ${licitacoesDoDia.length} licitações processadas.` };
 } catch (error) {
  console.error("--- [SyncService] ERRO CRÍTICO DURANTE A SINCRONIZAÇÃO ---", error);
  return { success: false, message: "Ocorreu um erro durante a sincronização." };
 } finally {
  await prisma.$disconnect();
 }
}