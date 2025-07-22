// src/lib/comprasApi.ts
import axios, { AxiosError } from 'axios';
import { ApiResponse, ComprasLicitacao, VwFtContrato, ContratosApiResponse, PncpContrato, PncpContratosApiResponse } from './types'; // Importe os novos tipos
import { ExtractedFilters } from './extractFilters';
import { format } from 'date-fns'; // Importe format para formatar datas

const BASE_URL = 'https://dadosabertos.compras.gov.br'; // Base para buscarLicitacoesComprasGov (API Compras)
const CONTRATOS_API_URL = 'https://api.compras.dados.gov.br'; // URL base para a API de contratos (API Compras)
const PNCP_CONSULTA_API_URL = 'https://pncp.gov.br/api/consulta'; // Nova URL base para a API de Consultas do PNCP

export const comprasApi = axios.create({
 baseURL: BASE_URL,
 headers: {
  'Accept': 'application/json',
 },
 timeout: 30000,
});

export const contratosApi = axios.create({
 baseURL: CONTRATOS_API_URL,
 headers: {
  'Accept': 'application/json',
 },
 timeout: 30000,
});

// Nova instância Axios para a API de Consultas do PNCP
export const pncpApi = axios.create({
 baseURL: PNCP_CONSULTA_API_URL,
 headers: {
  'Accept': '*/*', // Conforme exemplos cURL nos manuais do PNCP
 },
 timeout: 30000,
});

export function handleApiError(error: unknown, defaultMessage: string): ApiResponse<never> {
 // ... (código existente) ...
 let message = defaultMessage;
 let status = 500;

 if (axios.isAxiosError(error)) {
  const axiosError = error as AxiosError<unknown>;
  status = axiosError.response?.status || 500;
  const data = axiosError.response?.data as { error?: string; message?: string } | undefined;
  const responseError = data?.error || data?.message;
  message = typeof responseError === 'string' ? responseError : axiosError.message || defaultMessage;

  console.error(`❌ ${defaultMessage} (Status: ${status})`);
  if (axiosError.response?.data) {
   console.error(`📩 Resposta da API:`, JSON.stringify(axiosError.response.data, null, 2));
  } else {
   console.error(`Rastreamento do erro Axios:`, axiosError.config?.url, axiosError.message);
  }

  if (status === 404) {
   message = `Recurso não encontrado na API. Verifique o endpoint ou parâmetros.`;
  } else if (status === 429) {
   message = `Limite de requisições excedido na API. Tente novamente mais tarde.`;
  }

 } else if (error instanceof Error) {
  message = error.message;
  console.error(`❌ ${defaultMessage} (Erro não-Axios):`, error);
 } else {
  console.error(`❌ ${defaultMessage} (Erro desconhecido):`, error);
 }

 return { success: false, error: message, status: status };
}

// Função auxiliar para mapear nomes de modalidades para códigos do PNCP
function getPncpModalidadeCodigo(modalidadeNome: string): number | undefined {
 const modalidadesMap: { [key: string]: number } = {
  "leilão eletrônico": 1,
  "diálogo competitivo": 2,
  "concurso": 3,
  "concorrência eletrônica": 4,
  "concorrência presencial": 5,
  "pregão eletrônico": 6,
  "pregão presencial": 7,
  "dispensa de licitação": 8,
  "inexigibilidade": 9,
  "manifestação de interesse": 10,
  "pré-qualificação": 11,
  "credenciamento": 12,
  "leilão presencial": 13,
 };
 // Normalize o nome da modalidade (ex: "Pregão Eletrônico" -> "pregão eletrônico")
 const normalizedName = modalidadeNome.toLowerCase().replace(/á/g, 'a').replace(/õ/g, 'o').replace(/ç/g, 'c');
 return modalidadesMap[normalizedName];
}


