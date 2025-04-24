import { GoogleGenerativeAI } from '@google/generative-ai';

// Certifique-se de que a chave de API está configurada no .env
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
 throw new Error('A chave de API do Google não está configurada. Adicione-a ao arquivo .env.');
}

// Inicialize a API do Gemini com a chave de API
const genAI = new GoogleGenerativeAI(apiKey);

// Selecione o modelo Gemini para chat
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// IMPORTANTE! Configure o runtime para edge
export const runtime = 'edge';

export async function POST(req: Request) {
 try {
  const { messages } = await req.json();

  // Converta o formato de mensagens do OpenAI para o formato do Gemini
  const geminiMessages = messages.map((msg: { role: string; content: string }) => ({
   role: msg.role === 'user' ? 'user' : 'model',
   parts: [{ text: msg.content }],
  }));

  // Solicite ao Gemini um streaming de conclusão de chat
  const response = await model.generateContentStream({
   contents: geminiMessages,
  });

  // Converta a resposta em um stream de texto amigável com tratamento de erro
  const stream = new ReadableStream({
   async pull(controller) {
    try {
     for await (const chunk of response.stream) {
      controller.enqueue(new TextEncoder().encode(chunk.text()));
     }
     controller.close();
    } catch (error) {
     console.error('Erro durante o streaming:', error);
     controller.error(error);
    }
   },
  });

  // Responda com o stream
  return new Response(stream);

 } catch (error) {
  console.error('Erro ao processar a solicitação:', error);
  return new Response('Erro interno do servidor', { status: 500 });
 }
}