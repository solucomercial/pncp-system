// src/app/api/boletim-id/[boletimId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDetalhesBoletim } from '@/lib/comprasApi';

interface Params {
 params: {
  boletimId: string;
 }
}

export async function GET(req: NextRequest, { params }: Params) {
 const { boletimId } = params;

 if (!boletimId || isNaN(parseInt(boletimId, 10))) {
  return NextResponse.json({ error: 'ID do boletim inválido ou ausente na URL.' }, { status: 400 });
 }

 const idNumerico = parseInt(boletimId, 10);
 console.log(`📞 Rota API: Buscando detalhes para Boletim ID: ${idNumerico}`);

 try {
  const response = await getDetalhesBoletim(idNumerico);

  if (!response.success) {
   console.error(`❌ Erro ao buscar detalhes do boletim ${idNumerico} via rota API:`, response.error);
   return NextResponse.json(
    { error: 'Erro ao buscar detalhes do boletim', message: response.error },
    { status: response.status || 502 }
   );
  }

  console.log(`✅ Rota API: Detalhes do boletim ${idNumerico} encontrados.`);
  return NextResponse.json(response.data, { status: 200 });

 } catch (error: unknown) {
  console.error(`❌ Erro inesperado na rota /api/boletim-id/${boletimId}:`, error);
  return NextResponse.json({ error: 'Erro interno do servidor ao processar a requisição do boletim.' }, { status: 500 });
 }
}

// Handler OPTIONS para CORS Preflight (se necessário acessar esta rota diretamente do frontend)
export async function OPTIONS(req: NextRequest) {
 const origin = req.headers.get('origin');
 const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://kzmopug2zuivuibmmes7.lite.vusercontent.net'];
 const headers = new Headers();

 if (origin && allowedOrigins.includes(origin)) {
  headers.set('Access-Control-Allow-Origin', origin);
 } else if (allowedOrigins.includes('*')) {
  headers.set('Access-Control-Allow-Origin', '*');
 }
 headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS'); // Apenas GET e OPTIONS
 headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
 headers.set('Access-Control-Max-Age', '86400');

 return new Response(null, { status: 204, headers });
}