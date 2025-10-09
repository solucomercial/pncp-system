import { PrismaClient } from "@prisma/client";
import { subDays, format } from "date-fns";
import { pncpApi } from "./comprasApi";
import { PncpLicitacao } from "./types";
import { z } from "zod";
import { AxiosError } from "axios";

const PncpLicitacaoSchema = z.object({
    numeroControlePNCP: z.string(),
    numeroCompra: z.string(),
    anoCompra: z.number(),
    processo: z.string().nullable().optional(),
    modalidadeNome: z.string(),
    modoDisputaNome: z.string().nullable().optional(),
    situacaoCompraNome: z.string(),
    objetoCompra: z.string(),
    informacaoComplementar: z.string().nullable().optional(),
    valorTotalEstimado: z.number().nullable().optional(),
    valorTotalHomologado: z.number().nullable().optional(),
    dataAberturaProposta: z.string().nullable().optional(),
    dataEncerramentoProposta: z.string().nullable().optional(),
    dataPublicacaoPncp: z.string(),
    dataInclusao: z.string(),
    dataAtualizacao: z.string(),
    dataAtualizacaoGlobal: z.string().nullable().optional(),
    srp: z.boolean(),
    amparoLegal: z.object({ nome: z.string() }).nullable().optional(),
    sequencialCompra: z.number(),
    tipoInstrumentoConvocatorioNome: z.string(),
    justificativaPresencial: z.string().nullable().optional(),
    linkSistemaOrigem: z.string().nullable().optional(),
    linkProcessoEletronico: z.string().nullable().optional(),
    orgaoEntidade: z.object({
        cnpj: z.string(),
        razaoSocial: z.string(),
    }),
    unidadeOrgao: z.object({
        codigoUnidade: z.string(),
        nomeUnidade: z.string(),
        municipioNome: z.string(),
        ufSigla: z.string(),
    }),
});

const prisma = new PrismaClient();
const ALL_MODALITY_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

pncpApi.defaults.timeout = 90000;

function mapLicitacaoToPrisma(licitacao: PncpLicitacao) {
    // Definindo um tipo para a licitação com possíveis campos extras
    type LicitacaoComExtras = PncpLicitacao & { [key: string]: unknown };

    const licitacaoComExtras = licitacao as LicitacaoComExtras;

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
        sequencialCompra: licitacao.sequencialCompra,
        tipoInstrumentoConvocatorioNome: licitacao.tipoInstrumentoConvocatorioNome,
        justificativaPresencial: licitacao.justificativaPresencial,
        linkProcessoEletronico: typeof licitacaoComExtras.linkProcessoEletronico === 'string' ? licitacaoComExtras.linkProcessoEletronico : null,
        dataAtualizacaoGlobal: licitacaoComExtras.dataAtualizacaoGlobal ? new Date(licitacaoComExtras.dataAtualizacaoGlobal as string) : null,
    };
}

async function fetchLicitacoesFromPNCP(data: Date): Promise<PncpLicitacao[]> {
    console.log(`[SyncService] Buscando licitações para a data: ${format(data, "yyyy-MM-dd")}`);
    const dataFormatada = format(data, "yyyyMMdd");
    const todasLicitacoes: PncpLicitacao[] = []; // Corrigido para const

    for (const modalidade of ALL_MODALITY_CODES) {
        let pagina = 1;
        let totalPaginas = 1;

        while (pagina <= totalPaginas) {
            let sucesso = false;
            let tentativas = 0;
            const maxTentativas = 4;

            while (!sucesso && tentativas < maxTentativas) {
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
                        const rawData = response.data.data;
                        const validationResult = z.array(PncpLicitacaoSchema.partial()).safeParse(rawData);

                        if (validationResult.success) {
                            todasLicitacoes.push(...validationResult.data as PncpLicitacao[]);
                        } else {
                            console.warn(`[SyncService] DADOS INVÁLIDOS da API para Modalidade ${modalidade}, Página ${pagina}. Erros de validação:`, validationResult.error.flatten());
                        }

                        if (pagina === 1) {
                            totalPaginas = response.data.totalPaginas || 1;
                        }
                        console.log(`[SyncService] Modalidade ${modalidade}: Página ${pagina}/${totalPaginas} carregada.`);
                    }
                    sucesso = true;

                } catch (error) {
                    tentativas++;
                    const axiosError = error as AxiosError;
                    console.error(`[SyncService] Erro ao buscar Modalidade ${modalidade}, Página ${pagina} (tentativa ${tentativas}/${maxTentativas}). Código: ${axiosError.code}`);
                    if (tentativas >= maxTentativas) {
                        console.error(`[SyncService] FALHA FINAL ao buscar Modalidade ${modalidade}, Página ${pagina}. Pulando para a próxima página.`);
                    } else {
                        const tempoEspera = 5000 * tentativas;
                        console.log(`[SyncService] Aguardando ${tempoEspera / 1000}s para tentar novamente...`);
                        await new Promise(resolve => setTimeout(resolve, tempoEspera));
                    }
                }
            }
            pagina++;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`[SyncService] Total de ${todasLicitacoes.length} licitações válidas encontradas para ${format(data, "yyyy-MM-dd")}.`);
    return todasLicitacoes;
}


