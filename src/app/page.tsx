"use client"

import React, { useState, useMemo, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { Search, MapPin, CalendarDays, FileText, AlertCircle, Building, Newspaper, Filter as FilterIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterSheet, type Filters } from "@/components/FilterSheet";
import { Toaster, toast } from "sonner";
import { type PncpLicitacao as Licitacao } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { UserNav } from "@/components/UserNav";

const BACKEND_API_ROUTE = "/api/buscar-licitacoes";

export default function Home() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      signIn();
    },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [allResults, setAllResults] = useState<Licitacao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selectedBids, setSelectedBids] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);

    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  const formatCurrency = (v: number | null | undefined) => v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não informado";
  const formatGenericDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' }) : "Não informado";
  const getSituacaoBadgeVariant = (s: string | null | undefined): "default" | "destructive" | "secondary" => {
    const status = s?.toUpperCase() || '';
    if (["REVOGADA", "ANULADA", "SUSPENSA"].includes(status)) return "destructive";
    if (["DIVULGADA NO PNCP"].includes(status)) return "default";
    return "secondary";
  };

  const filteredResults = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return allResults;
    const lowercasedTerm = debouncedSearchTerm.toLowerCase();
    return allResults.filter(licitacao => {
      const local = `${licitacao.unidadeOrgao?.municipioNome ?? ''} / ${licitacao.unidadeOrgao?.ufSigla ?? ''}`;
      return (
        licitacao.objetoCompra?.toLowerCase().includes(lowercasedTerm) ||
        licitacao.numeroControlePNCP?.toLowerCase().includes(lowercasedTerm) ||
        licitacao.orgaoEntidade?.razaoSocial?.toLowerCase().includes(lowercasedTerm) ||
        local.toLowerCase().includes(lowercasedTerm) ||
        formatGenericDateTime(licitacao.dataPublicacaoPncp).toLowerCase().includes(lowercasedTerm) ||
        (licitacao.modalidadeNome?.toLowerCase().includes(lowercasedTerm)) ||
        formatCurrency(licitacao.valorTotalEstimado).toLowerCase().includes(lowercasedTerm)
      );
    });
  }, [allResults, debouncedSearchTerm]);

  const { paginatedResults, totalPages } = useMemo(() => {
    const total = Math.ceil(filteredResults.length / itemsPerPage);
    return {
      paginatedResults: filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
      totalPages: total
    };
  }, [filteredResults, currentPage, itemsPerPage]);

  const handleApplyFilters = async (filters: Filters) => {
    console.log("Aplicando filtros do frontend:", filters);
    setIsLoading(true);
    setAllResults([]);
    setCurrentPage(1);
    setHasSearched(true);
    setSearchTerm("");
    setSelectedBids([]);

    if (!filters.dateRange?.from) {
      toast.error("Data não informada", {
        description: "O filtro de data é obrigatório para realizar a busca.",
      });
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    const toastId = toast.loading("Iniciando busca...");

    try {
      const res = await fetch(BACKEND_API_ROUTE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filters }),
      });

      if (!res.body) {
        throw new Error("A resposta do servidor não pode ser lida.");
      }
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Falha na requisição para a API.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line) continue;
          try {
            const json = JSON.parse(line);
            switch (json.type) {
              case 'info':
                toast.loading(json.message, { id: toastId });
                break;
              case 'start':
                toast.loading(json.message, { id: toastId });
                break;
              case 'progress':
                toast.loading(`Analisando lote ${json.chunk} de ${json.totalChunks}...`, { id: toastId });
                break;
              case 'result':
                setAllResults(json.resultados || []);
                const useGemini = filters.useGeminiAnalysis !== false;
                const totalBruto = json.totalBruto || 0;
                const totalFinal = json.totalFinal || 0;

                if (totalFinal > 0) {
                  if (useGemini) {
                    toast.success("Análise concluída!", {
                      id: toastId,
                      description: `A IA analisou ${totalBruto.toLocaleString('pt-BR')} licitações e encontrou ${totalFinal.toLocaleString('pt-BR')} viáveis.`
                    });
                  } else {
                    toast.success("Busca concluída!", {
                      id: toastId,
                      description: `Foram encontradas ${totalFinal.toLocaleString('pt-BR')} licitações com os filtros aplicados.`
                    });
                  }
                } else {
                  if (useGemini && totalBruto > 0) {
                    toast.info("Análise concluída", {
                      id: toastId,
                      description: `A IA analisou ${totalBruto.toLocaleString('pt-BR')} licitações, mas nenhuma foi considerada viável.`
                    });
                  } else {
                    toast.info("Nenhuma licitação encontrada", {
                      id: toastId,
                      description: "Nenhuma licitação foi encontrada com os filtros aplicados."
                    });
                  }
                }
                break;
              case 'error':
                throw new Error(json.message);
            }
          } catch (e) {
            console.error("Erro ao processar o stream:", e, "Linha:", line);
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      toast.error("Erro na busca", { description: message, id: toastId });
    } finally {
      setIsLoading(false);
    }
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0);
    }
  };

  const handleSelectBid = (numeroControlePNCP: string) => {
    setSelectedBids(prev =>
      prev.includes(numeroControlePNCP)
        ? prev.filter(id => id !== numeroControlePNCP)
        : [...prev, numeroControlePNCP]
    );
  };

  const handleGenerateReport = async () => {
    toast.loading("Gerando relatório...", { id: "report-toast" });
    try {
      const selectedLicitacoes = allResults.filter(licitacao =>
        selectedBids.includes(licitacao.numeroControlePNCP)
      );

      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licitacoes: selectedLicitacoes }),
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar o relatório.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-licitacoes.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Relatório gerado!", { id: "report-toast" });

      setSelectedBids([]);

    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro ao gerar relatório", { id: "report-toast" });
    }
  };

  const paginationItems = useMemo(() => {
    const items: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      items.push(1);
      if (currentPage > 3) items.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (currentPage < totalPages - 2) items.push('...');
      items.push(totalPages);
    }
    return items;
  }, [currentPage, totalPages]);

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10 dark:bg-gray-800 dark:border-gray-700">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Licitações PNCP</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Busca inteligente e abrangente em licitações públicas do PNCP.</p>
          </div>
          <UserNav />
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <Card className="mb-8 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow w-full">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquise nos resultados por palavra-chave, órgão, etc..."
                  className="pl-10 h-11"
                  disabled={isLoading || allResults.length === 0}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              <Button
                onClick={() => setIsFilterSheetOpen(true)}
                className="min-w-[120px] h-11 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Filtrando...
                  </>
                ) : (
                  <>
                    <FilterIcon className="mr-2 h-4 w-4" />
                    Filtros
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <FilterSheet
          isOpen={isFilterSheetOpen}
          onOpenChange={setIsFilterSheetOpen}
          onApplyFilters={handleApplyFilters}
        />

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
          </div>
        ) : filteredResults.length > 0 ? (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Resultados da Busca ({filteredResults.length} licitações encontradas)</CardTitle>
                {selectedBids.length > 0 && (
                  <Button onClick={handleGenerateReport}>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar Relatório ({selectedBids.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-6">
                {paginatedResults.map((licitacao) => (
                  <li key={licitacao.numeroControlePNCP} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row justify-between gap-3 mb-3">
                      <h4 className="font-semibold text-gray-800 flex-1">{licitacao.objetoCompra || "Objeto não informado"}</h4>
                      <div className="flex items-center flex-wrap gap-2">
                        {licitacao.tipoInstrumentoConvocatorioNome && <Badge variant="outline" className="whitespace-nowrap"><FileText className="w-3.5 h-3.5 mr-1.5" />{licitacao.tipoInstrumentoConvocatorioNome}</Badge>}
                        {licitacao.modalidadeNome && <Badge variant="outline" className="whitespace-nowrap"><Newspaper className="w-3.5 h-3.5 mr-1.5" />{licitacao.modalidadeNome}</Badge>}
                        {licitacao.situacaoCompraNome && <Badge variant={getSituacaoBadgeVariant(licitacao.situacaoCompraNome)} className="capitalize whitespace-nowrap">{licitacao.situacaoCompraNome.toLowerCase()}</Badge>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-600 mb-4">
                      <div className="flex items-start gap-2"><Building className="w-4 h-4 mt-1 flex-shrink-0" /><span><strong>Órgão:</strong> {licitacao.orgaoEntidade?.razaoSocial ?? 'N/A'}</span></div>
                      <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-1 flex-shrink-0" /><span><strong>Local:</strong> {`${licitacao.unidadeOrgao?.municipioNome ?? 'N/A'} / ${licitacao.unidadeOrgao?.ufSigla ?? 'N/A'}`}</span></div>
                      <div className="flex items-start gap-2"><CalendarDays className="w-4 h-4 mt-1 flex-shrink-0" /><span><strong>Publicação:</strong> {formatGenericDateTime(licitacao.dataPublicacaoPncp)}</span></div>
                      <div className="flex items-start gap-2"><strong>Valor Estimado:</strong><span className="font-semibold text-green-700">{formatCurrency(licitacao.valorTotalEstimado)}</span></div>
                    </div>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`select-${licitacao.numeroControlePNCP}`}
                          checked={selectedBids.includes(licitacao.numeroControlePNCP)}
                          onCheckedChange={() => handleSelectBid(licitacao.numeroControlePNCP)}
                        />
                        <label htmlFor={`select-${licitacao.numeroControlePNCP}`} className="text-sm font-medium select-none cursor-pointer">
                          Selecionar para o relatório
                        </label>
                      </div>
                      {(licitacao.orgaoEntidade?.cnpj && licitacao.anoCompra && licitacao.sequencialCompra) && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`https://pncp.gov.br/app/editais/${licitacao.orgaoEntidade.cnpj}/${licitacao.anoCompra}/${licitacao.sequencialCompra}`} target="_blank" rel="noopener noreferrer">
                            <FileText className="w-4 h-4 mr-2" /> Ver no PNCP
                          </a>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            {totalPages > 1 && (
              <CardFooter className="flex-col sm:flex-row items-center sm:justify-between gap-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined} /></PaginationItem>
                    {paginationItems.map((item, index) => (
                      <PaginationItem key={index}>
                        {typeof item === 'number' ? (<PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(item); }} isActive={currentPage === item}>{item}</PaginationLink>) : (<PaginationEllipsis />)}
                      </PaginationItem>
                    ))}
                    <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }} className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined} /></PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="flex items-center space-x-2 text-sm">
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20 h-9">
                      <SelectValue placeholder={itemsPerPage} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardFooter>
            )}
          </Card>
        ) : (
          !isLoading && hasSearched && (
            <Card>
              <CardContent className="py-16 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum resultado encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">Sua busca com os filtros aplicados não retornou resultados.</p>
              </CardContent>
            </Card>
          )
        )}
      </main>
      <Toaster richColors position="bottom-left" />
    </div>
  )
}