import { GoogleGenerativeAI, GoogleGenerativeAIError, GenerativeModel, GenerateContentResult } from '@google/generative-ai';
import { format } from 'date-fns';

if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ FATAL: GEMINI_API_KEY não está definida nas variáveis de ambiente.");
  throw new Error('GEMINI_API_KEY não está definida nas variáveis de ambiente');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export interface ExtractedFilters {
  palavrasChave: string[];
  sinonimos: string[][];
  valorMin: number | null;
  valorMax: number | null;
  estado: string | null;
  modalidade: string | null;
  dataInicial: string | null;
  dataFinal: string | null;
  blacklist: string[];
  smartBlacklist: string[];
}

async function generateContentWithRetry(model: GenerativeModel, prompt: string, maxRetries = 3): Promise<GenerateContentResult> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      return result;
    } catch (error) {
      if (error instanceof GoogleGenerativeAIError && error.message.includes('503')) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error(`❌ Falha na chamada ao Gemini após ${maxRetries} tentativas. Último erro:`, error);
          throw new Error(`O serviço de IA está temporariamente sobrecarregado. Por favor, tente novamente em alguns instantes. (Error: 503)`);
        }
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Serviço do Gemini sobrecarregado (503). Tentando novamente em ${delay / 1000}s... (Tentativa ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Falha ao gerar conteúdo após múltiplas tentativas.');
}


