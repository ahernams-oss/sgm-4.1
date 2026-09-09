import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import type { Empenho } from "@/contexts/ClientesContext";
import { formatMilharBR, parseMilharBR } from "@/lib/valorPorExtenso";

interface Props {
  empenhos: Empenho[];
  onChange: (empenhos: Empenho[]) => void | Promise<unknown>;
  contratoNumero: string;
}

const empty = { numero: "", processo: "", data: "", valor: "" };

export default function EmpenhoSection({ empenhos, onChange, contratoNumero }: Props) {
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const total = useMemo(
    () => empenhos.reduce((s, e) => s + parseMilharBR(e.valor || ""), 0),
    [empenhos]
  );

  const salvar = async () => {
    if (!form.numero.trim()) { toast.error("Informe o Nº do empenho."); return; }
    if (editingId) {
      await onChange(empenhos.map(e => (e.id === editingId ? { ...e, ...form } : e)));
      toast.success("Empenho atualizado!");
    } else {
      await onChange([...empenhos, { id: crypto.randomUUID(), ...form }]);
      toast.success("Empenho adicionado!");
    }
    setForm(empty);
    setEditingId(null);
  };

  const editar = (e: Empenho) => {
    setEditingId(e.id);
    setForm({ numero: e.numero || "", processo: e.processo || "", data: e.data || "", valor: e.valor || "" });
  };

  const excluir = async (id: string) => {
    await onChange(empenhos.filter(e => e.id !== id));
    if (editingId === id) { setForm(empty); setEditingId(null); }
    toast.success("Empenho removido.");
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Empenhos — Contrato {contratoNumero || "—"}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Input placeholder="Nº Empenho *" value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} />
        <Input placeholder="Processo Empenho" value={form.processo} onChange={e => setForm(p => ({ ...p, processo: e.target.value }))} />
        <Input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
        <Input placeholder="Valor Empenho (R$)" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" type="button" onClick={salvar}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {editingId ? "Salvar Alterações" : "Adicionar Empenho"}
        </Button>
        {editingId && (
          <Button size="sm" variant="outline" type="button" onClick={() => { setForm(empty); setEditingId(null); }}>
            Cancelar
          </Button>
        )}
      </div>

      {empenhos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum empenho cadastrado.</p>
      ) : (
        <div className="divide-y divide-border">
          {empenhos.map(e => (
            <div key={e.id} className="py-2 flex items-center justify-between gap-4 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">Nº {e.numero || "—"}</p>
                <p className="text-muted-foreground truncate">Proc: {e.processo || "—"}</p>
                <p className="text-muted-foreground tabular-nums">
                  {e.data ? new Date(e.data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                </p>
                <p className="text-muted-foreground tabular-nums">R$ {formatMilharBR(parseMilharBR(e.valor || ""))}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" type="button" onClick={() => editar(e)} className="text-xs">Editar</Button>
                <Button variant="ghost" size="sm" type="button" onClick={() => requestDelete(e.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <div className="pt-3 flex justify-end">
            <p className="text-sm font-semibold text-foreground">
              Total Empenhado: R$ {formatMilharBR(total)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">({empenhos.length} empenho{empenhos.length === 1 ? "" : "s"})</span>
            </p>
          </div>
        </div>
      )}

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(open) => !open && cancelDelete()}
        onConfirm={() => { if (deleteId) { excluir(deleteId); cancelDelete(); } }}
      />
    </div>
  );
}
