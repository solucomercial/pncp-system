// src/utils/extractFilters.ts
import { GoogleGenerativeAI, GoogleGenerativeAIError } from '@google/generative-ai';
import { subDays, format } from 'date-fns';

// Garante que a chave seja verificada corretamente no nível do módulo
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GOOGLE_API_KEY não está definida nas variáveis de ambiente.");
  throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Interface atualizada para incluir datas
export interface ExtractedFilters {
  palavrasChave: string[];
  sinonimos: string[][];
  valorMin: number | null;
  valorMax: number | null;
  estado: string | null;
  modalidade: string | null;
  dataInicial: string | null; // Formato YYYY-MM-DD
  dataFinal: string | null;   // Formato YYYY-MM-DD
}

/**
 * Extrai filtros estruturados de uma pergunta em linguagem natural usando a API Gemini.
 * @param question A pergunta do usuário sobre licitações.
 * @returns Uma promessa que resolve para um objeto ExtractedFilters.
 */
export async function extractFilters(question: string): Promise<ExtractedFilters> {
  const defaultResponse: ExtractedFilters = {
    palavrasChave: [],
    sinonimos: [],
    valorMin: null,
    valorMax: null,
    estado: null,
    modalidade: null,
    dataInicial: null,
    dataFinal: null,
  };

  if (!question || typeof question !== 'string' || !question.trim()) {
    console.warn("⚠️ extractFilters chamada com pergunta inválida.");
    return defaultResponse;
  }
  console.log(`🧠 Chamando Gemini para extrair filtros de: "${question}"`);

  const hoje = new Date();
  const dataAtualFormatada = format(hoje, 'yyyy-MM-dd');

  // --- PROMPT OTIMIZADO ---
  // 1. Adicionada regra explícita para "últimos X dias".
  const prompt = `
    Você é um especialista assistente que analisa perguntas sobre licitações públicas no Brasil.
    Sua tarefa é extrair informações estruturadas da pergunta do usuário e retornar **apenas um objeto JSON válido**, sem nenhum texto, explicação ou markdown (como \`\`\`json) ao redor dele.

    A data de hoje é: ${dataAtualFormatada}.

    Pergunta do usuário: "${question}"

    O objeto JSON de saída deve ter a seguinte estrutura:
    {
      "palavrasChave": ["array", "de", "strings"],
      "sinonimos": [["sinonimos_palavra1"], ["para_palavra2"]],
      "valorMin": null | numero,
      "valorMax": null | numero,
      "estado": null | "string",
      "modalidade": null | "string",
      "dataInicial": null | "string" (formato AAAA-MM-DD),
      "dataFinal": null | "string" (formato AAAA-MM-DD)
    }

    Regras para extração de data:
    - Extraia um intervalo de datas mencionado. Use sempre o formato **AAAA-MM-DD**.
    - Se for dito "hoje", use "${dataAtualFormatada}" para dataInicial e dataFinal.
    - Se for dito "ontem", calcule a data correspondente.
    - **Se for dito "nos últimos X dias", calcule a data inicial subtraindo X dias da data de hoje (${dataAtualFormatada}). A data final será a data de hoje.**
    - Se apenas uma data for mencionada (ex: "no dia 15/05/2025"), use-a para dataInicial e dataFinal.
    - Se for "de 02/06/2025 até 06/06/2025", dataInicial será "2025-06-02" e dataFinal será "2025-06-06".
    - Se nenhum período for mencionado, retorne null para ambos.

    Exemplo para "últimos 2 dias" (considerando hoje como ${dataAtualFormatada}):
    Pergunta: "licitações de limpeza dos últimos 2 dias"
    JSON esperado:
    {
      "palavrasChave": ["limpeza"],
      "sinonimos": [["higienização", "conservação"]],
      "valorMin": null,
      "valorMax": null,
      "estado": null,
      "modalidade": null,
      "dataInicial": "${format(subDays(hoje, 2), 'yyyy-MM-dd')}",
      "dataFinal": "${dataAtualFormatada}"
    }
  `;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error('Falha ao extrair filtros: resposta da IA vazia');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta da IA não parece conter um objeto JSON válido.');

    const jsonText = jsonMatch[0];
    const parsedResponse = JSON.parse(jsonText) as Partial<ExtractedFilters>;
    const validatedResponse: ExtractedFilters = { ...defaultResponse };

    if (Array.isArray(parsedResponse.palavrasChave)) validatedResponse.palavrasChave = parsedResponse.palavrasChave.filter(kw => typeof kw === 'string');
    if (Array.isArray(parsedResponse.sinonimos)) validatedResponse.sinonimos = parsedResponse.sinonimos.map(s => Array.isArray(s) ? s.filter(i => typeof i === 'string') : []);
    if (typeof parsedResponse.valorMin === 'number') validatedResponse.valorMin = parsedResponse.valorMin;
    if (typeof parsedResponse.valorMax === 'number') validatedResponse.valorMax = parsedResponse.valorMax;
    if (typeof parsedResponse.estado === 'string') validatedResponse.estado = parsedResponse.estado.toUpperCase().trim();
    if (typeof parsedResponse.modalidade === 'string') validatedResponse.modalidade = parsedResponse.modalidade.trim();
    if (typeof parsedResponse.dataInicial === 'string') validatedResponse.dataInicial = parsedResponse.dataInicial;
    if (typeof parsedResponse.dataFinal === 'string') validatedResponse.dataFinal = parsedResponse.dataFinal;

    console.log("✅ Filtros extraídos e validados:", validatedResponse);
    return validatedResponse;

  } catch (error: any) {
    console.error('❌ Erro em extractFilters:', error);
    if (error instanceof GoogleGenerativeAIError) {
      throw new Error(`Falha na comunicação com a IA Gemini: ${error.message}`);
    }
    throw error;
  }
}
