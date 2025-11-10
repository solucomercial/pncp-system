import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { pncpLicitacao } from "@/lib/db/schema";
import { desc, sql, and, gte, lte, ilike } from "drizzle-orm";

const searchParamsSchema = z.object({
  page: z.string().default("1"),
  pageSize: z.string().default("10"),
  dataInicial: z.string().optional(),
  dataFinal: z.string().optional(),
  query: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validatedParams = searchParamsSchema.parse(params);
    const page = parseInt(validatedParams.page, 10);
    const pageSize = parseInt(validatedParams.pageSize, 10);
    const offset = (page - 1) * pageSize;
    const { dataInicial, dataFinal, query } = validatedParams;

    const conditions = [];

    if (dataInicial) {
      conditions.push(gte(pncpLicitacao.dataPublicacaoPNCP, new Date(dataInicial)));
    }
    if (dataFinal) {
      const dataFinalMaisUm = new Date(dataFinal);
      dataFinalMaisUm.setDate(dataFinalMaisUm.getDate() + 1);
      conditions.push(lte(pncpLicitacao.dataPublicacaoPNCP, dataFinalMaisUm));
    }
    if (query) {
      conditions.push(ilike(pncpLicitacao.objetoCompra, `%${query}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const licitacoes = await db.select()
      .from(pncpLicitacao)
      .where(whereClause)
      .orderBy(desc(pncpLicitacao.dataPublicacaoPNCP))
      .limit(pageSize)
      .offset(offset);

    const totalResult = await db.select({
        count: sql<number>`count(*)`.mapWith(Number)
      })
      .from(pncpLicitacao)
      .where(whereClause);

    const total = totalResult[0].count;

    return NextResponse.json({
      licitacoes,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Erro ao buscar licitações:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}