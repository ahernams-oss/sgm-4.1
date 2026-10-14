import { useEffect, useMemo, useState } from "react";
import { Factory, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useFabricantes } from "@/contexts/FabricantesContext";
import { toast } from "sonner";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface Props { grupo: { id: string; codigo: string; nome: string }; podeEditar: boolean; }

export default function GrupoFabricantesDialog({ grupo, podeEditar }: Props) {
  const { fabricantes } = useFabricantes();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [orig, setOrig] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    (supabase as any).from("categorias_compras_fabricantes").select("fabricante_id").eq("grupo_id", grupo.id)
      .then(({ data }: any) => {
        const s = new Set<string>((data ?? []).map((r: any) => r.fabricante_id));
        setSel(new Set(s)); setOrig(s);
      });
  }, [open, grupo.id]);

  const lista = useMemo(() => {
    const t = norm(busca.trim());
    return [...fabricantes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .filter((f) => !t || norm(f.nome).includes(t));
  }, [fabricantes, busca]);

  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const salvar = async () => {
    setSalvando(true);
    const add = [...sel].filter((id) => !orig.has(id));
    const rem = [...orig].filter((id) => !sel.has(id));
    const db = supabase as any;
    let erro = null;
    if (add.length) erro = (await db.from("categorias_compras_fabricantes").insert(add.map((fabricante_id) => ({ grupo_id: grupo.id, fabricante_id })))).error;
    if (!erro && rem.length) erro = (await db.from("categorias_compras_fabricantes").delete().eq("grupo_id", grupo.id).in("fabricante_id", rem)).error;
    setSalvando(false);
    if (erro) { toast.error("Erro ao salvar fabricantes."); return; }
    toast.success("Fabricantes atualizados.");
    setOpen(false);
  };

  return (
    <>
      <Button variant="ghost" size="icon" title="Fabricantes" onClick={() => setOpen(true)}>
        <Factory className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fabricantes — {grupo.codigo} {grupo.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar fabricante..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Badge variant="secondary">{sel.size} selecionado(s)</Badge>
          </div>
          <div className="max-h-[50vh] overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {lista.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum fabricante encontrado.</p>
            ) : lista.map((f) => (
              <label key={f.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={sel.has(f.id)} disabled={!podeEditar} onCheckedChange={() => toggle(f.id)} />
                <span className="text-sm">{f.nome}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            {podeEditar && <Button onClick={salvar} disabled={salvando}>Salvar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
