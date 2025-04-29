// src/app/api/ask-chat/route.tsx
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, GoogleGenerativeAIError } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'A pergunta é obrigatória e deve ser uma string não vazia.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
    Você é um assistente que extrai filtros a partir de perguntas sobre licitações.
    Sempre responda com um JSON com os seguintes campos:
    - palavrasChave: string[] — palavras principais extraídas da pergunta.
    - sinonimos: string[][] — um array com sinônimos de cada palavra-chave.
    - valorMin: number | null — valor mínimo extraído da pergunta.
    - valorMax: number | null — valor máximo extraído da pergunta.
    - estado: string | null — o estado mencionado na pergunta (ex: "São Paulo", "RJ"). Se nenhum estado for mencionado, retorne null.
    
    Se algum dos campos anteriores não puder ser identificado, retorne null para esse campo.
    
    Pergunta: "${question}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const parsed = JSON.parse(text);
      return new Response(JSON.stringify(parsed), { status: 200 });
    } catch (err) {
      console.error('Erro ao interpretar resposta da IA:', err);
      return new Response(JSON.stringify({ error: 'Erro ao interpretar filtros da IA.', respostaBruta: text }), { status: 500 });
    }
  } catch (error) {
    console.error('Erro ao processar a requisição:', error);
    if (error instanceof GoogleGenerativeAIError) {
      // Se o erro for específico da API do Google, retorne a mensagem de erro
      return new Response(JSON.stringify({ error: `Erro na API do Google: ${error.message}` }), { status: 500 });
    }
    return new Response(JSON.stringify({ error: 'Erro ao processar a requisição com a IA.' }), { status: 500 });
  }
}