// Arquivo: src/components/LicitacaoChatDialog.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, CornerDownLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface LicitacaoChatDialogProps {
  cacheKey: string;
}

export default function LicitacaoChatDialog({
  cacheKey,
}: LicitacaoChatDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<"checking" | "processed" | "empty" | "error">(
    "checking"
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const checkCache = async () => {
    setIsLoading(true);
    setCacheStatus("checking");
    try {
      const response = await fetch("/api/licitacao-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "check",
          cacheKey: cacheKey,
          action: "checkCache",
        }),
      });
      const data = await response.json();
      if (data.status === "processed") {
        setCacheStatus("processed");
      } else {
        setCacheStatus("empty");
      }
    } catch {
      setCacheStatus("error");
      toast.error("Erro ao verificar documentos da licitação.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = (open: boolean) => {
    if (open && !isOpen) {
      setMessages([]);
      setInput("");
      checkCache();
    }
    setIsOpen(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().length === 0 || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/licitacao-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          cacheKey: cacheKey,
          action: "queryDocuments",
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na resposta da API");
      }

      const data = await response.json();
      const modelMessage: ChatMessage = {
        role: "model",
        content: data.reply || "Desculpe, não consegui processar a resposta.",
      };
      setMessages((prev) => [...prev, modelMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = {
        role: "model",
        content: "Ocorreu um erro ao tentar processar sua pergunta.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast.error("Erro ao comunicar com o assistente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button>
          <Bot className="mr-2 h-4 w-4" />
          Perguntar à IA (Chat)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat da Licitação</DialogTitle>
          <DialogDescription>
            Pergunte sobre os documentos desta licitação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow flex flex-col min-h-0">
          <ScrollArea className="flex-grow min-h-0 pr-4" ref={scrollAreaRef}>
            <div className="space-y-4 p-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-3",
                    msg.role === "user" ? "justify-end" : ""
                  )}
                >
                  {msg.role === "model" && (
                    <div className="bg-primary rounded-full p-2">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "p-3 rounded-lg max-w-[70%]",
                      msg.role === "user"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="bg-secondary rounded-full p-2">
                      <User className="h-5 w-5 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && cacheStatus === 'checking' && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando documentos...
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 pt-4">
            {cacheStatus === 'processed' && (
              <Badge variant="secondary" className="mb-2">
                <Bot className="mr-1 h-3 w-3" /> IA pronta para responder
              </Badge>
            )}
            {cacheStatus === 'empty' && (
              <Badge variant="destructive" className="mb-2">
                Documentos ainda não processados pela sincronização.
              </Badge>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Qual é o prazo de entrega?"
                disabled={isLoading || cacheStatus !== 'processed'}
              />
              <Button
                type="submit"
                disabled={isLoading || input.trim().length === 0 || cacheStatus !== 'processed'}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CornerDownLeft className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}