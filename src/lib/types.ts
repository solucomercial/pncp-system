// src/lib/types.ts
export interface Orgao {
 nome: string;
 cidade: string;
 uf: string;
}

export interface Documento {
 filename: string;
 url: string;
}

export interface BoletimInfo {
 id: number;
 data: string;
}

export interface LicitacaoComBoletim {
 id: number;
 orgao?: Orgao;
 objeto?: string;
 situacao?: string;
 datahora_abertura?: string;
 datahora_prazo?: string;
 edital?: string;
 documento?: Documento[];
 processo?: string;
 observacao?: string;
 valor_estimado?: number;
 boletimInfo: BoletimInfo;
}

export interface FiltroConlicitacao {
 id: number;
 descricao: string;
 ultimo_boletim?: {
  id: number;
  datahora_fechamento?: string;
  numero_edital?: string;
 };
}

export interface FiltrosClienteResponse {
 filtros: FiltroConlicitacao[];
}

export interface BoletimResumo {
 id: number;
 datahora_fechamento: string;
}

export interface BoletimResponse {
 boletins: BoletimResumo[];
}

export interface DetalhesBoletimResponse {
 boletim: {
  id: number;
  datahora_fechamento: string;
 };
 licitacoes: LicitacaoComBoletim[];
}

export interface ApiResponse<T = unknown> {
 success: boolean;
 data?: T;
 error?: string;
 status?: number;
}