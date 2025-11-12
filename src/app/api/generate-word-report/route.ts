// Arquivo: src/app/api/generate-word-report/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pncpLicitacao } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  BorderStyle,
} from "docx";
import { z } from "zod";

// Schema para validar o corpo do POST
const reportSchema = z.object({
  licitacaoPncpIds: z.array(z.string()).min(1, "Pelo menos um ID é necessário"),
});

// Funções auxiliares de formatação
function formatarValor(valor: any): string {
  const num = Number(valor);
  if (isNaN(num) || num === 0) return "Não informado";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data: Date | string | null): string {
  if (!data) return "N/A";
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Função para criar uma linha de Parágrafo (ex: "Órgão: Ministério...")
const createInfoParagraph = (label: string, text: string | null) => {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
      }),
      new TextRun(text || "N/A"),
    ],
    spacing: {
      after: 100, // Espaçamento após o parágrafo
    },
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Validar o corpo da requisição
    const validation = reportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }
    
    const { licitacaoPncpIds } = validation.data;

    // 2. Buscar as licitações selecionadas no banco
    const licitacoes = await db
      .select()
      .from(pncpLicitacao)
      .where(inArray(pncpLicitacao.numeroControlePNCP, licitacaoPncpIds));

    if (licitacoes.length === 0) {
      return NextResponse.json({ error: "Nenhuma licitação encontrada" }, { status: 404 });
    }
    
    // 3. Gerar o Documento Word
    const sections = licitacoes.map(licitacao => {
      return {
        properties: {},
        children: [
          new Paragraph({
            text: licitacao.orgao || "Órgão Não Informado",
            heading: HeadingLevel.HEADING_2,
            style: "styleHeading2",
          }),
          createInfoParagraph("Objeto da Compra", licitacao.objetoCompra),
          createInfoParagraph("Valor Estimado", formatarValor(licitacao.valorEstimado)),
          createInfoParagraph("Modalidade", licitacao.modalidade),
          createInfoParagraph("Publicação", formatarData(licitacao.dataPublicacaoPNCP)),
          createInfoParagraph("Município/UF", `${licitacao.municipio}/${licitacao.uf}`),
          new Paragraph({ // Parágrafo de separação
            text: "",
            border: {
                bottom: {
                    color: "auto",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 6,
                },
            },
            spacing: {
                after: 300,
                before: 300
            }
          })
        ],
      };
    });

    const doc = new Document({
      styles: {
        paragraphStyles: [
            {
                id: "styleHeading1",
                name: "Heading 1",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    size: 32, // 16pt
                    bold: true,
                    color: "333333",
                },
                paragraph: {
                    spacing: { after: 240 },
                    alignment: AlignmentType.CENTER
                }
            },
            {
                id: "styleHeading2",
                name: "Heading 2",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: {
                    size: 28, // 14pt
                    bold: true,
                    color: "555555",
                },
                paragraph: {
                    spacing: { after: 120, before: 240 }
                }
            },
        ]
      },
      sections: [
        { // Página de Título
          properties: {},
          children: [
            new Paragraph({
              text: "Relatório de Licitações",
              heading: HeadingLevel.HEADING_1,
              style: "styleHeading1"
            }),
            new Paragraph({
              text: `Relatório gerado em: ${formatarData(new Date())}`,
              alignment: AlignmentType.CENTER
            }),
          ],
        },
        // Adiciona as seções de cada licitação
        ...sections
      ],
    });

    // 4. Empacotar e enviar o buffer do arquivo
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="relatorio_licitacoes.docx"`,
      },
    });

  } catch (error) {
    console.error("Erro ao gerar relatório DOCX:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}