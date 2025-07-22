// src/lib/comprasApi.ts
import axios, { AxiosError } from 'axios';
import { ApiResponse, ComprasLicitacao, VwFtContrato, ContratosApiResponse } from './types'; // Importe VwFtContrato e ContratosApiResponse
import { ExtractedFilters } from './extractFilters';

const BASE_URL = 'https://dadosabertos.compras.gov.br'; // Base para buscarLicitacoesComprasGov
const CONTRATOS_API_URL = 'https://api.compras.dados.gov.br'; // URL base para a API de contratos

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
   message = `Recurso não encontrado na API Compras.gov.br (${axiosError.config?.url}). Verifique o endpoint ou parâmetros.`;
  } else if (status === 429) {
   message = `Limite de requisições excedido na API Compras.gov.br. Tente novamente mais tarde.`;
  }

 } else if (error instanceof Error) {
  message = error.message;
  console.error(`❌ ${defaultMessage} (Erro não-Axios):`, error);
 } else {
  console.error(`❌ ${defaultMessage} (Erro desconhecido):`, error);
 }

 return { success: false, error: message, status: status };
}

// Removendo a função getModalidadeCodigo, pois a API de Contratos espera string para modalidade
// function getModalidadeCodigo(modalidadeNome: string): number | undefined {
//  const modalidadesMap: { [key: string]: number } = {
//   "pregão eletrônico": 5,
//   "concorrência": 1,
//  };
//  return modalidadesMap[modalidadeNome.toLowerCase()];
// }

export async function buscarLicitacoesComprasGov( // Renomeada para ser mais genérica se for buscar contratos
 filters: ExtractedFilters,
 page = 1,
 perPage = 10
): Promise<ApiResponse<ContratosApiResponse>> { // O retorno agora é ContratosApiResponse
 try {
  console.log(`📞 Chamando buscarLicitacoesComprasGov (para Contratos) com filtros:`, filters);

  const params: Record<string, any> = {
   pagina: page,
   tamanhoPagina: perPage,
  };

  // Ajuste dos nomes dos parâmetros de data para a API de contratos
  if (!filters.dataInicial || !filters.dataFinal) {
   return { success: false, error: "As datas inicial e final são obrigatórias para esta busca de contratos.", status: 400 };
  }
  params.dataVigenciaInicialMin = filters.dataInicial; // Usar dataVigenciaInicialMin
  params.dataVigenciaInicialMax = filters.dataFinal;   // Usar dataVigenciaInicialMax

  if (filters.estado) {
   params.ufSigla = filters.estado; // Parâmetro UF para a API de contratos
  }
  if (filters.modalidade) {
   // A modalidade na API de contratos é string, então passamos diretamente o nome extraído.
   // Você pode precisar de um mapeamento se os nomes da IA forem diferentes dos da API.
   params.codigoModalidadeCompra = filters.modalidade;
  }

  const endpoint = '/modulo-contratos/1_consultarContratos'; // Endpoint da requisição curl

  const response = await comprasApi.get<ContratosApiResponse>(endpoint, { params });
  console.log(`✅ Sucesso ao buscar contratos do Compras.gov.br.`);

  if (!response.data || !Array.isArray(response.data.resultado)) {
   console.error("❌ Estrutura inesperada na resposta da API Compras.gov.br (Contratos):", response.data);
   return { success: false, error: "Resposta da API Compras.gov.br inválida (estrutura inesperada).", status: 500 };
  }

  return { success: true, data: response.data, status: response.status };
 } catch (err: unknown) {
  return handleApiError(err, 'Erro ao buscar contratos na API Compras.gov.br');
 }
}

// Renomeado para clareza: getDetalhesBoletim -> getDetalhesLicitacao
export async function getDetalhesLicitacao(boletimId: number): Promise<ApiResponse<ComprasLicitacao>> {
 // ... (código existente) ...
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

// Esta função não precisa de alterações, pois consulta um contrato específico por ID em um endpoint diferente
export async function getDetalhesContrato(idContrato: string): Promise<ApiResponse<VwFtContrato>> {
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