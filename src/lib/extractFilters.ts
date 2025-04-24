// src/utils/extractFilters.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GOOGLE_API_KEY) {
 throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

interface Filters {
 palavrasChave: string[];
 sinonimos?: string[][]; // Adicionando sinonimos como opcional
 valorMin: number | null;
 valorMax: number | null;
 estado?: string | null; // Adicionando estado como opcional
}

export async function extractFilters(question: string): Promise<Filters> {
 if (!question || typeof question !== 'string') {
  throw new Error('A pergunta deve ser uma string não vazia');
 }

 const prompt = `
    Analise a seguinte pergunta sobre licitações e extraia:
    1. Palavras-chave relevantes para busca.
    2. Sinônimos relevantes para cada palavra-chave (retorne um array de arrays de strings).
    3. Faixa de valores (mínimo e máximo) se mencionada. Se não mencionada, retorne null.
    4. O estado (se mencionado). Se não mencionado, retorne null.

    Pergunta: "${question}"

    Retorne apenas um objeto JSON com a seguinte estrutura:
    {
      "palavrasChave": ["palavra1", "palavra2", ...],
      "sinonimos": [["sinonimo1", "sinonimo2"], ["outroSinonimo"]],
      "valorMin": null,
      "valorMax": null,
      "estado": null
    }
  `;

 try {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text) {
   throw new Error('Falha ao extrair filtros da pergunta: resposta vazia');
  }

  try {
   const parsedResponse = JSON.parse(text) as Filters;

   // Validação dos dados retornados
   if (!Array.isArray(parsedResponse.palavrasChave)) {
    throw new Error('palavrasChave deve ser um array');
   }
   if (parsedResponse.sinonimos && !Array.isArray(parsedResponse.sinonimos)) {
    throw new Error('sinonimos deve ser um array de arrays');
   } else if (parsedResponse.sinonimos) {
    parsedResponse.sinonimos.forEach(synonyms => {
     if (!Array.isArray(synonyms)) {
      throw new Error('Cada item em sinonimos deve ser um array');
     }
    });
   }
   if (parsedResponse.valorMin !== null && typeof parsedResponse.valorMin !== 'number') {
    throw new Error('valorMin deve ser um número ou null');
   }
   if (parsedResponse.valorMax !== null && typeof parsedResponse.valorMax !== 'number') {
    throw new Error('valorMax deve ser um número ou null');
   }
   if (parsedResponse.valorMin !== null && parsedResponse.valorMax !== null && parsedResponse.valorMin > parsedResponse.valorMax) {
    throw new Error('valorMin não pode ser maior que valorMax');
   }
   if (parsedResponse.estado !== null && typeof parsedResponse.estado !== 'string') {
    throw new Error('estado deve ser uma string ou null');
   }

   return parsedResponse;
  } catch (parseError) {
   console.error('Erro ao analisar resposta da IA:', parseError);
   console.error('Resposta bruta da IA:', text);
   throw new Error('Falha ao analisar resposta da IA');
  }
 } catch (error) {
  console.error('Erro na chamada da API Gemini:', error);
  throw new Error('Falha na comunicação com a IA Gemini');
 }
}