"use client"

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import { cn } from "@/lib/utils"; // Importação adicionada para corrigir erro
import { Search, MapPin, CalendarDays, FileText, AlertCircle, Building, Newspaper, Filter as FilterIcon, Loader2, X as XIcon } from "lucide-react";
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
import { type PncpLicitacao as Licitacao } from "@/lib/types"; // Assegura que este tipo está correto
// Ajuste o tipo Licitacao se a API agora retorna campos IA (relevanciaIA, justificativaIA)
// Exemplo: import { type Licitacao as LicitacaoPrisma } from "@prisma/client";
// type Licitacao = LicitacaoPrisma & { /* outros campos PncpLicitacao se necessário */ };

import { Checkbox } from "@/components/ui/checkbox";
import { UserNav } from "@/components/UserNav";
import { LicitacaoDetailDialog } from "@/components/LicitacaoDetailDialog";
// Remover DialogTrigger se controlar manualmente o estado isOpen
// import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { LicitacaoChatDialog } from "@/components/LicitacaoChatDialog"; // Importar novo componente de Chat

const BACKEND_API_ROUTE = "/api/buscar-licitacoes";

// Adapte este tipo se a API retornar os dados do Prisma com os campos IA
// Se mapPrismaToPncp foi removido da API, este tipo deve corresponder ao tipo Licitacao do Prisma
type LicitacaoComIA = Licitacao & { // Ou LicitacaoPrisma & { ... }
    relevanciaIA?: string | null;
    justificativaIA?: string | null;
};


