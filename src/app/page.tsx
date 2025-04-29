// src/app/page.tsx
"use client"

import React, { useState } from "react"
import { Search, MapPin, CalendarDays, Info, FileText, Download, AlertCircle, Building } from "lucide-react"
import { Button } from "@/components/ui/button" // Ajuste o caminho se necessário
import { Input } from "@/components/ui/input" // Ajuste o caminho se necessário
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card" // Ajuste o caminho se necessário
import { Badge } from "@/components/ui/badge" // Ajuste o caminho se necessário
import { Skeleton } from "@/components/ui/skeleton" // Ajuste o caminho se necessário
import { Toaster, toast } from "sonner"
import { Separator } from "@/components/ui/separator" // Ajuste o caminho se necessário

// --- Interfaces (Definindo a estrutura dos dados esperados) ---

interface Orgao {
  nome: string
  codigo?: string
  cidade: string
  uf: string
  endereco?: string
  telefone?: { ddd: string; numero: string; ramal: string }[]
  site?: string
}

interface Documento {
  filename: string
  url: string // URL relativa para download
}

interface Licitacao {
  id: number
  orgao: Orgao | null // Orgao pode ser null? Adicionado verificação
  objeto: string | null
  situacao: string | null
  datahora_abertura: string | null
  datahora_documento: string | null
  datahora_retirada: string | null
  datahora_visita: string | null
  datahora_prazo: string | null
  edital: string | null
  documento: Documento[] | null
  processo: string | null
  observacao: string | null
  item: string | null
  preco_edital: number | null
  valor_estimado: number | null
  has_electronic_trading?: boolean
  monitored_by_user?: boolean
}

interface Acompanhamento {
  id: number
  licitacao_id: number | null
  orgao: { // Orgao em acompanhamento é mais simples
    nome: string | null
    cidade: string | null
    uf: string | null
  } | null
  objeto: string | null
  sintese: string | null
  data_fonte: string | null
  edital: string | null
  processo: string | null
}

// Interface para a estrutura de um boletim retornado pela nossa API backend
interface ResultadoBoletim {
  boletim: { // Informações do boletim de origem
    id: number;
    datahora_fechamento: string;
    numero_edicao: number;
    cliente?: { // Cliente pode não vir sempre
      id: number;
      razao_social: string;
      filtro: {
        id: number;
        descricao: string;
      };
    };
    quantidade_licitacoes: number; // Quantidade original no boletim
    quantidade_acompanhamentos: number; // Quantidade original no boletim
  } | null; // Boletim pode ser null? Adicionado verificação
  licitacoes: Licitacao[]; // Array de licitações (potencialmente filtradas)
  acompanhamentos: Acompanhamento[]; // Array de acompanhamentos
}

// URL base para construir links de download do edital
const DOWNLOAD_BASE_URL = "[https://consultaonline.conlicitacao.com.br](https://consultaonline.conlicitacao.com.br)";
// URL da nossa API backend Next.js
const BACKEND_API_ROUTE = "/api/buscar-licitacoes"; // Usando rota relativa

