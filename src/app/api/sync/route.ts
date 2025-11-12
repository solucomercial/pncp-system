import { NextResponse } from "next/server";
import { runSync } from "@/lib/syncService";
import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('CRON_SECRET');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const targetDate = new Date(today);
    const existingLog = await db.select()
      .from(syncLog)
      .where(eq(syncLog.date, targetDate))
      .limit(1);

    if (existingLog.length > 0) {
      const log = existingLog[0];
      if (log.status === "running" || log.status === "success") {
        return NextResponse.json({
          message: `Sincronização para ${today} já em progresso ou concluída.`,
          log,
        });
      }
    }
    await runSync(1); 

    return NextResponse.json({
      message: `Sincronização para o dia anterior iniciada com sucesso.`,
    });
  } catch (error: unknown) {
    console.error("Erro na API de sync:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: "Erro interno do servidor", details: errorMessage },
      { status: 500 },
    );
  }
}