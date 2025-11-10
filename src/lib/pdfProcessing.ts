// Arquivo: src/lib/pdfProcessing.ts (Refatorado para Drizzle)

// --- NOVAS IMPORTAÇÕES ---
import { db } from "@/lib/db";
import { licitacaoDocumento, pncpLicitacao } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
// --- FIM NOVAS IMPORTAÇÕES ---

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { generateEmbedding } from "./embedding";
import { pncp } from "./comprasApi";

// @ts-ignore
import * as pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
if (typeof window === "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

// Interface (Tipo) para a licitação vinda da API PNCP (antes do upsert)
// Usamos 'any' por simplicidade, mas o ideal é tipar a resposta da API
type ApiPncpLicitacao = any; 


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
    
    const pageText = textContent.items
      // @ts-ignore
      .map((item) => item.str)
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
    const end = Math.min(i + cleanedText.length, cleanedText.length);
    chunks.push(cleanedText.slice(i, end));
    i += chunkSize - overlap;
    if (end === cleanedText.length) break;
  }
  return chunks;
}

/**
 * Tarefa 4 (Pipeline de ETL com Drizzle):
 * Processa todos os documentos de uma licitação.
 */
export async function processAndEmbedDocuments(
  // Recebe o tipo do nosso schema (ou o tipo da API)
  licitacao: typeof pncpLicitacao.$inferSelect | ApiPncpLicitacao, 
): Promise<string> {
  console.log(`[ETL] Processando documentos para: ${licitacao.numeroControlePNCP}`);
  let fullTextFromAllPdfs = "";

  try {
    const files = await pncp.getLicitacaoFiles(
      licitacao.cnpjOrgao,
      licitacao.anoCompra.toString(),
      licitacao.sequencialCompra.toString(),
    );

    const pdfFiles = files.filter(
      (f) => f.tipo === "application/pdf" && f.url,
    );
    
    if (pdfFiles.length === 0) {
      console.log(`[ETL] Nenhum PDF encontrado para ${licitacao.numeroControlePNCP}.`);
      return "";
    }
    
    // --- ATUALIZAÇÃO DRIZZLE (Apagar chunks antigos) ---
    await db.delete(licitacaoDocumento)
      .where(eq(licitacaoDocumento.licitacaoPncpId, licitacao.numeroControlePNCP));
    // --- FIM DA ATUALIZAÇÃO ---

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

        // Prepara os dados para inserção em lote (bulk insert)
        const chunksToInsert = [];

        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk);
          chunksToInsert.push({
            // id: é gerado automaticamente (uuid)
            licitacaoPncpId: licitacao.numeroControlePNCP,
            nomeArquivo: file.nome,
            textoChunk: chunk,
            embedding: embedding, // O 'toDriver' no schema trata a conversão
          });
        }

        // --- ATUALIZAÇÃO DRIZZLE (Inserir novos chunks) ---
        // Insere todos os chunks de uma vez para este ficheiro
        if (chunksToInsert.length > 0) {
          await db.insert(licitacaoDocumento).values(chunksToInsert);
        }
        // --- FIM DA ATUALIZAÇÃO ---

      } catch (docError) {
        console.error(`[ETL] Falha ao processar doc ${file.nome}:`, docError);
      }
    }

    console.log(`[ETL] Documentos processados com sucesso para ${licitacao.numeroControlePNCP}.`);
    return fullTextFromAllPdfs;

  } catch (error) {
    console.error(`[ETL] Erro fatal no pipeline para ${licitacao.numeroControlePNCP}:`, error);
    return "";
  }
}