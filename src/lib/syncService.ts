import { PrismaClient } from "@prisma/client";
import { subDays, format } from "date-fns";
import { pncpApi } from "./comprasApi";
import { PncpLicitacao } from "./types";
import { z } from "zod";
import { AxiosError } from "axios";
// Importa a função de análise e o tipo de resultado
import { analyzeBidsForStorage, LicitacaoAnalysisResult } from "./analyzeBids"; // <-- IMPORTADO

// Schema Zod para validação (mantido como antes)
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

// Ajusta o timeout padrão da API PNCP se necessário
pncpApi.defaults.timeout = 90000; // 90 segundos

/**
 * Mapeia os dados da licitação (API PNCP) e opcionalmente da análise IA
 * para o formato esperado pelo Prisma.
 * @param licitacao - Dados da licitação vindos da API PNCP.
 * @param analysis - Resultado opcional da análise da IA para esta licitação.
 * @returns Objeto formatado para inserção/atualização no Prisma.
 */
function mapLicitacaoToPrisma(licitacao: PncpLicitacao, analysis?: LicitacaoAnalysisResult) {
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
        // --- Adiciona os campos da IA ---
        relevanciaIA: analysis?.relevancia ?? null, // Usa o resultado da análise se disponível, senão null
        justificativaIA: analysis?.justificativa ?? null, // Usa o resultado da análise se disponível, senão null
    };
}

/**
 * Busca licitações publicadas numa data específica na API do PNCP,
 * iterando por todas as modalidades e páginas.
 * @param data - A data para a qual buscar as licitações.
 * @returns Um array com as licitações encontradas e validadas.
 */
async function fetchLicitacoesFromPNCP(data: Date): Promise<PncpLicitacao[]> {
    console.log(`[SyncService] A procurar licitações para a data: ${format(data, "yyyy-MM-dd")}`);
    const dataFormatada = format(data, "yyyyMMdd");
    const todasLicitacoes: PncpLicitacao[] = [];

    for (const modalidade of ALL_MODALITY_CODES) {
        let pagina = 1;
        let totalPaginas = 1;

        while (pagina <= totalPaginas) {
            let sucesso = false;
            let tentativas = 0;
            const maxTentativas = 4; // Número de retentativas em caso de erro da API

            while (!sucesso && tentativas < maxTentativas) {
                try {
                    const params = {
                        dataInicial: dataFormatada,
                        dataFinal: dataFormatada,
                        codigoModalidadeContratacao: modalidade,
                        pagina: pagina,
                        tamanhoPagina: 50, // Tamanho da página da API PNCP
                    };

                    const response = await pncpApi.get("/v1/contratacoes/publicacao", { params }); //

                    if (response.data && response.data.data) {
                        const rawData = response.data.data;
                        // Valida os dados recebidos com o schema Zod (permite campos parciais)
                        const validationResult = z.array(PncpLicitacaoSchema.partial()).safeParse(rawData);

                        if (validationResult.success) {
                            // Adiciona apenas os dados válidos ao array
                            todasLicitacoes.push(...validationResult.data as PncpLicitacao[]);
                        } else {
                            console.warn(`[SyncService] DADOS INVÁLIDOS da API para Modalidade ${modalidade}, Página ${pagina}. Erros de validação:`, validationResult.error.flatten());
                        }

                        // Atualiza o total de páginas na primeira iteração
                        if (pagina === 1) {
                            totalPaginas = response.data.totalPaginas || 1;
                        }
                        console.log(`[SyncService] Modalidade ${modalidade}: Página ${pagina}/${totalPaginas} carregada.`);
                    }
                    sucesso = true; // Marca como sucesso se a requisição foi bem-sucedida

                } catch (error) {
                    tentativas++;
                    const axiosError = error as AxiosError;
                    console.error(`[SyncService] Erro ao buscar Modalidade ${modalidade}, Página ${pagina} (tentativa ${tentativas}/${maxTentativas}). Código: ${axiosError.code}`);
                    if (tentativas >= maxTentativas) {
                        console.error(`[SyncService] FALHA FINAL ao buscar Modalidade ${modalidade}, Página ${pagina}. A saltar para a próxima página.`);
                        // Não marca sucesso, sai do loop de tentativas
                    } else {
                        // Espera exponencialmente antes de tentar novamente
                        const tempoEspera = 5000 * tentativas;
                        console.log(`[SyncService] A aguardar ${tempoEspera / 1000}s para tentar novamente...`);
                        await new Promise(resolve => setTimeout(resolve, tempoEspera));
                    }
                }
            } // Fim do loop de tentativas
            pagina++;
            await new Promise(resolve => setTimeout(resolve, 500)); // Pequena pausa entre páginas
        } // Fim do loop de páginas
    } // Fim do loop de modalidades

    console.log(`[SyncService] Total de ${todasLicitacoes.length} licitações válidas encontradas para ${format(data, "yyyy-MM-dd")}.`);
    return todasLicitacoes;
}

