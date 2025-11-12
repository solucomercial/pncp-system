// Arquivo: src/app/api/buscar-licitacoes/route.tsx
import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { pncpLicitacao } from "@/lib/db/schema";
import { desc, sql, and, gte, lte, ilike, eq, asc } from "drizzle-orm";

const searchParamsSchema = z.object({
  page: z.string().default("1"),
  pageSize: z.string().default("10"),
  
  // Filtros
  dataInicial: z.string().optional(),
  dataFinal: z.string().optional(),
  query: z.string().optional(),
  grauRelevanciaIA: z.string().optional(),
  orgao: z.string().optional(),
  cnpjOrgao: z.string().optional(),
  uf: z.string().optional(),
  municipio: z.string().optional(),
  valorMin: z.string().optional(),
  valorMax: z.string().optional(),
  modalidade: z.string().optional(),
  numeroProcesso: z.string().optional(),

  // Ordenação
  sortBy: z.string().optional(), 
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());

    const validatedParams = searchParamsSchema.parse(params);
    const page = parseInt(validatedParams.page, 10);
    const pageSize = parseInt(validatedParams.pageSize, 10);
    const offset = (page - 1) * pageSize;
    
    const {
      dataInicial,
      dataFinal,
      query,
      sortBy,
      sortDir,
      grauRelevanciaIA,
      orgao,
      cnpjOrgao,
      uf,
      municipio,
      valorMin,
      valorMax,
      modalidade,
      numeroProcesso
    } = validatedParams;

    const conditions = [];

    // ... (lógica de condições de filtro - sem alteração)
    if (dataInicial) {
      // Adicionada correção para datas (problema de fuso horário)
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
    if (orgao) {
      conditions.push(ilike(pncpLicitacao.orgao, `%${orgao}%`));
    }
    if (municipio) {
      conditions.push(ilike(pncpLicitacao.municipio, `%${municipio}%`));
    }
    if (modalidade) {
      conditions.push(ilike(pncpLicitacao.modalidade, `%${modalidade}%`));
    }
    if (numeroProcesso) {
      conditions.push(ilike(pncpLicitacao.numeroProcesso, `%${numeroProcesso}%`));
    }
    if (cnpjOrgao) {
      const cnpjLimpo = cnpjOrgao.replace(/\D/g, '');
      conditions.push(eq(pncpLicitacao.cnpjOrgao, cnpjLimpo));
    }
     if (uf) {
      conditions.push(eq(pncpLicitacao.uf, uf.toUpperCase()));
    }
    if (grauRelevanciaIA) {
      conditions.push(eq(pncpLicitacao.grauRelevanciaIA, grauRelevanciaIA));
    }
    if (valorMin) {
      conditions.push(gte(pncpLicitacao.valorEstimado, valorMin));
    }
    if (valorMax) {
      conditions.push(lte(pncpLicitacao.valorEstimado, valorMax));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // --- LÓGICA DE ORDENAÇÃO ATUALIZADA (Feature 2) ---
    let orderByClause;
    const direction = sortDir === "asc" ? asc : desc;
    const relevancyOrder = sql`
      CASE
        WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Alta' THEN 1
        WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Média' THEN 2
        WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Baixa' THEN 3
        ELSE 4
      END
    `;

    // Mapeamento de 'sortBy' (vindo da tabela) para colunas do DB
    switch (sortBy) {
      case "objetoCompra":
        orderByClause = [direction(pncpLicitacao.objetoCompra)];
        break;
      case "grauRelevanciaIA":
        orderByClause = [sortDir === "desc" ? desc(relevancyOrder) : asc(relevancyOrder), desc(pncpLicitacao.dataPublicacaoPNCP)];
        break;
      case "valorEstimado":
        orderByClause = [direction(pncpLicitacao.valorEstimado)];
        break;
      case "orgao":
        orderByClause = [direction(pncpLicitacao.orgao)];
        break;
      case "dataPublicacaoPNCP":
        orderByClause = [direction(pncpLicitacao.dataPublicacaoPNCP)];
        break;
      // Novas colunas ordenáveis
      case "municipio":
        orderByClause = [direction(pncpLicitacao.municipio)];
        break;
      case "uf":
        orderByClause = [direction(pncpLicitacao.uf)];
        break;
      case "cnpjOrgao":
        orderByClause = [direction(pncpLicitacao.cnpjOrgao)];
        break;
      case "situacao":
        orderByClause = [direction(pncpLicitacao.situacao)];
        break;
      case "numeroProcesso":
        orderByClause = [direction(pncpLicitacao.numeroProcesso)];
        break;
      
      // Fallback (Filtro 'relevancia' ou 'data')
      case "relevancia":
        orderByClause = [asc(relevancyOrder), desc(pncpLicitacao.dataPublicacaoPNCP)];
        break;
      case "data":
        orderByClause = [desc(pncpLicitacao.dataPublicacaoPNCP)];
        break;
      default:
         // Ordenação padrão (se nada for fornecido) é relevância
        orderByClause = [asc(relevancyOrder), desc(pncpLicitacao.dataPublicacaoPNCP)];
    }
    // --- FIM DA ATUALIZAÇÃO ---

    const licitacoes = await db.select()
      .from(pncpLicitacao)
      .where(whereClause)
      .orderBy(...orderByClause)
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
      page: page, 
      pageSize: pageSize, 
      pageCount: Math.ceil(total / pageSize)
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