async function upsertLicitacoes(licitacoes: PncpLicitacao[]) {
    if (licitacoes.length === 0) {
        console.log("[SyncService] Nenhuma licitação para salvar.");
        return { created: 0, updated: 0 };
    }

    console.log(`[SyncService] Salvando/Atualizando ${licitacoes.length} licitações no banco de dados...`);
    const createdCount = 0; // Corrigido para const
    let updatedCount = 0;

    const transacoes = licitacoes.map(async (lic) => {
        try {
            const data = mapLicitacaoToPrisma(lic);
            await prisma.licitacao.upsert({
                where: { numeroControlePNCP: lic.numeroControlePNCP },
                update: data,
                create: data,
            });
        } catch (error) {
            console.error(`[SyncService] Falha ao salvar licitação ${lic.numeroControlePNCP}. Pulando. Erro:`, error);
        }
    });

    await Promise.all(transacoes);
    updatedCount = licitacoes.length;

    console.log("[SyncService] Dados salvos com sucesso.");
    return { created: createdCount, updated: updatedCount };
}

async function cleanupOldLicitacoes() {
    const dataLimite = subDays(new Date(), 90);
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

export async function runSync(isInitialLoad: boolean = false) {
    console.log(`--- [SyncService] INICIANDO SINCRONIZAÇÃO (${isInitialLoad ? 'CARGA INICIAL' : 'DIÁRIA'}) ---`);
    let totalCriado = 0;
    let totalAtualizado = 0;

    if (isInitialLoad) {
        console.log("[SyncService] Executando carga inicial dos últimos 30 dias.");
        for (let i = 0; i < 30; i++) {
            const targetDate = subDays(new Date(), i);
            try {
                console.log(`\n--- Processando dia ${i + 1}/30: ${format(targetDate, 'dd/MM/yyyy')} ---`);
                const licitacoesDoDia = await fetchLicitacoesFromPNCP(targetDate);
                const { created, updated } = await upsertLicitacoes(licitacoesDoDia);
                totalCriado += created;
                totalAtualizado += updated;
            } catch (error) {
                console.error(`[SyncService] Erro crítico ao processar a data ${format(targetDate, 'dd/MM/yyyy')}. Continuando para o próximo dia.`, error);
            }
        }
    } else {
        try {
            const ontem = subDays(new Date(), 1);
            const licitacoesDoDia = await fetchLicitacoesFromPNCP(ontem);
            const { created, updated } = await upsertLicitacoes(licitacoesDoDia);
            totalCriado = created;
            totalAtualizado = updated;
        } catch (error) {
            console.error("[SyncService] Erro crítico durante a busca diária.", error);
            return { success: false, message: "Erro na sincronização diária." };
        }
    }

    try {
        await cleanupOldLicitacoes();
    } catch (error) {
        console.error("[SyncService] Erro crítico durante a limpeza de dados antigos.", error);
    }
    
    try {
        await prisma.syncLog.create({
            data: {
                createdCount: totalCriado,
                updatedCount: totalAtualizado,
            }
        });
    } catch (error) {
        console.error("[SyncService] Erro ao salvar log de sincronização.", error);
    }

    console.log("--- [SyncService] SINCRONIZAÇÃO CONCLUÍDA ---");
    await prisma.$disconnect();
    return { success: true, message: "Sincronização concluída." };
}