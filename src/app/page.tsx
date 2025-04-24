"use client"

import type React from "react"

import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster, toast } from "sonner"

interface Licitacao {
  id: string
  objeto: string
  valor_estimado: number
  link_edital?: string
}

interface Resultado {
  boletim: string
  data: string
  licitacoes: Licitacao[]
}

export default function Home() {
  const [question, setQuestion] = useState("")
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // Remover a desestruturação do useToast
  // const { toast } = useToast()

  const handleBuscar = async () => {
    if (!question.trim()) {
      // Atualizar as chamadas de toast para usar a API do Sonner
      // toast({
      //   title: "Campo vazio",
      //   description: "Por favor, digite sua consulta antes de buscar.",
      //   variant: "destructive",
      // })
      toast.error("Por favor, digite sua consulta antes de buscar.", {
        description: "O campo de busca não pode estar vazio.",
      })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/buscar-licitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      })

      if (!res.ok) {
        throw new Error("Erro ao buscar licitações")
      }

      const data = await res.json()
      setResultados(data.resultados || [])
    } catch (error) {
      // Atualizar a segunda chamada de toast
      // toast({
      //   title: "Erro na busca",
      //   description: "Ocorreu um erro ao buscar as licitações. Tente novamente.",
      //   variant: "destructive",
      // })
      console.error(error)
      // toast.error("Ocorreu um erro ao buscar as licitações. Tente novamente.")
      toast.error("Erro na busca", {
        description: "Ocorreu um erro ao buscar as licitações. Tente novamente.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBuscar()
    }
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Chat IA - Licitações Públicas</h1>
          <p className="mt-2 text-sm text-gray-600">Encontre licitações públicas usando inteligência artificial</p>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <Input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex: licitações de veículos entre 500 mil e 1 milhão"
                  className="pl-10"
                  disabled={isLoading}
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <Button onClick={handleBuscar} disabled={isLoading} className="min-w-[100px]">
                {isLoading ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : resultados.length > 0 ? (
          <div className="space-y-6">
            {resultados.map((resultado, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="bg-gray-50 pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span>Boletim #{resultado.boletim}</span>
                    <Badge variant="outline" className="ml-2">
                      {resultado.data}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-6">
                    {resultado.licitacoes.map((licitacao) => (
                      <li key={licitacao.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <h3 className="font-medium text-gray-900 mb-2">{licitacao.objeto}</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Valor estimado:</span>{" "}
                            <span className="text-emerald-600 font-semibold">
                              {formatCurrency(licitacao.valor_estimado)}
                            </span>
                          </p>
                          {licitacao.link_edital && (
                            <Button variant="outline" size="sm" asChild className="sm:self-end">
                              <a
                                href={licitacao.link_edital}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center"
                              >
                                Download do Edital
                              </a>
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum resultado encontrado</h3>
              <p className="text-gray-500 text-center max-w-md">
                {question.trim()
                  ? "Tente refinar sua busca com termos mais específicos ou diferentes palavras-chave."
                  : "Digite sua consulta e clique em buscar para encontrar licitações."}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
