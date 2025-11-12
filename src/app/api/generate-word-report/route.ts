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
  // PageBreak foi removido da importação
  ExternalHyperlink,
} from "docx";
import { z } from "zod";

// Schema para validar o corpo do POST (sem alteração)
const reportSchema = z.object({
  licitacaoPncpIds: z.array(z.string()).min(1, "Pelo menos um ID é necessário"),
});

// Funções auxiliares de formatação (sem alteração)
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

// Função auxiliar para criar parágrafos de informação simples
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

// Função auxiliar para criar parágrafos de Hiperlink
const createLinkParagraph = (label: string, link: string | null) => {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
      }),
      link
        ? new ExternalHyperlink({
            children: [
              new TextRun({
                text: link,
                style: "Hyperlink", // Usa o estilo de Hiperlink
              }),
            ],
            link: link,
          })
        : new TextRun("N/A"),
    ],
    spacing: {
      after: 100,
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
    
    const LICITACOES_POR_PAGINA = 3;
    const reportChildren: Paragraph[] = []; // Array agora contém apenas Parágrafos

    licitacoes.forEach((licitacao, index) => {
      
      const pageBreak = index > 0 && index % LICITACOES_POR_PAGINA === 0;

      // 1. Órgão (como título)
      reportChildren.push(new Paragraph({
        text: licitacao.orgao || "Órgão Não Informado",
        heading: HeadingLevel.HEADING_2,
        style: "styleHeading2",
        pageBreakBefore: pageBreak, 
      }));
      
      // 2. Nº do processo
      reportChildren.push(createInfoParagraph("Nº do processo", licitacao.numeroProcesso));
      
      // 3. Objeto da compra
      reportChildren.push(createInfoParagraph("Objeto da compra", licitacao.objetoCompra));
      
      // 4. Valor estimado
      reportChildren.push(createInfoParagraph("Valor estimado", formatarValor(licitacao.valorEstimado)));
      
      // 5. Modalidade
      reportChildren.push(createInfoParagraph("Modalidade", licitacao.modalidade));
      
      // 6. Publicação
      reportChildren.push(createInfoParagraph("Publicação", formatarData(licitacao.dataPublicacaoPNCP)));
      
      // 7. Município/UF
      reportChildren.push(createInfoParagraph("Município/UF", `${licitacao.municipio || "N/A"}/${licitacao.uf || "N/A"}`));
      
      // 8. Link no site de origem (como Hiperlink)
      reportChildren.push(createLinkParagraph("Link no site de origem", licitacao.linkSistemaOrigem));

      // 9. Link para baixar a documentação (como Hiperlinks)
      reportChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "Links para baixar a documentação:", bold: true })],
          spacing: { after: 100 },
        })
      );

      if (licitacao.documentosLinks && licitacao.documentosLinks.length > 0) {
        licitacao.documentosLinks.forEach(link => {
          reportChildren.push(
            new Paragraph({
              children: [
                new ExternalHyperlink({
                  children: [new TextRun({ text: link, style: "Hyperlink" })],
                  link: link,
                }),
              ],
              bullet: { level: 0 }, 
              spacing: { after: 100 },
            })
          );
        });
      } else {
        reportChildren.push(
          new Paragraph({
            children: [new TextRun("Nenhum documento encontrado.")],
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
      }

      // Adiciona um separador
      if ((index + 1) % LICITACOES_POR_PAGINA !== 0 && index < licitacoes.length - 1) {
        reportChildren.push(new Paragraph({
          text: "",
          border: {
              bottom: {
                  color: "auto",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
              },
          },
          spacing: { after: 300, before: 300 }
        }));
      }
    });

    const doc = new Document({
      styles: {
        characterStyles: [
          {
              id: "Hyperlink",
              name: "Hyperlink",
              basedOn: "Normal",
              run: {
                  color: "0000EE",
                  underline: { type: "single" },
              },
          },
        ],
        paragraphStyles: [
            {
                id: "styleHeading1",
                name: "Heading 1",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { size: 32, bold: true, color: "333333" },
                paragraph: { spacing: { after: 240 }, alignment: AlignmentType.CENTER }
            },
            {
                id: "styleHeading2",
                name: "Heading 2",
                basedOn: "Normal",
                next: "Normal",
                quickFormat: true,
                run: { size: 28, bold: true, color: "555555" },
                paragraph: { spacing: { after: 120, before: 240 } }
            },
        ]
      },
      sections: [
        { // Página de Título
          properties: {},
          children: [
            new Paragraph({
              text: "Relatório de Licitações",
              style: "styleHeading1"
            }),
            new Paragraph({
              text: `Relatório gerado em: ${formatarData(new Date())}`,
              alignment: AlignmentType.CENTER
            }),
            // --- LINHA PROBLEMÁTICA REMOVIDA ---
            // new PageBreak(), 
          ],
        },
        { // Conteúdo
          properties: {},
          children: reportChildren, // Adiciona o array de Parágrafos
        }
      ],
    });

    // 4. Empacotar e enviar o buffer do arquivo
    const blob = await Packer.toBlob(doc);

    return new NextResponse(blob, {
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