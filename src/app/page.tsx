// Arquivo: src/app/page.tsx
"use client";

import React, { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ColumnDef,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";

// Componentes do Projeto
import { pncpLicitacao } from "@/lib/db/schema";
import { UserNav } from "@/components/UserNav";
import FilterDialog from "@/components/FilterDialog";
import LicitacaoDetailDialog from "@/components/LicitacaoDetailDialog";
import { LicitacaoGrid } from "@/components/LicitacaoGrid";
import { LicitacaoTable } from "@/components/LicitacaoTable";
import { getLicitacaoTableColumns } from "@/components/LicitacaoTableColumns";
import { DataTablePagination } from "@/components/DataTablePagination";

// Componentes UI
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FileText,
  LayoutGrid,
  List,
  ListFilter,
  Loader2,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

// --- Tipos e Funções Auxiliares ---

type Licitacao = typeof pncpLicitacao.$inferSelect;
type ViewMode = "grid" | "table";

export interface Filters {
  query?: string;
  dataInicial?: string;
  dataFinal?: string;
  sortBy?: "relevancia" | "data";
  grauRelevanciaIA?: "Alta" | "Média" | "Baixa" | string;
  orgao?: string;
  cnpjOrgao?: string;
  uf?: string;
  municipio?: string;
  valorMin?: number | string;
  valorMax?: number | string;
  modalidade?: string;
  numeroProcesso?: string;
}

const getDefaultFilters = (): Filters => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const data = yesterday.toISOString().split("T")[0];
  
  return {
    dataInicial: data,
    dataFinal: data,
    sortBy: "relevancia",
  };
};

// --- Componente de Carregamento (Skeleton) ---

