// Arquivo: src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import LicitacaoDetailDialog from "@/components/LicitacaoDetailDialog";
import { UserNav } from "@/components/UserNav";
import FilterSheet from "@/components/FilterSheet";
import { Button } from "@/components/ui/button";
import { Download, ListFilter } from "lucide-react";
import { pncpLicitacao } from "@/lib/db/schema";

type Licitacao = typeof pncpLicitacao.$inferSelect;

export interface Filters {
  dataInicial?: string;
  dataFinal?: string;
  query?: string;
}

export default function Home() {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(
    null
  );
  
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({});

  const fetchLicitacoes = async (
    currentPage: number,
    currentFilters: Filters
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });
      if (currentFilters.dataInicial) {
        params.append("dataInicial", currentFilters.dataInicial);
      }
      if (currentFilters.dataFinal) {
        params.append("dataFinal", currentFilters.dataFinal);
      }
      if (currentFilters.query) {
        params.append("query", currentFilters.query);
      }

      const response = await fetch(
        `/api/buscar-licitacoes?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Falha ao buscar licitações");
      }
      const data = await response.json();
      
      setLicitacoes(data.licitacoes); 
      setTotal(data.total);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLicitacoes(page, filters);
  }, [page, filters, pageSize]);

  const totalPages = Math.ceil(total / pageSize);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleFilterApply = (newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1);
    setIsSheetOpen(false);
  };

  const formatarData = (data: Date | string | null) => {
    if (!data) return "N/A";
    return new Date(data).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatarValor = (valor: any) => {
    const num = Number(valor); 
    if (isNaN(num) || num === 0) return "Não informado";
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleCardClick = (licitacao: Licitacao) => {
    setSelectedLicitacao(licitacao);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 w-full bg-background/95 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Monitor de Licitações</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSheetOpen(true)}
            >
              <ListFilter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
            {/* Aponta a exportação para a API correta */}
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/generate-report?${new URLSearchParams(filters as Record<string, string>).toString()}`} download>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </a>
            </Button>
            <UserNav />
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              Exibindo {licitacoes.length} de {total} resultados.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {licitacoes.map((licitacao) => (
                <Card
                  key={licitacao.numeroControlePNCP}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleCardClick(licitacao)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {licitacao.orgao}
                    </CardTitle>
                    <CardDescription>
                      {licitacao.modalidade} | Publicado em:{" "}
                      {formatarData(licitacao.dataPublicacaoPNCP)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm line-clamp-2">
                      {licitacao.objetoCompra}
                    </p>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-lg font-bold text-primary">
                        {formatarValor(licitacao.valorEstimado)}
                      </span>
                      {licitacao.grauRelevanciaIA && (
                        <Badge
                          variant={
                            licitacao.grauRelevanciaIA === "Alta"
                              ? "destructive"
                              : licitacao.grauRelevanciaIA === "Média"
                              ? "default"
                              : "secondary"
                          }
                        >
                          Relevância: {licitacao.grauRelevanciaIA}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {!isLoading && totalPages > 1 && (
          <Pagination className="mt-8">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(page - 1);
                  }}
                  aria-disabled={page <= 1}
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  {page}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(page + 1);
                  }}
                  aria-disabled={page >= totalPages}
                  className={
                    page >= totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </main>

      <LicitacaoDetailDialog
        licitacao={selectedLicitacao!}
        isOpen={!!selectedLicitacao}
        onClose={() => setSelectedLicitacao(null)}
      />
      <FilterSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onApply={handleFilterApply}
        currentFilters={filters}
      />
    </div>
  );
}