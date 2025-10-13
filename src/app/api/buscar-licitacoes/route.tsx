import { NextResponse } from 'next/server';
import { PrismaClient, Prisma, Licitacao } from '@prisma/client';
import { analyzeAndFilterBids } from '@/lib/analyzeBids';
import { Filters } from '@/components/FilterSheet';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PncpLicitacao } from '@/lib/types';

const prisma = new PrismaClient();

function mapPrismaToPncp(licitacao: Licitacao): PncpLicitacao {
  return {
    numeroControlePNCP: licitacao.numeroControlePNCP,
    numeroCompra: licitacao.numeroCompra,
    anoCompra: licitacao.anoCompra,
    situacaoCompraNome: licitacao.situacaoCompraNome,
    objetoCompra: licitacao.objetoCompra,
    srp: licitacao.srp,
    sequencialCompra: licitacao.sequencialCompra ?? 0,
    tipoInstrumentoConvocatorioNome: licitacao.tipoInstrumentoConvocatorioNome ?? '',
    modalidadeNome: licitacao.modalidadeNome,
    processo: licitacao.processo ?? undefined,
    informacaoComplementar: licitacao.informacaoComplementar ?? undefined,
    modoDisputaNome: licitacao.modoDisputaNome ?? '',
    valorTotalEstimado: licitacao.valorTotalEstimado ?? undefined,
    valorTotalHomologado: licitacao.valorTotalHomologado ?? undefined,
    dataAberturaProposta: licitacao.dataAberturaProposta?.toISOString(),
    dataEncerramentoProposta: licitacao.dataEncerramentoProposta?.toISOString(),
    dataPublicacaoPncp: licitacao.dataPublicacaoPncp.toISOString(),
    dataInclusao: licitacao.dataInclusao.toISOString(),
    dataAtualizacao: licitacao.dataAtualizacao.toISOString(),
    linkSistemaOrigem: licitacao.linkSistemaOrigem ?? undefined,
    razaoSocialOrgaoEntidade: licitacao.razaoSocialOrgaoEntidade, // <-- Correção aqui
    amparoLegal: licitacao.amparoLegalNome
      ? { codigo: 0, nome: licitacao.amparoLegalNome, descricao: '' }
      : undefined,
    orgaoEntidade: {
      cnpj: licitacao.cnpjOrgaoEntidade,
      razaoSocial: licitacao.razaoSocialOrgaoEntidade,
      poderId: '',
      esferaId: '',
    },
    unidadeOrgao: {
      codigoUnidade: licitacao.codigoUnidadeOrgao,
      nomeUnidade: licitacao.nomeUnidadeOrgao,
      municipioNome: licitacao.municipioNomeUnidadeOrgao,
      ufSigla: licitacao.ufSiglaUnidadeOrgao,
      ufNome: '',
      codigoIbge: 0,
    },
    tipoInstrumentoConvocatorioId: 0,
    modalidadeId: 0,
    modoDisputaId: 0,
    situacaoCompraId: 0,
  };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  try {
    const body: { filters: Filters } = await request.json();
    const { filters } = body;
    const useGeminiAnalysis = filters.useGeminiAnalysis !== false;

    const where: Prisma.LicitacaoWhereInput = {};
    const andConditions: Prisma.LicitacaoWhereInput[] = [];

    if (filters.dateRange?.from) {
        const fromDate = new Date(filters.dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        andConditions.push({ dataPublicacaoPncp: { gte: fromDate } });
    }
    if (filters.dateRange?.to) {
        const toDate = new Date(filters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        andConditions.push({ dataPublicacaoPncp: { lte: toDate } });
    }
    if (filters.estado) {
        andConditions.push({ ufSiglaUnidadeOrgao: filters.estado });
    }
    if (filters.modalidades && filters.modalidades.length > 0) {
        andConditions.push({ modalidadeNome: { in: filters.modalidades, mode: 'insensitive' } });
    }
    if (filters.valorMin) {
        andConditions.push({ valorTotalEstimado: { gte: parseFloat(filters.valorMin) } });
    }
    if (filters.valorMax) {
        andConditions.push({ valorTotalEstimado: { lte: parseFloat(filters.valorMax) } });
    }
    if (filters.palavrasChave && filters.palavrasChave.length > 0) {
      const keywordConditions = filters.palavrasChave.map(kw => ({
        objetoCompra: {
          contains: kw,
          mode: 'insensitive' as const,
        },
      }));
      andConditions.push({ OR: keywordConditions });
    }
    if (filters.blacklist && filters.blacklist.length > 0) {
        where.NOT = filters.blacklist.map(term => ({
            objetoCompra: {
                contains: term,
                mode: 'insensitive',
            },
        }));
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const licitacoesBrutasDoDB = await prisma.licitacao.findMany({
      where,
      orderBy: {
        dataPublicacaoPncp: 'desc',
      },
      take: 20000,
    });

    const licitacoesBrutas = licitacoesBrutasDoDB.map(mapPrismaToPncp);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueue = (data: object) => controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));

        try {
          if (licitacoesBrutas.length === 0) {
            enqueue({ type: 'result', resultados: [], totalBruto: 0, totalFinal: 0 });
            // A linha controller.close() foi removida daqui
            return;
          }

          if (useGeminiAnalysis) {
            const licitacoesViaveis = await analyzeAndFilterBids(licitacoesBrutas, (progressUpdate) => {
              enqueue(progressUpdate);
            });
            enqueue({ type: 'result', resultados: licitacoesViaveis, totalBruto: licitacoesBrutas.length, totalFinal: licitacoesViaveis.length });
          } else {
            enqueue({ type: 'result', resultados: licitacoesBrutas, totalBruto: licitacoesBrutas.length, totalFinal: licitacoesBrutas.length });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
          console.error("❌ Erro no stream da API:", error);
          enqueue({ type: 'error', message: errorMessage });
        } finally {
          // Esta é a única chamada a controller.close(), garantindo que só aconteça uma vez.
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("❌ Erro crítico na rota /api/buscar-licitacoes:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}