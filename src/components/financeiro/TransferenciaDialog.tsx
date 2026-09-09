import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useFinanceiro } from "@/contexts/FinanceiroContext";

export default function TransferenciaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { contasBancarias, addLancamento } = useFinanceiro();
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [desc, setDesc] = useState("");

  const submit = async () => {
    if (!origem || !destino || origem === destino) { toast.error("Selecione contas distintas."); return; }
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) { toast.error("Valor inválido."); return; }
    await addLancamento({
      tipo: "transferencia",
      conta_bancaria_id: origem,
      conta_destino_id: destino,
      valor: v,
      data,
      descricao: desc || "Transferência entre contas",
      conciliado: false,
    });
    toast.success("Transferência registrada!");
    setOrigem(""); setDestino(""); setValor(""); setDesc("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Transferência entre Contas</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Conta de Origem</label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{contasBancarias.filter(c => c.ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Conta de Destino</label>
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{contasBancarias.filter(c => c.ativo && c.id !== origem).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ""))} />
            </div>
            <div>
              <label className="text-sm font-medium">Data</label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Transferir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
