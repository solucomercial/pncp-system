import { GoogleGenerativeAI, GoogleGenerativeAIError, GenerateContentResult } from '@google/generative-ai';
import { PncpLicitacao } from './types';

// Garante que a chave da API está definida
if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GOOGLE_API_KEY não está definida nas variáveis de ambiente.");
  throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}

// Inicializa o cliente da IA Generativa do Google
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Configura o modelo a ser usado (gemini-1.5-flash foi o que resolveu o 404)
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash", // Modelo que funcionou para evitar o 404
  generationConfig: {
    temperature: 0.2, // Baixa temperatura para respostas mais consistentes/determinísticas
    responseMimeType: "application/json", // Solicita resposta em formato JSON
  }
});

function extractJsonFromString(text: string): string | null {
  // Regex para encontrar ```json ... ``` ou um objeto/array JSON
  const match = text.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) {
    // Retorna o conteúdo dentro de ```json ... ``` (grupo 1) ou o objeto/array JSON (grupo 2)
    return match[1] || match[2];
  }
  return null; // Retorna null se nenhum JSON for encontrado
}

async function generateContentWithRetry(prompt: string, maxRetries = 3): Promise<GenerateContentResult> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      // Tenta gerar o conteúdo usando o modelo configurado
      const result = await model.generateContent(prompt);
      return result; // Retorna o resultado se bem-sucedido
    } catch (error) {
      const apiError = error as unknown;

      // Verifica se é um erro da API do Google e se é 503 (Serviço Indisponível) ou 429 (Limite de Taxa)
      if (
        apiError instanceof GoogleGenerativeAIError &&
        (typeof apiError.message === 'string' && apiError.message.includes('503') ||
          typeof (apiError as { status?: number }).status === 'number' && (apiError as { status?: number }).status === 429)
      ) {
        attempt++;
        const isRateLimit = (apiError as { status?: number }).status === 429;
        // Calcula o tempo de espera (backoff exponencial para 503, fixo para 429)
        const delayTime = isRateLimit ? 61000 : Math.pow(2, attempt) * 1000;

        if (attempt >= maxRetries) {
          console.error(`❌ Falha na chamada ao Gemini após ${maxRetries} tentativas.`, error);
          throw new Error(`O serviço de IA está enfrentando problemas (${(apiError as { status?: number }).status}). Tente novamente mais tarde.`);
        }

        console.warn(`⚠️ Serviço do Gemini retornou status ${(apiError as { status?: number }).status || '503'}. Tentando novamente em ${delayTime / 1000}s...`);
        // Aguarda antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, delayTime));
      } else {
        // Se for outro tipo de erro, lança-o imediatamente
        throw error;
      }
    }
  }
  // Se esgotar as tentativas, lança um erro final
  throw new Error('Falha ao gerar conteúdo após múltiplas tentativas.');
}

// Tipos para atualização de progresso via callback
type ProgressUpdate = {
  type: 'progress' | 'start' | 'complete' | 'error';
  message: string;
  chunk?: number;
  totalChunks?: number;
  total?: number;
  processed?: number;
  data?: PncpLicitacao[]; // Pode incluir dados nos updates, se necessário
};

type ProgressCallback = (update: ProgressUpdate) => void;

// Interface para o objeto esperado da análise da IA
interface ViableBid {
    numeroControlePNCP: string;
    relevancia: 'Principal' | 'Adjacente' | 'Inviável'; // Inclui 'Inviável' como opção
    justificativa: string;
}

