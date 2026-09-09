import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCargos } from "@/contexts/CargosContext";
import { useClientes } from "@/contexts/ClientesContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  funcionarioId: string;
  funcionarioNome: string;
  cargoAtualId: string;
  salarioAtual: string;
  clienteAtualId: string;
}

export default function SolicitarPromocaoDialog({
  open, onOpenChange, funcionarioId, funcionarioNome,
  cargoAtualId, salarioAtual, clienteAtualId,
}: Props) {
  const { cargos } = useCargos();
  const { clientes } = useClientes();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data_promocao: new Date().toISOString().split("T")[0],
    cargo_novo_id: "",
    salario_novo: "",
    motivo: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        data_promocao: new Date().toISOString().split("T")[0],
        cargo_novo_id: "",
        salario_novo: "",
        motivo: "",
      });
    }
  }, [open]);

  useEffect(() => {
    const c = cargos.find((x) => x.id === form.cargo_novo_id);
    if (c?.salario) setForm((p) => ({ ...p, salario_novo: c.salario }));
  }, [form.cargo_novo_id, cargos]);

  const cargoAtual = cargos.find((c) => c.id === cargoAtualId);
  const clienteAtual = clientes.find((c) => c.id === clienteAtualId);

  const handleSubmit = async () => {
    if (!form.cargo_novo_id || !form.data_promocao) {
      toast.error("Informe o novo cargo e a data da promoção.");
      return;
    }
    if (!form.motivo.trim()) {
      toast.error("A justificativa do pedido é obrigatória.");
      return;
    }
    setSaving(true);
    const cargoNovo = cargos.find((c) => c.id === form.cargo_novo_id);
    const { error } = await supabase.from("promocoes").insert({
      funcionario_id: funcionarioId,
      data_promocao: form.data_promocao,
      cargo_anterior_id: cargoAtualId,
      cargo_anterior_nome: cargoAtual?.nome || "",
      cargo_novo_id: form.cargo_novo_id,
      cargo_novo_nome: cargoNovo?.nome || "",
      salario_anterior: salarioAtual,
      salario_novo: form.salario_novo,
      cliente_anterior_id: clienteAtualId,
      cliente_anterior_nome: clienteAtual?.nome || "",
      cliente_novo_id: clienteAtualId,
      cliente_novo_nome: clienteAtual?.nome || "",
      motivo: form.motivo,
      observacoes: "",
      status: "pendente",
    } as any);
    setSaving(false);
    if (error) {
      console.error("Erro ao solicitar promoção:", error);
      toast.error("Erro ao solicitar promoção.");
      return;
    }
    toast.success("Solicitação de promoção registrada. Aguardando aprovação.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Promoção</DialogTitle>
          <DialogDescription>
            {funcionarioNome} — cargo atual: {cargoAtual?.nome || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Data da promoção *</Label>
              <Input
                type="date"
                value={form.data_promocao}
                onChange={(e) => setForm({ ...form, data_promocao: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Novo salário</Label>
              <Input
                value={form.salario_novo}
                onChange={(e) => setForm({ ...form, salario_novo: e.target.value.replace(",", ".") })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Novo cargo *</Label>
            <Select value={form.cargo_novo_id} onValueChange={(v) => setForm({ ...form, cargo_novo_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
              <SelectContent>
                {cargos.filter((c) => c.id !== cargoAtualId).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Justificativa do pedido *</Label>
            <Textarea
              rows={4}
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              placeholder="Descreva a justificativa da solicitação de promoção"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Enviando..." : "Solicitar Promoção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
