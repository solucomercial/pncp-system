import { z } from "zod";

const ApiResponseSchema = z.object({
  data: z.array(z.unknown()),
});

export class ComprasApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.PNCP_API_BASE_URL || "https://treina.pncp.gov.br/api/pncp";
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries = 3,
    delay = 2000
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        if (response.status === 404) {
          return response;
        }
        console.warn(`[ComprasApi] Tentativa ${i + 1}/${retries} falhou para ${url} com status ${response.status}`);
      } catch (error) {
        console.warn(`[ComprasApi] Tentativa ${i + 1}/${retries} falhou para ${url} com erro:`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error(`Falha ao buscar dados de ${url} após ${retries} tentativas.`);
  }

  async getLicitacoes(
    data: string,
    pagina: number
  ): Promise<{ data: Record<string, unknown>[] }> {
    const url = `${this.baseUrl}/v1/contratacoes/publicacao?dataInicial=${data}&dataFinal=${data}&pagina=${pagina}&tamanhoPagina=100`;
    
    try {
      const response = await this.fetchWithRetry(url, { method: "GET" });

      if (response.status === 404) {
        console.log(`[ComprasApi] Nenhum dado encontrado (404) para ${data}, página ${pagina}.`);
        return { data: [] };
      }
      
      const json = await response.json();
      const validation = ApiResponseSchema.safeParse(json);
      
      if (!validation.success) {
        console.error("Erro de validação Zod (getLicitacoes):", validation.error.issues);
        throw new Error("Formato de resposta inesperado da API PNCP.");
      }
      return validation.data as { data: Record<string, unknown>[] };
    } catch (error) {
      console.error(`[ComprasApi] Erro ao buscar licitações:`, error);
      throw error;
    }
  }

  async getLicitacaoFiles(
    cnpj: string,
    ano: string,
    sequencial: string
  ): Promise<Record<string, unknown>[]> {
    const url = `${this.baseUrl}/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`;
    
    try {
      const response = await this.fetchWithRetry(url, { method: "GET" });
      
      if (response.status === 404) {
        console.log(`[ComprasApi] Nenhum arquivo encontrado (404) para ${cnpj}/${ano}/${sequencial}.`);
        return [];
      }

      const json: unknown = await response.json();
      if (Array.isArray(json)) {
        return json as Record<string, unknown>[];
      }
      
      return [];
    } catch (error) {
      console.error(`[ComprasApi] Erro ao buscar arquivos da licitação:`, error);
      throw error;
    }
  }
}

export const pncp = new ComprasApi();