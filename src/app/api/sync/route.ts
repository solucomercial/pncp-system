import { NextResponse, NextRequest } from 'next/server';
import { runSync } from '@/lib/syncService';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
 const authorization = request.headers.get('authorization');

 if (authorization !== `Bearer ${CRON_SECRET}`) {
  return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
 }

 // Verifica se o parâmetro 'initial_load' foi passado na URL
 const { searchParams } = new URL(request.url);
 const isInitialLoad = searchParams.get('initial_load') === 'true';

 try {
  console.log(`[API Sync] Recebida requisição de sincronização autorizada (Initial Load: ${isInitialLoad}).`);
  // Passa o parâmetro para a função runSync
  const result = await runSync(isInitialLoad);

  if (result.success) {
   return NextResponse.json({ message: result.message });
  } else {
   return NextResponse.json({ message: result.message }, { status: 500 });
  }
 } catch (error) {
  console.error('[API Sync] Erro inesperado na rota de sincronização:', error);
  const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
  return NextResponse.json({ message: 'Erro interno do servidor.', error: errorMessage }, { status: 500 });
 }
}