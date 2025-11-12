"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"; // Alterado de Sheet para Dialog
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { useState, useEffect } from "react";
import { Filters } from "@/app/page";

interface FilterDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (filters: Filters) => void;
  currentFilters: Filters;
}

export default function FilterDialog({
  isOpen,
  onOpenChange,
  onApply,
  currentFilters,
}: FilterDialogProps) {
  const [filters, setFilters] = useState<Filters>(currentFilters);

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFilters((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id: keyof Filters, value: string) => {
    if (value === "todos") {
      setFilters((prev) => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    } else {
      setFilters((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleDateChange = (id: keyof Filters, date: Date | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [id]: date ? date.toISOString().split("T")[0] : undefined,
    }));
  };

  const handleApply = () => {
    const cleanedFilters: Filters = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value !== undefined && value !== null) {
        cleanedFilters[key as keyof Filters] = value;
      }
    });
    onApply(cleanedFilters);
  };

  const handleClear = () => {
    const defaultFilters = {};
    setFilters(defaultFilters);
    onApply(defaultFilters);
  };

  return (
    // Alterado para Dialog
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Filtros de Busca</DialogTitle>
          <DialogDescription>
            Refine sua busca por licitações.
          </DialogDescription>
        </DialogHeader>
        
        {/* Adicionada ScrollArea para o conteúdo do Dialog */}
        <ScrollArea className="flex-grow pr-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
            
            {/* Seção 1: Ordenação e Relevância */}
            <div className="grid w-full items-center gap-1.5">
              <Label>Ordenar Por</Label>
              <Select
                value={filters.sortBy || "relevancia"}
                onValueChange={(value) => handleSelectChange("sortBy", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevancia">Relevância (IA)</SelectItem>
                  <SelectItem value="data">Mais Recentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label>Grau de Relevância (IA)</Label>
              <Select
                value={filters.grauRelevanciaIA || ""} 
                onValueChange={(value) => handleSelectChange("grauRelevanciaIA", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as relevâncias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem> 
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-1 md:col-span-2 my-2">
              <Separator />
            </div>

            {/* Seção 2: Busca por Termos */}
            <div className="grid w-full items-center gap-1.5 md:col-span-2">
              <Label htmlFor="query">Objeto da Compra (Palavra-chave)</Label>
              <Input
                type="text"
                id="query"
                placeholder="Ex: software, consultoria, material de escritório..."
                value={filters.query || ""}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="modalidade">Modalidade</Label>
              <Input
                type="text"
                id="modalidade"
                placeholder="Ex: Pregão, Concorrência..."
                value={filters.modalidade || ""}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="numeroProcesso">Número do Processo</Label>
              <Input
                type="text"
                id="numeroProcesso"
                placeholder="Ex: 12345/2024"
                value={filters.numeroProcesso || ""}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="col-span-1 md:col-span-2 my-2">
              <Separator />
            </div>

            {/* Seção 3: Órgão */}
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="orgao">Nome do Órgão</Label>
              <Input
                type="text"
                id="orgao"
                placeholder="Ex: Ministério da Saúde..."
                value={filters.orgao || ""}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="cnpjOrgao">CNPJ do Órgão</Label>
              <Input
                type="text"
                id="cnpjOrgao"
                placeholder="Somente números"
                value={filters.cnpjOrgao || ""}
                onChange={handleInputChange}
              />
            </div>
            
            {/* Seção 4: Localização */}
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="uf">UF (Sigla)</Label>
                <Input
                  type="text"
                  id="uf"
                  placeholder="Ex: SP, RJ..."
                  value={filters.uf || ""}
                  onChange={handleInputChange}
                  maxLength={2}
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="municipio">Município</Label>
                <Input
                  type="text"
                  id="municipio"
                  placeholder="Ex: Brasília..."
                  value={filters.municipio || ""}
                  onChange={handleInputChange}
                />
              </div>

            <div className="col-span-1 md:col-span-2 my-2">
              <Separator />
            </div>
            
            {/* Seção 5: Datas */}
            <div className="grid w-full items-center gap-1.5">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.dataInicial && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dataInicial ? (
                      format(new Date(filters.dataInicial.replace(/-/g, '\/')), "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data inicial</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dataInicial ? new Date(filters.dataInicial.replace(/-/g, '\/')) : undefined}
                    onSelect={(date) => handleDateChange("dataInicial", date)}
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
                      !filters.dataFinal && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dataFinal ? (
                      format(new Date(filters.dataFinal.replace(/-/g, '\/')), "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data final</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dataFinal ? new Date(filters.dataFinal.replace(/-/g, '\/')) : undefined}
                    onSelect={(date) => handleDateChange("dataFinal", date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="col-span-1 md:col-span-2 my-2">
              <Separator />
            </div>

            {/* Seção 6: Valor */}
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="valorMin">Valor Mínimo (R$)</Label>
                <Input
                  type="number"
                  id="valorMin"
                  placeholder="Ex: 1000"
                  value={filters.valorMin || ""}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="valorMax">Valor Máximo (R$)</Label>
                <Input
                  type="number"
                  id="valorMax"
                  placeholder="Ex: 50000"
                  value={filters.valorMax || ""}
                  onChange={handleInputChange}
                />
              </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={handleClear}>
              Limpar Filtros
            </Button>
            <Button onClick={handleApply}>Aplicar Filtros</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}