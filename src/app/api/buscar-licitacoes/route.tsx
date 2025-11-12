import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { pncpLicitacao } from "@/lib/db/schema";
import { desc, sql, and, gte, lte, ilike, eq, asc } from "drizzle-orm";

// Schema expandido para incluir todos os filtros e ordenação
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
  sortBy: z.string().optional(), // vindo do filtro ou da tabela
  sortDir: z.enum(["asc", "desc"]).optional(), // vindo da tabela
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
      sortDir, // Novo
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

    // Filtros de Data
    if (dataInicial) {
      conditions.push(gte(pncpLicitacao.dataPublicacaoPNCP, new Date(dataInicial)));
    }
    if (dataFinal) {
      const dataFinalMaisUm = new Date(dataFinal);
      dataFinalMaisUm.setDate(dataFinalMaisUm.getDate() + 1); // Pega até o fim do dia
      conditions.push(lte(pncpLicitacao.dataPublicacaoPNCP, dataFinalMaisUm));
    }
    
    // Filtros de Texto (ilike para case-insensitive)
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

    // Filtros de Correspondência Exata (eq)
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

    // Filtros de Valor (Numérico)
    if (valorMin) {
      conditions.push(gte(pncpLicitacao.valorEstimado, valorMin));
    }
    if (valorMax) {
      conditions.push(lte(pncpLicitacao.valorEstimado, valorMax));
    }

    // Constrói a cláusula WHERE
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // --- LÓGICA DE ORDENAÇÃO ATUALIZADA ---
    let orderByClause;
    const direction = sortDir === "asc" ? asc : desc;

    // Mapeamento de 'sortBy' (vindo da tabela) para colunas do DB
    switch (sortBy) {
      case "objetoCompra":
        orderByClause = [direction(pncpLicitacao.objetoCompra)];
        break;
      case "grauRelevanciaIA":
        const relevancyOrder = sql`
          CASE
            WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Alta' THEN 1
            WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Média' THEN 2
            WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Baixa' THEN 3
            ELSE 4
          END
        `;
        // Se for "relevância", a direção é ASC (Alta 1, Média 2, Baixa 3)
        // Se o usuário clicar para inverter (sortDir 'desc'), invertemos a lógica.
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
      
      // Caso padrão (vazio ou 'relevancia' vindo do filtro)
      case "relevancia":
      default:
         const defaultRelevancyOrder = sql`
          CASE
            WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Alta' THEN 1
            WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Média' THEN 2
            WHEN ${pncpLicitacao.grauRelevanciaIA} = 'Baixa' THEN 3
            ELSE 4
          END
        `;
        orderByClause = [asc(defaultRelevancyOrder), desc(pncpLicitacao.dataPublicacaoPNCP)];
    }
    
    if (sortBy === 'data') {
        orderByClause = [desc(pncpLicitacao.dataPublicacaoPNCP)];
    }

    // Busca as licitações
    const licitacoes = await db.select()
      .from(pncpLicitacao)
      .where(whereClause)
      .orderBy(...orderByClause) // Aplica a ordenação
      .limit(pageSize)
      .offset(offset);

    // Busca o total de registros
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
      pageCount: Math.ceil(total / pageSize) // Envia o total de páginas
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