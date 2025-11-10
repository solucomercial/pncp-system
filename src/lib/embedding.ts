// Arquivo: src/lib/embedding.ts
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

// Garante que a API Key está nas suas variáveis de ambiente
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004", // Modelo de embedding recomendado
});

export async function generateEmbedding(
  text: string,
): Promise<number[]> {
  try {
    const result = await embeddingModel.embedContent(
      {
        content: { parts: [{ text }], role: "user" },
        taskType: TaskType.RETRIEVAL_DOCUMENT, // Otimizado para indexação (RAG)
      },
    );
    return result.embedding.values;
  } catch (error) {
    console.error("Erro ao gerar embedding:", error);
    throw new Error("Falha na geração de embedding.");
  }
}

export async function generateQueryEmbedding(
  query: string,
): Promise<number[]> {
  try {
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: query }], role: "user" },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    return result.embedding.values;
  } catch (error) {
    console.error("Erro ao gerar embedding da consulta:", error);
    throw new Error("Falha na geração de embedding.");
  }
}