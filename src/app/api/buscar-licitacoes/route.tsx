import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { analyzeAndFilterBids } from '@/lib/analyzeBids';
import { Filters } from '@/components/FilterSheet';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PncpLicitacao } from '@/lib/types';

const prisma = new PrismaClient();

function mapPrismaToPncp(licitacao: any): PncpLicitacao {
  return {
    ...licitacao,
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
    // Adicione valores padrão para outros campos obrigatórios que não estão no seu schema
    tipoInstrumentoConvocatorioId: 0,
    tipoInstrumentoConvocatorioNome: '',
    modalidadeId: 0,
    modoDisputaId: 0,
    situacaoCompraId: 0,
    srp: false,
    sequencialCompra: 0,
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

    // 1. Construir a query do Prisma dinamicamente com base nos filtros
    const where: Prisma.LicitacaoWhereInput = {
      AND: [],
    };

    if (filters.dateRange?.from) {
      where.AND.push({ dataPublicacaoPncp: { gte: new Date(filters.dateRange.from) } });
    }
    if (filters.dateRange?.to) {
      where.AND.push({ dataPublicacaoPncp: { lte: new Date(filters.dateRange.to) } });
    }
    if (filters.estado) {
      where.AND.push({ ufSiglaUnidadeOrgao: filters.estado });
    }
    if (filters.modalidades && filters.modalidades.length > 0) {
      where.AND.push({ modalidadeNome: { in: filters.modalidades, mode: 'insensitive' } });
    }
    if (filters.valorMin) {
      where.AND.push({ valorTotalEstimado: { gte: parseFloat(filters.valorMin) } });
    }
    if (filters.valorMax) {
      where.AND.push({ valorTotalEstimado: { lte: parseFloat(filters.valorMax) } });
    }
    if (filters.palavrasChave && filters.palavrasChave.length > 0) {
      where.AND.push({
        objetoCompra: {
          contains: filters.palavrasChave.join(' & '), // Busca por palavras-chave no objeto
          mode: 'insensitive',
        },
      });
    }
    if (filters.blacklist && filters.blacklist.length > 0) {
      where.NOT = filters.blacklist.map(term => ({
        objetoCompra: {
          contains: term,
          mode: 'insensitive',
        },
      }));
    }

    // 2. Executar a busca no banco de dados
    const licitacoesBrutasDoDB = await prisma.licitacao.findMany({
      where,
      orderBy: {
        dataPublicacaoPncp: 'desc',
      },
    });

    const licitacoesBrutas = licitacoesBrutasDoDB.map(mapPrismaToPncp);

    // O streaming agora é usado apenas para a análise do Gemini
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueue = (data: object) => controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));

        try {
          if (licitacoesBrutas.length === 0) {
            enqueue({ type: 'result', resultados: [], totalBruto: 0, totalFinal: 0 });
            controller.close();
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