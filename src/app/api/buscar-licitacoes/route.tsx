import { NextResponse } from 'next/server';
import { buscarLicitacoesPNCP, ProgressUpdate } from '@/lib/comprasApi';
import { analyzeAndFilterBids } from '@/lib/analyzeBids';
import { Filters } from '@/components/FilterSheet';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

interface RequestBody {
  filters: Filters;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => {
    abortController.abort();
  });

  try {
    const body: RequestBody = await request.json();
    const { filters } = body;
    const useGeminiAnalysis = filters.useGeminiAnalysis !== false;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueue = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
          } catch (e) {
            console.error('Erro ao enfileirar dados no stream:', e);
          }
        };

        const onApiProgress = (update: ProgressUpdate) => {
          enqueue(update);
        };

        try {
          const mappedFilters = {
            palavrasChave: filters.palavrasChave,
            valorMin: filters.valorMin ? parseFloat(filters.valorMin) : null,
            valorMax: filters.valorMax ? parseFloat(filters.valorMax) : null,
            estado: filters.estado,
            modalidades: filters.modalidades,
            dataInicial: filters.dateRange?.from ? new Date(filters.dateRange.from).toISOString() : null,
            dataFinal: filters.dateRange?.to ? new Date(filters.dateRange.to).toISOString() : null,
            blacklist: filters.blacklist,
          };

          enqueue({ type: 'info', message: 'Iniciando busca no PNCP...' });
          const licitacoesResponse = await buscarLicitacoesPNCP(mappedFilters, onApiProgress, abortController.signal);

          if (abortController.signal.aborted) {
            enqueue({ type: 'info', message: 'Busca cancelada.' });
            return;
          }

          if (!licitacoesResponse.success || !licitacoesResponse.data?.data) {
            throw new Error(licitacoesResponse.error || 'Falha ao buscar licitações no PNCP');
          }

          const licitacoesBrutas = licitacoesResponse.data.data;

          if (licitacoesBrutas.length === 0) {
            enqueue({ type: 'result', resultados: [], totalBruto: 0, totalFinal: 0 });
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
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
          console.error("❌ Erro no stream da API:", error);
          if (!abortController.signal.aborted) {
            enqueue({ type: 'error', message: errorMessage });
          }
        } finally {
          controller.close();
        }
      },
      cancel(reason) {
        console.log('Stream cancelado pelo cliente:', reason);
        abortController.abort();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("❌ Erro crítico na rota /api/buscar-licitacoes:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}