import { NextApiRequest, NextApiResponse } from 'next';
import { extractFilters } from '@/lib/extractFilters';

// Configuração de rate limiting
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 10;
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userRequests = requestCounts.get(ip);

  if (!userRequests || now > userRequests.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userRequests.count >= MAX_REQUESTS) {
    return false;
  }

  userRequests.count++;
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido',
      message: 'Apenas requisições POST são aceitas',
    });
  }

  // Verificar rate limit
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Limite de requisições excedido',
      message: 'Por favor, aguarde um momento antes de tentar novamente',
    });
  }

  try {
    // Validar corpo da requisição
    if (!req.body) {
      return res.status(400).json({
        error: 'Corpo da requisição inválido',
        message: 'O corpo da requisição não pode estar vazio',
      });
    }

    const { question } = req.body;

    // Validar pergunta
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Pergunta inválida',
        message: 'A pergunta deve ser uma string não vazia',
      });
    }

    // Extrair filtros da pergunta usando IA (agora usando Gemini)
    const filters = await extractFilters(question);

    // Aqui você implementaria a lógica real de busca no banco de dados
    // usando os 'filters' extraídos.
    // Por enquanto, retornamos dados mockados para demonstração.
    const mockData = {
      resultados: [
        {
          boletim: '1234',
          data: '2024-03-15',
          licitacoes: [
            {
              id: '1',
              objeto: 'Aquisição de veículos para frota municipal',
              valor_estimado: 750000,
              link_edital: 'https://example.com/edital1.pdf',
            },
            {
              id: '2',
              objeto: 'Manutenção de veículos da frota',
              valor_estimado: 250000,
              link_edital: 'https://example.com/edital2.pdf',
            },
          ],
        },
      ],
      filtros: filters, // Incluindo os filtros extraídos na resposta
    };

    // Configurar cache
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');

    return res.status(200).json(mockData);
  } catch (error) {
    console.error('Erro ao processar requisição:', error);

    // Tratamento específico para diferentes tipos de erro
    if (error instanceof Error) {
      if (error.message.includes('GOOGLE_API_KEY')) {
        return res.status(500).json({
          error: 'Erro de configuração',
          message: 'Chave da API Google não configurada',
        });
      }

      if (error.message.includes('Falha na comunicação com a IA Gemini')) {
        return res.status(503).json({
          error: 'Serviço temporariamente indisponível',
          message: 'Erro na comunicação com o serviço de IA Gemini',
        });
      }

      if (error.message.includes('Falha ao analisar resposta da IA')) {
        return res.status(500).json({
          error: 'Erro ao processar resposta da IA',
          message: 'A resposta da IA não pôde ser interpretada',
        });
      }
    }

    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Ocorreu um erro ao processar sua requisição',
    });
  }
}