export async function analyzeAndFilterBids(
  licitacoes: PncpLicitacao[],
  onProgress: ProgressCallback
): Promise<PncpLicitacao[]> {
  if (!licitacoes || licitacoes.length === 0) {
    return [];
  }

  const allViableBids: PncpLicitacao[] = []; // Armazena as licitações viáveis
  const CHUNK_SIZE = 150; // Tamanho do lote para enviar à IA (ajuste conforme necessário)
  // Divide as licitações em lotes (chunks)
  const chunks = Array.from({ length: Math.ceil(licitacoes.length / CHUNK_SIZE) }, (_, i) =>
    licitacoes.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE)
  );
  const totalChunks = chunks.length;

  // Envia o update inicial de progresso
  onProgress({
    type: 'start',
    message: `Analisando ${licitacoes.length.toLocaleString('pt-BR')} licitações com IA...`,
    total: licitacoes.length,
    totalChunks,
  });

  let chunkIndex = 0;
  for (const chunk of chunks) {
    const chunkNumber = chunkIndex + 1;

    // Simplifica os dados enviados para a IA, contendo apenas o ID e o objeto
    const simplifiedBids = chunk.map(lic => ({
      numeroControlePNCP: lic.numeroControlePNCP,
      objetoCompra: lic.objetoCompra,
    }));

    // Monta o prompt para a IA
    const prompt = `
<MISSION>
Você é um analista de negócios sênior da empresa SOLUÇÕES SERVIÇOS TERCEIRIZADOS LTDA. Sua missão é classificar TODAS as licitações de uma lista, indicando se são oportunidades de negócio viáveis ('Principal' ou 'Adjacente') ou inviáveis ('Inviável') para a empresa, sempre fornecendo uma justificativa curta e objetiva.
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

**ÁREAS DE BAIXA PRIORIDADE / NÃO-INTERESSE (Geralmente Inviáveis):**
- **Eventos**: Buffet, festas, shows, decoração.
- **Varejo/Alimentação Específica**: Compra de pães, bolos, coffee break.
- **Serviços Hiper-especializados**: Construção de pontes, recapeamento asfáltico, segurança armada, consultorias.
- **Locação SEM Motorista**.
- **Outros**: Controle de pragas, serviços automotivos específicos, educação/social, etc.
</COMPANY_PROFILE>

<INSTRUCTIONS>
1.  Analise **CADA** licitação da lista fornecida em <BIDS_TO_ANALYZE>.
2.  **Para CADA licitação**, classifique-a com um nível de 'relevancia': 'Principal', 'Adjacente' ou 'Inviável'.
3.  **Para CADA licitação**, escreva uma 'justificativa' curta e objetiva explicando a classificação (por que é viável ou por que não é).
4.  Utilize as definições do <COMPANY_PROFILE> para guiar sua análise. Licitações em 'ÁREAS DE BAIXA PRIORIDADE' devem ser marcadas como 'Inviável', a menos que haja uma razão estratégica muito clara (neste caso, explique na justificativa).
5.  Sua única saída deve ser um array JSON contendo **TODOS** os objetos das licitações analisadas, cada um com 'numeroControlePNCP', 'relevancia' e 'justificativa'. Certifique-se de que o JSON seja estritamente válido.
6.  Se a lista de entrada for vazia, retorne um array vazio: [].
</INSTRUCTIONS>

<BIDS_TO_ANALYZE>
${JSON.stringify(simplifiedBids, null, 2)}
</BIDS_TO_ANALYZE>

<OUTPUT_JSON_FORMAT>
[
  {
    "numeroControlePNCP": "ID_LICITACAO_VIAVEL_1",
    "relevancia": "Principal",
    "justificativa": "Encaixa-se perfeitamente em nossa atuação de Limpeza Hospitalar."
  },
  {
    "numeroControlePNCP": "ID_LICITACAO_ADJACENTE",
    "relevancia": "Adjacente",
    "justificativa": "Oportunidade para fornecer materiais de limpeza em grande escala, sinérgico com nossos serviços."
  },
  {
    "numeroControlePNCP": "ID_LICITACAO_INVIAVEL_1",
    "relevancia": "Inviável",
    "justificativa": "Objeto da licitação (Organização de Eventos) fora do escopo da empresa."
  },
  {
    "numeroControlePNCP": "ID_LICITACAO_INVIAVEL_2",
    "relevancia": "Inviável",
    "justificativa": "Serviço de segurança armada, área de não-interesse."
  }
]
</OUTPUT_JSON_FORMAT>
`;

    try {
      // Envia update de progresso para o lote atual
      onProgress({
        type: 'progress',
        message: `Analisando lote ${chunkNumber} de ${totalChunks}...`,
        chunk: chunkNumber,
        totalChunks,
      });

      // Chama a IA para gerar a análise
      const result = await generateContentWithRetry(prompt);
      const response = await result.response;
      const rawText = response.text(); // Pega a resposta crua da IA

      if (rawText) {
        // Extrai o JSON da resposta crua
        const jsonText = extractJsonFromString(rawText);
        if (jsonText) {
          try {
            // --- LIMPEZA DO JSON ANTES DO PARSE ---
            // Remove trailing commas (vírgulas antes de colchetes/chaves de fechamento)
            // e vírgulas extras entre elementos de array/objeto
            const cleanedJsonText = jsonText
              .replace(/,\s*([}\]])/g, "$1") // Remove vírgulas antes de } ou ]
              .replace(/([}\]])\s*,?\s*(?=[}\]])/g, "$1"); // Tenta remover vírgulas entre } ou ] (mais robusto)

            // Faz o parse do JSON limpo
            const analysisResults = JSON.parse(cleanedJsonText) as ViableBid[];

            // Log opcional para depuração
            // console.log(`--- JSON Extraído e Limpo (Lote ${chunkNumber}) ---`);
            // console.log(cleanedJsonText);

            // Cria um Set com os IDs das licitações classificadas como 'Principal' ou 'Adjacente'
            const viablePncpIds = new Set(
              analysisResults
                .filter(b => b.relevancia === 'Principal' || b.relevancia === 'Adjacente') // Filtra apenas as viáveis
                .map(b => b.numeroControlePNCP) // Pega apenas os IDs
            );

            // Filtra o lote original mantendo apenas as licitações cujos IDs estão no Set de viáveis
            const filteredChunk = chunk.filter(lic => viablePncpIds.has(lic.numeroControlePNCP));
            // Adiciona as licitações filtradas do lote atual ao resultado final
            allViableBids.push(...filteredChunk);
            // -------- FIM DAS MODIFICAÇÕES --------

          } catch (parseError) {
            // Se o parse falhar mesmo após a limpeza, loga o erro e o JSON problemático
            console.error(`❌ Erro de parse JSON no lote ${chunkNumber} mesmo após limpeza:`, parseError);
            console.error('JSON extraído (antes da limpeza) que falhou:', jsonText);
            // Pode ser útil logar o JSON após a limpeza também para depuração
            // console.error('JSON após tentativa de limpeza:', cleanedJsonText);
             onProgress({
                type: 'error',
                message: `Erro ao interpretar a análise da IA para o lote ${chunkNumber}.`,
             });
          }
        } else {
          // Se não conseguir extrair JSON da resposta
          console.warn(`⚠️ Não foi possível extrair JSON da resposta do lote ${chunkNumber}. Resposta crua:`, rawText);
           onProgress({
              type: 'error',
              message: `Resposta inesperada da IA para o lote ${chunkNumber}.`,
           });
        }
      } else {
        // Se a IA retornar uma resposta vazia
        console.warn(`⚠️ Lote ${chunkNumber} retornou uma resposta vazia.`);
         onProgress({
            type: 'error',
            message: `A IA não respondeu para o lote ${chunkNumber}.`,
         });
      }
    } catch (error) {
      // Se ocorrer um erro durante a chamada à API ou processamento
      console.error(`❌ Erro ao analisar o lote ${chunkNumber} com Gemini:`, error);
      // Notifica o frontend sobre o erro no lote
      onProgress({
        type: 'error',
        message: `Erro ao processar lote ${chunkNumber}. Detalhes no console.`,
      });
    }

    // Pequena pausa entre lotes para evitar sobrecarga (opcional, ajuste conforme necessário)
    if (chunkNumber < totalChunks) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa de 1 segundo
    }

    chunkIndex++;
  }

  // Log final e retorno das licitações filtradas
  console.log(`✅ Análise completa. Total de ${allViableBids.length} licitações consideradas viáveis.`);
   onProgress({
     type: 'complete', // Indica que a análise foi concluída (pode ser usado para fechar toast de loading)
     message: 'Análise com IA finalizada.',
     total: allViableBids.length // Pode enviar o total final se útil
   });
  return allViableBids;
}