"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Filters } from "@/app/page";

interface FilterSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: Filters) => void;
  currentFilters: Filters;
}

export default function FilterSheet({
  isOpen,
  onOpenChange,
  onApply,
  currentFilters,
}: FilterSheetProps) {
  const [dataInicial, setDataInicial] = useState<Date | undefined>(
    currentFilters.dataInicial ? new Date(currentFilters.dataInicial) : undefined
  );
  const [dataFinal, setDataFinal] = useState<Date | undefined>(
    currentFilters.dataFinal ? new Date(currentFilters.dataFinal) : undefined
  );
  const [query, setQuery] = useState(currentFilters.query || "");

  const handleApply = () => {
    onApply({
      dataInicial: dataInicial ? dataInicial.toISOString().split("T")[0] : undefined,
      dataFinal: dataFinal ? dataFinal.toISOString().split("T")[0] : undefined,
      query: query || undefined,
    });
  };

  const handleClear = () => {
    setDataInicial(undefined);
    setDataFinal(undefined);
    setQuery("");
    onApply({});
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtros de Busca</SheetTitle>
          <SheetDescription>
            Refine sua busca por licitações.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="query">Objeto da Compra</Label>
            <Input
              type="text"
              id="query"
              placeholder="Ex: software, consultoria..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label>Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataInicial && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicial ? (
                    format(dataInicial, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione a data inicial</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataInicial}
                  onSelect={setDataInicial}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label>Data Final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataFinal && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFinal ? (
                    format(dataFinal, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione a data final</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataFinal}
                  onSelect={setDataFinal}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleClear}>
            Limpar Filtros
          </Button>
          <Button onClick={handleApply}>Aplicar Filtros</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}