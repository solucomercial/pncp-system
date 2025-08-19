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

    console.log("🔎 Buscando licitações no PNCP com filtros mapeados:", mappedFilters);

    const licitacoesResponse = await buscarLicitacoesPNCP(mappedFilters);

    if (!licitacoesResponse.success || !licitacoesResponse.data?.data) {
      throw new Error(licitacoesResponse.error || 'Falha ao buscar licitações no PNCP');
    }

    const licitacoesBrutas = licitacoesResponse.data.data;
    console.log(`📡 Recebidas ${licitacoesBrutas.length} licitações brutas do PNCP.`);

    if (licitacoesBrutas.length === 0) {
      return NextResponse.json({ resultados: [] });
    }

    if (useGeminiAnalysis) {
      const licitacoesViaveis = await analyzeAndFilterBids(licitacoesBrutas);

      console.log(`✅ Processamento finalizado. Enviando ${licitacoesViaveis.length} licitações viáveis para o frontend.`);

      return NextResponse.json({
        resultados: licitacoesViaveis,
        totalBruto: licitacoesBrutas.length,
        totalFinal: licitacoesViaveis.length
      });
    } else {
      console.log("✅ Análise com Gemini desativada. Retornando resultados brutos.");
      return NextResponse.json({
        resultados: licitacoesBrutas,
        totalBruto: licitacoesBrutas.length,
        totalFinal: licitacoesBrutas.length
      });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("❌ Erro crítico ao processar requisição em /api/buscar-licitacoes:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}