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
import { Send, AlertTriangle } from "lucide-react";
import { type PncpLicitacao as Licitacao } from "@/lib/types";
import { Badge } from "@/components/ui/badge";


interface LicitacaoChatDialogProps {
  licitacao: Licitacao | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
}

interface DocumentInfo {
    url: string;
    titulo: string;
}

export function LicitacaoChatDialog({ licitacao, isOpen, onOpenChange }: LicitacaoChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  // --- CORREÇÃO: Estado de erro será usado ---
  const [error, setError] = useState<string | null>(null);
  // ------------------------------------------
  const [availableDocs, setAvailableDocs] = useState<DocumentInfo[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isFetchingDocs = useRef(false);

  const addMessage = useCallback((sender: Message['sender'], text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString() + Math.random(), sender, text }]);
  }, []);

  useEffect(() => {
    if (isOpen && licitacao && !isFetchingDocs.current && availableDocs.length === 0) {
      isFetchingDocs.current = true;
      setIsLoading(true);
      setError(null);
      setMessages([{id: 'init', sender: 'system', text: "A procurar documentos associados..."}]);

      const fetchDocs = async () => {
        try {
          const response = await fetch('/api/licitacao-chat?action=getDocuments', { /* ... corpo ... */ }); // Corpo omitido para brevidade
          // ... (restante da lógica fetchDocs) ...
        } catch (err) {
           console.error("Erro ao buscar documentos:", err);
           const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
           setError(`Erro ao buscar documentos: ${errorMessage}`); // <-- Usa setError
           setMessages(prev => prev.filter(m => m.id !== 'init'));
           addMessage('system', `Erro ao carregar documentos: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            isFetchingDocs.current = false;
        }
      };
      fetchDocs();
    } else if (!isOpen) {
        setMessages([]);
        setInput('');
        setIsLoading(false);
        setIsAiLoading(false);
        setError(null);
        setAvailableDocs([]);
        isFetchingDocs.current = false;
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, licitacao, addMessage]); // Removido availableDocs.length para permitir retry implícito ao reabrir

  useEffect(() => {
     // ... (lógica de scroll) ...
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const userMessage = input.trim();
    if (!userMessage || isLoading || isAiLoading || !licitacao || error || availableDocs.length === 0) return;

    addMessage('user', userMessage);
    setInput('');
    setIsAiLoading(true);
    setError(null); // Limpa erros ao enviar nova mensagem

    try {
       const response = await fetch('/api/licitacao-chat?action=queryDocuments', { /* ... corpo ... */ }); // Corpo omitido
       // ... (restante da lógica handleSendMessage) ...
    } catch (err) {
      console.error("Erro no chat:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro.";
      setError(`Erro ao processar pergunta: ${errorMessage}`); // <-- Usa setError
      addMessage('system', `Desculpe, ocorreu um erro ao processar a sua pergunta: ${errorMessage}`);
    } finally {
      setIsAiLoading(false);
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
           {availableDocs.length > 0 && ( /* ... exibição dos docs ... */ )}

           {/* --- CORREÇÃO: Exibe a mensagem de erro --- */}
           {error && (
             <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> {error}
             </div>
           )}
           {/* ------------------------------------------- */}
        </DialogHeader>

        {/* Área Histórico de Mensagens */}
        <ScrollArea className="flex-1 p-4 bg-gray-50 dark:bg-gray-900/50" ref={scrollAreaRef as any}>
            {/* ... (renderização das mensagens) ... */}
        </ScrollArea>

        {/* Formulário de Input */}
        <DialogFooter className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
          <form onSubmit={handleSendMessage} className="flex w-full gap-2">
            <Input
              placeholder={ /* ... lógica do placeholder ... */ }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              // Desabilita se houver QUALQUER erro
              disabled={isLoading || isAiLoading || !!error || availableDocs.length === 0}
              className="flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <Button
              type="submit"
              // Desabilita se houver QUALQUER erro
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