import axios, { AxiosError } from 'axios';
import { ApiResponse, PncpLicitacao, PncpApiResponse } from './types';
import { format, parseISO, differenceInDays, subDays } from 'date-fns';
import { getCachedApiResult, setCachedApiResult } from './apiCache';

export interface ProgressUpdate {
 type: 'info' | 'fetching';
 message: string;
 modalidade?: string;
 page?: number;
 totalPages?: number;
 totalResults?: number;
}

type ProgressCallback = (update: ProgressUpdate) => void;

export interface PncpApiFilters {
 palavrasChave: string[];
 valorMin: number | null;
 valorMax: number | null;
 estado: string | null;
 modalidades: string[];
 dataInicial: string | null;
 dataFinal: string | null;
 blacklist: string[];
}

const PNCP_CONSULTA_API_URL = process.env.PNCP_CONSULTA_API_URL;

export const pncpApi = axios.create({
 baseURL: PNCP_CONSULTA_API_URL,
 headers: { 'Accept': '*/*' },
 timeout: 60000,
});

export function handleApiError(error: unknown, defaultMessage: string): ApiResponse<never> {
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

const modalidadesMap: { [key: string]: number } = {
 "leilão eletrônico": 1, "diálogo competitivo": 2, "concurso": 3,
 "concorrência eletrônica": 4, "concorrência presencial": 5, "pregão eletrônico": 6,
 "pregão presencial": 7, "dispensa de licitação": 8, "inexigibilidade de licitação": 9,
 "manifestação de interesse": 10, "pré-qualificação": 11, "credenciamento": 12,
 "leilão presencial": 13,
};

const ALL_MODALITY_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


async function buscarLicitacoesPorModalidade(
 modalidadeCode: number,
 baseParams: Record<string, unknown>,
 onProgress: ProgressCallback,
 signal: AbortSignal,
 maxRetries = 3
): Promise<PncpLicitacao[]> {
 const endpoint = '/v1/contratacoes/publicacao';
 const licitacoesDaModalidade: PncpLicitacao[] = [];
 let currentPage = 1;
 let totalPages = 1;

 const modalidadeNome = Object.keys(modalidadesMap).find(key => modalidadesMap[key] === modalidadeCode) || `Cód ${modalidadeCode}`;
 onProgress({ type: 'info', message: `Iniciando busca por: ${modalidadeNome}...` });

 while (currentPage <= totalPages) {
  if (signal.aborted) throw new Error('A busca foi abortada pelo usuário.');

  const params = { ...baseParams, codigoModalidadeContratacao: modalidadeCode, pagina: currentPage };
  let attempt = 0;
  let success = false;

  while (attempt < maxRetries && !success) {
   if (signal.aborted) throw new Error('A busca foi abortada pelo usuário.');
   try {
    const response = await pncpApi.get<PncpApiResponse<PncpLicitacao>>(endpoint, { params, signal });
    if (response.data && Array.isArray(response.data.data)) {
     licitacoesDaModalidade.push(...response.data.data);
     if (currentPage === 1) {
      totalPages = response.data.totalPaginas > 0 ? response.data.totalPaginas : 0;
     }
     onProgress({
      type: 'fetching',
      message: `Buscando ${modalidadeNome}`,
      modalidade: modalidadeNome,
      page: currentPage,
      totalPages: totalPages,
      totalResults: response.data.totalRegistros
     });
    }
    success = true;
   } catch (err: unknown) {
    if (axios.isCancel(err)) {
     throw new Error('A busca foi abortada pelo usuário.');
    }
    attempt++;
    const status = (err as AxiosError)?.response?.status;
    console.warn(`  ⚠️  Erro ao buscar modalidade ${modalidadeCode}, página ${currentPage} (tentativa ${attempt}/${maxRetries}, status: ${status || 'N/A'}).`);
    if (attempt >= maxRetries) {
     console.error(`  ❌  Falha final ao buscar modalidade ${modalidadeCode}, página ${currentPage}. Pulando esta página.`);
    } else {
     await delay(1000 * attempt);
    }
   }
  }
  currentPage++;
 }
 return licitacoesDaModalidade;
}

export async function buscarLicitacoesPNCP(
 filters: PncpApiFilters,
 onProgress: ProgressCallback,
 signal: AbortSignal
): Promise<ApiResponse<PncpApiResponse<PncpLicitacao>>> {
 try {
  onProgress({ type: 'info', message: 'Estruturando filtros para a busca...' });
  const baseParams: Record<string, unknown> = { tamanhoPagina: 50 };
  if (filters.dataInicial && filters.dataFinal) {
   let dataInicial = parseISO(filters.dataInicial);
   const dataFinal = parseISO(filters.dataFinal);
   if (differenceInDays(dataFinal, dataInicial) > 365) {
    dataInicial = subDays(dataFinal, 365);
   }
   baseParams.dataInicial = format(dataInicial, 'yyyyMMdd');
   baseParams.dataFinal = format(dataFinal, 'yyyyMMdd');
  } else if (filters.dataInicial) {
   baseParams.dataInicial = format(parseISO(filters.dataInicial), 'yyyyMMdd');
  } else if (filters.dataFinal) {
   baseParams.dataFinal = format(parseISO(filters.dataFinal), 'yyyyMMdd');
  }

  if (filters.estado) baseParams.uf = filters.estado;
  if (filters.valorMin) baseParams.valorMinimo = filters.valorMin;
  if (filters.valorMax) baseParams.valorMaximo = filters.valorMax;


  const cacheKey = JSON.stringify(baseParams);
  const cachedData = getCachedApiResult(cacheKey);
  let allLicitacoes: PncpLicitacao[];

  if (cachedData) {
   allLicitacoes = cachedData;
   onProgress({ type: 'info', message: 'Resultados encontrados no cache da API.' });
  } else {
   const modalidadesCodigos = filters.modalidades && filters.modalidades.length > 0
    ? filters.modalidades.map(modalidadeNome => modalidadesMap[modalidadeNome.toLowerCase().replace(" de licitação", "").trim()]).filter((code): code is number => code !== undefined)
    : ALL_MODALITY_CODES;

   onProgress({ type: 'info', message: `Iniciando busca em ${modalidadesCodigos.length} modalidades...` });
   const promises = modalidadesCodigos.map(modalidadeCode =>
    buscarLicitacoesPorModalidade(modalidadeCode, baseParams, onProgress, signal)
   );

   const resultsFromAllModalities = await Promise.all(promises);
   allLicitacoes = resultsFromAllModalities.flat();

   setCachedApiResult(cacheKey, allLicitacoes);
  }

  if (signal.aborted) throw new Error('A busca foi abortada pelo usuário.');

  onProgress({ type: 'info', message: `Filtrando ${allLicitacoes.length} licitações brutas...` });
  const lowercasedKeywords = filters.palavrasChave.map(k => k.toLowerCase());
  const lowercasedBlacklist = filters.blacklist.map(b => b.toLowerCase());

  const finalResults = allLicitacoes.filter(licitacao => {
   const objeto = licitacao.objetoCompra?.toLowerCase() || '';
   const temKeyword = lowercasedKeywords.length === 0 || lowercasedKeywords.some(kw => objeto.includes(kw));
   const temBlacklist = lowercasedBlacklist.length > 0 && lowercasedBlacklist.some(bl => objeto.includes(bl));
   return temKeyword && !temBlacklist;
  });

  onProgress({ type: 'info', message: `Filtragem concluída. ${finalResults.length} licitações prontas para análise.` });

  return {
   success: true,
   data: {
    data: finalResults,
    totalRegistros: finalResults.length,
    totalPaginas: 1,
    numeroPagina: 1,
    paginasRestantes: 0,
    empty: finalResults.length === 0,
   },
   status: 200,
  };
 } catch (err: unknown) {
  if (err instanceof Error && err.message.includes('abortada')) {
   return { success: false, error: err.message, status: 499 };
  }
  return handleApiError(err, 'Erro geral ao buscar licitações na API PNCP');
 }
}