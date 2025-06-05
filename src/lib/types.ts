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
 // adicione outros campos relevantes do boletim aqui
}

export interface BoletimResponse {
 boletins: BoletimResumo[];
 // adicione outros campos de resposta se existirem
}

export interface ApiResponse<T = unknown> {
 success: boolean;
 data?: T;
 error?: string;
 status?: number;
}