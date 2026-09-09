import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useFinanceiro } from "@/contexts/FinanceiroContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

const empty = { codigo: "", nome: "", tipo: "despesa" as "receita" | "despesa", parent_id: null as string | null, ativo: true };

export default function PlanoContas() {
  const { planoContas, addPlanoConta, updatePlanoConta, deletePlanoConta } = useFinanceiro();
  const { tem } = usePermissao();
  const podeGerenciar = tem("financeiro.plano_contas.gerenciar");
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "receita" | "despesa">("todos");
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const handleSave = async () => {
    if (!podeGerenciar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome) { toast.error("Informe o nome."); return; }
    const data = { ...form, parent_id: form.parent_id || null };
    if (editingId) await updatePlanoConta(editingId, data);
    else await addPlanoConta(data);
    toast.success("Salvo!");
    setForm(empty); setEditingId(null);
  };

  const lista = planoContas.filter(p => filtroTipo === "todos" || p.tipo === filtroTipo);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Plano de Contas</h1>

      {podeGerenciar && (
      <Card>
        <CardHeader><CardTitle className="text-base">{editingId ? "Editar" : "Nova"} categoria</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          <Input placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={form.parent_id || "none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Categoria pai" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem pai —</SelectItem>
              {planoContas.filter(p => p.tipo === form.tipo && p.id !== editingId).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="md:col-span-4 flex gap-2">
            <Button onClick={handleSave}><Plus className="h-4 w-4 mr-1" />{editingId ? "Salvar" : "Adicionar"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Categorias ({lista.length})</CardTitle>
          <Select value={filtroTipo} onValueChange={(v: any) => setFiltroTipo(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="receita">Receitas</SelectItem>
              <SelectItem value="despesa">Despesas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Pai</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {lista.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.codigo || "—"}</TableCell>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell><span className={p.tipo === "receita" ? "text-emerald-600" : "text-red-600"}>{p.tipo}</span></TableCell>
                  <TableCell>{planoContas.find(x => x.id === p.parent_id)?.nome || "—"}</TableCell>
                  <TableCell className="text-right">
                    {podeGerenciar && <Button size="sm" variant="ghost" onClick={() => { setEditingId(p.id); setForm(p); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {podeGerenciar && <Button size="sm" variant="ghost" onClick={() => requestDelete(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {lista.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma categoria.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && cancelDelete()} onConfirm={async () => { if (!podeGerenciar) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; } if (deleteId) { await deletePlanoConta(deleteId); cancelDelete(); } }} />
    </div>
  );
}
