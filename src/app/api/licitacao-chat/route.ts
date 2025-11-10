// Arquivo: src/app/api/licitacao-chat/route.ts (Refatorado para Drizzle RAG)
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateQueryEmbedding } from "@/lib/embedding"; // O nosso ficheiro de embedding

// --- NOVAS IMPORTAÇÕES DRIZZLE ---
import { db } from "@/lib/db";
import { licitacaoDocumento, pncpLicitacao } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
// --- FIM NOVAS IMPORTAÇÕES ---

// Inicializa o modelo generativo (para responder)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro-latest",
  generationConfig: {
    temperature: 0.3,
  }
});

// Todas as importações de 'fs', 'path', 'pdf-parse' são removidas.

export async function POST(req: Request) {
  try {
    const { message, cacheKey, action } = await req.json();

    if (!message || !cacheKey || !action) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    // 1. Encontrar a licitação (helper no fim do ficheiro)
    const licitacao = await findLicitacaoByCacheKey(cacheKey);
    if (!licitacao) {
      return NextResponse.json({ status: "error", message: "Licitação não encontrada" }, { status: 404 });
    }
    const licitacaoPncpId = licitacao.numeroControlePNCP;


    if (action === "checkCache" || action === "clearCache") {
      // A "cache" agora é o nosso banco de dados vetorial.
      // Verificamos se os documentos já foram processados (existem chunks).
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(licitacaoDocumento)
        .where(eq(licitacaoDocumento.licitacaoPncpId, licitacaoPncpId));
      
      const docCount = Number(result[0].count); // Converte o count para número

      if (docCount > 0) {
        return NextResponse.json({
          status: "processed",
          message: `Base de conhecimento pronta com ${docCount} documentos.`,
        });
      } else {
        return NextResponse.json({
          status: "empty",
          message: "Os documentos desta licitação ainda não foram processados.",
        });
      }
    }

    if (action === "queryDocuments") {
      // --- INÍCIO DA LÓGICA RAG (Tarefa 6 com Drizzle) ---

      // 2. Gerar Embedding da Pergunta
      console.log(`[Chat RAG] Gerando embedding para a pergunta: ${message}`);
      const questionEmbedding = await generateQueryEmbedding(message);
      
      // Converte o array para o formato string que o 'sql' helper espera
      const vectorString = `[${questionEmbedding.join(',')}]`;

      // 3. Buscar Contexto (Retrieval) no pg-vector
      // Drizzle usa o helper `sql` para consultas customizadas como a busca vetorial
      console.log(`[Chat RAG] Buscando chunks relevantes para: ${licitacaoPncpId}`);
      
      // Esta é a consulta de similaridade de cosseno (<=>)
      const contextChunks = await db.select({
          texto: licitacaoDocumento.textoChunk,
        })
        .from(licitacaoDocumento)
        .where(eq(licitacaoDocumento.licitacaoPncpId, licitacaoPncpId))
        .orderBy(sql`${licitacaoDocumento.embedding} <=> ${vectorString}::vector`) // Ordena pelo mais similar
        .limit(5); // Pega os 5 chunks mais relevantes

      if (!contextChunks || contextChunks.length === 0) {
        console.log(`[Chat RAG] Nenhum chunk encontrado.`);
        return NextResponse.json({
          reply: "Não encontrei informações sobre isso nos documentos processados desta licitação.",
        });
      }

      console.log(`[Chat RAG] ${contextChunks.length} chunks encontrados.`);

      // 4. Injetar Contexto (Augmented)
      const context = contextChunks
        .map((chunk) => chunk.texto)
        .join("\n---\n");

      // 5. Gerar Resposta (Generation)
      const systemPrompt = `
        Você é um assistente especialista em licitações.
        Responda à PERGUNTA DO USUÁRIO usando APENAS o CONTEXTO fornecido abaixo, que foi extraído dos documentos oficiais da licitação.
        Se a resposta não estiver no contexto, diga "A informação solicitada não foi encontrada nos documentos da licitação."
        Seja direto e conciso.

        --- CONTEXTO ---
        ${context}
        --- FIM DO CONTEXTO ---

        PERGUNTA DO USUÁRIO: ${message}
      `;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
      });

      const reply = result.response.text();
      return NextResponse.json({ reply });
      // --- FIM DA LÓGICA RAG ---
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  } catch (error) {
    console.error("Erro na API licitacao-chat:", error);
    return NextResponse.json(
      {
        reply: "Desculpe, ocorreu um erro interno ao processar sua solicitação.",
      },
      { status: 500 },
    );
  }
}

/**
 * Helper refatorado para Drizzle
 * Encontra a licitação usando o cacheKey do front-end.
 * cacheKey = `pncp:${cnpj}:${ano}:${sequencial}`
 */
async function findLicitacaoByCacheKey(cacheKey: string) {
  try {
    const parts = cacheKey.split(":");
    if (parts.length !== 4 || parts[0] !== 'pncp') {
      throw new Error("Formato de cacheKey inválido.");
    }
    
    const [, cnpj, ano, sequencial] = parts;
    
    // Constrói a consulta com Drizzle
    const result = await db.select()
      .from(pncpLicitacao)
      .where(
        and(
          eq(pncpLicitacao.cnpjOrgao, cnpj),
          eq(pncpLicitacao.anoCompra, parseInt(ano)),
          eq(pncpLicitacao.sequencialCompra, parseInt(sequencial))
        )
      )
      .limit(1);
    
    return result[0] || null;

  } catch (error) {
    console.error("Erro ao parsear cacheKey:", error);
    return null;
  }
}