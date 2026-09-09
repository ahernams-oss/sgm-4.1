import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ArrowLeftRight } from "lucide-react";
import { useFinanceiro, formatBRL, ContaBancaria } from "@/contexts/FinanceiroContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";
import TransferenciaDialog from "@/components/financeiro/TransferenciaDialog";
import { usePermissao } from "@/hooks/usePermissao";

const empty = { nome: "", banco: "", agencia: "", conta: "", tipo: "corrente" as const, saldo_inicial: 0, ativo: true, observacao: "" };

export default function ContasBancarias() {
  const { contasBancarias, addContaBancaria, updateContaBancaria, deleteContaBancaria, saldoConta } = useFinanceiro();
  const { tem } = usePermissao();
  const podeCriar = tem("financeiro.contas_bancarias.criar");
  const podeEditar = tem("financeiro.contas_bancarias.editar");
  const podeExcluir = tem("financeiro.contas_bancarias.excluir");
  const podeTransferir = tem("financeiro.contas_bancarias.transferir");
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transfOpen, setTransfOpen] = useState(false);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const handleSave = async () => {
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome) { toast.error("Informe o nome."); return; }
    const data = { ...form, saldo_inicial: parseFloat(String(form.saldo_inicial).replace(",", ".")) || 0 };
    if (editingId) await updateContaBancaria(editingId, data);
    else await addContaBancaria(data);
    toast.success("Salvo!");
    setForm(empty); setEditingId(null);
  };

  const totalSaldo = useMemo(() => contasBancarias.reduce((s, c) => s + saldoConta(c.id), 0), [contasBancarias, saldoConta]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-semibold">Contas Bancárias / Caixas</h1>
        {podeTransferir && <Button variant="outline" onClick={() => setTransfOpen(true)}><ArrowLeftRight className="h-4 w-4 mr-2" />Transferir</Button>}
      </div>

      {(podeCriar || (editingId && podeEditar)) && (
      <Card>
        <CardHeader><CardTitle className="text-base">{editingId ? "Editar" : "Nova"} conta</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input placeholder="Banco" value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
          <Input placeholder="Agência" value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
          <Input placeholder="Conta" value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="corrente">Conta Corrente</SelectItem>
              <SelectItem value="poupanca">Poupança</SelectItem>
              <SelectItem value="caixa">Caixa</SelectItem>
              <SelectItem value="cartao">Cartão de Crédito</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Saldo inicial" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} />
          <div className="md:col-span-3 lg:col-span-6 flex gap-2">
            <Button onClick={handleSave}><Plus className="h-4 w-4 mr-1" />{editingId ? "Salvar" : "Adicionar"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Contas cadastradas — Saldo total: {formatBRL(totalSaldo)}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead>Banco</TableHead><TableHead>Ag/Conta</TableHead>
                <TableHead>Tipo</TableHead><TableHead className="text-right">Saldo Inicial</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contasBancarias.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.banco || "—"}</TableCell>
                  <TableCell>{c.agencia || "—"} / {c.conta || "—"}</TableCell>
                  <TableCell className="capitalize">{c.tipo}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(c.saldo_inicial))}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatBRL(saldoConta(c.id))}</TableCell>
                  <TableCell className="text-right">
                    {podeEditar && <Button size="sm" variant="ghost" onClick={() => { setEditingId(c.id); setForm(c); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {podeExcluir && <Button size="sm" variant="ghost" onClick={() => requestDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {contasBancarias.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma conta cadastrada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && cancelDelete()} onConfirm={async () => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; } if (deleteId) { await deleteContaBancaria(deleteId); cancelDelete(); } }} />
      <TransferenciaDialog open={transfOpen} onOpenChange={setTransfOpen} />
    </div>
  );
}
