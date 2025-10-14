import { GoogleGenerativeAI, GoogleGenerativeAIError, GenerateContentResult } from '@google/generative-ai';
import { PncpLicitacao } from './types';

if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GOOGLE_API_KEY não está definida nas variáveis de ambiente.");
  throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.2, // Aumentamos um pouco a temperatura para mais criatividade nas justificativas
    responseMimeType: "application/json",
  }
});

function extractJsonFromString(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) {
    return match[1] || match[2];
  }
  return null;
}

async function generateContentWithRetry(prompt: string, maxRetries = 3): Promise<GenerateContentResult> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      return result;
    } catch (error) {
      const apiError = error as unknown;
      
      if (
        apiError instanceof GoogleGenerativeAIError &&
        (typeof apiError.message === 'string' && apiError.message.includes('503') ||
          typeof (apiError as { status?: number }).status === 'number' && (apiError as { status?: number }).status === 429)
      ) {
        attempt++;
        const isRateLimit = (apiError as { status?: number }).status === 429;
        const delayTime = isRateLimit ? 61000 : Math.pow(2, attempt) * 1000;

        if (attempt >= maxRetries) {
          console.error(`❌ Falha na chamada ao Gemini após ${maxRetries} tentativas.`, error);
          throw new Error(`O serviço de IA está enfrentando problemas (${(apiError as { status?: number }).status}). Tente novamente mais tarde.`);
        }

        console.warn(`⚠️ Serviço do Gemini retornou status ${(apiError as { status?: number }).status || '503'}. Tentando novamente em ${delayTime / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Falha ao gerar conteúdo após múltiplas tentativas.');
}

type ProgressUpdate = {
  type: 'progress' | 'start' | 'complete' | 'error';
  message: string;
  chunk?: number;
  totalChunks?: number;
  total?: number;
  processed?: number;
  data?: PncpLicitacao[];
};

type ProgressCallback = (update: ProgressUpdate) => void;

interface ViableBid {
    numeroControlePNCP: string;
    relevancia: 'Principal' | 'Adjacente';
    justificativa: string;
}

export async function analyzeAndFilterBids(
  licitacoes: PncpLicitacao[],
  onProgress: ProgressCallback
): Promise<PncpLicitacao[]> {
  if (!licitacoes || licitacoes.length === 0) {
    return [];
  }

  const allViableBids: PncpLicitacao[] = [];
  const CHUNK_SIZE = 150;
  const chunks = Array.from({ length: Math.ceil(licitacoes.length / CHUNK_SIZE) }, (_, i) =>
    licitacoes.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE)
  );
  const totalChunks = chunks.length;

  onProgress({
    type: 'start',
    message: `Analisando ${licitacoes.length.toLocaleString('pt-BR')} licitações com IA...`,
    total: licitacoes.length,
    totalChunks,
  });

  let chunkIndex = 0;
  for (const chunk of chunks) {
    const chunkNumber = chunkIndex + 1;

    const simplifiedBids = chunk.map(lic => ({
      numeroControlePNCP: lic.numeroControlePNCP,
      objetoCompra: lic.objetoCompra,
    }));

    const prompt = `
<MISSION>
Você é um analista de negócios sênior da empresa SOLUÇÕES SERVIÇOS TERCEIRIZADOS LTDA. Sua missão é identificar oportunidades de negócio em uma lista de licitações, sendo flexível e estratégico. Você não deve apenas filtrar, mas também classificar a relevância e encontrar oportunidades em áreas similares.
</MISSION>

<COMPANY_PROFILE>
**ÁREAS DE ATUAÇÃO PRINCIPAIS (Core Business):**
1.  **Alimentação Coletiva**: Refeições em grande escala para presídios, hospitais e escolas.
2.  **Facilities e Mão de Obra**: Terceirização de serviços de apoio (recepcionista, porteiro, etc.).
3.  **Limpeza e Conservação Profissional**: Limpeza predial, hospitalar, urbana e industrial.
4.  **Locação de Frota com Motorista**: Veículos leves e pesados, sempre com condutor.
5.  **Engenharia e Manutenção Predial**: Reformas, obras de pequeno e médio porte, manutenção preventiva e corretiva.
6.  **Grandes Projetos**: Cogestão de unidades prisionais, PPPs e concessões de serviços públicos.

**OPORTUNIDADES ADJACENTES (Para Explorar):**
Identifique licitações que, embora não sejam nosso core business, são viáveis para explorar.
- **Exemplos**:
  - Fornecimento de grande volume de materiais de limpeza (relacionado à Limpeza).
  - Gestão de almoxarifado (relacionado a Facilities).
  - Pequenos serviços de jardinagem e paisagismo (relacionado a Manutenção).
  - Locação de equipamentos para obras (relacionado a Engenharia).

**ÁREAS DE BAIXA PRIORIDADE (Evitar, mas não excluir cegamente):**
- **Eventos**: Buffet, festas, shows, decoração.
- **Varejo/Alimentação Específica**: Compra de pães, bolos, coffee break.
- **Serviços Hiper-especializados**: Construção de pontes, recapeamento asfáltico, segurança armada, consultorias.
- **Locação SEM Motorista**.
</COMPANY_PROFILE>

<INSTRUCTIONS>
1.  Analise cada licitação da lista a seguir.
2.  Classifique cada oportunidade viável com um nível de 'relevancia': 'Principal' ou 'Adjacente'.
3.  Para cada licitação viável, escreva uma 'justificativa' curta e objetiva.
4.  Ignore completamente as licitações de baixa prioridade, a menos que identifique uma oportunidade estratégica clara.
5.  Sua única saída deve ser um array JSON contendo os objetos das licitações que você aprovou.
6.  Se nenhuma licitação for viável, retorne um array vazio: [].
</INSTRUCTIONS>

<BIDS_TO_ANALYZE>
${JSON.stringify(simplifiedBids, null, 2)}
</BIDS_TO_ANALYZE>

<OUTPUT_JSON_FORMAT>
[
  {
    "numeroControlePNCP": "ID_DA_LICITACAO",
    "relevancia": "Principal",
    "justificativa": "Encaixa-se perfeitamente em nossa atuação de Limpeza Hospitalar."
  },
  {
    "numeroControlePNCP": "ID_DE_OUTRA_LICITACAO",
    "relevancia": "Adjacente",
    "justificativa": "Oportunidade para fornecer materiais de limpeza em grande escala, sinérgico com nossos serviços."
  }
]
</OUTPUT_JSON_FORMAT>
`;

    try {
      onProgress({
        type: 'progress',
        message: `Analisando lote ${chunkNumber} de ${totalChunks}...`,
        chunk: chunkNumber,
        totalChunks,
      });

      const result = await generateContentWithRetry(prompt);
      const response = await result.response;
      const rawText = response.text();

      if (rawText) {
        const jsonText = extractJsonFromString(rawText);
        if (jsonText) {
          try {
            // A resposta agora tem um formato diferente
            const viableBidsFromAI = JSON.parse(jsonText) as ViableBid[];
            const viablePncpIds = new Set(viableBidsFromAI.map(b => b.numeroControlePNCP));

            const filteredChunk = chunk.filter(lic => viablePncpIds.has(lic.numeroControlePNCP));
            allViableBids.push(...filteredChunk);

          } catch (parseError) {
            console.error(`❌ Erro de parse JSON no lote ${chunkNumber} mesmo após extração:`, parseError);
            console.error('JSON extraído que falhou:', jsonText);
          }
        } else {
          console.warn(`⚠️ Não foi possível extrair JSON da resposta do lote ${chunkNumber}. Resposta crua:`, rawText);
        }
      } else {
        console.warn(`⚠️ Lote ${chunkNumber} retornou uma resposta vazia.`);
      }
    } catch (error) {
      console.error(`❌ Erro ao analisar o lote ${chunkNumber} com Gemini:`, error);
    }

    if (chunkNumber < totalChunks) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    chunkIndex++;
  }

  console.log(`✅ Análise completa. Total de ${allViableBids.length} licitações consideradas viáveis.`);
  return allViableBids;
}