"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type PncpLicitacao as Licitacao } from "@/lib/types";

interface LicitacaoDetailDialogProps {
  licitacao: Licitacao | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}


const formatCurrency = (v: number | null | undefined) => v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não informado";
const formatGenericDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' }) : "Não informado";

const DetailRow = ({ label, value }: { label: string, value: React.ReactNode }) => {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-muted-foreground font-medium col-span-1">{label}:</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );
};


export function LicitacaoDetailDialog({ licitacao, isOpen, onOpenChange }: LicitacaoDetailDialogProps) {
  if (!licitacao) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pr-10">
          <DialogTitle className="text-xl leading-tight text-primary">
            {licitacao.objetoCompra}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1 flex-wrap">
            <span>{licitacao.razaoSocialOrgaoEntidade}</span>
            <Badge variant="outline">{licitacao.modalidadeNome}</Badge>
            <Badge variant="secondary">{licitacao.numeroCompra}/{licitacao.anoCompra}</Badge>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-4 space-y-6">
          
          {/* Informações Gerais */}
          <div className="space-y-3">
            <h4 className="font-semibold text-md">Informações Gerais</h4>
            <Separator />
            <dl className="space-y-2">
              <DetailRow label="Nº Controle PNCP" value={licitacao.numeroControlePNCP} />
              <DetailRow label="Processo" value={licitacao.processo} />
              <DetailRow label="Modalidade" value={licitacao.modalidadeNome} />
              <DetailRow label="Modo de Disputa" value={licitacao.modoDisputaNome} />
              <DetailRow label="Instrumento" value={licitacao.tipoInstrumentoConvocatorioNome} />
              <DetailRow label="Amparo Legal" value={licitacao.amparoLegal?.nome} />
              {licitacao.informacaoComplementar && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <dt className="text-muted-foreground font-medium col-span-1">Inf. Complementar:</dt>
                  <dd className="col-span-2 bg-muted/50 p-2 rounded-md text-xs">{licitacao.informacaoComplementar}</dd>
                </div>
              )}
               {licitacao.justificativaPresencial && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <dt className="text-muted-foreground font-medium col-span-1">Just. Presencial:</dt>
                  <dd className="col-span-2 bg-muted/50 p-2 rounded-md text-xs">{licitacao.justificativaPresencial}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Valores e Datas */}
          <div className="space-y-3">
            <h4 className="font-semibold text-md">Valores e Datas</h4>
            <Separator />
            <dl className="space-y-2">
              <DetailRow label="Valor Estimado" value={<span className="font-bold text-green-700">{formatCurrency(licitacao.valorTotalEstimado)}</span>} />
              <DetailRow label="Valor Homologado" value={formatCurrency(licitacao.valorTotalHomologado)} />
              <DetailRow label="Publicação PNCP" value={formatGenericDateTime(licitacao.dataPublicacaoPncp)} />
              <DetailRow label="Abertura Propostas" value={formatGenericDateTime(licitacao.dataAberturaProposta)} />
              <DetailRow label="Encerramento Propostas" value={formatGenericDateTime(licitacao.dataEncerramentoProposta)} />
            </dl>
          </div>

          {/* Órgão */}
          <div className="space-y-3">
            <h4 className="font-semibold text-md">Órgão Responsável</h4>
            <Separator />
            <dl className="space-y-2">
              <DetailRow label="Razão Social" value={licitacao.orgaoEntidade.razaoSocial} />
              <DetailRow label="CNPJ" value={licitacao.orgaoEntidade.cnpj} />
              <DetailRow label="Unidade" value={licitacao.unidadeOrgao.nomeUnidade} />
              <DetailRow label="Localidade" value={`${licitacao.unidadeOrgao.municipioNome} - ${licitacao.unidadeOrgao.ufSigla}`} />
              {licitacao.linkSistemaOrigem && <DetailRow label="Link de Origem" value={<a href={licitacao.linkSistemaOrigem} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">{licitacao.linkSistemaOrigem}</a>} />}
            </dl>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}