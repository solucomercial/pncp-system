// src/lib/types.ts
export interface OrgaoCompras {
 nomeOrgaoEntidade: string;
 nomeUnidadeOrgao: string;
 cidade: string;
 uf: string;
}

export interface DocumentoCompras {
 filename: string;
 url: string;
}

export interface ComprasLicitacao {
 idCompra: string;
 numeroControlePNCP: string;
 anoCompraPncp: number;
 sequencialCompraPncp: number;
 orgaoEntidadeCnpj: string;
 orgaoEntidadeRazaoSocial: string;
 unidadeOrgaoCodigoUnidade: string;
 unidadeOrgaoNomeUnidade: string;
 unidadeOrgaoUfSigla: string;
 unidadeOrgaoMunicipioNome: string;
 numeroCompra: string;
 modalidadeIdPncp: number;
 modalidadeNome: string;
 objetoCompra: string;
 situacaoCompraNomePncp: string;
 valorTotalEstimado?: number;
 valorTotalHomologado?: number;
 dataPublicacaoPncp: string;
 dataAberturaPropostaPncp?: string;
 dataEncerramentoPropostaPncp?: string;
 processo?: string;
 informacaoComplementar?: string;
}

// Nova interface para contratos, baseada no schema VwFtContrato da documentação
export interface VwFtContrato {
 idCompra: string; // Corresponde ao identificador da compra
 identificador: string;
 numero_processo: string;
 uasg: number;
 modalidade: number; // Código da modalidade
 nome_modalidade: string;
 numero_aviso: number;
 situacao_aviso: string;
 tipo_pregao: string | null;
 tipo_recurso: string | null;
 nome_responsavel: string | null;
 funcao_responsavel: string | null;
 numero_itens: number;
 valor_estimado_total: number;
 valor_homologado_total: number;
 informacoes_gerais: string | null;
 objeto: string; // Objeto do contrato
 endereco_entrega_edital: string | null;
 codigo_municipio_uasg: number | null;
 data_abertura_proposta: string; // Data de abertura de proposta
 data_entrega_edital: string;
 data_entrega_proposta: string;
 data_publicacao: string; // Data de publicação
 dt_alteracao: string;
 pertence14133: boolean;
 // Campos adicionais do exemplo curl
 codigoOrgao?: string;
 nomeOrgao?: string;
 codigoUnidadeGestora?: string;
 nomeUnidadeGestora?: string;
 codigoUnidadeGestoraOrigemContrato?: string;
 nomeUnidadeGestoraOrigemContrato?: string;
 receitaDespesa?: string;
 numeroContrato?: string;
 codigoUnidadeRealizadoraCompra?: string;
 nomeUnidadeRealizadoraCompra?: string;
 numeroCompra?: string;
 codigoModalidadeCompra?: string; // String no exemplo curl, manter para compatibilidade
 codigoTipo?: string;
 nomeTipo?: string;
 codigoCategoria?: string;
 nomeCategoria?: string;
 codigoSubcategoria?: string;
 nomeSubcategoria?: string;
 niFornecedor?: string;
 nomeRazaoSocialFornecedor?: string;
 processo?: string;
 dataVigenciaInicial?: string; // Data de vigência inicial
 dataVigenciaFinal?: string;   // Data de vigência final
 valorGlobal?: number;         // Valor global
 numeroParcelas?: number;
 valorParcela?: number;
 valorAcumulado?: number;
 totalDespesasAcessorias?: number;
 dataHoraInclusao?: string;
 numeroControlePncpContrato?: string;
 dataHoraExclusao?: string;
 contratoExcluido?: boolean;
 unidadesRequisitantes?: string;
}

export interface ApiResponse<T = unknown> {
 success: boolean;
 data?: T;
 error?: string;
 status?: number;
}

export interface ComprasApiResponse {
 resultado: ComprasLicitacao[]; // Esta interface ainda será usada, mas para outro endpoint
 totalRegistros: number;
 totalPaginas: number;
 paginasRestantes: number;
}

// Nova interface para a resposta da API de contratos
export interface ContratosApiResponse {
 resultado: VwFtContrato[];
 totalRegistros: number;
 totalPaginas: number;
 paginasRestantes: number;
}