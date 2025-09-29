import { GoogleGenerativeAI, GoogleGenerativeAIError, GenerateContentResult } from '@google/generative-ai';
import { PncpLicitacao } from './types';
import { getCachedAnalysis, setCachedAnalysis } from './cache';

if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GOOGLE_API_KEY não está definida nas variáveis de ambiente.");
  throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.1,
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

export async function analyzeAndFilterBids(
  licitacoes: PncpLicitacao[],
  onProgress: ProgressCallback
): Promise<PncpLicitacao[]> {
  if (!licitacoes || licitacoes.length === 0) {
    return [];
  }

  const bidsToAnalyze: PncpLicitacao[] = [];
  const cachedViableBids: PncpLicitacao[] = [];

  for (const lic of licitacoes) {
    const cachedResult = getCachedAnalysis(lic.numeroControlePNCP);
    if (cachedResult === true) {
      cachedViableBids.push(lic);
    } else if (cachedResult === null) {
      bidsToAnalyze.push(lic);
    }
  }

  if (bidsToAnalyze.length === 0) {
    onProgress({ type: 'complete', message: `Análise concluída. ${cachedViableBids.length} licitações viáveis encontradas no cache.` });
    return cachedViableBids;
  }

  const allViableBids: PncpLicitacao[] = [...cachedViableBids];
  const CHUNK_SIZE = 150;
  const chunks = Array.from({ length: Math.ceil(bidsToAnalyze.length / CHUNK_SIZE) }, (_, i) =>
    bidsToAnalyze.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE)
  );
  const totalChunks = chunks.length;

  onProgress({
    type: 'start',
    message: `Analisando ${bidsToAnalyze.length.toLocaleString('pt-BR')} licitações com IA...`,
    total: bidsToAnalyze.length,
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
Você é um analista de licitações sênior da empresa SOLUÇÕES SERVIÇOS TERCEIRIZADOS LTDA. Sua tarefa é analisar uma lista de licitações e retornar uma sub-lista em JSON, contendo apenas as licitações que são relevantes e viáveis para a empresa.
</MISSION>
<COMPANY_PROFILE>
**ÁREAS DE ATUAÇÃO ESTRATÉGICAS:**
1.  **Alimentação Coletiva**: Refeições em grande escala para presídios, hospitais e escolas.
2.  **Facilities e Mão de Obra**: Terceirização de serviços de apoio (recepcionista, porteiro, etc.).
3.  **Limpeza e Conservação Profissional**: Limpeza predial e hospitalar.
4.  **Locação de Frota COM Motorista**.
5.  **Manutenção Predial e Pequenas Reformas (Apenas em SP)**.
6.  **Grandes Projetos**: Cogestão prisional, PPP e concessões.

**CRITÉRIOS DE EXCLUSÃO:**
- **Eventos**: Buffet, festas, shows.
- **Alimentação Específica/Varejo**: Compra de pães, bolos, doces, coffee break.
- **Insumos de Saúde**: Aquisição de medicamentos, materiais hospitalares, equipamentos médicos.
- **Obras de Grande Porte/Especializadas**: Construção de pontes, viadutos, recapeamento asfáltico.
- **Serviços que Não Prestamos**: Controle de pragas, segurança patrimonial, consultoria, leilões.
- **Locação SEM Motorista**.
</COMPANY_PROFILE>
<INSTRUCTIONS>
1.  Para cada licitação, verifique se o 'objetoCompra' se encaixa em nossas áreas de atuação.
2.  Verifique a regra geográfica para obras.
3.  Sua única saída deve ser um array JSON contendo os objetos das licitações que você aprovou.
4.  Se nenhuma licitação for viável, retorne um array vazio: [].
</INSTRUCTIONS>
<BIDS_TO_ANALYZE>
${JSON.stringify(simplifiedBids, null, 2)}
</BIDS_TO_ANALYZE>
<OUTPUT_JSON>
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
            const viableSimplifiedBids = JSON.parse(jsonText) as { numeroControlePNCP: string }[];
            const viablePncpIds = new Set(viableSimplifiedBids.map(b => b.numeroControlePNCP));

            const filteredChunk = chunk.filter(lic => {
              const isViable = viablePncpIds.has(lic.numeroControlePNCP);
              setCachedAnalysis(lic.numeroControlePNCP, isViable);
              return isViable;
            });
            allViableBids.push(...filteredChunk);

          } catch (parseError) {
            console.error(`❌ Erro de parse JSON no lote ${chunkNumber} mesmo após extração:`, parseError);
            console.error('JSON extraído que falhou:', jsonText);
            chunk.forEach(lic => setCachedAnalysis(lic.numeroControlePNCP, false));
          }
        } else {
          console.warn(`⚠️ Não foi possível extrair JSON da resposta do lote ${chunkNumber}. Resposta crua:`, rawText);
          chunk.forEach(lic => setCachedAnalysis(lic.numeroControlePNCP, false));
        }
      } else {
        chunk.forEach(lic => setCachedAnalysis(lic.numeroControlePNCP, false));
        console.warn(`⚠️ Lote ${chunkNumber} retornou uma resposta vazia.`);
      }
    } catch (error) {
      chunk.forEach(lic => setCachedAnalysis(lic.numeroControlePNCP, false));
      console.error(`❌ Erro ao analisar o lote ${chunkNumber} com Gemini:`, error);
    }

    if (chunkNumber < totalChunks) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    chunkIndex++;
  }

  console.log(`✅ Análise completa. Total de ${allViableBids.length} licitações consideradas viáveis (incluindo cache).`);
  return allViableBids;
}