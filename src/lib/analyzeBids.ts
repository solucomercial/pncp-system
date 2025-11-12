import { GoogleGenerativeAI } from "@google/generative-ai";
import { processAndEmbedDocuments } from "./pdfProcessing";
import { pncpLicitacao } from "@/lib/db/schema";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json", 
    temperature: 0.2,
  },
});

interface AIAnalysis {
  resumo: string;
  palavrasChave: string[];
  grauRelevanciaIA: "Alta" | "Média" | "Baixa";
  justificativaRelevanciaIA: string;
}

interface FullAnalysis extends AIAnalysis {
  allFileUrls: string[];
}

// Tipo para a licitação vinda da API PNCP (antes do upsert)
type ApiPncpLicitacao = Record<string, any>; 

export async function analyzeLicitacao(
  // Aceita o tipo inferido do schema Drizzle OU o tipo da API
  licitacao: typeof pncpLicitacao.$inferSelect | ApiPncpLicitacao,
): Promise<FullAnalysis | null> {
  console.log(`Analisando licitação: ${licitacao.numeroControlePNCP}`);
  
  // 1. Processa e salva os documentos (agora retorna texto E links)
  const { fullTextFromAllPdfs, allFileUrls } = await processAndEmbedDocuments(licitacao);

  // 2. Prepara o contexto da licitação
  const licitacaoContext = {
    objeto: licitacao.objetoCompra,
    // Converte 'Decimal' (do Prisma) ou 'string' (do Drizzle/API) para 'number'
    valor: Number(licitacao.valorEstimado) || 0, 
    modalidade: licitacao.modalidade,
    orgao: licitacao.orgao,
    municipio: licitacao.municipio,
    uf: licitacao.uf,
    dataPublicacao: licitacao.dataPublicacaoPNCP,
  };

  // 3. Define o prompt de relevância
  const systemPrompt = `
    Você é um especialista em licitações públicas no Brasil.
    Sua tarefa é analisar a seguinte licitação e retornar um JSON ESTRITO.
    
    Critérios para Relevância (Priorize estes critérios):
    - Alta: Licitações de alto valor (acima de R$ 1.000.000), objetos complexos (ex: desenvolvimento de software, consultoria estratégica, obras de engenharia de grande porte) ou que mencionem explicitamente termos de tecnologia avançada (ex: "inteligência artificial", "big data", "cibersegurança").
    - Média: Licitações de valor moderado, serviços contínuos (limpeza, segurança, manutenção predial) ou compras comuns de TI (computadores, licenças de software).
    - Baixa: Licitações de baixo valor (ex: pregão para compra de café, material de escritório, gêneros alimentícios), credenciamentos simples.

    Responda APENAS com um objeto JSON válido, seguindo este formato:
    {
      "resumo": "Um resumo conciso do objeto da licitação em uma frase.",
      "palavrasChave": ["palavra1", "palavra2", "palavra3"],
      "grauRelevanciaIA": "Alta" | "Média" | "Baixa",
      "justificativaRelevanciaIA": "Uma breve justificativa (máx 30 palavras) do porquê deste grau de relevância, baseada nos critérios e no conteúdo dos documentos."
    }

    --- DADOS DA LICITAÇÃO (JSON) ---
    ${JSON.stringify(licitacaoContext, null, 2)}

    --- CONTEÚDO DOS DOCUMENTOS (EDITAL/ANEXOS) ---
    {/* --- CORREÇÃO AQUI --- */}
    ${fullTextFromAllPdfs || "Nenhum documento PDF encontrado ou processado."} 
    ---
  `;

  try {
    // 4. Chamar a IA (sem alteração)
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
    });

    const responseText = result.response.text();
    const analysis = JSON.parse(responseText) as AIAnalysis;

    console.log(`Análise concluída para ${licitacao.numeroControlePNCP}: Relevância ${analysis.grauRelevanciaIA}`);
    
    return {
      ...analysis,
      allFileUrls: allFileUrls,
    };
    
  } catch (error) {
    console.error(`Erro ao analisar licitação ${licitacao.numeroControlePNCP}:`, error);
    
    return {
      resumo: "Análise de IA falhou.",
      palavrasChave: [],
      grauRelevanciaIA: "Média", // Default
      justificativaRelevanciaIA: "Erro no processamento da IA.",
      allFileUrls: allFileUrls, // Retorna os links mesmo em erro
    };
  }
}