// Função para buscar contratos na API de Consultas do PNCP
export async function buscarContratosPNCP(
 filters: ExtractedFilters,
 page = 1,
 perPage = 500 // Padrão da API de Consultas do PNCP é 500
): Promise<ApiResponse<PncpContratosApiResponse>> { // O retorno agora é PncpContratosApiResponse
 try {
  console.log(`📞 Chamando buscarContratosPNCP com filtros:`, filters);

  const params: Record<string, any> = {
   pagina: page,
   tamanhoPagina: perPage, // Usará 500 agora
  };

  // As datas precisam estar no formato AAAAMMDD para a API de Consultas do PNCP
  if (!filters.dataInicial || !filters.dataFinal) {
   return { success: false, error: "As datas inicial e final são obrigatórias para esta busca de contratos.", status: 400 };
  }
  params.dataInicial = format(new Date(filters.dataInicial), 'yyyyMMdd');
  params.dataFinal = format(new Date(filters.dataFinal), 'yyyyMMdd');


  if (filters.estado) {
   params.uf = filters.estado; // Parâmetro UF para a API de contratos PNCP
  }
  if (filters.modalidade) {
   const codigoModalidade = getPncpModalidadeCodigo(filters.modalidade);
   if (codigoModalidade !== undefined) {
    params.codigoModalidadeContratacao = codigoModalidade; // Mapeamento para código numérico
   } else {
    console.warn(`⚠️ Modalidade "${filters.modalidade}" não mapeada para um código do PNCP. Ignorando filtro de modalidade.`);
   }
  }

  const endpoint = '/v1/contratos'; // Endpoint da API de Consultas do PNCP para contratos

  const response = await pncpApi.get<PncpContratosApiResponse>(endpoint, { params });
  console.log(`✅ Sucesso ao buscar contratos do PNCP.`);

  if (!response.data || !Array.isArray(response.data.data)) { // A resposta do PNCP tem os dados em 'data'
   console.error("❌ Estrutura inesperada na resposta da API PNCP (Contratos):", response.data);
   return { success: false, error: "Resposta da API PNCP inválida (estrutura inesperada).", status: 500 };
  }

  return { success: true, data: response.data, status: response.status };
 } catch (err: unknown) {
  return handleApiError(err, 'Erro ao buscar contratos na API PNCP');
 }
}

// Mantendo outras funções que podem ser usadas para API Compras original
export async function getDetalhesLicitacao(boletimId: number): Promise<ApiResponse<ComprasLicitacao>> {
 // ... (código existente, sem alterações) ...
 try {
  console.log(`📞 Chamando getDetalhesLicitacao para boletim ${boletimId}...`);
  const response = await comprasApi.get(`/boletim/${boletimId}`);
  console.log(`✅ Sucesso ao buscar detalhes do boletim ${boletimId}.`);
  const responseData = response.data as ComprasLicitacao;
  if (!responseData || typeof responseData !== 'object' || responseData === null) {
   console.error(`❌ Estrutura inesperada na resposta de /boletim/${boletimId}:`, responseData);
   return { success: false, error: `Resposta da API de detalhes do boletim ${boletimId} inválida.`, status: 500 };
  }
  return { success: true, data: responseData, status: response.status };
 } catch (err: unknown) {
  return handleApiError(err, `Erro ao buscar detalhes do boletim ${boletimId}`);
 }
}

export async function getDetalhesContrato(idContrato: string): Promise<ApiResponse<VwFtContrato>> {
 // ... (código existente, sem alterações) ...
 try {
  console.log(`📞 Chamando getDetalhesContrato para contrato ${idContrato}...`);
  const response = await contratosApi.get<VwFtContrato>(`/comprasContratos/doc/contrato/${idContrato}`);
  console.log(`✅ Sucesso ao buscar detalhes do contrato ${idContrato}.`);

  if (!response.data || typeof response.data !== 'object' || response.data === null) {
   console.error(`❌ Estrutura inesperada na resposta da API de contratos para ${idContrato}:`, response.data);
   return { success: false, error: `Resposta da API de detalhes do contrato ${idContrato} inválida.`, status: 500 };
  }
  return { success: true, data: response.data, status: response.status };
 } catch (err: unknown) {
  return handleApiError(err, `Erro ao buscar detalhes do contrato ${idContrato}`);
 }
}