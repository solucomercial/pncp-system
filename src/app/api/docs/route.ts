// src/app/api/docs/route.ts
import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger';

export async function GET() {
  try {
    const spec = getApiDocs();
    return NextResponse.json(spec);
  } catch (error) {
    console.error("Failed to generate API docs:", error);
    return new NextResponse("Failed to generate API docs", { status: 500 });
  }
}