/**
 * Insere ou atualiza (upsert) as licitações na base de dados,
 * incluindo os resultados da análise de IA.
 * @param licitacoes - Array de licitações procuradas da API.
 * @param analysisResults - Array correspondente com os resultados da análise IA.
 * @returns Contagem de registos criados e atualizados (atualmente simplificado).
 */
async function upsertLicitacoes(
    licitacoes: PncpLicitacao[],
    analysisResults: LicitacaoAnalysisResult[] // <-- Recebe os resultados da análise
) {
    if (licitacoes.length === 0) {
        console.log("[SyncService] Nenhuma licitação para guardar.");
        return { created: 0, updated: 0 };
    }

    // Cria um mapa para acesso rápido aos resultados da análise por ID (numeroControlePNCP)
    const analysisMap = new Map(analysisResults.map(a => [a.numeroControlePNCP, a]));

    console.log(`[SyncService] A guardar/atualizar ${licitacoes.length} licitações (com análise IA) na base de dados...`);
    let updatedCount = 0; // Usaremos para contar o total de operações bem-sucedidas

    // Mapeia cada licitação para uma promessa de operação upsert
    const transacoes = licitacoes.map(async (lic) => {
        try {
            // Obtém a análise correspondente do mapa
            const analysis = analysisMap.get(lic.numeroControlePNCP);
            // Mapeia os dados da licitação e da análise para o formato do Prisma
            const data = mapLicitacaoToPrisma(lic, analysis); // <-- Passa a análise para o mapeamento
            // Executa a operação upsert na base de dados
            await prisma.licitacao.upsert({
                where: { numeroControlePNCP: lic.numeroControlePNCP }, // Chave única para encontrar ou criar
                update: data, // Dados para atualizar se encontrado
                create: data, // Dados para criar se não encontrado
            });
        } catch (error) {
            // Loga erro caso uma operação específica falhe, mas continua as outras
            console.error(`[SyncService] Falha ao guardar licitação ${lic.numeroControlePNCP}. A saltar. Erro:`, error);
        }
    });

    // Aguarda todas as operações upsert serem concluídas
    await Promise.all(transacoes);
    // Assume que todas as licitações foram processadas (simplificação)
    updatedCount = licitacoes.length;

    console.log("[SyncService] Dados guardados com sucesso.");
    // Retorna a contagem (simplificada, created não é rastreado facilmente com upsert em lote)
    return { created: 0, updated: updatedCount };
}

/**
 * Remove licitações antigas da base de dados (publicadas há mais de 90 dias).
 */
async function cleanupOldLicitacoes() {
    const dataLimite = subDays(new Date(), 90); // Define a data limite (90 dias atrás)
    console.log(`[SyncService] A remover licitações publicadas antes de ${format(dataLimite, "yyyy-MM-dd")}`);

    // Executa a exclusão em massa na base de dados
    const result = await prisma.licitacao.deleteMany({
        where: {
            dataPublicacaoPncp: {
                lt: dataLimite, // 'lt' significa 'less than' (menor que)
            },
        },
    });

    console.log(`[SyncService] ${result.count} licitações antigas removidas.`);
}

/**
 * Função principal que orquestra o processo de sincronização e análise.
 * Busca dados do PNCP, analisa com IA e guarda na base de dados.
 * @param isInitialLoad - Flag para indicar se é a carga inicial (busca 30 dias) ou diária (busca 1 dia).
 * @returns Objeto indicando sucesso ou falha da operação.
 */
