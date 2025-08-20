import { GoogleGenerativeAI, GoogleGenerativeAIError, GenerateContentResult } from '@google/generative-ai';
import { PncpLicitacao } from './types';

if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GOOGLE_API_KEY não está definida nas variáveis de ambiente.");
  throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// --- INÍCIO DA ALTERAÇÃO ---
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
  // --- FIM DA ALTERAÇÃO ---
  if (!licitacoes || licitacoes.length === 0) {
    return [];
  }

  const allViableBids: PncpLicitacao[] = [];
  const CHUNK_SIZE = 150;
  const totalChunks = Math.ceil(licitacoes.length / CHUNK_SIZE);

  // --- INÍCIO DA ALTERAÇÃO ---
  console.log(`🧠 Iniciando análise de ${licitacoes.length} licitações em lotes de ${CHUNK_SIZE}.`);
  onProgress({
    type: 'start',
    message: `Análise com IA iniciada para ${licitacoes.length.toLocaleString('pt-BR')} licitações.`,
    total: licitacoes.length,
    totalChunks,
  });
  // --- FIM DA ALTERAÇÃO ---

  for (let i = 0; i < licitacoes.length; i += CHUNK_SIZE) {
    const chunk = licitacoes.slice(i, i + CHUNK_SIZE);
    const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;

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

<BIDS_TO_ANALYZE>
${JSON.stringify(simplifiedBids, null, 2)}
</BIDS_TO_ANALYZE>

<OUTPUT_JSON>
`;

    try {
      // --- INÍCIO DA ALTERAÇÃO ---
      console.log(`🧠 Analisando lote ${chunkNumber} de ${totalChunks}...`);
      onProgress({
        type: 'progress',
        message: `Analisando lote ${chunkNumber} de ${totalChunks}...`,
        chunk: chunkNumber,
        totalChunks: totalChunks,
      });
      // --- FIM DA ALTERAÇÃO ---
      const result = await generateContentWithRetry(prompt);
      const response = await result.response;
      const text = response.text();

      if (text) {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const jsonText = jsonMatch[0];
          const viableSimplifiedBids = JSON.parse(jsonText) as { numeroControlePNCP: string }[];
          const viablePncpIds = new Set(viableSimplifiedBids.map(b => b.numeroControlePNCP));

          const filteredChunk = chunk.filter(lic => viablePncpIds.has(lic.numeroControlePNCP));
          allViableBids.push(...filteredChunk);
        } else {
          console.warn(`⚠️ Lote ${Math.floor(i / CHUNK_SIZE) + 1} não retornou um JSON de array válido.`);
        }
      }

      if ((i + CHUNK_SIZE) < licitacoes.length) {
        await delay(1000);
      }

    } catch (error) {
      console.error(`❌ Erro ao analisar o lote ${Math.floor(i / CHUNK_SIZE) + 1} com Gemini:`, error);
    }
  }

  // --- INÍCIO DA ALTERAÇÃO ---
  console.log(`✅ Análise completa. Total de ${allViableBids.length} licitações consideradas viáveis.`);
  return allViableBids;
}
// --- FIM DA ALTERAÇÃO ---