import { useState } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LocalEntrega } from "@/contexts/ClientesContext";

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const emptyLocal: Omit<LocalEntrega, "id"> = {
  local: "", cep: "", bairro: "", logradouro: "", numero: "", complemento: "",
  uf: "", cidade: "", contato: "", telContato: "",
  relLinha1: "", relLinha2: "", relLinha3: "", relLinha4: "",
};

interface LocaisEntregaSectionProps {
  locais: LocalEntrega[];
  onChange: (locais: LocalEntrega[]) => void;
  clienteNome: string;
}

export default function LocaisEntregaSection({ locais, onChange, clienteNome }: LocaisEntregaSectionProps) {
  const [form, setForm] = useState(emptyLocal);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const buscarCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado."); return; }
      setForm(prev => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
      }));
    } catch { toast.error("Erro ao buscar CEP."); }
  };

  const handleSave = () => {
    if (!form.local.trim()) { toast.error("Informe o nome do local."); return; }
    if (editingId) {
      onChange(locais.map(l => l.id === editingId ? { ...l, ...form } : l));
      toast.success("Local de entrega atualizado!");
    } else {
      onChange([...locais, { id: crypto.randomUUID(), ...form }]);
      toast.success("Local de entrega adicionado!");
    }
    setForm(emptyLocal);
    setEditingId(null);
  };

  const handleEdit = (l: LocalEntrega) => {
    setEditingId(l.id);
    const { id, ...rest } = l;
    setForm(rest);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    onChange(locais.filter(l => l.id !== id));
    toast.success("Local de entrega removido.");
    if (editingId === id) { setForm(emptyLocal); setEditingId(null); }
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  return (
    <div className="section-card animate-fade-up mt-6">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between w-full">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Locais de Entrega — {clienteNome}
        </h2>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Local</label>
              <Input placeholder="Local" value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">CEP *</label>
              <Input placeholder="CEP" value={form.cep} onChange={e => setForm(p => ({ ...p, cep: e.target.value }))} onBlur={() => buscarCep(form.cep)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Bairro</label>
              <Input placeholder="Bairro" value={form.bairro} onChange={e => setForm(p => ({ ...p, bairro: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Logradouro *</label>
              <Input placeholder="Rua" value={form.logradouro} onChange={e => setForm(p => ({ ...p, logradouro: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Nº</label>
              <Input placeholder="Nº" value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Complemento</label>
              <Input placeholder="Complemento" value={form.complemento} onChange={e => setForm(p => ({ ...p, complemento: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">UF</label>
              <Select value={form.uf} onValueChange={v => setForm(p => ({ ...p, uf: v }))}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Cidade</label>
              <Input placeholder="Cidade" value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contato</label>
              <Input placeholder="Contato" value={form.contato} onChange={e => setForm(p => ({ ...p, contato: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Tel. Contato</label>
              <Input placeholder="Telefone" value={form.telContato} onChange={e => setForm(p => ({ ...p, telContato: e.target.value }))} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {editingId ? "Salvar Alterações" : "Adicionar Local"}
            </Button>
            {editingId && (
              <Button size="sm" variant="outline" onClick={() => { setForm(emptyLocal); setEditingId(null); }}>Cancelar</Button>
            )}
          </div>

          {locais.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum local de entrega cadastrado.</p>
          ) : (
            <div className="divide-y divide-border">
              {locais.map(l => (
                <div key={l.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                    <p className="font-medium text-foreground">{l.local}</p>
                    <p className="text-muted-foreground truncate">{l.logradouro ? `${l.logradouro}, ${l.numero}` : "—"}</p>
                    <p className="text-muted-foreground truncate">{l.bairro || "—"}</p>
                    <p className="text-muted-foreground">{l.cidade ? `${l.cidade}/${l.uf}` : "—"}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(l)} className="text-xs">Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => requestDelete(l.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
}
