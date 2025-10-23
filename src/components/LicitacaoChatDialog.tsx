"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, FileText, ExternalLink } from "lucide-react";
import { type PncpLicitacao as Licitacao } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown'; // Para renderizar respostas da IA (instalar: npm install react-markdown)

interface LicitacaoChatDialogProps {
  licitacao: Licitacao | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  id: string; // ID único para cada mensagem
  sender: 'user' | 'ai' | 'system'; // System para mensagens iniciais/erro
  text: string;
}

// Interface para info dos documentos obtidos do backend
interface DocumentInfo {
    url: string;
    titulo: string;
}

export function LicitacaoChatDialog({ licitacao, isOpen, onOpenChange }: LicitacaoChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading geral (busca docs ou IA responde)
  const [isAiLoading, setIsAiLoading] = useState(false); // Loading específico da IA
  const [error, setError] = useState<string | null>(null);
  const [availableDocs, setAvailableDocs] = useState<DocumentInfo[]>([]); // Estado para guardar info dos docs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isFetchingDocs = useRef(false); // Prevenir buscas múltiplas de docs

  // Função para adicionar mensagem com ID único
  const addMessage = useCallback((sender: Message['sender'], text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString() + Math.random(), sender, text }]);
  }, []);

  // Busca lista de documentos ao abrir o dialog
  useEffect(() => {
    // Só busca se o dialog estiver aberto, houver licitação, não estiver buscando E ainda não tiver buscado
    if (isOpen && licitacao && !isFetchingDocs.current && availableDocs.length === 0) {
      isFetchingDocs.current = true;
      setIsLoading(true); // Loading geral
      setError(null); // Limpa erros anteriores
      setMessages([{id: 'init', sender: 'system', text: "A procurar documentos associados..."}]); // Mensagem inicial

      const fetchDocs = async () => {
        try {
          // Passa identificadores necessários para a API
          const response = await fetch('/api/licitacao-chat?action=getDocuments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cnpj: licitacao.orgaoEntidade.cnpj,
              ano: licitacao.anoCompra,
              sequencial: licitacao.sequencialCompra,
              numeroControlePNCP: licitacao.numeroControlePNCP // Envia ID completo para logs/backup
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao buscar lista de documentos.');
          }

          const data: { documents: DocumentInfo[] } = await response.json();

          if (data.documents && data.documents.length > 0) {
              setAvailableDocs(data.documents);
              addMessage('ai', `Encontrei ${data.documents.length} documento(s) PDF. Faça a sua pergunta sobre eles.`);
          } else {
              addMessage('ai', "Não encontrei documentos PDF associados a esta licitação para analisar.");
          }
           setMessages(prev => prev.filter(m => m.id !== 'init')); // Remove mensagem de loading

        } catch (err) {
          console.error("Erro ao buscar documentos:", err);
          const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
          setError(`Erro ao buscar documentos: ${errorMessage}`);
          setMessages(prev => prev.filter(m => m.id !== 'init')); // Remove mensagem de loading
          addMessage('system', `Erro ao carregar documentos: ${errorMessage}`);
        } finally {
            setIsLoading(false); // Termina loading geral
            isFetchingDocs.current = false;
        }
      };
      fetchDocs();
    } else if (!isOpen) {
        // Reset ao fechar o dialog
        setMessages([]);
        setInput('');
        setIsLoading(false);
        setIsAiLoading(false);
        setError(null);
        setAvailableDocs([]);
        isFetchingDocs.current = false; // Reset trava de busca
    }
  }, [isOpen, licitacao, addMessage, availableDocs.length]); // Depende de availableDocs.length para não buscar de novo

  // Scroll para a última mensagem
  useEffect(() => {
    // Acessa o viewport dentro do ScrollArea
    const scrollViewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollViewport) {
      // Usa requestAnimationFrame para garantir que o scroll ocorra após a renderização
      requestAnimationFrame(() => {
        scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [messages]);


  // Envia mensagem para a API
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const userMessage = input.trim();
    // Impede envio se estiver carregando, sem input, com erro, ou sem documentos
    if (!userMessage || isLoading || isAiLoading || !licitacao || error || availableDocs.length === 0) return;

    addMessage('user', userMessage);
    setInput('');
    setIsAiLoading(true); // Ativa loading da IA
    setError(null);

    try {
      const response = await fetch('/api/licitacao-chat?action=queryDocuments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Passa identificadores novamente para contexto no backend
          cnpj: licitacao.orgaoEntidade.cnpj,
          ano: licitacao.anoCompra,
          sequencial: licitacao.sequencialCompra,
          numeroControlePNCP: licitacao.numeroControlePNCP,
          message: userMessage,
          // Pode enviar histórico limitado (ex: últimas 4 mensagens)
          // history: messages.slice(-4).map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao comunicar com a IA.');
      }

      const data = await response.json();
      addMessage('ai', data.reply || "Não obtive uma resposta.");

    } catch (err) {
      console.error("Erro no chat:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro.";
      setError(`Erro ao processar pergunta: ${errorMessage}`);
      addMessage('system', `Desculpe, ocorreu um erro ao processar a sua pergunta: ${errorMessage}`);
    } finally {
      setIsAiLoading(false); // Desativa loading da IA
    }
  };

  if (!licitacao) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl dark:bg-gray-800">
        <DialogHeader className="p-4 border-b dark:border-gray-700">
          <DialogTitle className="text-lg dark:text-gray-100">Chat sobre Documentos da Licitação</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground line-clamp-1 dark:text-gray-400">
            {licitacao.objetoCompra} (<Badge variant="secondary" className="text-xs">{licitacao.numeroControlePNCP}</Badge>)
          </DialogDescription>
           {/* Mostra Documentos Encontrados */}
           {availableDocs.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground dark:text-gray-400">
                    <span className='font-medium'>Documentos encontrados:</span>
                    <ScrollArea className="max-h-20 border rounded-md p-1 mt-1 dark:border-gray-600">
                        <ul className="list-disc list-inside space-y-1">
                            {availableDocs.map((doc, idx) => (
                            <li key={idx} className="truncate text-[11px] leading-tight">
                               <FileText className="inline h-3 w-3 mr-1 align-middle" />
                                <span className="align-middle">{doc.titulo}</span>
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:underline align-middle" title="Abrir documento original">
                                    <ExternalLink className="inline h-3 w-3" />
                                </a>
                            </li>
                            ))}
                        </ul>
                    </ScrollArea>
                </div>
            )}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </DialogHeader>

        {/* Área Histórico de Mensagens */}
        <ScrollArea className="flex-1 p-4 bg-gray-50 dark:bg-gray-900/50" ref={scrollAreaRef as any}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground dark:bg-blue-600 dark:text-white'
                      : msg.sender === 'ai'
                      ? 'bg-muted dark:bg-gray-700 dark:text-gray-200'
                      : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800' // Estilo para msg de Sistema/Erro
                  }`}
                >
                  {/* Renderiza Markdown para mensagens da IA */}
                  {msg.sender === 'ai' ? (
                     <ReactMarkdown
                       className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5" // Ajusta espaçamento do markdown
                     >
                       {msg.text}
                     </ReactMarkdown>
                  ) : (
                    // Renderiza texto simples para outras mensagens
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}
            {/* Indicador de Loading da IA */}
            {isAiLoading && (
              <div className="flex justify-start">
                 <div className="bg-muted dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> A analisar documentos...
                 </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Formulário de Input */}
        <DialogFooter className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
          <form onSubmit={handleSendMessage} className="flex w-full gap-2">
            <Input
              placeholder={
                  isLoading ? "A carregar documentos..." :
                  error ? "Erro ao carregar documentos" :
                  availableDocs.length === 0 && !isFetchingDocs.current ? "Nenhum documento encontrado" :
                  "Pergunte sobre os documentos..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              // Desabilita se estiver carregando algo, se deu erro, se não há docs, ou se está carregando docs
              disabled={isLoading || isAiLoading || !!error || availableDocs.length === 0}
              className="flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <Button
              type="submit"
              disabled={isLoading || isAiLoading || !input.trim() || !!error || availableDocs.length === 0}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}