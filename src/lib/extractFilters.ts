// src/utils/extractFilters.ts
import { GoogleGenerativeAI, GoogleGenerativeAIError } from '@google/generative-ai';

// Garante que a chave seja verificada corretamente no nível do módulo
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GOOGLE_API_KEY não está definida nas variáveis de ambiente.");
  // Lançar erro aqui pode parar a inicialização do servidor, o que pode ser desejado
  throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Exporta a interface para ser usada em outros lugares
export interface ExtractedFilters {
  palavrasChave: string[];
  sinonimos?: string[][]; // Mantém opcional
  valorMin: number | null;
  valorMax: number | null;
  estado?: string | null; // Mantém opcional
}

export async function extractFilters(question: string): Promise<ExtractedFilters> {
  if (!question || typeof question !== 'string' || !question.trim()) {
    console.warn("⚠️ extractFilters chamada com pergunta inválida.");
    // Retorna uma estrutura padrão
    return {
      palavrasChave: [],
      valorMin: null,
      valorMax: null,
      estado: null,
      sinonimos: []
    };
  }
  console.log(`🧠 Chamando Gemini para extrair filtros de: "${question}"`);

  // Prompt refinado para melhor aderência à estrutura JSON
  const prompt = `
     Analise a seguinte pergunta sobre licitações públicas no Brasil e extraia as informações solicitadas.
     Pergunta: "${question}"

     Responda **apenas** com um objeto JSON válido contendo os seguintes campos:
     - "palavrasChave": array de strings com os termos mais importantes para busca (ex: ["manutenção", "veículos", "frota"]). Mantenha termos compostos juntos se relevante (ex: ["ar condicionado"]). Se nenhuma palavra-chave for identificada, retorne um array vazio [].
     - "sinonimos": array de arrays de strings. Cada array interno deve conter sinônimos para a palavra-chave correspondente no array "palavrasChave". Se não houver sinônimos ou não for aplicável, retorne um array vazio [] para essa palavra-chave. A estrutura deve ser, por exemplo: [["conserto", "reparo"], ["automóveis"], []]. Se nenhuma palavra-chave for identificada, retorne um array vazio [].
     - "valorMin": número representando o valor mínimo mencionado (ex: 500000). Se nenhum valor mínimo for explicitamente mencionado, retorne null. Extraia apenas números.
     - "valorMax": número representando o valor máximo mencionado (ex: 1000000). Se nenhum valor máximo for explicitamente mencionado, retorne null. Extraia apenas números.
     - "estado": string contendo a sigla de duas letras do estado brasileiro mencionado (ex: "SP", "RJ", "MG"). Se nenhum estado for mencionado ou não for possível identificar claramente, retorne null.
     

     Exemplo de JSON esperado:
     {
       "palavrasChave": ["trator agrícola", "pneus"],
       "sinonimos": [["máquina agrícola"], ["rodas", "borrachas"]],
       "valorMin": null,
       "valorMax": 380000,
       "estado": "SP"
     }

     **Importante:** Retorne apenas o objeto JSON, sem nenhum texto adicional antes ou depois, e sem usar markdown (como \`\`\`json).
   `;

  try {
    // Usa o modelo gemini-1.5-flash ou outro configurado
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Ajuste se necessário
    console.log(`ℹ️ Usando modelo Gemini: ${model.model}`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      console.error('❌ Falha ao extrair filtros: resposta da IA vazia.');
      throw new Error('Falha ao extrair filtros da pergunta: resposta vazia da IA');
    }

    // --- Lógica Melhorada de Extração de JSON ---
    let jsonText = text.trim();
    const regexMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (regexMatch && regexMatch[1]) {
      jsonText = regexMatch[1].trim();
      console.log("ℹ️ JSON extraído de dentro dos delimitadores ```json.");
    } else {
      jsonText = jsonText.replace(/^```\s*|\s*```$/g, '').trim();
      if (!jsonText.startsWith('{') || !jsonText.endsWith('}')) {
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          console.warn("⚠️ Tentando extrair JSON entre o primeiro '{' e o último '}'. Resposta original pode conter texto extra.");
          jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        } else {
          console.error('❌ Resposta da IA não parece conter um objeto JSON válido após tentativas de limpeza:', jsonText);
          throw new Error('Resposta da IA não parece conter um objeto JSON válido.');
        }
      }
    }
    // --- Fim da Lógica Melhorada de Extração de JSON ---

    try {
      const parsedResponse = JSON.parse(jsonText) as Partial<ExtractedFilters>; // Usa Partial para validação

      // --- Validação e Normalização ---
      const validatedResponse: ExtractedFilters = {
        palavrasChave: [],
        sinonimos: [],
        valorMin: null,
        valorMax: null,
        estado: null,
      };

      if (Array.isArray(parsedResponse.palavrasChave)) {
        validatedResponse.palavrasChave = parsedResponse.palavrasChave.filter(kw => typeof kw === 'string');
      } else {
        console.warn('⚠️ IA retornou palavrasChave inválido, usando default [].', parsedResponse.palavrasChave);
      }

      if (parsedResponse.sinonimos !== undefined) {
        if (Array.isArray(parsedResponse.sinonimos)) {
          validatedResponse.sinonimos = parsedResponse.sinonimos.map(synList =>
            Array.isArray(synList) ? synList.filter(s => typeof s === 'string') : []
          );
        } else {
          console.warn('⚠️ IA retornou sinonimos inválido, ignorando.', parsedResponse.sinonimos);
        }
      }

      if (parsedResponse.valorMin !== null && typeof parsedResponse.valorMin === 'number') {
        validatedResponse.valorMin = parsedResponse.valorMin;
      } else if (parsedResponse.valorMin !== null) {
        console.warn('⚠️ IA retornou valorMin inválido, usando null.', parsedResponse.valorMin);
      }

      if (parsedResponse.valorMax !== null && typeof parsedResponse.valorMax === 'number') {
        validatedResponse.valorMax = parsedResponse.valorMax;
      } else if (parsedResponse.valorMax !== null) {
        console.warn('⚠️ IA retornou valorMax inválido, usando null.', parsedResponse.valorMax);
      }

      // Verifica intervalo min/max
      if (validatedResponse.valorMin !== null && validatedResponse.valorMax !== null && validatedResponse.valorMin > validatedResponse.valorMax) {
        console.warn('⚠️ IA retornou valorMin > valorMax, invalidando faixa.', parsedResponse);
        validatedResponse.valorMin = null;
        validatedResponse.valorMax = null;
      }

      if (parsedResponse.estado !== null && typeof parsedResponse.estado === 'string') {
        const estadoUpper = parsedResponse.estado.toUpperCase().trim();
        if (estadoUpper.length === 2) { // Verificação básica de formato
          validatedResponse.estado = estadoUpper;
        } else {
          console.warn('⚠️ IA retornou estado com formato inválido, usando null.', parsedResponse.estado);
        }
      } else if (parsedResponse.estado !== null) {
        console.warn('⚠️ IA retornou estado inválido, usando null.', parsedResponse.estado);
      }
      // --- Fim da Validação ---

      console.log("✅ Filtros extraídos e validados:", validatedResponse);
      return validatedResponse;

    } catch (parseError: any) {
      console.error('❌ Erro ao analisar JSON da resposta da IA:', parseError.message);
      console.error('📄 Texto que falhou no parse JSON:', jsonText);
      console.error('📄 Resposta bruta original da IA:', text);
      throw new Error(`Falha ao analisar resposta da IA: ${parseError.message}.`);
    }
  } catch (error: any) {
    if (error instanceof GoogleGenerativeAIError) {
      console.error('❌ Erro na API Gemini:', error);
      throw new Error(`Falha na comunicação com a IA Gemini: ${error.message}`);
    } else {
      console.error('❌ Erro inesperado em extractFilters:', error);
      throw error;
    }
  }
}
