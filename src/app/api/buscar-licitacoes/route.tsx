// src/app/api/buscar-licitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractFilters, ExtractedFilters } from '@/lib/extractFilters';
import { getFiltrosCliente, getDetalhesBoletim, handleApiError, ApiResponse } from '@/lib/conlicitacaApi';
// AxiosError não é mais necessário aqui diretamente
// import { AxiosError } from 'axios';

// --- Rate Limiting (Mantido) ---
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_IP = 20;
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    if (requestCounts.size > 5000) {
      const cutoff = now - RATE_LIMIT_WINDOW * 10;
      for (const [key, val] of requestCounts.entries()) {
        if (val.resetTime < cutoff) requestCounts.delete(key);
      }
    }
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_IP) {
    console.warn(`🚦 Rate limit excedido para o IP ${ip}`);
    return false;
  }

  entry.count++;
  return true;
}
// --- Fim Rate Limiting ---

// --- Interface ApiFilter (Mantida) ---
interface ApiFilter {
  id: number;
  descricao: string;
  ultimo_boletim?: {
    id: number;
    datahora_fechamento?: string;
    numero_edicao?: number;
  };
}

// --- Função findBestFilter (Mantida) ---
function findBestFilter(availableFilters: ApiFilter[], extractedInfo: ExtractedFilters): ApiFilter | null {
  if (!availableFilters || availableFilters.length === 0) {
    console.warn("⚠️ Nenhum filtro disponível para findBestFilter.");
    return null;
  }
  if (!extractedInfo.palavrasChave || extractedInfo.palavrasChave.length === 0) {
    console.warn("⚠️ Nenhuma palavra-chave da IA para correspondência de filtro.");
    return null;
  }
  console.log("ℹ️ Tentando encontrar correspondência de filtro...");
  console.log("   Palavras-chave da IA:", extractedInfo.palavrasChave);

  const searchKeywords = extractedInfo.palavrasChave.map(kw => kw.toLowerCase());

  for (const filter of availableFilters) {
    if (filter && typeof filter.descricao === 'string') {
      const filterDescriptionLower = filter.descricao.toLowerCase();
      console.log(`   Verificando Filtro ID ${filter.id}: "${filter.descricao}"`);
      let foundKeywordMatch = false;
      for (const keyword of searchKeywords) {
        if (filterDescriptionLower.includes(keyword)) {
          console.log(`   -> Match com keyword "${keyword}"`);
          foundKeywordMatch = true;
          break; // Encontrou match para este filtro, pode parar de checar keywords
        }
      }

      if (foundKeywordMatch && filter.ultimo_boletim && typeof filter.ultimo_boletim.id === 'number') {
        console.log(`✅ Filtro ID ${filter.id} selecionado (tem boletim ID: ${filter.ultimo_boletim.id}).`);
        return filter;
      } else if (foundKeywordMatch) {
        console.warn(`   -> Filtro ID ${filter.id} corresponde às keywords, mas falta 'ultimo_boletim.id' válido. Pulando.`);
      }
    }
  }

  console.warn("⚠️ Nenhum filtro correspondente com 'ultimo_boletim.id' válido encontrado.");
  const firstFilterWithBoletim = availableFilters.find(f => f.ultimo_boletim && typeof f.ultimo_boletim.id === 'number');
  if (firstFilterWithBoletim) {
    console.warn(`   -> Usando o PRIMEIRO filtro disponível com boletim válido como fallback (ID: ${firstFilterWithBoletim.id}).`);
    return firstFilterWithBoletim;
  }

  console.error("❌ Nenhum filtro com boletim válido encontrado na conta.");
  return null;
}
// --- Fim Função Auxiliar ---


