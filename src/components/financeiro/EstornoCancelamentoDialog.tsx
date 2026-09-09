import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useFinanceiro, ContaPagar, ContaReceber, formatBRL } from "@/contexts/FinanceiroContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conta: ContaPagar | ContaReceber | null;
  modo: "pagar" | "receber";
  acao: "estornar" | "cancelar";
}

export default function EstornoCancelamentoDialog({ open, onOpenChange, conta, modo, acao }: Props) {
  const { lancamentos, deleteLancamento, updateContaPagar, updateContaReceber } = useFinanceiro();
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);

  useEffect(() => { if (open) setMotivo(""); }, [open]);

  if (!conta) return null;

  const titulo = acao === "estornar"
    ? `Estornar ${modo === "pagar" ? "pagamento" : "recebimento"}`
    : `Cancelar conta a ${modo === "pagar" ? "pagar" : "receber"}`;

  const descricao = acao === "estornar"
    ? "Os lançamentos bancários vinculados serão removidos e a conta voltará para 'Em aberto'."
    : "A conta será marcada como cancelada. Esta ação não pode ser desfeita.";

  const handleConfirm = async () => {
    if (!motivo.trim() || motivo.trim().length < 5) {
      toast.error("Informe o motivo (mínimo 5 caracteres).");
      return;
    }
    setProcessando(true);
    try {
      const carimbo = `[${acao === "estornar" ? "ESTORNO" : "CANCELAMENTO"} ${new Date().toLocaleString("pt-BR")}] ${motivo.trim()}`;
      const obsAtual = conta.observacao || "";
      const novaObs = obsAtual ? `${obsAtual}\n${carimbo}` : carimbo;

      if (acao === "estornar") {
        // Remove lancamentos vinculados
        const vinc = lancamentos.filter((l) =>
          modo === "pagar" ? l.conta_pagar_id === conta.id : l.conta_receber_id === conta.id
        );
        for (const l of vinc) await deleteLancamento(l.id);

        const update: any = {
          status: "aberta",
          observacao: novaObs,
        };
        if (modo === "pagar") {
          update.valor_pago = 0;
          update.data_pagamento = null;
          await updateContaPagar(conta.id, update);
        } else {
          update.valor_recebido = 0;
          update.data_recebimento = null;
          await updateContaReceber(conta.id, update);
        }
        toast.success(`Estorno realizado. ${vinc.length} lançamento(s) removido(s).`);
      } else {
        const update: any = { status: "cancelada", observacao: novaObs };
        if (modo === "pagar") await updateContaPagar(conta.id, update);
        else await updateContaReceber(conta.id, update);
        toast.success("Conta cancelada.");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Falha: " + (e.message || e));
    } finally {
      setProcessando(false);
    }
  };

  const valorBaixado = modo === "pagar"
    ? (conta as ContaPagar).valor_pago
    : (conta as ContaReceber).valor_recebido;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-muted/40 p-3 rounded-md">
            <div className="font-medium">{conta.descricao}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Valor: {formatBRL(Number(conta.valor_total))}
              {acao === "estornar" && ` • ${modo === "pagar" ? "Pago" : "Recebido"}: ${formatBRL(Number(valorBaixado))}`}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Motivo *</label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder={acao === "estornar" ? "Ex.: Pagamento duplicado, erro de digitação..." : "Ex.: Cliente desistiu, fatura substituída..."}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processando}>Voltar</Button>
          <Button variant={acao === "cancelar" ? "destructive" : "default"} onClick={handleConfirm} disabled={processando}>
            {processando ? "Processando..." : (acao === "estornar" ? "Confirmar estorno" : "Cancelar conta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
