import { NextResponse } from 'next/server';
import { buscarLicitacoesPNCP } from '@/lib/comprasApi';
import { Filters } from '@/components/FilterSheet';

// O tipo agora reflete a estrutura exata enviada pelo FilterSheet
interface RequestBody {
  filters: Filters;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { filters } = body;

    console.log("▶️ Rota da API recebendo filtros:", filters);

    // --- BYPASS DO GEMINI ---
    // Não há mais chamada para extractFilters. Os filtros são usados diretamente.

    // Mapeia os filtros do frontend para o formato esperado pela função de busca
    const mappedFilters = {
      palavrasChave: filters.palavrasChave,
      sinonimos: [], // Não estamos mais usando sinônimos do Gemini
      valorMin: filters.valorMin ? parseFloat(filters.valorMin) : null,
      valorMax: filters.valorMax ? parseFloat(filters.valorMax) : null,
      estado: filters.estado,
      // Passa o array de modalidades diretamente
      modalidades: filters.modalidades,
      dataInicial: filters.dateRange?.from ? filters.dateRange.from.toString() : null,
      dataFinal: filters.dateRange?.to ? filters.dateRange.to.toString() : null,
      blacklist: filters.blacklist,
      smartBlacklist: [] // Não estamos mais usando smartBlacklist do Gemini
    };

    console.log("🔎 Mapeando para a função de busca com:", mappedFilters);

    // Chama a função de busca com os filtros mapeados
    const licitacoesResponse = await buscarLicitacoesPNCP(mappedFilters);

    if (!licitacoesResponse.success || !licitacoesResponse.data) {
      throw new Error(licitacoesResponse.error || 'Falha ao buscar licitações no PNCP');
    }

    const licitacoes = licitacoesResponse.data.data;

    console.log(`✅ Requisição processada. Enviando ${licitacoes.length} licitações.`);

    return NextResponse.json({ resultados: licitacoes });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    console.error("❌ Erro crítico ao processar requisição em /api/buscar-licitacoes:", error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}