// Arquivo: src/lib/pdfProcessing.ts
import { db } from "@/lib/db";
import { licitacaoDocumento, pncpLicitacao } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as pdfjsLib from "pdfjs-dist";
import { generateEmbedding } from "./embedding";
import { pncp } from "./comprasApi";

// --- CORREÇÃO: Importar o tipo TextItem oficial ---
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";

type ApiPncpLicitacao = Record<string, any>; 

interface ProcessResult {
  fullTextFromAllPdfs: string;
  allFileUrls: string[];
}

async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  let fullText = "";

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    
    // --- CORREÇÃO: O type guard 'item is TextItem' agora usa o tipo importado
    // e o 'map' subsequente também usa o tipo TextItem correto.
    const pageText = textContent.items
      .filter((item): item is TextItem => 'str' in item) 
      .map((item: TextItem) => item.str) 
      .join(" ");
      
    fullText += pageText + "\n";
  }

  return fullText;
}

function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 100,
): string[] {
  const chunks: string[] = [];
  const cleanedText = text.replace(/\s+/g, ' ').trim();

  let i = 0;
  while (i < cleanedText.length) {
    const end = Math.min(i + chunkSize, cleanedText.length);
    chunks.push(cleanedText.slice(i, end));
    i += chunkSize - overlap;
    if (end === cleanedText.length) break;
  }
  return chunks;
}

export async function processAndEmbedDocuments(
  licitacao: typeof pncpLicitacao.$inferSelect | ApiPncpLicitacao, 
): Promise<ProcessResult> {
  console.log(`[ETL] Processando documentos para: ${licitacao.numeroControlePNCP}`);
  let fullTextFromAllPdfs = "";
  let allFileUrls: string[] = []; 

  try {
    const files: Record<string, any>[] = await pncp.getLicitacaoFiles(
      licitacao.cnpjOrgao,
      licitacao.anoCompra.toString(),
      licitacao.sequencialCompra.toString(),
    );

    allFileUrls = files
      .filter((f) => f.url)
      .map((f) => f.url as string);

    const pdfFiles = files.filter(
      (f) => f.tipo === "application/pdf" && f.url,
    );
    
    if (pdfFiles.length === 0) {
      console.log(`[ETL] Nenhum PDF encontrado para ${licitacao.numeroControlePNCP}.`);
      return { fullTextFromAllPdfs: "", allFileUrls };
    }
    
    await db.delete(licitacaoDocumento)
      .where(eq(licitacaoDocumento.licitacaoPncpId, licitacao.numeroControlePNCP));

    for (const file of pdfFiles) {
      try {
        console.log(`[ETL] Baixando: ${file.nome}`);
        const pdfBuffer = await downloadFile(file.url);
        const text = await extractTextFromPdfBuffer(pdfBuffer);
        
        if (!text) continue;
        
        fullTextFromAllPdfs += `Conteúdo do arquivo "${file.nome}":\n${text}\n\n--- (Fim do Documento) ---\n\n`;

        const chunks = chunkText(text);
        if (chunks.length === 0) continue;

        console.log(`[ETL] Gerando ${chunks.length} embeddings para ${file.nome}...`);

        const chunksToInsert = [];

        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk);
          chunksToInsert.push({
            licitacaoPncpId: licitacao.numeroControlePNCP,
            nomeArquivo: file.nome,
            textoChunk: chunk,
            embedding: embedding,
          });
        }

        if (chunksToInsert.length > 0) {
          await db.insert(licitacaoDocumento).values(chunksToInsert);
        }

      } catch (docError) {
        console.error(`[ETL] Falha ao processar doc ${file.nome}:`, docError);
      }
    }

    console.log(`[ETL] Documentos processados com sucesso para ${licitacao.numeroControlePNCP}.`);
    return { fullTextFromAllPdfs, allFileUrls };

  } catch (error) {
    console.error(`[ETL] Erro fatal no pipeline para ${licitacao.numeroControlePNCP}:`, error);
    return { fullTextFromAllPdfs: "", allFileUrls: [] };
  }
}