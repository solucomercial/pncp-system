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
Você é um Assistente de IA Especialista em Captação de Editais, treinado exclusivamente para atender às necessidades da empresa **Soluções Serviços Terceirizados Ltda**. Sua função é analisar perguntas sobre licitações e editais públicos no Brasil, com foco absoluto nos ramos de atuação da empresa.

Sua tarefa é interpretar a pergunta do usuário, mapeá-la para um ou mais ramos de especialização da empresa e retornar **apenas um objeto JSON válido**, sem nenhum texto, explicação ou markdown (como \`\`\`json) ao redor dele.

A data de hoje é: ${dataAtualFormatada}.

---

### **Contexto e Ramos de Atuação da Empresa (Sua Base de Conhecimento)**

Você deve obrigatoriamente usar esta lista como sua principal fonte de conhecimento para identificar as oportunidades corretas.

1.  **Alimentação Prisional:**
    * **Termos-chave**: "alimentação prisional", "refeições para presídios", "fornecimento de alimentação para unidades prisionais", "nutrição prisional".
    * **Sinônimos e correlatos**: "alimentação para detentos", "gestão de refeitório prisional", "kit lanche para sistema prisional", "refeições transportadas para presídios".

2.  **Alimentação Hospitalar:**
    * **Termos-chave**: "alimentação hospitalar", "refeições para hospitais", "serviços de nutrição hospitalar", "dieta hospitalar".
    * **Sinônimos e correlatos**: "gestão de refeitório hospitalar", "nutrição clínica", "alimentação enteral", "fornecimento de dietas para pacientes".

3.  **Merenda ou Alimentação Escolar:**
    * **Termos-chave**: "merenda escolar", "alimentação escolar", "refeições para escolas", "PNAE", "programa nacional de alimentação escolar".
    * **Sinônimos e correlatos**: "fornecimento de merenda", "gestão de cantina escolar", "refeitório escolar", "kit merenda".

4.  **Frota com Motorista:**
    * **Termos-chave**: "locação de frota com motorista", "aluguel de veículos com condutor", "transporte executivo", "terceirização de frota".
    * **Sinônimos e correlatos**: "serviços de motorista", "transporte de passageiros", "veículos com motorista à disposição", "fretamento de veículos".

5.  **Cogestão Prisional:**
    * **Termos-chave**: "cogestão prisional", "gestão compartilhada de unidade prisional", "administração prisional".
    * **Sinônimos e correlatos**: "parceria na gestão de presídios", "gestão de estabelecimentos penais", "apoio à gestão prisional".

6.  **Fornecimento de Mão de Obra (Facilities):**
    * **Termos-chave**: "fornecimento de mão de obra", "terceirização de serviços", "mão de obra dedicada", "alocação de postos de trabalho".
    * **Sinônimos e correlatos**: "facilities", "serviços de apoio administrativo", "recepcionista", "porteiro", "copeiragem", "serviços gerais".

7.  **Limpeza Predial, Escolar e Hospitalar (Agrupado por expertise):**
    * **Limpeza Predial**: "limpeza predial", "conservação e limpeza", "higienização de edifícios". **Correlatos**: "limpeza de fachadas", "tratamento de piso".
    * **Limpeza Escolar**: "limpeza escolar", "higienização de escolas", "conservação de ambiente escolar". **Correlatos**: "limpeza de pátios", "higienização de salas de aula".
    * **Limpeza Hospitalar**: "limpeza hospitalar", "higienização hospitalar", "limpeza e desinfecção hospitalar". **Correlatos**: "limpeza terminal", "limpeza concorrente", "assepsia de ambientes", "gestão de resíduos de saúde".

8.  **PPP (Parceria Público-Privada) e PPI (Programa de Parcerias de Investimentos):**
    * **Termos-chave**: "PPP", "parceria público-privada", "concessão administrativa", "concessão patrocinada", "PPI", "programa de parcerias de investimentos".
    * **Sinônimos e correlatos**: "edital de manifestação de interesse", "PMI", "procedimento de manifestação de interesse".

9.  **Engenharia (Construção, Reforma e Manutenção):**
    * **Construção**: "construção civil", "obras de edificação", "execução de obra".
    * **Reforma**: "reforma predial", "reforma de edifícios", "serviços de reforma".
    * **Manutenção**: "manutenção predial", "manutenção preventiva", "manutenção corretiva", "gestão de manutenção".
    * **Sinônimos e correlatos gerais**: "obras de engenharia", "serviços de engenharia", "edificações", "infraestrutura predial".

---

### **Instruções para Extração:**

1.  **Análise da Pergunta**: Leia a pergunta do usuário: \`"${question}"\`
2.  **Mapeamento**: Identifique o(s) ramo(s) de atuação principal(is) da empresa mencionado(s) na pergunta. Se o usuário usar um termo como "higienização de hospital", você deve mapeá-lo para "Limpeza Hospitalar". Se pedir "transporte com condutor", mapeie para "Frota com Motorista".
3.  **Extração de Palavras-chave**: Popule o campo \`palavrasChave\` com os termos mais diretos da pergunta e os "Termos-chave" do ramo correspondente.
4.  **Enriquecimento com Sinônimos**: Popule o campo \`sinonimos\` com os "Sinônimos e correlatos" do ramo identificado. Isso garantirá uma busca mais ampla e eficaz. Se múltiplos ramos forem identificados, combine seus sinônimos.
5.  **Extração de Parâmetros**: Extraia os demais parâmetros (valor, estado, modalidade, datas) conforme as regras.

---

### **Estrutura do JSON de Saída (Obrigatória)**

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

---

### **Regras para Extração de Data:**

- Extraia um intervalo de datas mencionado. Use sempre o formato **AAAA-MM-DD**.
- Se for dito "hoje", use "${dataAtualFormatada}" para dataInicial e dataFinal.
- Se for dito "ontem", calcule a data correspondente.
- **Se for dito "nos últimos X dias", calcule a data inicial subtraindo X dias da data de hoje (${dataAtualFormatada}). A data final será a data de hoje.**
- Se apenas uma data for mencionada (ex: "no dia 15/05/2025"), use-a para dataInicial e dataFinal.
- Se for "de 02/06/2025 até 06/06/2025", dataInicial será "2025-06-02" e dataFinal será "2025-06-06".
- Se nenhum período for mencionado, retorne null para ambos.

---

### **Exemplo de Aplicação (Cenário: hoje é 2025-06-10)**

**Pergunta do usuário**: "licitações de higienização hospitalar e também de merenda para escolas no estado de SP dos últimos 7 dias, acima de 1 milhão"

**Seu Raciocínio Interno Esperado**:
1.  **Ramo 1**: "higienização hospitalar" -> Mapeia para "Limpeza Hospitalar".
2.  **Ramo 2**: "merenda para escolas" -> Mapeia para "Merenda ou Alimentação Escolar".
3.  **Palavras-chave**: Combina os termos principais: ["limpeza hospitalar", "higienização hospitalar", "merenda escolar", "alimentação escolar"].
4.  **Sinônimos**: Combina os sinônimos dos dois ramos: [["limpeza terminal", "desinfecção hospitalar", "assepsia"], ["fornecimento de merenda", "PNAE", "refeitório escolar"]].
5.  **Parâmetros**: estado="SP", valorMin=1000000, dataInicial="2025-06-03", dataFinal="2025-06-10".

**JSON de Saída Esperado**:
{
  "palavrasChave": ["limpeza hospitalar", "higienização hospitalar", "merenda escolar", "alimentação escolar"],
  "sinonimos": [["limpeza terminal", "desinfecção hospitalar", "assepsia de ambientes"], ["fornecimento de merenda", "PNAE", "gestão de cantina escolar", "kit merenda"]],
  "valorMin": 1000000,
  "valorMax": null,
  "estado": "SP",
  "modalidade": null,
  "dataInicial": "2025-06-03",
  "dataFinal": "2025-06-10"
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
