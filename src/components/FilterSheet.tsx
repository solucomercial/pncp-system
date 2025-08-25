"use client"

import React, { useState, useEffect } from "react"
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
 SheetFooter,
 SheetClose,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import {
 Popover,
 PopoverContent,
 PopoverTrigger,
} from "@/components/ui/popover"
import {
 Command,
 CommandEmpty,
 CommandGroup,
 CommandInput,
 CommandItem,
 CommandList,
} from "@/components/ui/command"
import { Switch } from "@/components/ui/switch"
import { Calendar as CalendarIcon, Check, ChevronsUpDown, XIcon } from "lucide-react"
import { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"

const defaultBlacklist = [
 "teste", "simulação", "cancelado", "leilão", "dedetização", "controle de pragas",
 "poços artesianos", "desratização", "pombo", "ratos", "controle de pragas urbanas",
 "descupinização", "banheiro químico", "desentupimento de canos e ralos",
 "buffet", "coração", "organização de espaços", "salgados fritos e assados", "bolos",
 "brinquedos", "infláveis", "pula pula", "máquina algodão doce", "pipoca", "sessão solene", "homenagem",
 "fornecimento de pão", "confeitaria", "padaria", "doces", "ocupação de espaço físico", "picolé", "algodão doce", "coquetel", "panificação",
 "ações institucionais", "sociais", "reuniões", "eventos", "biscoitos", "praça de alimentação", "agricultores familiares", "familiares rurais", "festa",
 "hotelaria", "feiras livres", "camarim",
 "sem motorista", "sem condutor", "ônibus e micro-ônibus", "caminhão", "máquinas", "veículos pesados", "unidades habitações",
 "audiovisual", "imagens", "locução", "panfletos", "produção de cards", "outdoor", "cartazes",
 "trabalho social", "sem fins lucrativos", "vagas de estágio remunerado", "curso",
 "armamento", "pistolas", "musica", "multi-instrumentista", "sociedade civil", "leilões", "alienação de bens", "leiloeiros", "lavagem automotiva",
 "samba", "pagode", "rock", "sertanejo", "lavagem dos veiculos",
 "teatro", "móveis", "imóveis", "ginástica", "musculação", "dança", "imprensa", "segurança privada", "desfile", "albergagem", "veterinária",
 "usina", "professor", "recreativos", "arbitragem", "assesoria", "consultoria", "cerimonialista", "campeonatos", "recapeamento", "decoração natalina",
 "show pirotécnico", "fogos de artifício", "elevador"
];

const linhasFornecimento = [
 {
  label: "Limpeza Predial",
  keywords: [
   "limpeza", "conservação", "asseio", "higienização",
   "limpeza e conservação", "limpeza predial", "serviços de limpeza", "limpeza e higienização",
   "limpeza hospitalar", "higienização de ambientes", "desinfecção", "assepsia", "limpeza terminal",
   "tratamento de piso", "limpeza de vidros", "limpeza de fachadas", "serviços contínuos de limpeza"
  ],
 },
 {
  label: "Manutenção Predial",
  keywords: [
   "manutenção predial", "manutenção preventiva", "manutenção corretiva",
   "serviços de reparo", "reformas", "pequenas obras", "manutenção de instalações", "elétrica", "hidráulica", "pintura", "alvenaria", "serralheria"
  ],
 },
 {
  label: "Engenharia",
  keywords: [
   "engenharia", "obras", "construção", "edificações", "serviços de engenharia",
   "engenharia civil", "projetos de engenharia", "execução de obras", "infraestrutura"
  ],
 },
 {
  label: "Recursos Humanos (Mão de Obra)",
  keywords: [
   "mão de obra", "terceirização de serviços", "facilities", "postos de trabalho", "serviços continuados",
   "apoio administrativo", "recepcionista", "porteiro", "copeiragem", "serviços gerais", "telefonista", "motorista", "jardinagem", "operacional"
  ],
 },
 {
  label: "Administração e Gestão",
  keywords: [
   "administração", "gestão", "cogestão", "gerenciamento", "apoio logístico",
   "gestão de facilities", "gestão de contratos", "gestão prisional", "administração de unidades"
  ],
 },
 {
  label: "Locação de Veículos",
  keywords: [
   "locação de veículos", "aluguel de veículos", "locação de frota", "transporte",
   "veículos com motorista", "veículos com condutor", "transporte de passageiros", "transporte de servidores", "fretamento"
  ],
 },
 {
  label: "Fornecimento de Alimentação",
  keywords: [
   "alimentação", "refeições", "nutrição", "fornecimento de alimentos",
   "merenda escolar", "alimentação hospitalar", "alimentação prisional", "refeições coletivas", "kit lanche", "rancho"
  ],
 },
 {
  label: "Outras",
  keywords: [],
 },
];


const modalidadesDisponiveis = [
 { id: "leilão eletrônico", label: "Leilão Eletrônico" },
 { id: "diálogo competitivo", label: "Diálogo Competitivo" },
 { id: "concurso", label: "Concurso" },
 { id: "concorrência eletrônica", label: "Concorrência Eletrônica" },
 { id: "concorrência presencial", label: "Concorrência Presencial" },
 { id: "pregão eletrônico", label: "Pregão Eletrônico" },
 { id: "pregão presencial", label: "Pregão Presencial" },
 { id: "dispensa de licitação", label: "Dispensa de Licitação" },
 { id: "inexigibilidade de licitação", label: "Inexigibilidade de Licitação" },
 { id: "manifestação de interesse", label: "Manifestação de Interesse" },
 { id: "pré-qualificação", label: "Pré-qualificação" },
 { id: "credenciamento", label: "Credenciamento" },
 { id: "leilão presencial", label: "Leilão Presencial" },
];

const estadosBrasil = [
 { value: "AC", label: "Acre" }, { value: "AL", label: "Alagoas" }, { value: "AP", label: "Amapá" },
 { value: "AM", label: "Amazonas" }, { value: "BA", label: "Bahia" }, { value: "CE", label: "Ceará" },
 { value: "DF", label: "Distrito Federal" }, { value: "ES", label: "Espírito Santo" }, { value: "GO", label: "Goiás" },
 { value: "MA", label: "Maranhão" }, { value: "MT", label: "Mato Grosso" }, { value: "MS", label: "Mato Grosso do Sul" },
 { value: "MG", label: "Minas Gerais" }, { value: "PA", label: "Pará" }, { value: "PB", label: "Paraíba" },
 { value: "PR", label: "Paraná" }, { value: "PE", label: "Pernambuco" }, { value: "PI", label: "Piauí" },
 { value: "RJ", label: "Rio de Janeiro" }, { value: "RN", label: "Rio Grande do Norte" }, { value: "RS", label: "Rio Grande do Sul" },
 { value: "RO", label: "Rondônia" }, { value: "RR", label: "Roraima" }, { value: "SC", label: "Santa Catarina" },
 { value: "SP", label: "São Paulo" }, { value: "SE", label: "Sergipe" }, { value: "TO", label: "Tocantins" }
];

export interface Filters {
 modalidades: string[];
 dateRange?: DateRange;
 palavrasChave: string[];
 valorMin: string;
 valorMax: string;
 estado: string | null;
 blacklist: string[];
 useGeminiAnalysis?: boolean;
}

interface FilterSheetProps {
 isOpen: boolean;
 onOpenChange: (open: boolean) => void;
 onApplyFilters: (filters: Filters) => void;
}

export function FilterSheet({ isOpen, onOpenChange, onApplyFilters }: FilterSheetProps) {
 const [modalidades, setModalidades] = useState<string[]>([]);
 const [date, setDate] = useState<DateRange | undefined>(undefined);
 const [palavrasChave, setPalavrasChave] = useState<string[]>([]);
 const [valorMin, setValorMin] = useState<string>("");
 const [valorMax, setValorMax] = useState<string>("");
 const [estado, setEstado] = useState<string | null>(null);
 const [blacklist, setBlacklist] = useState<string[]>(defaultBlacklist);
 const [useGeminiAnalysis, setUseGeminiAnalysis] = useState<boolean>(true);
 const [newBlacklistItem, setNewBlacklistItem] = useState<string>("");
 const [outrasIsSelected, setOutrasIsSelected] = useState(false);


 const [openLinhaFornecimento, setOpenLinhaFornecimento] = useState(false);
 const [openEstado, setOpenEstado] = useState(false);

 const handleApply = () => {
  let finalBlacklist = [...blacklist];
  let finalPalavrasChave = [...palavrasChave];

  if (outrasIsSelected) {
   const allOtherKeywords = linhasFornecimento
    .filter(item => item.label !== "Outras")
    .flatMap(item => item.keywords);

   finalBlacklist = [...new Set([...finalBlacklist, ...allOtherKeywords])];
   finalPalavrasChave = finalPalavrasChave.filter(kw => !allOtherKeywords.includes(kw));
  }

  onApplyFilters({
   modalidades,
   dateRange: date,
   palavrasChave: finalPalavrasChave,
   valorMin,
   valorMax,
   estado,
   blacklist: finalBlacklist,
   useGeminiAnalysis,
  });
  onOpenChange(false);
 };

 const handleClear = () => {
  setModalidades([]);
  setDate(undefined);
  setPalavrasChave([]);
  setValorMin("");
  setValorMax("");
  setEstado(null);
  setBlacklist(defaultBlacklist);
  setUseGeminiAnalysis(true);
  setOutrasIsSelected(false);
 };

 const addBlacklistItem = () => {
  const item = newBlacklistItem.trim().toLowerCase();
  if (item && !blacklist.includes(item)) {
   setBlacklist([...blacklist, item].sort());
   setNewBlacklistItem("");
  }
 };

 const removeBlacklistItem = (itemToRemove: string) => {
  setBlacklist(blacklist.filter(item => item !== itemToRemove));
 };

 useEffect(() => {
  if (isOpen) {
   setBlacklist(prev => [...prev].sort());
  }
 }, [isOpen]);

 const selectedGroupsCount = linhasFornecimento.filter(item =>
  item.label !== "Outras" && item.keywords.every(kw => palavrasChave.includes(kw))
 ).length + (outrasIsSelected ? 1 : 0);

 return (
  <Sheet open={isOpen} onOpenChange={onOpenChange}>
   <SheetContent className="flex flex-col w-full sm:max-w-md bg-background p-6">
    <SheetHeader className="space-y-1 border-b pb-4 mb-4">
     <SheetTitle className="text-lg font-semibold">Filtros Avançados</SheetTitle>
     <SheetDescription className="text-sm text-muted-foreground">
      Refine sua busca por licitações com os filtros abaixo.
     </SheetDescription>
    </SheetHeader>

    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
     <div className="space-y-3">
      <Label className="text-sm font-medium">Análise com IA (Gemini)</Label>
      <div className="flex items-center space-x-2 rounded-md p-2 hover:bg-muted/40 transition-colors">
       <Switch
        id="gemini-analysis"
        checked={useGeminiAnalysis}
        onCheckedChange={setUseGeminiAnalysis}
       />
       <label htmlFor="gemini-analysis" className="text-sm font-normal leading-none cursor-pointer select-none">
        {useGeminiAnalysis ? "Análise com IA ativada" : "Análise com IA desativada"}
       </label>
      </div>
      <p className="text-xs text-muted-foreground px-2">
       Desative para uma busca mais rápida e ampla, sem o filtro de relevância da IA.
      </p>
     </div>

     <div className="space-y-3">
      <Label className="text-sm font-medium">Modalidade</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
       {modalidadesDisponiveis.map((item) => (
        <div key={item.id} className="flex items-center space-x-2 rounded-md p-2 hover:bg-muted/40 transition-colors">
         <Checkbox
          id={item.id}
          checked={modalidades.includes(item.id)}
          onCheckedChange={(checked) => {
           setModalidades((prev) =>
            checked ? [...prev, item.id] : prev.filter((v) => v !== item.id)
           );
          }}
         />
         <label htmlFor={item.id} className="text-sm font-normal leading-none cursor-pointer select-none">
          {item.label}
         </label>
        </div>
       ))}
      </div>
     </div>

     <div className="space-y-3">
      <Label className="text-sm font-medium">Período de Publicação</Label>
      <Popover>
       <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
         <CalendarIcon className="mr-2 h-4 w-4" />
         {date?.from ? (date.to ? (<>{format(date.from, "dd/MM/yy", { locale: ptBR })} - {format(date.to, "dd/MM/yy", { locale: ptBR })}</>) : (format(date.from, "dd/MM/yyyy", { locale: ptBR }))) : (<span>Escolha um período</span>)}
        </Button>
       </PopoverTrigger>
       <PopoverContent className="w-auto p-0" align="start">
        <Calendar initialFocus mode="range" selected={date} onSelect={setDate} numberOfMonths={1} locale={ptBR} />
       </PopoverContent>
      </Popover>
     </div>

     <div className="space-y-3">
      <Label className="text-sm font-medium">Linha de Fornecimento</Label>
      <Popover open={openLinhaFornecimento} onOpenChange={setOpenLinhaFornecimento}>
       <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={openLinhaFornecimento} className="w-full justify-between">
         {selectedGroupsCount > 0 ? `${selectedGroupsCount} selecionada(s)` : "Selecione..."}
         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
       </PopoverTrigger>
       <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
         <CommandInput placeholder="Buscar linha..." />
         <CommandList>
          <CommandEmpty>Nenhuma linha encontrada.</CommandEmpty>
          <CommandGroup>
           {linhasFornecimento.map((item) => {
            const isSelected = item.label === "Outras"
             ? outrasIsSelected
             : item.keywords.every(kw => palavrasChave.includes(kw));

            return (
             <CommandItem
              key={item.label}
              onSelect={() => {
               if (item.label === "Outras") {
                setOutrasIsSelected(!outrasIsSelected);
               } else {
                setPalavrasChave(prev => {
                 if (isSelected) {
                  return prev.filter(kw => !item.keywords.includes(kw));
                 } else {
                  const newKeywords = item.keywords.filter(kw => !prev.includes(kw));
                  return [...prev, ...newKeywords];
                 }
                });
               }
              }}>
              <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
              {item.label}
             </CommandItem>
            );
           })}
          </CommandGroup>
         </CommandList>
        </Command>
       </PopoverContent>
      </Popover>
     </div>

     <div className="space-y-3">
      <Label className="text-sm font-medium">Estado</Label>
      <Popover open={openEstado} onOpenChange={setOpenEstado}>
       <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={openEstado} className="w-full justify-between">
         {estado ? estadosBrasil.find((e) => e.value === estado)?.label : "Selecione o estado..."}
         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
       </PopoverTrigger>
       <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
         <CommandInput placeholder="Buscar estado..." />
         <CommandList>
          <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
          <CommandGroup>
           {estadosBrasil.map((e) => (
            <CommandItem key={e.value} value={e.label} onSelect={() => {
             setEstado(e.value === estado ? null : e.value)
             setOpenEstado(false)
            }}>
             <Check className={cn("mr-2 h-4 w-4", estado === e.value ? "opacity-100" : "opacity-0")} />
             {e.label}
            </CommandItem>
           ))}
          </CommandGroup>
         </CommandList>
        </Command>
       </PopoverContent>
      </Popover>
     </div>

     <div className="space-y-3">
      <Label className="text-sm font-medium">Faixa de Valor (R$)</Label>
      <div className="flex items-center gap-2">
       <Input type="number" placeholder="Mínimo" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
       <span className="text-muted-foreground">-</span>
       <Input type="number" placeholder="Máximo" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
      </div>
     </div>

     <div className="space-y-3">
      <Label className="text-sm font-medium">Palavras-chave a Ignorar (Blacklist)</Label>
      <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[60px]">
       {blacklist.length > 0 ? blacklist.map((item) => (
        <Badge key={item} variant="destructive" className="flex items-center gap-1.5">
         {item}
         <button
          type="button"
          onClick={() => removeBlacklistItem(item)}
          className="rounded-full hover:bg-black/20 focus:outline-none transition-colors"
          aria-label={`Remover ${item}`}
         >
          <XIcon className="h-3 w-3" />
         </button>
        </Badge>
       )) : <span className="text-xs text-muted-foreground px-1">Nenhuma palavra-chave para ignorar.</span>}
      </div>
      <div className="flex items-center space-x-2">
       <Input
        type="text"
        placeholder="Adicionar palavra..."
        value={newBlacklistItem}
        onChange={(e) => setNewBlacklistItem(e.target.value)}
        onKeyDown={(e) => {
         if (e.key === "Enter") {
          e.preventDefault();
          addBlacklistItem();
         }
        }}
       />
       <Button size="sm" onClick={addBlacklistItem}>
        Adicionar
       </Button>
      </div>
     </div>
    </div>

    <SheetFooter className="mt-auto pt-4 border-t flex gap-2">
     <Button variant="outline" onClick={handleClear} className="flex-1">
      Limpar Filtros
     </Button>
     <SheetClose asChild>
      <Button onClick={handleApply} className="flex-1">
       Aplicar Filtros
      </Button>
     </SheetClose>
    </SheetFooter>
   </SheetContent>
  </Sheet>
 )
}