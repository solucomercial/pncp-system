import { NextResponse } from 'next/server';
import { buscarLicitacoesPNCP } from '@/lib/comprasApi';
import { analyzeAndFilterBids } from '@/lib/analyzeBids';
import { Filters } from '@/components/FilterSheet';

interface RequestBody {
  filters: Filters;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { filters } = body;

    console.log("▶️ Rota da API recebendo filtros do frontend:", filters);

    const useGeminiAnalysis = filters.useGeminiAnalysis !== false;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueue = (data: object) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
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

          enqueue({ type: 'info', message: 'Buscando licitações no PNCP...' });
          const licitacoesResponse = await buscarLicitacoesPNCP(mappedFilters);

          if (!licitacoesResponse.success || !licitacoesResponse.data?.data) {
            throw new Error(licitacoesResponse.error || 'Falha ao buscar licitações no PNCP');
          }

          const licitacoesBrutas = licitacoesResponse.data.data;
          enqueue({ type: 'info', message: `Foram encontradas ${licitacoesBrutas.length.toLocaleString('pt-BR')} licitações.` });


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
            console.log("✅ Análise com Gemini desativada. Retornando resultados brutos.");
            enqueue({ type: 'result', resultados: licitacoesBrutas, totalBruto: licitacoesBrutas.length, totalFinal: licitacoesBrutas.length });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
          console.error("❌ Erro crítico ao processar requisição em /api/buscar-licitacoes:", error);
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

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("❌ Erro crítico ao processar requisição em /api/buscar-licitacoes:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}