export async function extractFilters(question: string, userBlacklist: string[] = []): Promise<ExtractedFilters> {
  const defaultResponse: ExtractedFilters = {
    palavrasChave: [],
    sinonimos: [],
    valorMin: null,
    valorMax: null,
    estado: null,
    modalidade: null,
    dataInicial: null,
    dataFinal: null,
    blacklist: userBlacklist,
    smartBlacklist: [],
  };

  if (!question || typeof question !== 'string' || !question.trim()) {
    console.warn("⚠️ extractFilters chamada com pergunta inválida. Retornando resposta padrão.");
    defaultResponse.blacklist = userBlacklist;
    return defaultResponse;
  }
  console.log(`🧠 Chamando Gemini para extrair filtros de: "${question}"`);

  const hoje = new Date();
  const dataAtualFormatada = format(hoje, 'yyyy-MM-dd');

  const prompt = `
<MISSION>
Você é um assistente de IA especialista em licitações públicas no Brasil, atuando como um analista de licitações para a empresa SOLUÇÕES SERVIÇOS TERCEIRIZADOS LTDA (CNPJ 09.445.502/0001-09). Sua função é analisar a solicitação do usuário e convertê-la em um objeto JSON estrito e preciso, otimizando a busca por oportunidades de negócio relevantes para a empresa. A sua saída deve ser APENAS o objeto JSON.
</MISSION>

<CONTEXT>
A data de referência (hoje) é: ${dataAtualFormatada}.

**ÁREAS DE ATUAÇÃO PRINCIPAIS (O QUE A EMPRESA FAZ):**
Esta é a lista de ramos de atuação da empresa. Use-a como base principal para identificar palavras-chave e sinônimos.

1.  **Alimentação (Prisional, Hospitalar, Escolar):**
    * **Termos-chave**: "alimentação prisional", "alimentação hospitalar", "merenda escolar", "refeições coletivas", "nutrição", "PNAE".
    * **Sinônimos**: "refeições para presídios", "refeições para hospitais", "alimentação escolar", "gestão de refeitório", "kit lanche", "dieta hospitalar".

2.  **Facilities e Mão de Obra:**
    * **Termos-chave**: "fornecimento de mão de obra", "terceirização de serviços", "facilities", "postos de trabalho", "serviços continuados".
    * **Sinônimos**: "apoio administrativo", "recepcionista", "porteiro", "copeiragem", "serviços gerais", "mão de obra dedicada".

3.  **Limpeza e Conservação (Predial, Escolar, Hospitalar):**
    * **Termos-chave**: "limpeza predial", "limpeza e conservação", "limpeza hospitalar", "higienização de ambientes".
    * **Sinônimos**: "serviços de limpeza", "assepsia", "desinfecção hospitalar", "limpeza terminal", "tratamento de piso".

4.  **Frota com Motorista:**
    * **Termos-chave**: "locação de frota com motorista", "aluguel de veículos com condutor", "transporte de passageiros".
    * **Sinônimos**: "transporte executivo", "terceirização de frota com motorista", "veículos com motorista à disposição".

5.  **Engenharia e Manutenção Predial:**
    * **Termos-chave**: "manutenção predial", "reforma predial", "serviços de engenharia civil", "obras de pequeno porte".
    * **Sinônimos**: "manutenção preventiva", "manutenção corretiva", "pequenas reformas", "edificações".

6.  **Cogestão Prisional e PPPs:**
    * **Termos-chave**: "cogestão prisional", "gestão compartilhada de unidade prisional", "PPP", "parceria público-privada", "concessão administrativa".
    * **Sinônimos**: "administração prisional", "concessão patrocinada", "PMI", "edital de manifestação de interesse".

**ÁREAS DE NÃO-INTERESSE (O QUE A EMPRESA NÃO FAZ):**
Esta lista contém exemplos de serviços que **NÃO** são o foco da empresa. Use-a para popular a 'smartBlacklist' e refinar a busca, especialmente em consultas genéricas.
* **Eventos e Cultura**: "buffet", "coquetel", "organização de eventos", "shows", "bandas", "decoração natalina", "fogos de artifício", "camarim", "desfile".
* **Alimentação Varejo/Específica**: "pão", "confeitaria", "padaria", "picolé", "algodão doce", "coffee break".
* **Serviços de Obras Específicas**: "recapeamento asfáltico", "construção de pontes", "grandes obras de infraestrutura".
* **Controle de Pragas**: "dedetização", "desratização", "controle de pombos".
* **Serviços Automotivos**: "leilão de veículos", "lavagem automotiva", "locação de veículo sem motorista".
* **Educação e Social**: "cursos", "palestras", "trabalho social", "vagas de estágio".
* **Outros**: "segurança privada/vigilância armada", "consultoria", "assessoria", "leiloeiros", "serviços veterinários", "viagens e hotelaria".

**Modalidades de Licitação Conhecidas**: "Leilão Eletrônico", "Leilão Presencial", "Diálogo Competitivo", "Concurso", "Concorrência Eletrônica", "Concorrência Presencial", "Pregão Eletrônico", "Pregão Presencial", "Dispensa de Licitação", "Inexigibilidade de Licitação", "Manifestação de Interesse", "Pré-qualificação", "Credenciamento".
</CONTEXT>

<RULES>
1.  **JSON Estrito**: Sua saída deve ser **exclusivamente** um objeto JSON válido, sem nenhum texto, explicação ou formatação adicional.
2.  **Mapeamento de Termos**: Se a pergunta do usuário corresponder a uma ou mais **ÁREAS DE ATUAÇÃO PRINCIPAIS**, popule 'palavrasChave' com os "Termos-chave" e 'sinonimos' com os "Sinônimos" dos ramos correspondentes.
3.  **Blacklist do Usuário**: Extraia termos que o usuário explicitamente **NÃO** deseja ver (indicados por "exceto", "sem", "não quero", "excluindo"). Popule o array 'blacklist' apenas com esses termos.
4.  **Smart Blacklist (Filtro Inteligente)**:
    * **Se a busca for FOCADA** em uma ou mais áreas de atuação (ex: "quero limpeza hospitalar"), preencha a 'smartBlacklist' com termos das **ÁREAS DE NÃO-INTERESSE**.
    * **Se a busca for GENÉRICA** (ex: "licitações abertas em SP" ou "qualquer licitação"), preencha a 'smartBlacklist' de forma agressiva com **TODOS** os termos das **ÁREAS DE NÃO-INTERESSE** para garantir que apenas resultados relevantes para a empresa sejam retornados.
5.  **Interpretação de Dados**:
    * **Datas**: Hoje é ${dataAtualFormatada}. Use o formato YYYY-MM-DD. Se nenhum período for mencionado, 'dataInicial' e 'dataFinal' devem ser null.
    * **Valores**: Interprete "mil" como 1000, "milhão" como 1000000. "acima de X" é 'valorMin', "abaixo de X" é 'valorMax'.
    * **Estado**: Retorne a sigla em maiúsculas (ex: "Rio de Janeiro" -> "RJ").
    * **Modalidade**: Identifique a modalidade a partir da lista de modalidades conhecidas.

</RULES>

<EXAMPLES>
* **Exemplo 1 (Busca Focada):**
    * **Pergunta**: "Quero ver as licitações de alimentação prisional e hospitalar no estado de Minas Gerais."
    * **JSON Esperado**:
        {
          "palavrasChave": ["alimentação prisional", "refeições para presídios", "alimentação hospitalar", "refeições para hospitais"],
          "sinonimos": [["alimentação para detentos", "gestão de refeitório prisional"], ["gestão de refeitório hospitalar", "nutrição clínica"]],
          "valorMin": null,
          "valorMax": null,
          "estado": "MG",
          "modalidade": null,
          "dataInicial": null,
          "dataFinal": null,
          "blacklist": [],
          "smartBlacklist": ["buffet", "coquetel", "pão", "padaria", "dedetização", "leilão de veículos", "cursos", "segurança privada"]
        }
* **Exemplo 2 (Busca Genérica):**
    * **Pergunta**: "me mostre as licitações de hoje"
    * **JSON Esperado**:
        {
          "palavrasChave": [],
          "sinonimos": [],
          "valorMin": null,
          "valorMax": null,
          "estado": null,
          "modalidade": null,
          "dataInicial": "${dataAtualFormatada}",
          "dataFinal": "${dataAtualFormatada}",
          "blacklist": [],
          "smartBlacklist": ["buffet", "coquetel", "organização de eventos", "shows", "bandas", "decoração natalina", "fogos de artifício", "camarim", "desfile", "pão", "confeitaria", "padaria", "picolé", "algodão doce", "coffee break", "recapeamento asfáltico", "construção de pontes", "grandes obras de infraestrutura", "dedetização", "desratização", "controle de pombos", "leilão de veículos", "lavagem automotiva", "locação de veículo sem motorista", "cursos", "palestras", "trabalho social", "vagas de estágio", "segurança privada/vigilância armada", "consultoria", "assessoria", "leiloeiros", "serviços veterinários", "viagens e hotelaria"]
        }
* **Exemplo 3 (Busca com Exclusão):**
    * **Pergunta**: "licitações de facilities acima de 500 mil, sem copeiragem"
    * **JSON Esperado**:
        {
          "palavrasChave": ["fornecimento de mão de obra", "terceirização de serviços", "facilities"],
          "sinonimos": [["apoio administrativo", "recepcionista", "porteiro", "serviços gerais"]],
          "valorMin": 500000,
          "valorMax": null,
          "estado": null,
          "modalidade": null,
          "dataInicial": null,
          "dataFinal": null,
          "blacklist": ["copeiragem"],
          "smartBlacklist": ["buffet", "coquetel", "pão", "dedetização", "leilão de veículos", "cursos", "segurança privada"]
        }
</EXAMPLES>

<OUTPUT_FORMAT>
Sua única saída deve ser um objeto JSON válido, aderindo à seguinte estrutura:
{
  "palavrasChave": ["string"],
  "sinonimos": [["string"]],
  "valorMin": number | null,
  "valorMax": number | null,
  "estado": string | null,
  "modalidade": string | null,
  "dataInicial": string | null,
  "dataFinal": string | null,
  "blacklist": ["string"],
  "smartBlacklist": ["string"]
}
</OUTPUT_FORMAT>
---
Agora, analise a pergunta abaixo e retorne APENAS o objeto JSON correspondente.
Pergunta do Usuário: "${question}"
`;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await generateContentWithRetry(model, prompt);

    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error('Falha ao extrair filtros: resposta da IA vazia');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta da IA não contém um objeto JSON válido.');

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

    const explicitBlacklist = Array.isArray(parsedResponse.blacklist) ? parsedResponse.blacklist.filter(item => typeof item === 'string').map(item => item.toLowerCase()) : [];
    validatedResponse.blacklist = [...new Set([...userBlacklist.map(term => term.toLowerCase()), ...explicitBlacklist])];

    if (Array.isArray(parsedResponse.smartBlacklist)) validatedResponse.smartBlacklist = parsedResponse.smartBlacklist.filter(item => typeof item === 'string').map(item => item.toLowerCase());

    console.log("✅ Filtros extraídos e validados:", validatedResponse);
    return validatedResponse;

  } catch (error: unknown) {
    console.error('❌ Erro em extractFilters:', error);
    if (error instanceof Error) {
      throw new Error(`Falha na comunicação com a IA Gemini: ${error.message}`);
    }
    throw new Error("Ocorreu um erro desconhecido durante a extração de filtros.");
  }
}