// --- Handler POST ---
export async function POST(req: NextRequest) {
  const ip = req.ip ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Limite de requisições excedido', message: 'Muitas tentativas. Por favor, aguarde um momento.' }, { status: 429 }
    );
  }

  let question: string | undefined;
  try {
    const body = await req.json();
    question = body.question;
  } catch (e) {
    console.warn(`⚠️ Requisição inválida (JSON malformado) do IP ${ip}`);
    return NextResponse.json({ error: 'Corpo da requisição inválido (JSON esperado).' }, { status: 400 });
  }

  if (!question || typeof question !== 'string' || !question.trim()) {
    console.warn(`⚠️ Requisição inválida (sem pergunta válida) do IP ${ip}`);
    return NextResponse.json({ error: 'Pergunta inválida ou ausente.' }, { status: 400 });
  }
  console.log(`\n🚀 Recebida pergunta do IP ${ip}: "${question}"`);

  try {
    // Etapa 1: IA -> extrair filtros
    const extractedInfo = await extractFilters(question);
    console.log(`🧠 Filtros extraídos pela IA:`, extractedInfo);

    // Etapa 2: Buscar filtros disponíveis do cliente via API ConLicitação
    console.log("📞 Buscando filtros do cliente...");
    const filtrosResponse = await getFiltrosCliente();

    // A validação agora está dentro de getFiltrosCliente, verificamos apenas o 'success'
    if (!filtrosResponse.success || !filtrosResponse.data) { // Verifica se data existe
      console.error("❌ Falha ao buscar filtros do cliente:", filtrosResponse.error);
      return NextResponse.json(
        { error: 'Erro ao buscar filtros', message: filtrosResponse.error || "Não foi possível obter a lista de filtros da API." },
        { status: filtrosResponse.status || 502 }
      );
    }

    // --- CORREÇÃO DO ACESSO ---
    // Acessa diretamente 'filtrosResponse.data.filtros' pois a validação já confirmou que é um array
    const availableFilters: ApiFilter[] = filtrosResponse.data.filtros;
    // --- FIM DA CORREÇÃO ---

    console.log(`✅ ${availableFilters.length} filtros disponíveis encontrados.`);

    if (availableFilters.length === 0) {
      console.warn("⚠️ Nenhum filtro encontrado para este cliente.");
      return NextResponse.json(
        { resultados: [], message: 'Nenhum filtro de licitação foi encontrado para sua conta.' },
        { status: 200 }
      );
    }

    // Etapa 3: Encontrar o filtro correspondente
    const matchingFilter = findBestFilter(availableFilters, extractedInfo);

    if (!matchingFilter || !matchingFilter.ultimo_boletim?.id) {
      console.error('❌ Erro: Nenhum filtro correspondente com boletim válido encontrado.');
      let message = 'Nenhum filtro adequado encontrado para sua pergunta.';
      if (!matchingFilter && availableFilters.length > 0) {
        message = 'Sua pergunta não correspondeu a nenhum filtro configurado que tenha boletins recentes.';
      } else if (matchingFilter && !matchingFilter.ultimo_boletim?.id) {
        message = `O filtro "${matchingFilter.descricao}" foi encontrado, mas não possui um boletim recente associado.`;
      } else if (availableFilters.every(f => !f.ultimo_boletim?.id)) {
        message = 'Nenhum dos filtros configurados possui boletins recentes associados.';
      }
      return NextResponse.json(
        { resultados: [], message: message },
        { status: 404 }
      );
    }

    const filtroId = matchingFilter.id;
    const boletimId = matchingFilter.ultimo_boletim.id;
    console.log(`⚙️ Usando Filtro ID: ${filtroId} ("${matchingFilter.descricao}")`);
    console.log(`⚙️ Usando ID do Último Boletim: ${boletimId}`);

    // Etapa 4: Buscar os detalhes do boletim específico
    console.log(`📞 Buscando detalhes do boletim ${boletimId}...`);
    const boletimDetailsResponse = await getDetalhesBoletim(boletimId);

    if (!boletimDetailsResponse.success || !boletimDetailsResponse.data?.boletim) {
      console.error(`❌ Erro ao buscar detalhes do boletim ${boletimId}:`, boletimDetailsResponse.error);
      return NextResponse.json(
        { error: 'Erro ao buscar detalhes do boletim', message: boletimDetailsResponse.error || `Não foi possível obter detalhes para o boletim ID ${boletimId}.` },
        { status: boletimDetailsResponse.status || 502 }
      );
    }

    const boletimDetails = boletimDetailsResponse.data;
    console.log(`✅ Detalhes do boletim ${boletimId} recebidos.`);

    // Etapa 5: Filtrar licitações por valor (se aplicável)
    let licitacoesDoBoletim = boletimDetails.licitacoes || [];
    let licitacoesFiltradas = licitacoesDoBoletim;
    const { valorMin, valorMax } = extractedInfo;

    if (valorMin !== null || valorMax !== null) {
      console.log(`🔍 Aplicando filtro de valor: min=${valorMin ?? 'N/A'}, max=${valorMax ?? 'N/A'}`);
      licitacoesFiltradas = licitacoesDoBoletim.filter((lic: any) => {
        const valorEstimado = (typeof lic?.valor_estimado === 'number') ? lic.valor_estimado : 0;
        const checkMin = (valorMin === null) || (valorEstimado >= valorMin);
        const checkMax = (valorMax === null) || (valorEstimado <= valorMax);
        return checkMin && checkMax;
      });
      console.log(`   -> ${licitacoesFiltradas.length} de ${licitacoesDoBoletim.length} licitações após filtro de valor.`);
    } else {
      console.log(`ℹ️ Nenhum filtro de valor aplicado.`);
    }

    // Etapa 6: Formatar a resposta final para o frontend
    const finalResponseData = {
      resultados: [
        {
          boletim: boletimDetails.boletim,
          licitacoes: licitacoesFiltradas,
          acompanhamentos: boletimDetails.acompanhamentos || []
        }
      ]
    };

    console.log(`✅ Requisição processada. Enviando ${licitacoesFiltradas.length} licitações filtradas.`);
    return NextResponse.json(finalResponseData, {
      status: 200,
    });

  } catch (error: any) {
    console.error(`❌ Erro crítico ao processar requisição para IP ${ip}:`, error);
    let errorMessage = 'Ocorreu um erro inesperado ao processar sua busca.';
    let errorStatus = 500;
    if (error.message?.includes('Falha na comunicação com a IA Gemini')) {
      errorMessage = 'Erro ao comunicar com o serviço de Inteligência Artificial.';
      errorStatus = 503;
    } else if (error.message?.includes('Falha ao processar resposta da IA')) {
      errorMessage = 'Erro ao interpretar a resposta da Inteligência Artificial.';
      errorStatus = 500;
    }
    return NextResponse.json({ error: 'Erro interno do servidor', message: errorMessage }, { status: errorStatus });
  }
}

// --- Handlers GET e OPTIONS (Mantidos) ---
export async function GET() {
  return NextResponse.json({ message: 'Método GET não é suportado para esta rota.' }, { status: 405 });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://kzmopug2zuivuibmmes7.lite.vusercontent.net'];
  const headers = new Headers();
  console.log(`Received OPTIONS request from origin: ${origin}`);
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    console.log(`Set Access-Control-Allow-Origin: ${origin}`);
  } else if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
    console.log(`Set Access-Control-Allow-Origin: *`);
  } else {
    console.log(`Origin ${origin} not in allowed list: ${allowedOrigins.join(', ')}`);
  }
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(null, { status: 204, headers });
}
