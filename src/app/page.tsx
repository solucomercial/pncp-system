// src/app/page.tsx
"use client"

import React, { useState } from "react"
import { Search, MapPin, CalendarDays, FileText, Download, AlertCircle, Building, Newspaper, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster, toast } from "sonner"
import { type LicitacaoComBoletim as Licitacao } from "@/lib/types"

const DOWNLOAD_BASE_URL = "https://consultaonline.conlicitacao.com.br";
const BACKEND_API_ROUTE = "/api/buscar-licitacoes";

export default function Home() {
  const [question, setQuestion] = useState("")
  const [resultados, setResultados] = useState<Licitacao[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastSearchQuestion, setLastSearchQuestion] = useState<string | null>(null);

  const handleBuscar = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast.error("Por favor, digite sua consulta antes de buscar.");
      return;
    }

    setIsLoading(true);
    setResultados([]);
    setLastSearchQuestion(trimmedQuestion);

    try {
      const res = await fetch(BACKEND_API_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro no servidor.");

      setResultados(data.resultados || []);
      if (!data.resultados?.length) {
        toast.info("Nenhuma licitação encontrada para os critérios informados.");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      toast.error("Erro na busca", { description: message });
    } finally {
      setIsLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !isLoading) handleBuscar(); }
  const formatCurrency = (v: number | null | undefined) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatGenericDateTime = (d: string | null | undefined) => d ? new Date(d.replace(" ", "T")).toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' }) : "Não informado";
  const formatDateOnly = (d: string | null | undefined) => d ? new Date(d.replace(" ", "T")).toLocaleDateString("pt-BR", { timeZone: 'UTC' }) : "Não informado";
  const getSituacaoBadgeVariant = (s: string | null | undefined): "default" | "destructive" | "secondary" => {
    const status = s?.toUpperCase() || '';
    if (["ANUL", "REV", "CANC", "DES"].includes(status)) return "destructive";
    if (["NOVA", "EDITAL", "REAB"].includes(status)) return "default";
    return "secondary";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800">Licitações IA</h1>
          <p className="text-sm text-gray-500">Busca inteligente e abrangente em licitações públicas</p>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <Card className="mb-8 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow w-full">
                <Input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Busque por licitações de limpeza em SP nos últimos 7 dias..."
                  className="pl-10 h-11"
                  disabled={isLoading}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
              <Button onClick={handleBuscar} disabled={isLoading || !question.trim()} className="min-w-[120px] h-11 text-base">
                {isLoading ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : resultados.length > 0 ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Resultados da Busca ({resultados.length} licitações encontradas)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-6">
                {resultados.map((licitacao) => (
                  <li key={licitacao.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row justify-between gap-3 mb-3">
                      <h4 className="font-semibold text-gray-800 flex-1">{licitacao.objeto || "Objeto não informado"}</h4>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-start md:self-auto">
                        {licitacao.boletimInfo && (
                          <Badge variant="outline" className="whitespace-nowrap">
                            <Newspaper className="w-3.5 h-3.5 mr-1.5" />
                            Boletim #{licitacao.boletimInfo.id} ({formatDateOnly(licitacao.boletimInfo.data)})
                          </Badge>
                        )}
                        <Badge variant={getSituacaoBadgeVariant(licitacao.situacao)} className="capitalize">{licitacao.situacao?.toLowerCase() ?? 'n/a'}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-600 mb-4">
                      <div className="flex items-start gap-2"><Building className="w-4 h-4 mt-1" /><span><strong>Órgão:</strong> {licitacao.orgao?.nome ?? 'N/A'}</span></div>
                      <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-1" /><span><strong>Local:</strong> {`${licitacao.orgao?.cidade} / ${licitacao.orgao?.uf}`}</span></div>
                      <div className="flex items-start gap-2"><CalendarDays className="w-4 h-4 mt-1" /><span><strong>Abertura:</strong> {formatGenericDateTime(licitacao.datahora_abertura || licitacao.datahora_prazo)}</span></div>
                      <div className="flex items-start gap-2"><FileText className="w-4 h-4 mt-1" /><span><strong>Edital:</strong> {licitacao.edital ?? 'N/A'}</span></div>
                      <div className="flex items-start gap-2"><strong>Valor Estimado:</strong><span className="font-semibold text-green-700">{formatCurrency(licitacao.valor_estimado)}</span></div>
                    </div>

                    {licitacao.observacao && (
                      <details className="group mt-3 text-sm">
                        <summary className="flex items-center gap-2 cursor-pointer list-none font-medium text-gray-700 hover:text-gray-900 transition-colors">
                          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                          <span>Ver Observações</span>
                        </summary>
                        <div className="mt-2 pt-3 text-gray-600 whitespace-pre-wrap border-t border-gray-200">
                          <p>{licitacao.observacao}</p>
                        </div>
                      </details>
                    )}

                    {(licitacao.documento && licitacao.documento.length > 0 && licitacao.documento[0].url) && (
                      <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
                        <Button variant="outline" size="sm" asChild>
                          <a href={`${DOWNLOAD_BASE_URL}${licitacao.documento[0].url}`} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-2" /> Download Edital
                          </a>
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          !isLoading && lastSearchQuestion && (
            <Card>
              <CardContent className="py-16 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum resultado encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">Sua busca por "{lastSearchQuestion}" não retornou resultados.</p>
              </CardContent>
            </Card>
          )
        )}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}