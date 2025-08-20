import { NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { PncpLicitacao } from '@/lib/types';

export async function POST(request: Request) {
 try {
  const { licitacoes } = (await request.json()) as { licitacoes: PncpLicitacao[] };

  if (!licitacoes || licitacoes.length === 0) {
   return NextResponse.json({ message: 'Nenhuma licitação selecionada.' }, { status: 400 });
  }

  const sections = licitacoes.map((licitacao, index) => {
   const children = [
    new Paragraph({
     heading: HeadingLevel.HEADING_2,
     children: [new TextRun({ text: licitacao.objetoCompra || 'Objeto não informado', bold: true })],
    }),
    new Paragraph({
     children: [
      new TextRun({ text: 'Órgão: ', bold: true }),
      new TextRun(licitacao.orgaoEntidade?.razaoSocial || 'N/A'),
     ],
    }),
    new Paragraph({
     children: [
      new TextRun({ text: 'Local: ', bold: true }),
      new TextRun(`${licitacao.unidadeOrgao?.municipioNome || 'N/A'} / ${licitacao.unidadeOrgao?.ufSigla || 'N/A'}`),
     ],
    }),
    new Paragraph({
     children: [
      new TextRun({ text: 'Publicação: ', bold: true }),
      new TextRun(licitacao.dataPublicacaoPncp ? new Date(licitacao.dataPublicacaoPncp).toLocaleString('pt-BR') : 'Não informado'),
     ],
    }),
    new Paragraph({
     children: [
      new TextRun({ text: 'Modalidade: ', bold: true }),
      new TextRun(licitacao.modalidadeNome || 'Não informado'),
     ],
    }),
    new Paragraph({
     children: [
      new TextRun({ text: 'Valor Estimado: ', bold: true }),
      new TextRun(
       licitacao.valorTotalEstimado
        ? licitacao.valorTotalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : 'Não informado'
      ),
     ],
    }),
    new Paragraph({
     children: [
      new TextRun({ text: 'Link PNCP: ', bold: true }),
      new TextRun(`https://pncp.gov.br/app/editais/${licitacao.orgaoEntidade.cnpj}/${licitacao.anoCompra}/${licitacao.sequencialCompra}`),
     ],
    }),
   ];

   if (index < licitacoes.length - 1) {
    children.push(
     new Paragraph({
      thematicBreak: true,
      spacing: {
       after: 200,
       before: 200,
      },
     })
    );
   }

   return { children };
  }).flat();

  const doc = new Document({
   sections: [{ children: sections.flatMap(s => s.children) }],
  });

  const buffer = await Packer.toBuffer(doc);

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  responseHeaders.set('Content-Disposition', `attachment; filename="relatorio-licitacoes.docx"`);

  return new Response(buffer as BodyInit, {
   status: 200,
   headers: responseHeaders,
  });

 } catch (error) {
  console.error('Erro ao gerar relatório:', error);
  return NextResponse.json({ message: 'Erro interno ao gerar o relatório.' }, { status: 500 });
 }
}