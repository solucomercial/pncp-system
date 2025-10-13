// src/lib/types.ts

export interface PncpLicitacao {
  numeroControlePNCP: string;
  numeroCompra: string;
  anoCompra: number;
  processo?: string;
  tipoInstrumentoConvocatorioId: number;
  tipoInstrumentoConvocatorioNome: string;
  modalidadeId: number;
  modalidadeNome: string;
  modoDisputaId: number;
  modoDisputaNome: string;
  situacaoCompraId: number;
  situacaoCompraNome: string;
  objetoCompra: string;
  informacaoComplementar?: string;
  razaoSocialOrgaoEntidade: string;
  srp: boolean;
  amparoLegal?: {
    codigo: number;
    nome: string;
    descricao: string;
  };
  valorTotalEstimado?: number;
  valorTotalHomologado?: number;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  dataPublicacaoPncp: string;
  dataInclusao: string;
  dataAtualizacao: string;
  sequencialCompra: number;
  orgaoEntidade: {
    cnpj: string;
    razaoSocial: string;
    poderId: string;
    esferaId: string;
  };
  unidadeOrgao: {
    codigoUnidade: string;
    nomeUnidade: string;
    codigoIbge: number;
    municipioNome: string;
    ufSigla: string;
    ufNome: string;
  };
  usuarioNome?: string;
  linkSistemaOrigem?: string;
  justificativaPresencial?: string;
  linkProcessoEletronico?: string;
  dataAtualizacaoGlobal?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface PncpApiResponse<T> {
  data: T[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}