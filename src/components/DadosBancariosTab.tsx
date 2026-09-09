import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X, Save } from "lucide-react";
import type { InformacaoFinanceira } from "@/contexts/ClientesContext";

interface DadosBancariosTabProps {
  dados: InformacaoFinanceira[];
  onChange: (dados: InformacaoFinanceira[]) => void;
}

const emptyDado: Omit<InformacaoFinanceira, "id"> = {
  banco: "",
  agencia: "",
  conta: "",
  chavePix: "",
};

export default function DadosBancariosTab({ dados, onChange }: DadosBancariosTabProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<InformacaoFinanceira, "id">>(emptyDado);
  const [isAdding, setIsAdding] = useState(false);

  const startAdd = () => {
    setForm(emptyDado);
    setEditingIndex(null);
    setIsAdding(true);
  };

  const startEdit = (index: number) => {
    const item = dados[index];
    setForm({ banco: item.banco, agencia: item.agencia, conta: item.conta, chavePix: item.chavePix ?? "" });
    setEditingIndex(index);
    setIsAdding(true);
  };

  const cancel = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setForm(emptyDado);
  };

  const save = () => {
    if (!form.banco.trim()) return;
    const updated = [...dados];
    if (editingIndex !== null) {
      updated[editingIndex] = { ...updated[editingIndex], ...form };
    } else {
      updated.push({ id: crypto.randomUUID(), ...form });
    }
    onChange(updated);
    cancel();
  };

  const remove = (index: number) => {
    onChange(dados.filter((_, i) => i !== index));
    if (editingIndex === index) cancel();
  };

  return (
    <div className="space-y-4">
      {isAdding && (
        <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
          <h4 className="text-sm font-semibold text-foreground">
            {editingIndex !== null ? "Editar Dados Bancários" : "Novo Dados Bancários"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="field-label">Banco</label>
              <Input
                placeholder="Ex: Banco do Brasil"
                value={form.banco}
                onChange={(e) => setForm((p) => ({ ...p, banco: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Agência</label>
              <Input
                placeholder="Ex: 1234-5"
                value={form.agencia}
                onChange={(e) => setForm((p) => ({ ...p, agencia: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Conta</label>
              <Input
                placeholder="Ex: 12345-6"
                value={form.conta}
                onChange={(e) => setForm((p) => ({ ...p, conta: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Chave PIX</label>
              <Input
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={form.chavePix}
                onChange={(e) => setForm((p) => ({ ...p, chavePix: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} className="gap-1">
              <Save className="h-3.5 w-3.5" />
              {editingIndex !== null ? "Salvar" : "Adicionar"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={cancel} className="gap-1">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {dados.length === 0 && !isAdding ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          Nenhum dado bancário cadastrado.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {dados.map((d, idx) => (
            <div key={d.id} className="flex items-center justify-between py-3 gap-4">
              <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1">
                <p className="text-sm font-medium text-foreground truncate">{d.banco || "—"}</p>
                <p className="text-sm text-muted-foreground truncate">Ag: {d.agencia || "—"}</p>
                <p className="text-sm text-muted-foreground truncate">Conta: {d.conta || "—"}</p>
                <p className="text-sm text-muted-foreground truncate">PIX: {d.chavePix || "—"}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => startEdit(idx)} className="text-xs">
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(idx)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isAdding && (
        <Button type="button" variant="outline" size="sm" onClick={startAdd} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar Dados Bancários
        </Button>
      )}
    </div>
  );
}
