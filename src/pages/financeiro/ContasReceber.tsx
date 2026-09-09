import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2, Undo2, Ban } from "lucide-react";
import { useFinanceiro, formatBRL, formatDate, isVencida, ContaReceber } from "@/contexts/FinanceiroContext";
import { useClientes } from "@/contexts/ClientesContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import BaixaDialog from "@/components/financeiro/BaixaDialog";
import EstornoCancelamentoDialog from "@/components/financeiro/EstornoCancelamentoDialog";
import SupervisorPasswordDialog from "@/components/financeiro/SupervisorPasswordDialog";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

const empty = {
  descricao: "", cliente_id: null as string | null, cliente_nome: "",
  valor_total: "", data_emissao: "", data_vencimento: "",
  conta_bancaria_id: null as string | null, plano_conta_id: null as string | null,
  centro_custo_id: null as string | null, parcela_num: 1, parcela_total: 1,
  observacao: "", origem: "manual",
};

export default function ContasReceber() {
  const { contasReceber, planoContas, centrosCusto, contasBancarias, addContaReceber, updateContaReceber, deleteContaReceber } = useFinanceiro();
  const { clientes } = useClientes();
  const clientesLista = useMemo(() => clientes.filter(c => c.tipo === "Cliente"), [clientes]);
  const { tem } = usePermissao();
  const podeCriar = tem("financeiro.contas_receber.criar");
  const podeEditar = tem("financeiro.contas_receber.editar");
  const podeExcluir = tem("financeiro.contas_receber.excluir");
  const podeBaixar = tem("financeiro.contas_receber.baixar");
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [baixaConta, setBaixaConta] = useState<ContaReceber | null>(null);
  const [estornoConta, setEstornoConta] = useState<{ conta: ContaReceber; acao: "estornar" | "cancelar" } | null>(null);
  const [supervPending, setSupervPending] = useState<ContaReceber | null>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const handleSave = async () => {
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.descricao || !form.data_vencimento || !form.valor_total) {
      toast.error("Preencha descrição, vencimento e valor."); return;
    }
    const valor = parseFloat(String(form.valor_total).replace(",", "."));
    const total = Number(form.parcela_total) || 1;
    const cliente = clientesLista.find(c => c.id === form.cliente_id);
    const baseRow = {
      ...form,
      valor_total: valor,
      valor_recebido: 0,
      status: "aberta",
      cliente_nome: cliente?.nome || form.cliente_nome || "",
    };
    if (editingId) {
      await updateContaReceber(editingId, baseRow);
      toast.success("Conta atualizada!");
    } else if (total > 1) {
      const valorParcela = +(valor / total).toFixed(2);
      const venc = new Date(form.data_vencimento + "T00:00:00");
      for (let i = 1; i <= total; i++) {
        const v = new Date(venc); v.setMonth(v.getMonth() + (i - 1));
        await addContaReceber({
          ...baseRow,
          valor_total: i === total ? +(valor - valorParcela * (total - 1)).toFixed(2) : valorParcela,
          parcela_num: i,
          parcela_total: total,
          data_vencimento: v.toISOString().slice(0, 10),
          descricao: `${baseRow.descricao} (${i}/${total})`,
        } as any);
      }
      toast.success(`${total} parcelas criadas!`);
    } else {
      await addContaReceber(baseRow as any);
      toast.success("Conta a receber criada!");
    }
    setForm(empty); setEditingId(null);
  };

  const filtradas = useMemo(() => contasReceber.filter((c) => {
    if (busca && !c.descricao.toLowerCase().includes(busca.toLowerCase()) && !(c.cliente_nome || "").toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroStatus === "todos") return true;
    if (filtroStatus === "vencida") return isVencida(c);
    return c.status === filtroStatus;
  }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)), [contasReceber, busca, filtroStatus]);

  const { paginated } = paginate(filtradas, page, pageSize);
  const totais = useMemo(() => ({
    total: filtradas.reduce((s, c) => s + Number(c.valor_total), 0),
    rec: filtradas.reduce((s, c) => s + Number(c.valor_recebido), 0),
  }), [filtradas]);

  const statusBadge = (c: ContaReceber) => {
    if (isVencida(c)) return <Badge variant="destructive">Vencida</Badge>;
    if (c.status === "recebida") return <Badge className="bg-emerald-600">Recebida</Badge>;
    if (c.status === "parcial") return <Badge className="bg-amber-600">Parcial</Badge>;
    if (c.status === "cancelada") return <Badge variant="secondary">Cancelada</Badge>;
    return <Badge variant="outline">Aberta</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Contas a Receber</h1>

      {(podeCriar || (editingId && podeEditar)) && (
      <Card>
        <CardHeader><CardTitle className="text-base">{editingId ? "Editar conta" : "Nova conta a receber"}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <Input placeholder="Descrição *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" />
          <Select value={form.cliente_id || "none"} onValueChange={(v) => setForm({ ...form, cliente_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {clientesLista.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Valor *" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
          <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
          <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
          <Input type="number" min={1} value={form.parcela_total} onChange={(e) => setForm({ ...form, parcela_total: Number(e.target.value) })} placeholder="Nº Parcelas" disabled={!!editingId} />
          <Select value={form.plano_conta_id || "none"} onValueChange={(v) => setForm({ ...form, plano_conta_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Categoria DRE" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {planoContas.filter(p => p.tipo === "receita" && p.ativo).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.centro_custo_id || "none"} onValueChange={(v) => setForm({ ...form, centro_custo_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Centro de custo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {centrosCusto.filter(c => c.ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={form.conta_bancaria_id || "none"} onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Conta bancária" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {contasBancarias.filter(c => c.ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Observação" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="md:col-span-2 lg:col-span-3" />
          <div className="md:col-span-3 lg:col-span-4 flex gap-2">
            <Button onClick={handleSave}><Plus className="h-4 w-4 mr-1" />{editingId ? "Salvar" : "Adicionar"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{filtradas.length} conta(s) — Total: {formatBRL(totais.total)} | Recebido: {formatBRL(totais.rec)}</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Buscar..." value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} className="w-48" />
            <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberta">Em aberto</SelectItem>
                <SelectItem value="vencida">Vencidas</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="recebida">Recebidas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Recebido</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((c) => (
                <TableRow key={c.id} className={isVencida(c) ? "bg-red-50/50" : ""}>
                  <TableCell className="tabular-nums">{formatDate(c.data_vencimento)}</TableCell>
                  <TableCell className="font-medium">{c.descricao}</TableCell>
                  <TableCell>{c.cliente_nome || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(c.valor_total))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(c.valor_recebido))}</TableCell>
                  <TableCell>{statusBadge(c)}</TableCell>
                  <TableCell className="text-right">
                    {podeBaixar && c.status !== "recebida" && c.status !== "cancelada" && (
                      <Button size="sm" variant="ghost" onClick={() => setBaixaConta(c)} title="Receber"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></Button>
                    )}
                    {podeBaixar && (c.status === "recebida" || c.status === "parcial") && (
                      <Button size="sm" variant="ghost" onClick={() => setEstornoConta({ conta: c, acao: "estornar" })} title="Estornar recebimento"><Undo2 className="h-3.5 w-3.5 text-amber-600" /></Button>
                    )}
                    {podeEditar && c.status !== "recebida" && c.status !== "cancelada" && (
                      <Button size="sm" variant="ghost" onClick={() => setEstornoConta({ conta: c, acao: "cancelar" })} title="Cancelar com motivo"><Ban className="h-3.5 w-3.5 text-orange-600" /></Button>
                    )}
                    {podeEditar && <Button size="sm" variant="ghost" onClick={() => setSupervPending(c)} title="Editar (requer supervisão)"><Pencil className="h-3.5 w-3.5" /></Button>}
                    {podeExcluir && <Button size="sm" variant="ghost" onClick={() => requestDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma conta.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <PaginationControls currentPage={page} totalItems={filtradas.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </CardContent>
      </Card>

      <BaixaDialog open={!!baixaConta} onOpenChange={(o) => !o && setBaixaConta(null)} conta={baixaConta} modo="receber" />
      <EstornoCancelamentoDialog
        open={!!estornoConta}
        onOpenChange={(o) => !o && setEstornoConta(null)}
        conta={estornoConta?.conta || null}
        modo="receber"
        acao={estornoConta?.acao || "estornar"}
      />
      <SupervisorPasswordDialog
        open={!!supervPending}
        onOpenChange={(o) => !o && setSupervPending(null)}
        descricao="A edição de lançamentos financeiros exige aprovação de um supervisor. A justificativa será registrada na observação da conta."
        onAuthorized={async ({ email, justificativa }) => {
          const c = supervPending!;
          const carimbo = `[AJUSTE AUTORIZADO ${new Date().toLocaleString("pt-BR")} por ${email}] ${justificativa}`;
          const novaObs = c.observacao ? `${c.observacao}\n${carimbo}` : carimbo;
          setEditingId(c.id);
          setForm({
            ...c,
            observacao: novaObs,
            valor_total: c.valor_total,
            data_emissao: c.data_emissao || "",
            data_vencimento: c.data_vencimento,
          });
          toast.success("Edição autorizada.");
        }}
      />
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && cancelDelete()} onConfirm={async () => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; } if (deleteId) { await deleteContaReceber(deleteId); cancelDelete(); } }} />
    </div>
  );
}
