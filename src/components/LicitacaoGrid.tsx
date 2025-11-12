// Arquivo: src/components/LicitacaoGrid.tsx
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { pncpLicitacao } from "@/lib/db/schema"
import { Table } from "@tanstack/react-table"
import React from "react"

type Licitacao = typeof pncpLicitacao.$inferSelect

interface LicitacaoGridProps {
  table: Table<Licitacao>
  onRowClick: (licitacao: Licitacao) => void
}

const formatarData = (data: Date | string | null) => {
  if (!data) return "N/A"
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

const formatarValor = (valor: string | number | null | undefined) => {
  const num = Number(valor)
  if (isNaN(num) || num === 0) return "Não informado"
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export function LicitacaoGrid({ table, onRowClick }: LicitacaoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {table.getRowModel().rows.map((row) => {
        const licitacao = row.original
        return (
          <Card
            key={licitacao.numeroControlePNCP}
            className="relative cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="absolute top-4 right-4 z-10">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Selecionar licitação"
                className="bg-background/80"
              />
            </div>
            
            <div onClick={() => onRowClick(licitacao)}>
              <CardHeader>
                <CardTitle className="text-lg pr-10">
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
            </div>
          </Card>
        )
      })}
    </div>
  )
}