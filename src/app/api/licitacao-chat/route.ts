import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Part } from '@google/generative-ai';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { pncpApi } from '@/lib/comprasApi'; // Reutiliza instância axios
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// --- CORREÇÃO DA IMPORTAÇÃO ---
// A biblioteca 'pdf-parse' usa exportação CommonJS (module.exports).
// No TypeScript/ESM, a forma correta de importar isso é usando 'import ... = require(...)'.
import pdf = require('pdf-parse');
// -----------------------------

// Configuração do Gemini
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    console.error("❌ FATAL: GOOGLE_API_KEY não está definida.");
    throw new Error('GOOGLE_API_KEY não está definida nas variáveis de ambiente');
}
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const generationConfig = {
    temperature: 0.6,
    maxOutputTokens: 4096,
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Interface para dados recebidos
interface ChatRequestBody {
    cnpj: string;
    ano: number;
    sequencial: number;
    numeroControlePNCP?: string;
    message?: string;
}

// Interface para info do documento
interface DocumentInfo {
    url: string;
    titulo: string;
}

// Cache simples em memória para URLs de documentos
const documentCache = new Map<string, { docs: DocumentInfo[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Função para baixar arquivo
async function downloadFile(url: string, destination: string): Promise<void> {
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 60000, // Timeout de 60s
        });
        const writer = require('fs').createWriteStream(destination);
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', (err: any) => reject(new Error(`Falha ao escrever arquivo: ${err.message}`)));
            response.data.on('error', (err: any) => reject(new Error(`Erro no stream de download: ${err.message}`)));
        });
    } catch (error: any) {
        console.error(`Erro ao iniciar download de ${url}:`, error.message);
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        throw new Error(`Falha ao baixar ${url}. ${status ? `Status: ${status} ${statusText}` : `Causa: ${error.message || 'Erro desconhecido'}`}`);
    }
}

// Função para extrair texto do PDF usando pdf-parse
async function extractTextFromPdf(filePath: string): Promise<string> {
    try {
        const dataBuffer = await fs.readFile(filePath);
        if (dataBuffer.length === 0) {
            console.warn(`Arquivo PDF vazio: ${filePath}`);
            return `[PDF VAZIO: ${path.basename(filePath)}]`;
        }
        // Usa a importação 'pdf' corrigida
        const data = await pdf(dataBuffer); 
        const MAX_TEXT_LENGTH = 20000; // Limite (ajuste conforme necessário)
        const text = data.text || '';
        return text.substring(0, MAX_TEXT_LENGTH) + (text.length > MAX_TEXT_LENGTH ? '\n... [CONTEÚDO TRUNCADO]' : '');
    } catch (error: any) {
        console.error(`Erro ao extrair texto do PDF ${filePath}:`, error.message);
        if (error.message && (error.message.includes('Invalid PDF structure') || error.message.includes('Header not found'))) {
             return `[Erro: PDF inválido ou corrompido - ${path.basename(filePath)}]`;
        }
        return `[Erro ao processar PDF: ${path.basename(filePath)}]`;
    }
}

