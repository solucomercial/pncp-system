import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import LicitacaoChatDialog from "./LicitacaoChatDialog";
import { ThumbsUp, ThumbsDown, BrainCircuit } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { pncpLicitacao } from "@/lib/db/schema";

interface LicitacaoDetailDialogProps {
  licitacao: typeof pncpLicitacao.$inferSelect;
  isOpen: boolean;
  onClose: () => void;
}

function formatarData(data: Date | string | null): string {
  if (!data) return "N/A";
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarValor(valor: string | number | null | undefined): string {
  const num = Number(valor);
  if (isNaN(num) || num === 0) return "N/A";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function LicitacaoDetailDialog({
  licitacao,
  isOpen,
  onClose,
}: LicitacaoDetailDialogProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (voto: 1 | -1) => {
    setIsVoting(true);
    try {
      const response = await fetch("/api/licitacao-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licitacaoPncpId: licitacao.numeroControlePNCP,
          voto,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao registrar voto.");
      }

      toast.success("Obrigado pelo seu feedback!");
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(
        errorMessage === "Não autorizado"
          ? "Você precisa estar logado para votar."
          : "Erro ao enviar feedback."
      );
    } finally {
      setIsVoting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="
          max-w-[95vw] md:max-w-4xl
          h-[90vh]
          flex flex-col
          p-0
        "
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="pr-10">
            Detalhes da Licitação
            <Badge variant="secondary" className="ml-2">
              {licitacao.modalidade}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* ÁREA ROLÁVEL */}
        <ScrollArea
          className="
            flex-grow 
            px-6 
            pb-6 
            pt-2
            overflow-y-auto
            scroll-smooth
          "
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold">Órgão</span>
                <p className="text-muted-foreground">{licitacao.orgao}</p>
              </div>
              <div>
                <span className="font-semibold">Publicação (PNCP)</span>
                <p className="text-muted-foreground">
                  {formatarData(licitacao.dataPublicacaoPNCP)}
                </p>
              </div>
              <div>
                <span className="font-semibold">Valor Estimado</span>
                <p className="text-muted-foreground font-bold">
                  {formatarValor(licitacao.valorEstimado)}
                </p>
              </div>
            </div>

            {licitacao.grauRelevanciaIA && (
              <>
                <Separator />
                <div className="space-y-3 p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold text-lg">
                      Análise de Relevância (IA)
                    </h4>
                  </div>

                  <Badge
                    variant={
                      licitacao.grauRelevanciaIA === "Alta"
                        ? "destructive"
                        : licitacao.grauRelevanciaIA === "Média"
                        ? "default"
                        : "secondary"
                    }
                    className="text-sm font-semibold"
                  >
                    Relevância {licitacao.grauRelevanciaIA}
                  </Badge>

                  {licitacao.justificativaRelevanciaIA && (
                    <p className="text-sm text-muted-foreground italic">
                      &quot;{licitacao.justificativaRelevanciaIA}&quot;
                    </p>
                  )}

                  <div className="flex items-center gap-4 pt-2 flex-wrap">
                    <p className="text-sm font-medium">
                      Esta análise foi útil?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleVote(1)}
                        disabled={isVoting}
                        title="Análise útil"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleVote(-1)}
                        disabled={isVoting}
                        title="Análise não foi útil"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h4 className="font-semibold mb-1">Objeto da Compra</h4>
              <p className="text-sm text-muted-foreground">
                {licitacao.objetoCompra}
              </p>
            </div>

            {licitacao.iaResumo &&
              licitacao.iaResumo !== "Análise de IA falhou." && (
                <div>
                  <h4 className="font-semibold mb-1">Resumo (IA)</h4>
                  <p className="text-sm text-muted-foreground italic">
                    {licitacao.iaResumo}
                  </p>
                </div>
              )}

            {licitacao.iaPalavrasChave &&
              licitacao.iaPalavrasChave.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Palavras-chave (IA)</h4>
                  <div className="flex flex-wrap gap-2">
                    {licitacao.iaPalavrasChave.map((keyword) => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Unidade</span>
                <p className="text-muted-foreground">{licitacao.unidadeOrgao}</p>
              </div>
              <div>
                <span className="font-semibold">Município/UF</span>
                <p className="text-muted-foreground">
                  {licitacao.municipio}/{licitacao.uf}
                </p>
              </div>
              <div>
                <span className="font-semibold">Situação</span>
                <p className="text-muted-foreground">{licitacao.situacao}</p>
              </div>
              <div>
                <span className="font-semibold">Processo</span>
                <p className="text-muted-foreground">
                  {licitacao.numeroProcesso}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button variant="outline" asChild>
                <a
                  href={licitacao.linkPNCP ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver no PNCP
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={licitacao.linkSistemaOrigem ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sistema de Origem
                </a>
              </Button>
            </div>
          </div>
        </ScrollArea>

        {/* Rodapé fixo */}
        <div className="flex-shrink-0 p-4 border-t bg-background">
          <LicitacaoChatDialog
            cacheKey={`pncp:${licitacao.cnpjOrgao}:${licitacao.anoCompra}:${licitacao.sequencialCompra}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}