export default function Home() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      signIn();
    },
  });

  // Estados existentes
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // Atualiza o tipo do estado para incluir os campos da IA
  const [allResults, setAllResults] = useState<LicitacaoComIA[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Inicia como true para o carregamento inicial
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selectedBids, setSelectedBids] = useState<string[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(10);
  const [selectedLicitacao, setSelectedLicitacao] = useState<LicitacaoComIA | null>(null); // Atualiza tipo
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Novos estados para o Chat Dialog
  const [selectedLicitacaoForChat, setSelectedLicitacaoForChat] = useState<LicitacaoComIA | null>(null); // Atualiza tipo
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  // const callCounterRef = useRef(0); // Para depuração de chamadas múltiplas

  // useEffect para o carregamento inicial
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Define os filtros para o carregamento inicial, SEM análise da IA
    // O campo useGeminiAnalysis pode ser mantido ou removido,
    // dependendo se você o reaproveitará no FilterSheet para filtrar por relevância
    const initialLoadFilters: Filters = {
      modalidades: [],
      palavrasChave: [],
      valorMin: "",
      valorMax: "",
      estado: null,
      blacklist: [], // Pode definir uma blacklist inicial se necessário
      useGeminiAnalysis: false, // <-- Garante que IA (análise ou filtro) NÃO seja ativada no início
      dateRange: { from: yesterday, to: yesterday },
    };
    // Chama a função para aplicar os filtros e buscar os dados
    console.log("-> A CHAMAR handleApplyFilters DO useEffect INICIAL"); // Log extra para depuração
    handleApplyFilters(initialLoadFilters, true); // O 'true' indica que é a carga inicial
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array de dependências vazio para executar apenas uma vez na montagem


  // useEffect para debounce da barra de pesquisa
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reseta para a primeira página ao pesquisar
    }, 500); // Aguarda 500ms após o utilizador parar de digitar

    return () => {
      clearTimeout(timerId); // Limpa o timeout se o utilizador digitar novamente
    };
  }, [searchTerm]);

  // Funções de formatação
  const formatCurrency = (v: number | null | undefined) => v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não informado";
  const formatGenericDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' }) : "Não informado";
  const getSituacaoBadgeVariant = (s: string | null | undefined): "default" | "destructive" | "secondary" => {
    const status = s?.toUpperCase() || '';
    if (["REVOGADA", "ANULADA", "SUSPENSA"].includes(status)) return "destructive";
    if (["DIVULGADA NO PNCP"].includes(status)) return "default";
    return "secondary";
  };
   // Nova função para badge de relevância IA
   const getRelevanciaBadgeVariant = (relevancia: string | null | undefined): "default" | "secondary" | "outline" => {
    switch (relevancia) {
      case 'Principal': return 'default'; // Verde (padrão primário) ou outra cor chamativa
      case 'Adjacente': return 'secondary'; // Amarelo/Laranja (padrão secundário)
      default: return 'outline'; // Cinza/neutro para 'Inviável' ou null
    }
  };


  // Abre o diálogo de detalhes da licitação
  const handleOpenDetailDialog = (licitacao: LicitacaoComIA) => { // Atualiza tipo
    setSelectedLicitacao(licitacao);
    setIsDetailDialogOpen(true);
  };

  // Abre o diálogo de chat da licitação
  const handleOpenChatDialog = (licitacao: LicitacaoComIA) => { // Atualiza tipo
    // Verifica se CNPJ, ano e sequencial existem antes de abrir
    if (licitacao.orgaoEntidade?.cnpj && licitacao.anoCompra && licitacao.sequencialCompra) {
        setSelectedLicitacaoForChat(licitacao);
        setIsChatDialogOpen(true);
    } else {
        toast.error("Faltam dados", { description: "Não é possível abrir o chat sem CNPJ, ano e sequencial." });
    }
  };


  // Filtra os resultados com base no termo de busca debounced
  const filteredResults = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return allResults; // Retorna todos se a busca estiver vazia
    const lowercasedTerm = debouncedSearchTerm.toLowerCase();
    // Filtra pelos campos existentes E pelos novos campos IA
    return allResults.filter(licitacao => {
      const local = `${licitacao.unidadeOrgao?.municipioNome ?? ''} / ${licitacao.unidadeOrgao?.ufSigla ?? ''}`;
      return (
        licitacao.objetoCompra?.toLowerCase().includes(lowercasedTerm) ||
        licitacao.numeroControlePNCP?.toLowerCase().includes(lowercasedTerm) ||
        licitacao.orgaoEntidade?.razaoSocial?.toLowerCase().includes(lowercasedTerm) ||
        local.toLowerCase().includes(lowercasedTerm) ||
        formatGenericDateTime(licitacao.dataPublicacaoPncp).toLowerCase().includes(lowercasedTerm) ||
        (licitacao.modalidadeNome?.toLowerCase().includes(lowercasedTerm)) ||
        formatCurrency(licitacao.valorTotalEstimado).toLowerCase().includes(lowercasedTerm) ||
        licitacao.relevanciaIA?.toLowerCase().includes(lowercasedTerm) || // <-- Filtra por relevância
        licitacao.justificativaIA?.toLowerCase().includes(lowercasedTerm) // <-- Filtra por justificativa
      );
    });
  }, [allResults, debouncedSearchTerm]);

  // Calcula os resultados paginados e o total de páginas
  const { paginatedResults, totalPages } = useMemo(() => {
    if (itemsPerPage === 'all') { // Se "Todos" estiver selecionado
      return {
        paginatedResults: filteredResults,
        totalPages: 1, // Apenas uma página
      };
    }
    const total = Math.ceil(filteredResults.length / itemsPerPage);
    return {
      paginatedResults: filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
      totalPages: total
    };
  }, [filteredResults, currentPage, itemsPerPage]);

  // Função principal para buscar licitações (chamada no início e ao aplicar filtros)
  const handleApplyFilters = async (filters: Filters, isInitialLoad = false) => {
    // let applyFilterCallCount = ++callCounterRef.current; // Para depuração

    // Cancela a requisição anterior, se houver
    if (abortControllerRef.current) {
      abortControllerRef.current.abort("Nova busca iniciada."); // Mensagem opcional
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    // Não limpa allResults imediatamente se for busca normal para UI mais suave? Avaliar.
    if (isInitialLoad) setAllResults([]); // Limpa apenas na carga inicial
    setCurrentPage(1); // Volta para a primeira página
    setHasSearched(true); // Indica que uma busca foi realizada
    // setSearchTerm(""); // Não limpar search term ao aplicar filtros?
    setSelectedBids([]); // Limpa licitações selecionadas

    // Log para depuração
    // console.log(`[handleApplyFilters CALL #${applyFilterCallCount}] Chamado com isInitialLoad=${isInitialLoad}. Valor de useGeminiAnalysis nos filtros:`, filters.useGeminiAnalysis);

    // Configura o botão de cancelar no toast
    const cancelAction = {
      label: <XIcon className="h-5 w-5" />,
      altText: "Cancelar",
      onClick: () => abortControllerRef.current?.abort("Busca cancelada pelo utilizador."),
    };

    // Exibe toast de loading, exceto na carga inicial
    const toastId = isInitialLoad ? undefined : toast.loading("A procurar licitações...", {
      description: "A aguardar enquanto consultamos os dados.",
      action: cancelAction,
    });

    try {
      // Faz a requisição POST para a API backend
      const res = await fetch(BACKEND_API_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }), // Envia os filtros no corpo
        signal, // Passa o AbortSignal para poder cancelar
      });

      // Trata erros de resposta da API
      if (!res.ok) {
        // Verifica se o erro foi por cancelamento
        if (signal.aborted) {
             console.log("Busca abortada antes da resposta completa.");
             // Não lança erro, mas pode mostrar um toast info
              if (toastId) toast.info("Busca cancelada.", { id: toastId });
             return; // Interrompe a execução aqui
        }
        const errorData = await res.json().catch(() => ({ message: 'Não foi possível ler a resposta do servidor.' }));
        throw new Error(errorData.message || `Erro ${res.status}: Ocorreu um problema no servidor.`);
      }

      // Processa a resposta JSON (não mais stream)
      const data = await res.json();

       // Processa o resultado final
       if (data.type === 'result') {
          // Atualiza o estado com os resultados (tipo LicitacaoComIA)
          setAllResults(data.resultados || []);
          const totalFinal = data.totalFinal || 0;

          // Exibe toast de sucesso/info (diferente para carga inicial)
          if (isInitialLoad) {
            if (totalFinal === 0) {
                toast.info("Nenhuma licitação encontrada para ontem.");
            } else {
                toast.success(`${totalFinal.toLocaleString('pt-BR')} licitações de ontem carregadas!`);
            }
          } else { // Para buscas normais via filtro
            if (totalFinal > 0) {
              // Verifica se o filtro de relevância foi aplicado (reaproveitando useGeminiAnalysis)
              const relevanceFiltered = filters.useGeminiAnalysis === true;
              const successMessage = `Busca concluída!`;
              const description = relevanceFiltered
                ? `${totalFinal.toLocaleString('pt-BR')} licitações relevantes encontradas.`
                : `${totalFinal.toLocaleString('pt-BR')} licitações encontradas com os filtros aplicados.`;
              toast.success(successMessage, { id: toastId, description });
            } else {
              toast.info("Nenhum resultado", {
                id: toastId,
                description: "Nenhuma licitação encontrada com os filtros aplicados.",
              });
            }
          }
       } else if (data.type === 'error') { // Trata erros enviados pela API
           throw new Error(data.message || 'Erro retornado pela API.');
       }

    } catch (error: unknown) {
      // Trata erros gerais da requisição (fetch, AbortError, etc.)
      const err = error as Error;
      // Verifica se o erro é de cancelamento
      if (err.name === 'AbortError') {
        console.log("Busca abortada:", err.message); // Loga a razão do cancelamento
        // Mostra toast de cancelamento apenas se não for a carga inicial
        if (toastId) toast.info("Busca cancelada.", { id: toastId, description: err.message });
      } else { // Outros erros
        console.error("Erro na busca:", err);
        toast.error("Erro na busca", { description: err.message, id: toastId });
      }
    } finally {
      // Garante que o estado de loading seja desativado e a referência ao AbortController limpa
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }

  // Muda a página atual
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo(0, 0); // Rola para o topo da página
    }
  };

  // Adiciona/remove licitação da seleção para o relatório
  const handleSelectBid = (numeroControlePNCP: string) => {
    setSelectedBids(prev =>
      prev.includes(numeroControlePNCP)
        ? prev.filter(id => id !== numeroControlePNCP) // Remove se já existe
        : [...prev, numeroControlePNCP] // Adiciona se não existe
    );
  };

  // Gera e baixa o relatório .docx
  const handleGenerateReport = async () => {
    toast.loading("A gerar relatório...", { id: "report-toast" });
    try {
      // Filtra as licitações completas com base nos IDs selecionados
      const selectedLicitacoes = allResults.filter(licitacao =>
        selectedBids.includes(licitacao.numeroControlePNCP)
      );

      // Chama a API para gerar o relatório
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
        },
        // Envia os dados completos, incluindo campos IA se existirem
        body: JSON.stringify({ licitacoes: selectedLicitacoes }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(()=> ({message: "Erro desconhecido na geração."}));
        throw new Error(errorData.message || 'Falha ao gerar o relatório.');
      }

      // Processa a resposta como blob (arquivo)
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      // Cria um link temporário para download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-licitacoes.docx';
      document.body.appendChild(a);
      a.click(); // Simula o clique para iniciar o download
      a.remove(); // Remove o link
      window.URL.revokeObjectURL(url); // Libera a memória
      toast.success("Relatório gerado!", { id: "report-toast" });

      setSelectedBids([]); // Limpa a seleção após gerar o relatório

    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao gerar relatório", { id: "report-toast", description: message });
    }
  };

  // Gera os itens da paginação (números, elipses)
  const paginationItems = useMemo(() => {
    const items: (number | string)[] = [];
    if (totalPages <= 7) { // Se poucas páginas, mostra todas
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else { // Se muitas páginas, mostra início, fim e vizinhas da atual
      items.push(1);
      if (currentPage > 3) items.push('...'); // Elipse no início
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) items.push(i);
      if (currentPage < totalPages - 2) items.push('...'); // Elipse no fim
      items.push(totalPages);
    }
    return items;
  }, [currentPage, totalPages]);

  // Exibe loading se a sessão ainda está carregando ou não existe
  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-gray-900">
        <Loader2 className="h-12 w-12 animate-spin dark:text-gray-400" />
      </div>
    );
  }

  // Renderização principal do componente
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Cabeçalho */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10 dark:bg-gray-800 dark:border-gray-700">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Licitações PNCP</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Busca inteligente e abrangente em licitações públicas do PNCP.</p>
          </div>
          <UserNav /> {/* Componente de navegação do utilizador */}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="container mx-auto py-8 px-4">
        {/* Card da Barra de Busca e Botão de Filtro */}
        <Card className="mb-8 shadow-md dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Input de Busca */}
              <div className="relative flex-grow w-full">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Pesquise nos resultados por palavra-chave, órgão, relevância, etc..." // Atualiza placeholder
                  className="pl-10 h-11 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-gray-200"
                  disabled={isLoading || allResults.length === 0} // Desabilita enquanto carrega ou se não houver resultados
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              {/* Botão de Filtros */}
              <Button
                onClick={() => setIsFilterSheetOpen(true)}
                className="min-w-[120px] h-11 text-base"
                disabled={isLoading && !!abortControllerRef.current} // Desabilita se estiver carregando UMA BUSCA ATIVA
              >
                {/* Mostra loader apenas se estiver carregando UMA BUSCA ATIVA */}
                {isLoading && !!abortControllerRef.current ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

        {/* Componente Sheet de Filtros (lateral) */}
        <FilterSheet
          isOpen={isFilterSheetOpen}
          onOpenChange={setIsFilterSheetOpen}
          onApplyFilters={handleApplyFilters} // Passa a função para aplicar filtros
        />

        {/* Exibição dos Resultados ou Loading */}
        {isLoading ? ( // Se estiver carregando (inicial ou busca)
          <div className="space-y-4">
            {/* Mostra skeletons */}
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg dark:bg-gray-700" />)}
          </div>
        ) : filteredResults.length > 0 ? ( // Se houver resultados filtrados
          <Card className="shadow-lg dark:bg-gray-800">
            {/* Cabeçalho do Card de Resultados */}
            <CardHeader>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <CardTitle className="dark:text-gray-200">Resultados da Busca ({filteredResults.length.toLocaleString('pt-BR')} licitações encontradas)</CardTitle>
                {/* Botão de Gerar Relatório (aparece se houver seleção) */}
                {selectedBids.length > 0 && (
                  <Button onClick={handleGenerateReport}>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar Relatório ({selectedBids.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            {/* Conteúdo do Card de Resultados (Lista) */}
            <CardContent>
              <ul className="space-y-6">
                {/* Mapeia os resultados paginados */}
                {paginatedResults.map((licitacao) => (
                  <li key={licitacao.numeroControlePNCP} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow dark:border-gray-700 dark:bg-gray-700/30">
                    {/* Cabeçalho de cada item (Objeto, Badges) */}
                    <div className="flex flex-col md:flex-row justify-between gap-3 mb-3">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex-1">{licitacao.objetoCompra || "Objeto não informado"}</h4>
                      <div className="flex items-center flex-wrap gap-2">
                        {/* --- NOVO BADGE DE RELEVÂNCIA IA --- */}
                        {licitacao.relevanciaIA && (
                            <Badge variant={getRelevanciaBadgeVariant(licitacao.relevanciaIA)} className="cursor-help" title={licitacao.justificativaIA || undefined}>
                                {licitacao.relevanciaIA}
                            </Badge>
                        )}
                        {/* ------------------------------------ */}
                        {/* Badge de Número/Ano (abre diálogo de DETALHES) */}
                        {licitacao.numeroCompra && (
                          <Badge
                            variant="outline"
                            className="whitespace-nowrap cursor-pointer dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            onClick={() => handleOpenDetailDialog(licitacao)}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            {licitacao.numeroCompra}/{licitacao.anoCompra}
                          </Badge>
                        )}
                        {/* Badge de Modalidade (com link, se houver) */}
                        {licitacao.modalidadeNome && (
                          licitacao.linkSistemaOrigem ? (
                            <a href={licitacao.linkSistemaOrigem} target="_blank" rel="noopener noreferrer">
                              <Badge variant="outline" className="whitespace-nowrap dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                                <Newspaper className="w-3.5 h-3.5 mr-1.5" />
                                {licitacao.modalidadeNome}
                              </Badge>
                            </a>
                          ) : (
                            <Badge variant="outline" className="whitespace-nowrap dark:border-gray-600 dark:text-gray-300">
                              <Newspaper className="w-3.5 h-3.5 mr-1.5" />
                              {licitacao.modalidadeNome}
                            </Badge>
                          )
                        )}
                        {/* Badge de Situação (ABRE DIÁLOGO DE CHAT) */}
                        {licitacao.situacaoCompraNome && (
                          <Badge
                            variant={getSituacaoBadgeVariant(licitacao.situacaoCompraNome)}
                            className="capitalize whitespace-nowrap cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                            onClick={() => handleOpenChatDialog(licitacao)} // Chama handler do CHAT
                            title="Analisar documentos com IA" // Tooltip
                          >
                            {licitacao.situacaoCompraNome.toLowerCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Detalhes (Órgão, Local, Datas, Valor) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <div className="flex items-start gap-2"><Building className="w-4 h-4 mt-1 flex-shrink-0" /><span><strong>Órgão:</strong> {licitacao.orgaoEntidade?.razaoSocial ?? 'N/A'}</span></div>
                      <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-1 flex-shrink-0" /><span><strong>Local:</strong> {`${licitacao.unidadeOrgao?.municipioNome ?? 'N/A'} / ${licitacao.unidadeOrgao?.ufSigla ?? 'N/A'}`}</span></div>
                      <div className="flex items-start gap-2"><CalendarDays className="w-4 h-4 mt-1 flex-shrink-0" /><span><strong>Publicação:</strong> {formatGenericDateTime(licitacao.dataPublicacaoPncp)}</span></div>
                      <div className="flex items-start gap-2"><CalendarDays className="w-4 h-4 mt-1 flex-shrink-0" /><span><strong>Abertura da Proposta:</strong> {formatGenericDateTime(licitacao.dataAberturaProposta)}</span></div>
                      <div className="flex items-start gap-2"><strong>Valor Estimado:</strong><span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(licitacao.valorTotalEstimado)}</span></div>
                      {/* Opcional: Mostrar Justificativa IA se houver */}
                      {licitacao.justificativaIA && (
                          <div className="flex items-start gap-2 sm:col-span-2 text-xs text-muted-foreground dark:text-gray-500">
                              <span><strong>Justificativa IA:</strong> {licitacao.justificativaIA}</span>
                          </div>
                      )}
                    </div>
                    {/* Rodapé de cada item (Checkbox de Seleção, Link PNCP) */}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`select-${licitacao.numeroControlePNCP}`}
                          checked={selectedBids.includes(licitacao.numeroControlePNCP)}
                          onCheckedChange={() => handleSelectBid(licitacao.numeroControlePNCP)}
                          className="dark:border-gray-600 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary"
                        />
                        <label htmlFor={`select-${licitacao.numeroControlePNCP}`} className="text-sm font-medium select-none cursor-pointer dark:text-gray-300">
                          Selecionar para o relatório
                        </label>
                      </div>
                      {/* Link para o PNCP (se dados disponíveis) */}
                      {(licitacao.orgaoEntidade?.cnpj && licitacao.anoCompra && licitacao.sequencialCompra) && (
                        <Button variant="outline" size="sm" asChild className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
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
            {/* Rodapé do Card de Resultados (Paginação, Itens por página) */}
            {(totalPages > 1 || itemsPerPage === 'all') && ( // Mostra rodapé se houver mais de 1 página OU se "Todos" estiver ativo (para mostrar o seletor)
              <CardFooter className="flex-col sm:flex-row items-center sm:justify-between gap-4 dark:border-t dark:border-gray-700 pt-4">
                {/* Paginação (mostrada apenas se itensPerPage não for 'all') */}
                {itemsPerPage !== 'all' && totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} className={cn(currentPage === 1 ? "pointer-events-none opacity-50" : undefined, "dark:text-gray-400 dark:hover:bg-gray-700")} /></PaginationItem>
                      {paginationItems.map((item, index) => {
                         const isActive = currentPage === item; // Define isActive aqui
                         return (
                          <PaginationItem key={index}>
                            {typeof item === 'number' ? (
                              <PaginationLink
                                href="#"
                                onClick={(e) => { e.preventDefault(); handlePageChange(item); }}
                                isActive={isActive} // Passa isActive como prop
                                // Usa cn para aplicar classes condicionais de dark mode ATIVO
                                // e classes gerais de dark mode NÃO ATIVO
                                className={cn(
                                  "dark:text-gray-400 dark:hover:bg-gray-700", // Estilos padrão dark
                                  isActive && "dark:bg-primary dark:text-primary-foreground dark:border-primary dark:hover:bg-primary/90" // Estilos dark ATIVOS
                                )}
                              >
                                {item}
                              </PaginationLink>
                            ) : (
                              <PaginationEllipsis className="dark:text-gray-400" />
                            )}
                          </PaginationItem>
                         );
                        })}
                      <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }} className={cn(currentPage === totalPages ? "pointer-events-none opacity-50" : undefined, "dark:text-gray-400 dark:hover:bg-gray-700")} /></PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
                {/* Seletor de Itens por Página */}
                <div className="flex items-center space-x-2 text-sm dark:text-gray-400">
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(value) => {
                      setItemsPerPage(value === 'all' ? 'all' : Number(value));
                      setCurrentPage(1); // Volta para a pág 1 ao mudar itens por página
                    }}
                  >
                    <SelectTrigger className="w-28 h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300">
                      <SelectValue placeholder="Itens por pág." />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                      <SelectItem value="10" className="dark:focus:bg-gray-700">10</SelectItem>
                      <SelectItem value="20" className="dark:focus:bg-gray-700">20</SelectItem>
                      <SelectItem value="50" className="dark:focus:bg-gray-700">50</SelectItem>
                      <SelectItem value="100" className="dark:focus:bg-gray-700">100</SelectItem>
                      <SelectItem value="all" className="dark:focus:bg-gray-700">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>itens por página</span>
                </div>
              </CardFooter>
            )}
          </Card>
        ) : ( // Se não está carregando E não há resultados (e já foi feita uma busca)
          !isLoading && hasSearched && (
            <Card className="dark:bg-gray-800">
              <CardContent className="py-16 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-200">Nenhum resultado encontrado</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A sua busca com os filtros aplicados não retornou resultados.</p>
              </CardContent>
            </Card>
          )
          // Se não está carregando, não há resultados, MAS ainda não foi feita uma busca (estado inicial antes do useEffect), não mostra nada aqui.
        )}
      </main>
      {/* Diálogo de Detalhes (controlado pelo estado) */}
      <LicitacaoDetailDialog
        licitacao={selectedLicitacao}
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
      />
      {/* Diálogo de Chat (controlado pelo estado) */}
       <LicitacaoChatDialog
         licitacao={selectedLicitacaoForChat}
         isOpen={isChatDialogOpen}
         onOpenChange={setIsChatDialogOpen}
       />
      {/* Componente para exibir Toasts */}
      <Toaster richColors position="bottom-left" />
    </div>
  )
}