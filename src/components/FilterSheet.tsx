"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
  // Estado local para todos os filtros
  const [filters, setFilters] = useState<Filters>(currentFilters);

  // Sincroniza o estado local se os filtros externos mudarem
  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFilters((prev) => ({ ...prev, [id]: value }));
  };

  // --- FUNÇÃO MODIFICADA ---
  // Agora entende o valor "todos" como 'undefined'
  const handleSelectChange = (id: keyof Filters, value: string) => {
    if (value === "todos") {
      // Se o usuário selecionou "Todas", limpamos o filtro (undefined)
      setFilters((prev) => {
        const newState = { ...prev };
        delete newState[id]; // Remove a chave do objeto
        return newState;
      });
    } else {
      // Caso contrário, define o valor selecionado
      setFilters((prev) => ({ ...prev, [id]: value }));
    }
  };
  // --- FIM DA MODIFICAÇÃO ---

  const handleDateChange = (id: keyof Filters, date: Date | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [id]: date ? date.toISOString().split("T")[0] : undefined,
    }));
  };

  const handleApply = () => {
    // Limpa chaves vazias antes de aplicar
    const cleanedFilters: Filters = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value !== undefined && value !== null) {
        cleanedFilters[key as keyof Filters] = value;
      }
    });
    onApply(cleanedFilters);
  };

  const handleClear = () => {
    const defaultFilters = {}; // Limpa TUDO
    setFilters(defaultFilters);
    onApply(defaultFilters); // Aplica os filtros limpos
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Filtros de Busca</SheetTitle>
          <SheetDescription>
            Refine sua busca por licitações.
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-grow pr-4">
          <div className="grid gap-6 py-6">
            
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
                // O value="" aqui é correto, pois `undefined || ""` = ""
                // Isso faz o placeholder "Todas as relevâncias" aparecer
                value={filters.grauRelevanciaIA || ""} 
                onValueChange={(value) => handleSelectChange("grauRelevanciaIA", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as relevâncias" />
                </SelectTrigger>
                <SelectContent>
                  {/* --- ITEM MODIFICADO --- */}
                  <SelectItem value="todos">Todas</SelectItem> 
                  {/* --- FIM DA MODIFICAÇÃO --- */}
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Seção 2: Busca por Termos */}
            <Label className="font-semibold">Busca por Termos</Label>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="query">Objeto da Compra</Label>
              <Input
                type="text"
                id="query"
                placeholder="Ex: software, consultoria..."
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

            <Separator />

            {/* Seção 3: Órgão */}
            <Label className="font-semibold">Dados do Órgão</Label>
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
            <Label className="font-semibold">Localização</Label>
             <div className="grid grid-cols-2 gap-4">
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
             </div>

            <Separator />
            
            {/* Seção 5: Datas */}
            <Label className="font-semibold">Período de Publicação</Label>
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
            
            <Separator />

            {/* Seção 6: Valor */}
            <Label className="font-semibold">Valor Estimado (R$)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="valorMin">Valor Mínimo</Label>
                <Input
                  type="number"
                  id="valorMin"
                  placeholder="Ex: 1000"
                  value={filters.valorMin || ""}
                  onChange={handleInputChange}
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="valorMax">Valor Máximo</Label>
                <Input
                  type="number"
                  id="valorMax"
                  placeholder="Ex: 50000"
                  value={filters.valorMax || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
             <Separator />
            
            {/* Seção 7: Outros */}
            <Label className="font-semibold">Outros</Label>
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

          </div>
        </ScrollArea>
        
        <SheetFooter className="pt-4 border-t">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={handleClear}>
              Limpar Filtros
            </Button>
            <Button onClick={handleApply}>Aplicar Filtros</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}