// Arquivo: src/components/LicitacaoTableColumns.tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { pncpLicitacao } from "@/lib/db/schema"
import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Licitacao = typeof pncpLicitacao.$inferSelect

// Funções de formatação
const formatarData = (data: Date | string | null) => {
  if (!data) return "N/A"
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

const formatarValor = (valor: any) => {
  const num = Number(valor)
  if (isNaN(num) || num === 0) return "Não informado"
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

// Props para as colunas, permitindo injetar o handler de clique
type GetColumnsProps = {
  onRowClick: (licitacao: Licitacao) => void
}

export const getLicitacaoTableColumns = ({ onRowClick }: GetColumnsProps): ColumnDef<Licitacao>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Selecionar todas"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Selecionar linha"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "objetoCompra",
    header: "Objeto",
    cell: ({ row }) => {
      return (
        <Button
          variant="link"
          className="p-0 h-auto font-normal text-left whitespace-normal"
          onClick={() => onRowClick(row.original)}
        >
          {row.getValue("objetoCompra")}
        </Button>
      )
    },
  },
  {
    accessorKey: "grauRelevanciaIA",
    header: "Relevância",
    cell: ({ row }) => {
      const relevancia = row.getValue("grauRelevanciaIA") as string
      if (!relevancia) return null

      return (
        <Badge
          variant={
            relevancia === "Alta"
              ? "destructive"
              : relevancia === "Média"
              ? "default"
              : "secondary"
          }
        >
          {relevancia}
        </Badge>
      )
    },
  },
  {
    accessorKey: "valorEstimado",
    header: () => <div className="text-right">Valor Estimado</div>,
    cell: ({ row }) => (
      <div className="text-right">{formatarValor(row.getValue("valorEstimado"))}</div>
    ),
  },
  {
    accessorKey: "orgao",
    header: "Órgão",
  },
  {
    accessorKey: "dataPublicacaoPNCP",
    header: "Publicação",
    cell: ({ row }) => formatarData(row.getValue("dataPublicacaoPNCP")),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const licitacao = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRowClick(licitacao)}>
              Ver Detalhes
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={licitacao.linkPNCP ?? "#"} target="_blank" rel="noopener noreferrer">
                Ver no PNCP
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={licitacao.linkSistemaOrigem ?? "#"} target="_blank" rel="noopener noreferrer">
                Sistema de Origem
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
]