export async function runSync(isInitialLoad: boolean = false) {
    console.log(`--- [SyncService] A INICIAR SINCRONIZAÇÃO (${isInitialLoad ? 'CARGA INICIAL' : 'DIÁRIA'}) ---`);
    let totalCriado = 0; // Contadores (simplificados)
    let totalAtualizado = 0;

    // Função interna para processar uma data específica (busca + análise + guardar)
    const processDate = async (targetDate: Date) => {
        let licitacoesDoDia: PncpLicitacao[] = [];
        let analysisDoDia: LicitacaoAnalysisResult[] = [];
        try {
            // 1. Busca licitações da API PNCP
            licitacoesDoDia = await fetchLicitacoesFromPNCP(targetDate);

            // Só prossegue para análise se houver licitações
            if (licitacoesDoDia.length > 0) {
                 // Prepara dados simplificados (ID e objeto) para a análise da IA
                 const simplifiedBids = licitacoesDoDia.map(lic => ({
                     numeroControlePNCP: lic.numeroControlePNCP,
                     objetoCompra: lic.objetoCompra,
                 }));

                 // 2. Chama a análise da IA
                 console.log(`[SyncService] A iniciar análise da IA para ${simplifiedBids.length} licitações de ${format(targetDate, 'dd/MM/yyyy')}...`);
                 analysisDoDia = await analyzeBidsForStorage(simplifiedBids, (message) => console.log(`[SyncService IA] ${message}`)); // Passa callback para logs
                 console.log(`[SyncService] Análise da IA concluída.`);
            } else {
                console.log(`[SyncService] Nenhuma licitação encontrada para ${format(targetDate, 'dd/MM/yyyy')}, a saltar análise IA.`);
            }

            // 3. Guarda na base de dados COM os resultados da análise
            const { created, updated } = await upsertLicitacoes(licitacoesDoDia, analysisDoDia); // <-- Passa analysisDoDia
            totalCriado += created; // Acumula contadores
            totalAtualizado += updated;

        } catch (error) {
            console.error(`[SyncService] Erro crítico ao processar/analisar a data ${format(targetDate, 'dd/MM/yyyy')}.`, error);
            // Decide se quer parar a sincronização ou continuar para o próximo dia
            // Lançar o erro aqui pararia o processo, útil para a sincronização diária
            if (!isInitialLoad) throw error; // Interrompe se for a sincronização diária
        }
    }; // Fim da função processDate

    // Lógica para carga inicial (30 dias) ou diária (1 dia)
    if (isInitialLoad) {
        console.log("[SyncService] A executar carga inicial dos últimos 30 dias com análise IA.");
        for (let i = 0; i < 30; i++) { // Loop pelos últimos 30 dias
            const targetDate = subDays(new Date(), i);
            console.log(`\n--- A processar dia ${i + 1}/30: ${format(targetDate, 'dd/MM/yyyy')} ---`);
            try {
                await processDate(targetDate); // Chama a função que processa e analisa
            } catch (error) {
                 // Na carga inicial, apenas loga o erro e continua para o próximo dia
                 console.error(`[SyncService] Erro no dia ${format(targetDate, 'dd/MM/yyyy')} da carga inicial. A continuar...`)
            }
        }
    } else {
         console.log("[SyncService] A executar busca diária com análise IA.");
        try {
            const ontem = subDays(new Date(), 1); // Pega a data de ontem
            await processDate(ontem); // Chama a função que processa e analisa
        } catch (error) {
            // Se processDate lançar erro na sincronização diária, loga e retorna falha
            console.error("[SyncService] Erro crítico durante a busca/análise diária.", error);
            await prisma.$disconnect(); // Garante desconexão em caso de erro
            return { success: false, message: "Erro na sincronização/análise diária." };
        }
    }

    // 4. Limpa dados antigos (após processar todas as datas)
    try {
        await cleanupOldLicitacoes();
    } catch (error) {
        console.error("[SyncService] Erro durante a limpeza de dados antigos.", error);
        // Geralmente não impede a conclusão da sincronização, apenas loga
    }

    // 5. Guarda log da sincronização na base de dados
    try {
        await prisma.syncLog.create({
            data: {
                createdCount: 0, // Simplificado
                updatedCount: totalAtualizado,
            }
        });
    } catch (error) {
        console.error("[SyncService] Erro ao guardar log de sincronização.", error);
    }

    console.log("--- [SyncService] SINCRONIZAÇÃO E ANÁLISE CONCLUÍDAS ---");
    await prisma.$disconnect(); // Desconecta da base de dados ao final
    return { success: true, message: "Sincronização e análise concluídas." };
}