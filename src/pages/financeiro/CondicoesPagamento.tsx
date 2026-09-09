import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

interface Condicao {
  id: string;
  nome: string;
  descricao?: string;
  tipo: "a_vista" | "a_prazo";
  num_parcelas: number;
  dias_parcelas: number[];
  intervalo_dias?: number | null;
  percentual_entrada?: number;
  ativo: boolean;
  observacao?: string;
}

const empty = {
  nome: "", descricao: "", tipo: "a_prazo" as const,
  num_parcelas: 1, dias_parcelas: "30", intervalo_dias: "" as string,
  percentual_entrada: 0, ativo: true, observacao: "",
};

export default function CondicoesPagamento() {
  const [items, setItems] = useState<Condicao[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeCriar = tem("financeiro.condicoes_pagamento.criar");
  const podeEditar = tem("financeiro.condicoes_pagamento.editar");
  const podeExcluir = tem("financeiro.condicoes_pagamento.excluir");

  const reload = async () => {
    setLoading(true);
    const data = await fetchAll("fin_condicoes_pagamento", "nome");
    setItems(data as any);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const parseDias = (s: string): number[] =>
    s.split(/[,;\/\s]+/).map(x => parseInt(x.trim(), 10)).filter(n => !isNaN(n) && n >= 0);

  const handleSave = async () => {
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome.trim()) { toast.error("Informe o nome."); return; }
    const dias = form.tipo === "a_vista" ? [0] : parseDias(form.dias_parcelas);
    if (form.tipo === "a_prazo" && dias.length === 0) {
      toast.error("Informe os dias das parcelas (ex.: 30/60/90)."); return;
    }
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      tipo: form.tipo,
      num_parcelas: form.tipo === "a_vista" ? 1 : dias.length,
      dias_parcelas: dias,
      intervalo_dias: form.intervalo_dias ? parseInt(form.intervalo_dias, 10) : null,
      percentual_entrada: Number(String(form.percentual_entrada).replace(",", ".")) || 0,
      ativo: form.ativo,
      observacao: form.observacao || null,
    };
    if (editingId) {
      await updateRow("fin_condicoes_pagamento", editingId, payload);
      toast.success("Condição atualizada!");
    } else {
      await insertRow("fin_condicoes_pagamento", payload);
      toast.success("Condição cadastrada!");
    }
    setForm(empty); setEditingId(null);
    reload();
  };

  const handleEdit = (c: Condicao) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      descricao: c.descricao || "",
      tipo: c.tipo,
      num_parcelas: c.num_parcelas,
      dias_parcelas: (c.dias_parcelas || []).join("/"),
      intervalo_dias: c.intervalo_dias ? String(c.intervalo_dias) : "",
      percentual_entrada: c.percentual_entrada || 0,
      ativo: c.ativo,
      observacao: c.observacao || "",
    });
  };

  const handleDelete = async () => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; }
    if (!deleteId) return;
    await deleteRow("fin_condicoes_pagamento", deleteId);
    cancelDelete();
    toast.success("Excluído!");
    reload();
  };

  const formatDias = (c: Condicao) => {
    if (c.tipo === "a_vista") return "À vista";
    return (c.dias_parcelas || []).join("/") + " dias";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-serif font-semibold">Condições de Pagamento</h1>
          <p className="text-sm text-muted-foreground">
            Cadastros parametrizáveis utilizados pelos módulos Financeiro e de Compras.
          </p>
        </div>
      </div>

      {(podeCriar || (editingId && podeEditar)) && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Editar condição" : "Nova condição"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome} placeholder="Ex.: 30/60/90 dias"
              onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a_vista">À Vista</SelectItem>
                <SelectItem value="a_prazo">A Prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.tipo === "a_prazo" && (
            <>
              <div className="md:col-span-2">
                <Label>Dias das parcelas *</Label>
                <Input value={form.dias_parcelas} placeholder="Ex.: 30/60/90 ou 30,60,90"
                  onChange={(e) => setForm({ ...form, dias_parcelas: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">
                  O número de parcelas será definido automaticamente pela quantidade de dias informados.
                </p>
              </div>
              <div>
                <Label>Intervalo (dias) — opcional</Label>
                <Input type="number" value={form.intervalo_dias} placeholder="Ex.: 30"
                  onChange={(e) => setForm({ ...form, intervalo_dias: e.target.value })} />
              </div>
            </>
          )}

          <div>
            <Label>% Entrada</Label>
            <Input type="number" step="0.01" value={form.percentual_entrada}
              onChange={(e) => setForm({ ...form, percentual_entrada: e.target.value.replace(",", ".") })} />
          </div>
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Input value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <div className="md:col-span-3">
            <Label>Observação</Label>
            <Input value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>

          <div className="md:col-span-3 flex gap-2">
            <Button onClick={handleSave}>
              <Plus className="h-4 w-4 mr-1" />{editingId ? "Salvar alterações" : "Adicionar"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Condições cadastradas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>% Entrada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-6">Carregando...</TableCell></TableRow>}
              {!loading && items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma condição cadastrada.</TableCell></TableRow>
              )}
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>
                    <Badge variant={c.tipo === "a_vista" ? "secondary" : "outline"}>
                      {c.tipo === "a_vista" ? "À Vista" : "A Prazo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.num_parcelas}x</TableCell>
                  <TableCell>{formatDias(c)}</TableCell>
                  <TableCell>{Number(c.percentual_entrada || 0).toFixed(2)}%</TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {podeEditar && <Button size="sm" variant="ghost" onClick={() => handleEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>}
                    {podeExcluir && <Button size="sm" variant="ghost" onClick={() => requestDelete(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => !o && cancelDelete()}
        onConfirm={handleDelete}
      />
    </div>
  );
}
