import { NextResponse } from 'next/server';
import { runSync } from '@/lib/syncService';

// Esta é a chave secreta que o seu serviço de Cron Job vai usar para se autenticar.
// É MUITO IMPORTANTE que este valor seja o mesmo que está no seu arquivo .env
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
 // Medida de segurança: Verifica se a chave secreta foi enviada no cabeçalho da requisição.
 const authorization = request.headers.get('authorization');

 if (authorization !== `Bearer ${CRON_SECRET}`) {
  // Se a chave estiver errada ou não for enviada, retorna um erro de "Não Autorizado".
  return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
 }

 try {
  // Se a chave estiver correta, executa o serviço de sincronização.
  console.log('[API Sync] Recebida requisição de sincronização autorizada.');
  const result = await runSync();

  if (result.success) {
   return NextResponse.json({ message: result.message });
  } else {
   // Se algo der errado no serviço, retorna um erro de servidor.
   return NextResponse.json({ message: result.message }, { status: 500 });
  }
 } catch (error) {
  console.error('[API Sync] Erro inesperado na rota de sincronização:', error);
  const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
  return NextResponse.json({ message: 'Erro interno do servidor.', error: errorMessage }, { status: 500 });
 }
}