import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useFinanceiro } from "@/contexts/FinanceiroContext";
import { useClientes } from "@/contexts/ClientesContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

const empty = { codigo: "", nome: "", cliente_id: null as string | null, ativo: true };

export default function CentrosCusto() {
  const { centrosCusto, addCentroCusto, updateCentroCusto, deleteCentroCusto } = useFinanceiro();
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podeGerenciar = tem("financeiro.centros_custo.gerenciar");
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const handleSave = async () => {
    if (!podeGerenciar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome) { toast.error("Informe o nome."); return; }
    const data = { ...form, cliente_id: form.cliente_id || null };
    if (editingId) await updateCentroCusto(editingId, data);
    else await addCentroCusto(data);
    toast.success("Salvo!");
    setForm(empty); setEditingId(null);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Centros de Custo</h1>

      {podeGerenciar && (
      <Card>
        <CardHeader><CardTitle className="text-base">{editingId ? "Editar" : "Novo"} centro de custo</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          <Input placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Select value={form.cliente_id || "none"} onValueChange={(v) => setForm({ ...form, cliente_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Cliente (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem cliente —</SelectItem>
              {clientes.filter(c => c.tipo === "Cliente").map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="md:col-span-3 flex gap-2">
            <Button onClick={handleSave}><Plus className="h-4 w-4 mr-1" />{editingId ? "Salvar" : "Adicionar"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Cliente/Obra</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {centrosCusto.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.codigo || "—"}</TableCell>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{clientes.find(x => x.id === c.cliente_id)?.nome || "—"}</TableCell>
                  <TableCell className="text-right">
                    {podeGerenciar && <Button size="sm" variant="ghost" onClick={() => { setEditingId(c.id); setForm(c); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {podeGerenciar && <Button size="sm" variant="ghost" onClick={() => requestDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {centrosCusto.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum centro de custo.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && cancelDelete()} onConfirm={async () => { if (!podeGerenciar) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; } if (deleteId) { await deleteCentroCusto(deleteId); cancelDelete(); } }} />
    </div>
  );
}
