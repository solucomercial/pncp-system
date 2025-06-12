// src/app/api/buscar-licitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractFilters } from '@/lib/extractFilters';
import { getFiltrosCliente, getBoletins, getDetalhesBoletim } from '@/lib/conlicitacaApi';
import { LicitacaoComBoletim, BoletimResumo, FiltroConlicitacao as ApiFilter } from '@/lib/types';


// --- Rate Limiting (Mantido) ---
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_IP = 20;
const requestCounts = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_IP) return false;
  entry.count++;
  return true;
}

// --- Handler POST ---
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Limite de requisições excedido' }, { status: 429 });
  }

  let question: string | undefined;
  try {
    const body = await req.json();
    question = body.question;
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: 'Pergunta ausente' }, { status: 400 });
  }

  try {
    const extractedInfo = await extractFilters(question);
    const { palavrasChave, sinonimos, valorMin, valorMax, modalidade, estado, dataInicial, dataFinal } = extractedInfo;

    const filtrosResponse = await getFiltrosCliente();
    if (!filtrosResponse.success || !filtrosResponse.data?.filtros) {
      throw new Error(filtrosResponse.error || "Não foi possível obter a lista de filtros da API.");
    }
    const availableFilters: ApiFilter[] = filtrosResponse.data.filtros;
    if (availableFilters.length === 0) {
      return NextResponse.json({ resultados: [], message: 'Nenhum filtro de licitação foi encontrado para sua conta.' }, { status: 200 });
    }

    const boletimListPromises = availableFilters.map(filtro => getBoletins(filtro.id, 1, 200));
    const boletimListResults = await Promise.all(boletimListPromises);
    const allBoletins: BoletimResumo[] = boletimListResults.flatMap(res => res.success && res.data?.boletins ? res.data.boletins : []);

    let boletimIdsToFetch: number[];
    if (dataInicial && dataFinal) {
      console.log(`🗓️ Filtrando boletins entre ${dataInicial} e ${dataFinal}`);
      // Comparação de data robusta, ignorando timezone.
      boletimIdsToFetch = allBoletins
        .filter(b => {
          const boletimDateStr = b.datahora_fechamento.substring(0, 10); // Extrai apenas 'YYYY-MM-DD'
          return boletimDateStr >= dataInicial && boletimDateStr <= dataFinal;
        })
        .map(b => b.id);
      console.log(`Found ${boletimIdsToFetch.length} boletins no período.`);
    } else {
      boletimIdsToFetch = availableFilters.map(f => f.ultimo_boletim?.id).filter((id): id is number => !!id);
    }

    if (boletimIdsToFetch.length === 0) {
      return NextResponse.json({ resultados: [], message: 'Nenhum boletim encontrado para os critérios especificados.' }, { status: 200 });
    }

    const uniqueBoletimIds = [...new Set(boletimIdsToFetch)];
    const boletimDetailsPromises = uniqueBoletimIds.map(id => getDetalhesBoletim(id));
    const boletimDetailsResults = await Promise.all(boletimDetailsPromises);

    const allLicitacoesMap = new Map<number, LicitacaoComBoletim>();
    boletimDetailsResults.forEach(res => {
      if (res.success && res.data?.boletim && res.data.licitacoes) {
        const { id, datahora_fechamento } = res.data.boletim;
        res.data.licitacoes.forEach(lic => {
          if (!allLicitacoesMap.has(lic.id)) {
            allLicitacoesMap.set(lic.id, { ...lic, boletimInfo: { id, data: datahora_fechamento } });
          }
        });
      }
    });

    const licitacoesAgregadas = Array.from(allLicitacoesMap.values());

    const searchTerms = [...palavrasChave.map(k => k.toLowerCase()), ...sinonimos.flat().map(s => s.toLowerCase())];
    const licitacoesFiltradas = licitacoesAgregadas.filter(lic => {
      // Filtro de valor
      const valor = lic.valor_estimado ?? 0;
      const valorOk = (valorMin === null || valor >= valorMin) && (valorMax === null || valor <= valorMax);
      if (!valorOk) return false;

      // Aplicação do filtro de Estado (UF)
      if (estado && lic.orgao?.uf?.toUpperCase() !== estado) {
        return false;
      }

      const textoBusca = `${lic.objeto?.toLowerCase() || ''} ${lic.observacao?.toLowerCase() || ''}`;
      if (modalidade && !textoBusca.includes(modalidade.toLowerCase())) return false;
      if (searchTerms.length > 0 && !searchTerms.some(term => textoBusca.includes(term))) return false;

      return true;
    });

    console.log(`✅ Requisição processada. Enviando ${licitacoesFiltradas.length} licitações filtradas.`);
    return NextResponse.json({ resultados: licitacoesFiltradas }, { status: 200 });

  } catch (error: unknown) {
    console.error(`❌ Erro crítico ao processar requisição:`, error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Erro interno do servidor', message }, { status: 500 });
  }
}

// --- Handlers GET e OPTIONS (Mantidos) ---
export async function GET() { return NextResponse.json({ message: 'Método GET não suportado.' }, { status: 405 }); }
export async function OPTIONS() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } }); }