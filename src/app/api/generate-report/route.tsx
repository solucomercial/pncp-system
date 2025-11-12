import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pncpLicitacao } from "@/lib/db/schema";
import { and, gte, lte, ilike } from "drizzle-orm";

function convertToCSV(data: Record<string, any>[]) {
  if (data.length === 0) {
    return "";
  }
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];

  for (const row of data) {
    const values = headers.map((header) => {
      let value = row[header];
      if (value === null || value === undefined) {
        value = "";
      } else if (typeof value === 'string') {
        value = `"${value.replace(/"/g, '""')}"`;
      } else if (value instanceof Date) {
        value = `"${value.toISOString()}"`;
      }
      return value;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const dataInicial = searchParams.get("dataInicial");
    const dataFinal = searchParams.get("dataFinal");
    const query = searchParams.get("query");

    const conditions = [];

    if (dataInicial) {
      conditions.push(gte(pncpLicitacao.dataPublicacaoPNCP, new Date(dataInicial.replace(/-/g, '\/'))));
    }
    if (dataFinal) {
      const dataFinalMaisUm = new Date(dataFinal.replace(/-/g, '\/'));
      dataFinalMaisUm.setDate(dataFinalMaisUm.getDate() + 1);
      conditions.push(lte(pncpLicitacao.dataPublicacaoPNCP, dataFinalMaisUm));
    }
    if (query) {
      conditions.push(ilike(pncpLicitacao.objetoCompra, `%${query}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const licitacoes = await db.select()
      .from(pncpLicitacao)
      .where(whereClause);

    if (licitacoes.length === 0) {
      return NextResponse.json({ message: "Nenhum dado encontrado para o relatório." }, { status: 404 });
    }

    const csvData = convertToCSV(licitacoes);

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio_licitacoes.csv"`,
      },
    });

  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}