function PageSkeleton({ viewMode = "grid" }: { viewMode?: ViewMode }) {
  // Skeleton da tabela agora reflete 8 colunas (para caber as novas)
  const tableSkeletonColumns = 8;
  return (
    <>
      {viewMode === 'table' ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {[...Array(tableSkeletonColumns)].map((_, i) => (
                  <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(10)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(tableSkeletonColumns)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(10)].map((_, i) => (
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
      )}
    </>
  )
}

// --- Componente Principal da Página (Cliente) ---

function LicitacoesClientPage() {
  // Hooks de Roteamento
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Estados Derivados da URL (Fonte da Verdade)
  const { filters, pagination, sorting, viewMode } = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    
    let parsedFilters: Record<string, any> = {}; 
    const filterKeys: Array<keyof Filters> = ["query", "dataInicial", "dataFinal", "sortBy", "grauRelevanciaIA", "orgao", "cnpjOrgao", "uf", "municipio", "valorMin", "valorMax", "modalidade", "numeroProcesso"];
    let hasFilterParam = false;
    
    filterKeys.forEach(key => {
      if (params.has(key)) {
        parsedFilters[key] = params.get(key)!; 
        hasFilterParam = true;
      }
    });

    if (!hasFilterParam) {
      parsedFilters = getDefaultFilters();
    }

    const pageIndex = params.get("page") ? parseInt(params.get("page")!, 10) - 1 : 0;
    const pageSize = params.get("pageSize") ? parseInt(params.get("pageSize")!, 10) : 10;
    const parsedPagination: PaginationState = { pageIndex, pageSize };

    const parsedSorting: SortingState = [];
    if (params.has("sortBy")) {
      parsedSorting.push({
        id: params.get("sortBy")!,
        desc: params.get("sortDir") === "desc",
      });
    }

    const parsedViewMode = (params.get("view") as ViewMode) || "grid";

    return { 
      filters: parsedFilters as Filters, 
      pagination: parsedPagination, 
      sorting: parsedSorting, 
      viewMode: parsedViewMode 
    };
  }, [searchParams]);

  // Estados de UI e Dados
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(null);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Estados do Tanstack Table
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  
  // Feature 2: Colunas novas (ex: municipio, uf) são ocultadas por padrão
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    municipio: false,
    uf: false,
    cnpjOrgao: false,
    situacao: false,
    numeroProcesso: false,
  });

  // --- EFEITO DE BUSCA DE DADOS ---
  useEffect(() => {
    const fetchLicitacoes = async () => {
      setIsLoading(true);
      const params = new URLSearchParams();
      
      (Object.keys(filters) as Array<keyof Filters>).forEach((key) => {
        const value = filters[key];
        if (value) {
          params.append(key, value.toString());
        }
      });
      
      params.append("page", (pagination.pageIndex + 1).toString());
      params.append("pageSize", pagination.pageSize.toString());
      
      if (sorting.length > 0) {
        params.append("sortBy", sorting[0].id);
        params.append("sortDir", sorting[0].desc ? "desc" : "asc");
      }

      try {
        const response = await fetch(`/api/buscar-licitacoes?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Falha ao buscar licitações");
        }
        const data = await response.json();
        
        setLicitacoes(data.licitacoes);
        setTotal(data.total);
        
        // BUG 1 (FIX): Linha removida. A seleção não é mais limpa ao
        // buscar dados (o que acontece a cada mudança de página).
        // setRowSelection({}); 
      } catch (error) {
        console.error(error);
        toast.error("Erro ao buscar dados", { description: "Não foi possível carregar as licitações." });
        setLicitacoes([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLicitacoes();
  }, [searchParams, filters, pagination, sorting]); 

  // --- HANDLERS (Funções que ATUALIZAM A URL) ---

  const updateQueryParams = (newParams: URLSearchParams) => {
    // Usamos 'replace' para evitar histórico de navegação desnecessário
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
  };

  const handleSetPagination = (updater: React.SetStateAction<PaginationState>) => {
    const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", (newPagination.pageIndex + 1).toString());
    newParams.set("pageSize", newPagination.pageSize.toString());
    updateQueryParams(newParams);
  };

  const handleSetSorting = (updater: React.SetStateAction<SortingState>) => {
    const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
    const newParams = new URLSearchParams(searchParams);
    if (newSorting.length > 0) {
      newParams.set("sortBy", newSorting[0].id);
      newParams.set("sortDir", newSorting[0].desc ? "desc" : "asc");
    } else {
      newParams.delete("sortBy");
      newParams.delete("sortDir");
    }
    updateQueryParams(newParams);
  };

  const handleSetFilters = (newFilters: Filters) => {
    const newParams = new URLSearchParams(); 
    
    (Object.keys(newFilters) as Array<keyof Filters>).forEach((key) => {
      const value = newFilters[key];
      if (value) {
        newParams.append(key, value.toString());
      }
    });
    
    newParams.set("view", viewMode);
    newParams.set("pageSize", pagination.pageSize.toString());
    newParams.set("page", "1"); 
    
    // BUG 1 (FIX): Limpa a seleção ao aplicar novos filtros
    setRowSelection({});
    updateQueryParams(newParams);
  };

  const handleSetViewMode = (newViewMode: ViewMode) => {
    if (newViewMode) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("view", newViewMode);
      updateQueryParams(newParams);
    }
  };

  const handleCardClick = useCallback((licitacao: Licitacao) => {
    setSelectedLicitacao(licitacao);
  }, []);

  const columns = useMemo<ColumnDef<Licitacao>[]>(
    () => getLicitacaoTableColumns({ onRowClick: handleCardClick }),
    [handleCardClick]
  );

  const table = useReactTable({
    data: licitacoes,
    columns,
    pageCount: Math.ceil(total / pagination.pageSize),
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility,
    },
    getRowId: (row) => row.numeroControlePNCP, // Essencial para seleção entre páginas
    enableRowSelection: true,
    manualPagination: true,
    manualSorting: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSetSorting,
    onPaginationChange: handleSetPagination,
    onColumnVisibilityChange: setColumnVisibility, // Gerencia colunas ocultas
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const handleFilterApply = (newFilters: Filters) => {
    handleSetFilters(newFilters);
    setIsDialogOpen(false);
  };

  const handleGenerateWordReport = async () => {
    setIsDownloading(true);
    toast.loading("Gerando seu relatório...", { id: "download-toast" });

    try {
      const selectedIds = Object.keys(rowSelection); // BUG 1 (FIX): Lê direto do estado

      if (selectedIds.length === 0) {
        throw new Error("Nenhuma licitação selecionada.");
      }

      const response = await fetch('/api/generate-word-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licitacaoPncpIds: selectedIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao gerar o arquivo.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "relatorio_licitacoes.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Relatório gerado!", { id: "download-toast" });
      setRowSelection({}); // Limpa a seleção após o sucesso
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao gerar relatório", { id: "download-toast", description: error.message });
    } finally {
      setIsDownloading(false);
    }
  };

  const activeFiltersCount = Object.keys(filters).length;
  const selectedRowCount = Object.keys(rowSelection).length;

  // Feature 2: Mapeamento de IDs de coluna para Nomes Amigáveis
  const columnNames: Record<string, string> = {
    objetoCompra: "Objeto",
    grauRelevanciaIA: "Relevância",
    valorEstimado: "Valor Estimado",
    orgao: "Órgão",
    dataPublicacaoPNCP: "Publicação",
    municipio: "Município",
    uf: "UF",
    cnpjOrgao: "CNPJ Órgão",
    situacao: "Situação",
    numeroProcesso: "Processo",
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 w-full bg-background/95 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold hidden sm:block">Monitor de Licitações</h1>
          
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value: ViewMode) => handleSetViewMode(value)}
              size="sm"
            >
              <ToggleGroupItem value="grid" aria-label="Visualizar em grade">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Visualizar em tabela">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-0 sm:mr-2" />
                  <span className="hidden sm:inline">Colunas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== "undefined" &&
                      column.getCanHide()
                  )
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {/* Feature 2: Usa o mapa de nomes amigáveis */}
                        {columnNames[column.id] || column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 max-w-xs">
            {/* Espaço para busca rápida futura */}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* FEATURE 4: Botão Filtros Responsivo */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              className="relative"
            >
              <ListFilter className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            
            {/* FEATURE 4: Botão Gerar Relatório Responsivo */}
            <Button
              variant="default"
              size="sm"
              disabled={selectedRowCount === 0 || isDownloading}
              onClick={handleGenerateWordReport}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-0 sm:mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-0 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                Gerar Relatório {selectedRowCount > 0 ? `(${selectedRowCount})` : ""}
              </span>
            </Button>
            
            <UserNav />
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        {isLoading ? (
          <PageSkeleton viewMode={viewMode} />
        ) : (
          <>
            {licitacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                  <Search className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">Nenhum resultado encontrado</h3>
                  <p className="text-muted-foreground">Tente ajustar seus filtros ou verificar novamente mais tarde.</p>
              </div>
            ) : (
              viewMode === 'grid' ? (
                <LicitacaoGrid
                  table={table}
                  onRowClick={handleCardClick}
                />
              ) : (
                <LicitacaoTable
                  table={table}
                />
              )
            )}
          </>
        )}

        {!isLoading && total > 0 && (
          <DataTablePagination table={table} />
        )}
      </main>

      {selectedLicitacao && (
        <LicitacaoDetailDialog
          licitacao={selectedLicitacao}
          isOpen={!!selectedLicitacao}
          onClose={() => setSelectedLicitacao(null)}
        />
      )}
      
      <FilterDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onApply={handleFilterApply}
        currentFilters={filters} 
      />
    </div>
  );
}

// --- Componente Wrapper com Suspense ---

export default function Page() {
  return (
    // Suspense é crucial para que useSearchParams() funcione corretamente
    <Suspense fallback={<PageSkeleton />}>
      <LicitacoesClientPage />
    </Suspense>
  )
}