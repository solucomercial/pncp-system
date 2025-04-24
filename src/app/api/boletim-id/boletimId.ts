import type { NextApiRequest, NextApiResponse } from 'next';
import { conlicitacaoApi } from '@/lib/conlicitacaApi';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 const {
  query: { boletimId },
  method,
 } = req;

 if (method !== 'GET') {
  return res.status(405).json({ error: 'Método não permitido' });
 }

 if (!boletimId || typeof boletimId !== 'string') {
  return res.status(400).json({ error: 'ID do boletim inválido' });
 }

 try {
  const response = await conlicitacaoApi.get(`/boletim/${boletimId}`);
  res.status(200).json(response.data);
 } catch (error: unknown) {
  if (error instanceof Error) {
   console.error('Erro ao buscar boletim:', error.message);
  } else {
   console.error('Erro ao buscar boletim:', error);
  }
  res.status(500).json({ error: 'Erro ao buscar boletim' });
 }
}
