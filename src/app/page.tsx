// Arquivo: src/app/page.tsx
"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
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

import { pncpLicitacao } from "@/lib/db/schema";
import { UserNav } from "@/components/UserNav";
import FilterDialog from "@/components/FilterDialog";
import LicitacaoDetailDialog from "@/components/LicitacaoDetailDialog";
import { LicitacaoGrid } from "@/components/LicitacaoGrid";
import { LicitacaoTable } from "@/components/LicitacaoTable";
import { getLicitacaoTableColumns } from "@/components/LicitacaoTableColumns";
import { DataTablePagination } from "@/components/DataTablePagination";
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

// Tipos
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

// Função para gerar os filtros padrão
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

export default function Home() {
  // Estados da Aplicação
  const [filters, setFilters] = useState<Filters>(getDefaultFilters());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(null);

  // Estados de Dados e Carregamento
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // Estados do Tanstack Table
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // --- BUSCA DE DADOS (DATA FETCHING) ---

  // Função principal de busca, agora reage aos estados da tabela
  const fetchLicitacoes = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      // 1. Paginação
      params.append("page", (pagination.pageIndex + 1).toString());
      params.append("pageSize", pagination.pageSize.toString());

      // 2. Filtros
      (Object.keys(filters) as Array<keyof Filters>).forEach((key) => {
        const value = filters[key];
        if (value) {
          params.append(key, value.toString());
        }
      });
      
      // 3. Ordenação (do Tanstack Table)
      if (sorting.length > 0) {
        params.append("sortBy", sorting[0].id);
        params.append("sortDir", sorting[0].desc ? "desc" : "asc");
      } else if (filters.sortBy) {
        // Fallback para a ordenação do filtro se a tabela não tiver ordenação
        params.append("sortBy", filters.sortBy);
      }

      const response = await fetch(`/api/buscar-licitacoes?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Falha ao buscar licitações");
      }
      const data = await response.json();
      
      setLicitacoes(data.licitacoes);
      setTotal(data.total);

    } catch (error) {
      console.error(error);
      toast.error("Erro ao buscar dados", { description: "Não foi possível carregar as licitações." });
      setLicitacoes([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination, sorting]);

  // Efeito que dispara a busca quando os filtros ou a tabela mudam
  useEffect(() => {
    fetchLicitacoes();
  }, [fetchLicitacoes]);


  // --- HANDLERS (Manipuladores de Eventos) ---

  // Define as colunas da tabela
  const handleCardClick = React.useCallback((licitacao: Licitacao) => {
    setSelectedLicitacao(licitacao);
  }, []);

  const columns = React.useMemo<ColumnDef<Licitacao>[]>(
    () => getLicitacaoTableColumns({ onRowClick: handleCardClick }),
    [handleCardClick]
  );

  // Inicializa a instância da tabela
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
    enableRowSelection: true,
    manualPagination: true, // Indica que a paginação é controlada no servidor
    manualSorting: true, // Indica que a ordenação é controlada no servidor
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Handler para aplicar os filtros do Dialog
  const handleFilterApply = (newFilters: Filters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, pageIndex: 0 })); // Reseta para a página 1
    setRowSelection({}); // Limpa a seleção
    setIsDialogOpen(false);
  };
  
  // Handler para gerar o relatório Word
  const handleGenerateWordReport = async () => {
    setIsDownloading(true);
    toast.loading("Gerando seu relatório...", { id: "download-toast" });

    try {
      const selectedIds = table.getSelectedRowModel().rows.map(row => row.original.numeroControlePNCP);
      
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

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 w-full bg-background/95 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold hidden sm:block">Monitor de Licitações</h1>
          
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value: ViewMode) => value && setViewMode(value)}
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
                        {column.id === 'objetoCompra' ? 'Objeto' : 
                         column.id === 'grauRelevanciaIA' ? 'Relevância' :
                         column.id === 'valorEstimado' ? 'Valor' :
                         column.id === 'dataPublicacaoPNCP' ? 'Publicação' :
                         column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 max-w-xs">
            {/* Espaço reservado para um futuro input de busca rápida, se desejado */}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              className="relative"
            >
              <ListFilter className="mr-2 h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="default"
              size="sm"
              disabled={selectedRowCount === 0 || isDownloading}
              onClick={handleGenerateWordReport}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Gerar Relatório {selectedRowCount > 0 ? `(${selectedRowCount})` : ""}
            </Button>
            
            <UserNav />
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        {isLoading ? (
          viewMode === 'table' ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {[...Array(6)].map((_, i) => (
                      <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
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
          )
        ) : (
          <>
            {licitacoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                  <Search className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">Nenhum resultado encontrado</h3>
                  <p className="text-muted-foreground">Tente ajustar seus filtros ou verificar novamente mais tarde.</p>
              </div>
            ) : (
              // Renderização condicional da visualização
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

        {/* Paginação Avançada */}
        {!isLoading && total > 0 && (
          <DataTablePagination table={table} />
        )}
      </main>

      {/* Dialog de Detalhes */}
      {selectedLicitacao && (
        <LicitacaoDetailDialog
          licitacao={selectedLicitacao}
          isOpen={!!selectedLicitacao}
          onClose={() => setSelectedLicitacao(null)}
        />
      )}
      
      {/* Dialog de Filtros */}
      <FilterDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onApply={handleFilterApply}
        currentFilters={filters}
      />
    </div>
  );
}