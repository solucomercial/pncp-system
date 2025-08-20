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

  console.log(`🔍 Verificando cache para ${licitacoes.length} licitações...`);
  for (const lic of licitacoes) {
    const cachedResult = getCachedAnalysis(lic.numeroControlePNCP);
    if (cachedResult === true) {
      cachedViableBids.push(lic);
    } else if (cachedResult === null) {
      bidsToAnalyze.push(lic);
    }
  }

  console.log(`✅ ${cachedViableBids.length} licitações viáveis encontradas no cache.`);
  console.log(`🧠 ${bidsToAnalyze.length} licitações restantes para análise com IA.`);

  if (bidsToAnalyze.length === 0) {
    onProgress({ type: 'complete', message: `Análise concluída. ${cachedViableBids.length} licitações viáveis encontradas no cache.` });
    return cachedViableBids;
  }

  const allViableBids: PncpLicitacao[] = [...cachedViableBids];
  const CHUNK_SIZE = 150;
  const chunks = [];
  for (let i = 0; i < bidsToAnalyze.length; i += CHUNK_SIZE) {
    chunks.push(bidsToAnalyze.slice(i, i + CHUNK_SIZE));
  }
  const totalChunks = chunks.length

  console.log(`🧠 Iniciando análise de ${bidsToAnalyze.length} licitações em ${totalChunks} lotes de até ${CHUNK_SIZE}.`);
  onProgress({
    type: 'start',
    message: `Análise com IA iniciada para ${bidsToAnalyze.length.toLocaleString('pt-BR')} licitações.`,
    total: bidsToAnalyze.length,
    totalChunks,
  });

  const analysisPromises = chunks.map(async (chunk, index) => {
    const chunkNumber = index + 1;

    const simplifiedBids = chunk.map(lic => ({
      numeroControlePNCP: lic.numeroControlePNCP,
      objetoCompra: lic.objetoCompra,
      modalidadeNome: lic.modalidadeNome,
      valorTotalEstimado: lic.valorTotalEstimado,
      municipioNome: lic.unidadeOrgao?.municipioNome,
      ufSigla: lic.unidadeOrgao?.ufSigla,
    }));

    const prompt = `
<MISSION>
Você é um analista de licitações sênior da empresa SOLUÇÕES SERVIÇOS TERCEIRIZADOS LTDA (CNPJ 09.445.502/0001-09). Sua tarefa é analisar uma lista de licitações em formato JSON e retornar **APENAS** uma sub-lista, também em formato JSON, contendo somente as licitações que são genuinamente relevantes e viáveis para a empresa. Seja extremamente rigoroso e detalhista em sua análise.
</MISSION>

<COMPANY_PROFILE>
**ÁREAS DE ATUAÇÃO ESTRATÉGICAS (O QUE BUSCAMOS):**
1.  **Alimentação Coletiva**: Fornecimento de refeições em grande escala para presídios, hospitais e escolas (merenda). Termos como "alimentação prisional", "alimentação hospitalar", "merenda escolar", "refeições coletivas" são de alto interesse.
2.  **Facilities e Mão de Obra**: Terceirização de serviços de apoio como "recepcionista", "porteiro", "copeiragem", "serviços gerais", "apoio administrativo".
3.  **Limpeza e Conservação Profissional**: "limpeza predial", "limpeza hospitalar", "higienização de ambientes". O foco é em contratos de serviço contínuo.
4.  **Locação de Frota COM Motorista**: Apenas "locação de veículos com condutor" ou "transporte de passageiros".
5.  **Manutenção Predial e Pequenas Reformas**: "manutenção preventiva", "manutenção corretiva", "pequenas obras de engenharia civil". **(Atenção: Veja a regra geográfica específica abaixo)**.
6.  **Grandes Projetos**: "cogestão prisional", "PPP" (Parceria Público-Privada) e "concessões" nas nossas áreas de atuação.

**REGRAS DE NEGÓCIO CONDICIONAIS (MUITO IMPORTANTE):**
- **REGRA 1 - OBRAS APENAS EM SP**: Licitações da área de "Manutenção Predial e Pequenas Reformas" ou qualquer outra que envolva "obras" ou "engenharia" só devem ser consideradas viáveis se o campo "ufSigla" for **"SP"**. Se for de qualquer outro estado, a licitação deve ser **descartada**.

**CRITÉRIOS DE EXCLUSÃO (O QUE DEVEMOS IGNORAR):**
- **Eventos**: Buffet, coquetel, festas, shows, decoração, fogos de artifício.
- **Alimentação Específica/Varejo**: Compra de pães, bolos, doces, coffee break. O foco é em refeições completas.
- **Obras de Grande Porte/Especializadas**: Construção de pontes, viadutos, recapeamento asfáltico.
- **Serviços que Não Prestamos**: Controle de pragas (dedetização), segurança patrimonial/vigilância armada, consultoria, assessoria, leilões de bens, serviços veterinários, hotelaria, lavagem de veículos.
- **Locação SEM Motorista**: Qualquer aluguel de veículos que não especifique claramente "com motorista" ou "com condutor".
- **Objetos Genéricos ou Suspeitos**: "teste", "simulação", "credenciamento de imprensa".
</COMPANY_PROFILE>

<INSTRUCTIONS>
1.  Para cada licitação na lista, verifique primeiro as **REGRAS DE NEGÓCIO CONDICIONAIS**.
2.  Em seguida, analise o **contexto** do 'objetoCompra' para diferenciar a **prestação de um serviço** (nosso foco) da **compra de um produto** (fora do nosso foco).
3.  Verifique os **CRITÉRIOS DE EXCLUSÃO**.
4.  Sua única saída deve ser um array JSON contendo os objetos das licitações que você aprovou.
5.  Se nenhuma licitação for viável após sua análise rigorosa, retorne um array vazio: [].
6.  Não inclua explicações, apenas o JSON.
</INSTRUCTIONS>

<EXAMPLES>
[
  {
    "input": { "numeroControlePNCP": "12345", "objetoCompra": "contratação de empresa para prestação de serviços de limpeza, asseio e conservação predial.", "ufSigla": "SP" },
    "output": { "numeroControlePNCP": "12345" },
    "motivo": "Objeto alinhado com a área de Limpeza e Conservação."
  },
  {
    "input": { "numeroControlePNCP": "67890", "objetoCompra": "aquisição de material de limpeza para a secretaria de educação.", "ufSigla": "SP" },
    "output": null,
    "motivo": "É uma compra de produto, não prestação de serviço."
  },
  {
    "input": { "numeroControlePNCP": "11223", "objetoCompra": "serviços de manutenção predial e pequenas reformas no edifício sede.", "ufSigla": "RJ" },
    "output": null,
    "motivo": "Descartado pela REGRA 1 (Obras apenas em SP)."
  }
]
</EXAMPLES>

<BIDS_TO_ANALYZE>
${JSON.stringify(simplifiedBids, null, 2)}
</BIDS_TO_ANALYZE>

<OUTPUT_JSON>
`;
    try {
      console.log(`🧠 Analisando lote ${chunkNumber} de ${totalChunks}...`);
      onProgress({
        type: 'progress',
        message: `Analisando lote ${chunkNumber} de ${totalChunks}...`,
        chunk: chunkNumber,
        totalChunks: totalChunks,
      });

      const result = await generateContentWithRetry(prompt);
      const response = await result.response;
      const text = response.text();

      if (text) {
        const viableSimplifiedBids = JSON.parse(text) as { numeroControlePNCP: string }[];
        const viablePncpIds = new Set(viableSimplifiedBids.map(b => b.numeroControlePNCP));

        const filteredChunk = chunk.filter(lic => {
          const isViable = viablePncpIds.has(lic.numeroControlePNCP);
          setCachedAnalysis(lic.numeroControlePNCP, isViable);
          return isViable;
        });

        return filteredChunk;

      } else {
        chunk.forEach(lic => setCachedAnalysis(lic.numeroControlePNCP, false));
        console.warn(`⚠️ Lote ${chunkNumber} retornou uma resposta vazia. Todas as licitações do lote foram marcadas como não-viáveis.`);
        return [];
      }
    } catch (error) {
      chunk.forEach(lic => setCachedAnalysis(lic.numeroControlePNCP, false));
      console.error(`❌ Erro ao analisar o lote ${chunkNumber} com Gemini:`, error);
      return [];
    }
  });

  const resultsFromAllChunks = await Promise.all(analysisPromises);

  resultsFromAllChunks.forEach(chunkResult => {
    allViableBids.push(...chunkResult);
  });

  console.log(`✅ Análise completa. Total de ${allViableBids.length} licitações consideradas viáveis (incluindo cache).`);
  return allViableBids;
}