export default function Home() {
  const [question, setQuestion] = useState("")
  // O estado armazena um array de ResultadoBoletim (geralmente terá 1 item vindo do backend)
  const [resultados, setResultados] = useState<ResultadoBoletim[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSearchQuestion, setLastSearchQuestion] = useState<string | null>(null); // Para exibir na tela de "nenhum resultado"

  const handleBuscar = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Por favor, digite sua consulta antes de buscar.", {
        description: "O campo de busca não pode estar vazio.",
      })
      return
    }

    setIsLoading(true)
    setResultados([]) // Limpa resultados anteriores
    setLastSearchQuestion(trimmedQuestion); // Guarda a busca atual

    try {
      // --- Chamada REAL ao Backend Next.js ---
      console.log(`Frontend: Enviando busca para ${BACKEND_API_ROUTE} com a questão: "${trimmedQuestion}"`);
      const res = await fetch(BACKEND_API_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }), // Envia a questão no corpo
      })

      const data = await res.json(); // Lê o corpo da resposta

      if (!res.ok) {
        console.error("Erro do backend:", res.status, data);
        // Usa a mensagem de erro do backend se disponível
        throw new Error(data?.error || data?.message || `Erro ${res.status} ao buscar licitações no servidor.`);
      }

      console.log("Frontend: Dados recebidos do backend:", data);

      // Atualiza o estado com os resultados recebidos
      // Espera a estrutura { resultados: [ResultadoBoletim] }
      setResultados(data.resultados || []); // Garante que seja um array

      // Verifica se vieram resultados válidos
      const hasValidResults = data.resultados && data.resultados.length > 0 &&
        (data.resultados[0].licitacoes?.length > 0 || data.resultados[0].acompanhamentos?.length > 0);

      if (!hasValidResults) {
        toast.info(data.message || "Nenhuma licitação ou acompanhamento encontrado.", {
          description: "Verifique os filtros aplicados ou tente refinar seus termos de busca.",
        });
      }
      // Não mostra toast de sucesso para não poluir a tela

    } catch (error: any) {
      console.error("Erro no handleBuscar:", error);
      toast.error("Erro na busca", {
        description: error.message || "Ocorreu um erro ao conectar com o servidor. Verifique se ele está rodando e tente novamente.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // --- Funções auxiliares ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) { // Previne Enter duplo durante loading
      handleBuscar();
    }
  }

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || value === 0) {
      return "Não informado";
    }
    try {
      return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    } catch (e) {
      console.error("Erro ao formatar moeda:", value, e);
      return "Valor inválido";
    }
  }

  const formatGenericDateTime = (dateTimeString: string | null | undefined): string => {
    if (!dateTimeString) return "Não informado";
    try {
      // Tenta criar um objeto Date. Isso lida com vários formatos ISO-like.
      const date = new Date(dateTimeString.replace(" ", "T")); // Tenta normalizar espaço para T
      if (isNaN(date.getTime())) {
        // Se falhar, tenta formato DD/MM/YYYY HH:MM:SS (comum em alguns sistemas)
        const parts = dateTimeString.split(/[\s/:]+/); // Divide por espaço, /, :
        if (parts.length >= 5) { // DD, MM, YYYY, HH, MM
          // Formato esperado: YYYY-MM-DDTHH:MM:SS
          const isoAttempt = `${parts[2]}-${parts[1]}-${parts[0]}T${parts[3]}:${parts[4]}:${parts[5] || '00'}`;
          const dateFromParts = new Date(isoAttempt);
          if (!isNaN(dateFromParts.getTime())) {
            return dateFromParts.toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
          }
        }
        // Se ainda falhar, tenta formato YYYY-MM-DD (apenas data)
        const dateOnly = new Date(dateTimeString + 'T00:00:00Z'); // Adiciona Z para UTC
        if (!isNaN(dateOnly.getTime())) {
          return dateOnly.toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        }
        return "Data inválida"; // Último recurso
      }
      // Se o Date inicial funcionou, formata
      return date.toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
      console.error("Erro ao formatar data/hora:", dateTimeString, e);
      return "Data inválida";
    }
  }


  const formatDateOnly = (dateString: string | null | undefined): string => {
    if (!dateString) return "Não informado";
    try {
      // Assume formato YYYY-MM-DD e trata como UTC para evitar problemas de fuso
      const date = new Date(dateString + 'T00:00:00Z');
      if (isNaN(date.getTime())) return "Data inválida";
      // Exibe no fuso local desejado
      return date.toLocaleDateString("pt-BR", { timeZone: 'America/Sao_Paulo' });
    } catch (e) {
      console.error("Erro ao formatar data:", dateString, e);
      return "Data inválida";
    }
  }

  const getSituacaoBadgeVariant = (situacao: string | null | undefined): "default" | "destructive" | "outline" | "secondary" | "warning" | "success" | "info" => {
    if (!situacao) return "outline";
    const s = situacao.toUpperCase();
    if (["NOVA", "EDITAL", "PRO", "REAB"].includes(s)) return "success"; // Aberta, Proposta, Reaberta
    if (["SUS", "ALTER"].includes(s)) return "warning"; // Suspensa, Alterada
    if (s === "RET") return "info"; // Retificada
    if (["ANUL", "REV", "CANC", "DES"].includes(s)) return "destructive"; // Anulada, Revogada, Cancelada, Deserta
    if (["HOM", "ADJ"].includes(s)) return "default"; // Homologada, Adjudicada (consideradas finalizadas)
    return "secondary"; // Outros casos
  }

  // --- JSX ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Licitações IA</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">Busca inteligente em licitações públicas</p>
          </div>
          {/* Pode adicionar logo ou outros elementos aqui */}
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Card de Busca */}
        <Card className="mb-8 shadow-md border border-gray-200">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="relative flex-grow w-full">
                <Input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Descreva a licitação que você procura..."
                  className="pl-10 h-11 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  disabled={isLoading}
                  aria-label="Campo de busca de licitações"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              <Button
                onClick={handleBuscar}
                disabled={isLoading || !question.trim()} // Desabilita se vazio ou carregando
                className="min-w-[120px] h-11 text-base sm:w-auto w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
                aria-live="polite" // Informa sobre mudança de estado (loading)
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Buscando...
                  </div>
                ) : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Exibição dos Resultados */}
        {isLoading ? (
          // Skeleton Loading
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <Card key={i} className="shadow border border-gray-200 animate-pulse">
                <CardHeader className="bg-gray-100 p-4">
                  <Skeleton className="h-6 w-3/5 rounded" />
                  <Skeleton className="h-4 w-1/4 mt-2 rounded" />
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-4">
                  <Skeleton className="h-5 w-full rounded" />
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <div className="flex justify-between items-center mt-3">
                    <Skeleton className="h-4 w-1/3 rounded" />
                    <Skeleton className="h-8 w-24 rounded" />
                  </div>
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : resultados.length > 0 ? (
          // Resultados Encontrados
          <div className="space-y-8">
            {resultados.map((resultado, boletimIndex) => (
              <Card key={boletimIndex} className="overflow-hidden shadow-lg border border-gray-200 bg-white">
                {/* Cabeçalho do Boletim */}
                {resultado.boletim && ( // Renderiza cabeçalho apenas se boletim existir
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <CardTitle className="text-base sm:text-lg font-semibold text-blue-800">
                        Boletim #{resultado.boletim.id} (Edição: {resultado.boletim.numero_edicao ?? 'N/A'})
                      </CardTitle>
                      <Badge variant="outline" className="text-xs sm:text-sm whitespace-nowrap">
                        <CalendarDays className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                        {formatGenericDateTime(resultado.boletim.datahora_fechamento)}
                      </Badge>
                    </div>
                    {resultado.boletim.cliente?.filtro?.descricao && (
                      <CardDescription className="text-xs sm:text-sm text-gray-600 mt-1">
                        Filtro: {resultado.boletim.cliente.filtro.descricao}
                        {` (${resultado.boletim.quantidade_licitacoes ?? '?'} licitações, ${resultado.boletim.quantidade_acompanhamentos ?? '?'} acomp. no boletim original)`}
                      </CardDescription>
                    )}
                  </CardHeader>
                )}

                {/* Seção de Licitações */}
                {resultado.licitacoes && resultado.licitacoes.length > 0 ? (
                  <div className="p-4 md:p-6">
                    <h3 className="text-md font-semibold text-gray-700 mb-4 border-b pb-2">
                      Licitações Encontradas ({resultado.licitacoes.length})
                    </h3>
                    <ul className="space-y-6">
                      {resultado.licitacoes.map((licitacao) => (
                        <li key={licitacao.id} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                          {/* Cabeçalho da Licitação */}
                          <div className="flex flex-col md:flex-row justify-between md:items-start mb-3 gap-2">
                            <h4 className="font-semibold text-base text-gray-800 flex-1 mb-2 md:mb-0">{licitacao.objeto || "Objeto não informado"}</h4>
                            <div className="flex items-center gap-2 flex-wrap self-start pt-1"> {/* Badge alignment */}
                              <Badge variant={getSituacaoBadgeVariant(licitacao.situacao)} className="capitalize text-xs px-2 py-0.5">
                                {licitacao.situacao?.toLowerCase() ?? 'n/a'}
                              </Badge>
                              {licitacao.has_electronic_trading && <Badge variant="info" className="text-xs px-2 py-0.5">Pregão Eletrônico</Badge>}
                            </div>
                          </div>
                          {/* Detalhes da Licitação */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-600 mb-4">
                            <div className="flex items-start gap-2"> {/* items-start */}
                              <Building className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                              <span><span className="font-medium">Órgão:</span> {licitacao.orgao?.nome ?? 'N/A'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                              <span><span className="font-medium">Local:</span> {licitacao.orgao?.cidade ?? 'N/A'} / {licitacao.orgao?.uf ?? 'N/A'}</span>
                            </div>
                            {(licitacao.datahora_abertura || licitacao.datahora_prazo) && (
                              <div className="flex items-start gap-2">
                                <CalendarDays className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span><span className="font-medium">{licitacao.datahora_abertura ? "Abertura:" : "Prazo:"}</span> {formatGenericDateTime(licitacao.datahora_abertura || licitacao.datahora_prazo)}</span>
                              </div>
                            )}
                            {licitacao.edital && (
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span><span className="font-medium">Edital:</span> {licitacao.edital}</span>
                              </div>
                            )}
                            {licitacao.processo && (
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span><span className="font-medium">Processo:</span> {licitacao.processo}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-gray-700 mt-0.5">Valor Estimado:</span>
                              <span className="text-emerald-700 font-semibold mt-0.5">{formatCurrency(licitacao.valor_estimado)}</span>
                            </div>
                          </div>
                          {/* Observações (colapsáveis) */}
                          {licitacao.observacao && (
                            <details className="mb-4 group">
                              <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-800 list-none flex items-center">
                                Mostrar Observações
                                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-1 group-open:rotate-180 transition-transform">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </summary>
                              <div className="mt-2 p-3 bg-gray-50 rounded border text-xs text-gray-700 max-h-40 overflow-y-auto"> {/* Added scroll */}
                                <p className="whitespace-pre-wrap">{licitacao.observacao}</p>
                              </div>
                            </details>
                          )}
                          {/* Botão de Download */}
                          {licitacao.documento && licitacao.documento.length > 0 && licitacao.documento[0].url && (
                            <div className="flex justify-end mt-2">
                              <Button variant="outline" size="sm" asChild className="text-xs">
                                <a
                                  href={`${DOWNLOAD_BASE_URL}${licitacao.documento[0].url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5"
                                  title={`Baixar ${licitacao.documento[0].filename}`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download Edital
                                </a>
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  // Mensagem se não houver licitações *filtradas*
                  <div className="p-6 text-center text-gray-500 italic">
                    Nenhuma licitação encontrada neste boletim para os filtros aplicados.
                  </div>
                )}


                {/* Seção de Acompanhamentos */}
                {resultado.acompanhamentos && resultado.acompanhamentos.length > 0 && (
                  <div className="p-4 md:p-6 border-t bg-blue-50">
                    <h3 className="text-md font-semibold text-gray-700 mb-4 border-b pb-2">Acompanhamentos ({resultado.acompanhamentos.length})</h3>
                    <ul className="space-y-6">
                      {resultado.acompanhamentos.map((acomp) => (
                        <li key={acomp.id} className="border rounded-lg p-4 bg-white shadow-sm">
                          {/* Cabeçalho do Acompanhamento */}
                          <div className="flex flex-col md:flex-row justify-between md:items-start mb-3 gap-2">
                            <h4 className="font-semibold text-base text-gray-800 flex-1 mb-2 md:mb-0">{acomp.objeto || "Objeto não informado"}</h4>
                            <Badge variant="secondary" className="whitespace-nowrap self-start md:self-center text-xs px-2 py-0.5">
                              Ref. Licitação: {acomp.licitacao_id ?? 'N/A'}
                            </Badge>
                          </div>
                          {/* Detalhes do Acompanhamento */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600 mb-3">
                            <div className="flex items-start gap-2">
                              <Building className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                              <span><span className="font-medium">Órgão:</span> {acomp.orgao?.nome ?? 'N/A'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                              <span><span className="font-medium">Local:</span> {acomp.orgao?.cidade ?? 'N/A'} / {acomp.orgao?.uf ?? 'N/A'}</span>
                            </div>
                            {acomp.data_fonte && (
                              <div className="flex items-start gap-2">
                                <CalendarDays className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span><span className="font-medium">Data Fonte:</span> {formatDateOnly(acomp.data_fonte)}</span>
                              </div>
                            )}
                            {acomp.edital && (
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span><span className="font-medium">Edital Ref.:</span> {acomp.edital}</span>
                              </div>
                            )}
                            {acomp.processo && (
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span><span className="font-medium">Processo:</span> {acomp.processo}</span>
                              </div>
                            )}
                          </div>
                          {/* Síntese (colapsável) */}
                          {acomp.sintese && (
                            <details className="group">
                              <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-800 list-none flex items-center">
                                Mostrar Síntese
                                <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-1 group-open:rotate-180 transition-transform">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </summary>
                              <div className="mt-2 p-3 bg-indigo-50 rounded border border-indigo-100 text-xs text-gray-700 max-h-60 overflow-y-auto"> {/* Increased max height */}
                                <p className="whitespace-pre-wrap">{acomp.sintese}</p>
                              </div>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </Card>
            ))}
          </div>
        ) : (
          // Nenhum Resultado Encontrado (após busca)
          !isLoading && lastSearchQuestion && ( // Mostra apenas se uma busca foi feita e não está carregando
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-amber-100 p-4 mb-5">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-gray-500 max-w-md px-4">
                  Não encontramos licitações ou acompanhamentos para "<span className="font-medium">{lastSearchQuestion}</span>". Tente refinar sua busca ou verificar os filtros aplicados.
                </p>
              </CardContent>
            </Card>
          )
        )}
        {/* Mensagem inicial antes da primeira busca */}
        {!isLoading && !lastSearchQuestion && resultados.length === 0 && (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-gray-100 p-4 mb-5">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Pronto para buscar?
              </h3>
              <p className="text-gray-500 max-w-md px-4">
                Digite sua consulta na barra acima e clique em "Buscar" para encontrar licitações e acompanhamentos relevantes.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      {/* Toaster para notificações */}
      <Toaster richColors position="top-right" closeButton />
    </div>
  )
}