// Função principal da API Route
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // action=getDocuments ou action=queryDocuments

    let tempFilePaths: string[] = []; // Rastreia arquivos para limpeza
    let tempDir: string | null = null; // Rastreia diretório temporário

    try {
        const body: ChatRequestBody = await request.json();
        const { cnpj, ano, sequencial, message } = body;

        if (!cnpj || typeof ano !== 'number' || typeof sequencial !== 'number') {
             return NextResponse.json({ message: 'CNPJ (string), Ano (number) e Sequencial (number) são obrigatórios.' }, { status: 400 });
        }
        if (!/^\d{14}$/.test(cnpj)) {
             return NextResponse.json({ message: 'Formato de CNPJ inválido.' }, { status: 400 });
        }

        const cacheKey = `${cnpj}-${ano}-${sequencial}`;
        const now = Date.now();
        let cachedData = documentCache.get(cacheKey);

        // --- Busca URLs dos documentos (com cache) ---
        let documentUrls: DocumentInfo[] = [];
        if (cachedData && (now - cachedData.timestamp < CACHE_TTL)) {
            console.log(`[API licitacao-chat] Usando cache para documentos de ${cacheKey}`);
            documentUrls = cachedData.docs;
        } else {
            console.log(`[API licitacao-chat] Buscando documentos no PNCP para ${cacheKey}...`);
            try {
                // Endpoint CORRETO para buscar arquivos de uma COMPRA específica
                const endpoint = `/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`; //
                console.log(`[API licitacao-chat] Chamando PNCP API: ${endpoint}`);
                const docResponse = await pncpApi.get(endpoint); //

                if (docResponse.data && Array.isArray(docResponse.data)) {
                    documentUrls = docResponse.data
                        .filter((doc: any) => doc.url && typeof doc.url === 'string' && doc.url.toLowerCase().endsWith('.pdf'))
                        .map((doc: any) => ({
                             url: doc.url,
                             titulo: doc.titulo || `Documento_${doc.id || Math.random().toString(36).substring(7)}`
                         }));
                    console.log(`[API licitacao-chat] Encontrados ${documentUrls.length} PDFs para ${cacheKey}.`);
                    documentCache.set(cacheKey, { docs: documentUrls, timestamp: now });
                } else {
                    console.log(`[API licitacao-chat] Nenhum documento encontrado ou formato inesperado para ${cacheKey}. Resposta PNCP:`, docResponse.data);
                    documentUrls = [];
                    documentCache.set(cacheKey, { docs: [], timestamp: now });
                }
            } catch (error: any) {
                documentCache.delete(cacheKey);
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    console.warn(`[API licitacao-chat] PNCP API retornou 404 para arquivos de ${cacheKey}. Nenhum documento encontrado.`);
                     documentUrls = [];
                     documentCache.set(cacheKey, { docs: [], timestamp: now });
                } else {
                    console.error("Erro ao buscar documentos no PNCP:", error.message);
                    if (action === 'getDocuments') {
                        return NextResponse.json({ message: `Erro ao buscar documentos da licitação: ${error.message}` }, { status: 502 });
                    }
                    console.warn("[API licitacao-chat] Continuando sem documentos devido a erro na busca PNCP.");
                    documentUrls = [];
                }
            }
        }

        // --- Ação: getDocuments ---
        if (action === 'getDocuments') {
             console.log(`[API licitacao-chat] Retornando ${documentUrls.length} documentos encontrados para ${cacheKey}.`);
             return NextResponse.json({ documents: documentUrls });
        }

        // --- Ação: queryDocuments ---
        if (action === 'queryDocuments') {
            if (!message) {
                 return NextResponse.json({ message: 'A mensagem do utilizador é obrigatória para queryDocuments.' }, { status: 400 });
            }

            if (documentUrls.length === 0) {
                 console.log(`[API licitacao-chat] Sem documentos para analisar para ${cacheKey}.`);
                 return NextResponse.json({ reply: "Não há documentos PDF associados a esta licitação ou não foi possível buscá-los." });
            }

            // 1. Baixar PDFs temporariamente
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `pncp-${cacheKey}-`));
            const downloadPromises: Promise<{path: string, title: string} | null>[] = [];

            console.log(`[API licitacao-chat] Baixando ${documentUrls.length} PDFs para ${tempDir}...`);
            for (const doc of documentUrls) {
                 const safeTitle = (doc.titulo || `doc_${Date.now()}`).replace(/[^\w\-\.]/g, '_').substring(0, 100);
                 const fileName = `${safeTitle}.pdf`;
                const filePath = path.join(tempDir, fileName);

                downloadPromises.push(
                    downloadFile(doc.url, filePath)
                        .then(() => {
                            tempFilePaths.push(filePath);
                            console.log(` - Baixado: ${doc.titulo}`);
                            return { path: filePath, title: doc.titulo };
                        })
                        .catch(downloadError => {
                            console.warn(`Falha ao baixar ${doc.titulo}. Pulando... Causa: ${downloadError.message}`);
                            return null;
                        })
                );
            }

            const downloadedFiles = (await Promise.all(downloadPromises)).filter(f => f !== null) as {path: string, title: string}[];

            if (downloadedFiles.length === 0) {
                 console.warn(`[API licitacao-chat] Falha ao baixar todos os ${documentUrls.length} PDFs.`);
                 return NextResponse.json({ reply: "Não consegui baixar ou processar nenhum documento PDF para analisar." });
            }

            // 2. Extrair texto e preparar partes para Gemini
            console.log(`[API licitacao-chat] Extraindo texto de ${downloadedFiles.length} PDFs...`);
            const parts: Part[] = [];
            let totalChars = 0;
            const MAX_TOTAL_CHARS = 800000;

            parts.push({text: `Contexto: Análise de documentos da licitação ${body.numeroControlePNCP || cacheKey}. Documentos disponíveis:\n${downloadedFiles.map(f => `- ${f.title}`).join('\n')}\n---\n`});

            for (const fileInfo of downloadedFiles) {
                 console.log(`   - Processando: ${fileInfo.title}`);
                 const textContent = await extractTextFromPdf(fileInfo.path);
                 if (textContent.length > 0 && !textContent.startsWith('[Erro:') && totalChars < MAX_TOTAL_CHARS) {
                    parts.push({ text: `--- INÍCIO DOCUMENTO: ${fileInfo.title} ---` });
                    parts.push({ text: textContent });
                    parts.push({ text: `--- FIM DOCUMENTO: ${fileInfo.title} ---` });
                    totalChars += textContent.length;
                 } else if (textContent.startsWith('[Erro:')) {
                     parts.push({ text: textContent });
                 } else if (totalChars >= MAX_TOTAL_CHARS) {
                     console.warn(`[API licitacao-chat] Limite de caracteres atingido (${MAX_TOTAL_CHARS}). Ignorando restante.`);
                     parts.push({text: "\n[AVISO: O CONTEÚDO DE ALGUNS DOCUMENTOS PODE TER SIDO TRUNCADO DEVIDO AO TAMANHO]"})
                     break;
                 } else {
                     console.log(`   - Documento vazio ou erro não especificado: ${fileInfo.title}`);
                 }
            }

            if (parts.length <= 1) {
                 console.warn("[API licitacao-chat] Nenhum conteúdo útil extraído dos PDFs.");
                 return NextResponse.json({ reply: "Não foi possível extrair conteúdo útil dos documentos PDF." });
            }

             parts.push({ text: `\n\nCom base APENAS nos documentos fornecidos acima (incluindo possíveis erros de processamento indicados), responda à seguinte pergunta: ${message}` });

             console.log(`[API licitacao-chat] Enviando ${parts.length} partes (~${totalChars} caracteres) para o Gemini...`);


            // 3. Chamar Gemini com o conteúdo extraído
            const result = await model.generateContent({
                 contents: [{ role: "user", parts }],
                 generationConfig,
                 safetySettings,
             });

            const response = result.response;
             if (response.promptFeedback?.blockReason) {
                 console.warn(`[API licitacao-chat] Resposta bloqueada por: ${response.promptFeedback.blockReason}`);
                 return NextResponse.json({ reply: `Desculpe, a resposta foi bloqueada por motivos de segurança (${response.promptFeedback.blockReason}). Tente reformular a pergunta.` });
             }
             if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
                 console.warn("[API licitacao-chat] Gemini não retornou candidatos ou conteúdo.");
                 return NextResponse.json({ reply: "Desculpe, não consegui gerar uma resposta neste momento." });
             }

            const replyText = response.text();
            console.log("[API licitacao-chat] Resposta recebida do Gemini.");
            return NextResponse.json({ reply: replyText });

        } else {
             return NextResponse.json({ message: 'Ação inválida solicitada. Use action=getDocuments ou action=queryDocuments.' }, { status: 400 });
        }

    } catch (error) {
        console.error("[API licitacao-chat] Erro:", error);
        const message = error instanceof Error ? error.message : "Erro interno do servidor.";
        return NextResponse.json({ message }, { status: 500 });
    } finally {
        // 4. Limpeza
        if (tempFilePaths.length > 0 && tempDir) {
            console.log(`[API licitacao-chat] Limpando ${tempFilePaths.length} arquivos temporários de ${tempDir}...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            for (const filePath of tempFilePaths) {
                try {
                    await fs.unlink(filePath);
                } catch (unlinkError: any) {
                    console.error(`Erro ao limpar arquivo ${filePath}:`, unlinkError.message);
                }
            }
            try {
                await fs.rmdir(tempDir);
                console.log(`[API licitacao-chat] Diretório temporário ${tempDir} removido.`);
            } catch (rmdirError: any) {
                 console.warn(`Erro ao limpar diretório temporário ${tempDir}:`, rmdirError.message);
            }
        } else if (tempDir) {
             try {
                 await fs.rmdir(tempDir);
                 console.log(`[API licitacao-chat] Diretório temporário vazio ${tempDir} removido.`);
             } catch (rmdirError: any) {
                 console.warn(`Erro ao limpar diretório temporário vazio ${tempDir}:`, rmdirError.message);
             }
        }
    }
}