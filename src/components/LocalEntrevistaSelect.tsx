import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";

const QK = ["locais_entrevista"];

export default function LocalEntrevistaSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const { data: locais = [] } = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("locais_entrevista").select("id,descricao").order("descricao");
      if (error) throw error;
      return data as { id: string; descricao: string }[];
    },
  });

  const adicionar = async () => {
    const d = (novo || "").trim();
    if (!d) return toast.error("Informe o local.");
    if (!locais.some((l) => l.descricao.toLowerCase() === d.toLowerCase())) {
      const { error } = await (supabase as any).from("locais_entrevista").insert({ descricao: d });
      if (error) return toast.error("Erro ao salvar local: " + error.message);
      await qc.invalidateQueries({ queryKey: QK });
      toast.success("Local cadastrado!");
    }
    onChange(d);
    setNovo(null);
  };

  const remover = async () => {
    const l = locais.find((x) => x.descricao === value);
    if (!l) return;
    if (!window.confirm(`Excluir o local "${l.descricao}" da lista?`)) return;
    const { error } = await (supabase as any).from("locais_entrevista").delete().eq("id", l.id);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    await qc.invalidateQueries({ queryKey: QK });
    onChange("");
    toast.success("Local excluído da lista.");
  };

  const salvarEdicao = async () => {
    const l = locais.find((x) => x.descricao === value);
    const d = (editando || "").trim();
    if (!l) return setEditando(null);
    if (!d) return toast.error("Informe o local.");
    if (d !== l.descricao) {
      if (locais.some((x) => x.id !== l.id && x.descricao.toLowerCase() === d.toLowerCase()))
        return toast.error("Já existe um local com esse nome.");
      const { error } = await (supabase as any).from("locais_entrevista").update({ descricao: d }).eq("id", l.id);
      if (error) return toast.error("Erro ao editar: " + error.message);
      await qc.invalidateQueries({ queryKey: QK });
      toast.success("Local atualizado!");
    }
    onChange(d);
    setEditando(null);
  };

  if (novo !== null) {
    return (
      <div className="flex gap-1">
        <Input autoFocus value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="Novo local (endereço / sala)" />
        <Button type="button" size="icon" onClick={adicionar} title="Salvar local"><Check className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="outline" onClick={() => setNovo(null)} title="Cancelar"><X className="h-4 w-4" /></Button>
      </div>
    );
  }

  const opcoes = value && !locais.some((l) => l.descricao === value) ? [{ id: "_atual", descricao: value }, ...locais] : locais;
  return (
    <div className="flex gap-1">
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o local" /></SelectTrigger>
        <SelectContent>
          {opcoes.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum local cadastrado</div>}
          {opcoes.map((l) => <SelectItem key={l.id} value={l.descricao}>{l.descricao}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" size="icon" variant="outline" onClick={() => setNovo("")} disabled={disabled} title="Adicionar novo local"><Plus className="h-4 w-4" /></Button>
      {value && locais.some((l) => l.descricao === value) && (
        <Button type="button" size="icon" variant="ghost" onClick={remover} disabled={disabled} title="Remover local da lista"><Trash2 className="h-4 w-4 text-destructive" /></Button>
      )}
    </div>
  );
}
