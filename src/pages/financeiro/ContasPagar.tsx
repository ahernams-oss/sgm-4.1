import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2, AlertCircle, Paperclip, X, Filter, Undo2, Ban } from "lucide-react";
import { useFinanceiro, formatBRL, formatDate, isVencida, ContaPagar } from "@/contexts/FinanceiroContext";
import { useClientes } from "@/contexts/ClientesContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import BaixaDialog from "@/components/financeiro/BaixaDialog";
import EstornoCancelamentoDialog from "@/components/financeiro/EstornoCancelamentoDialog";
import SupervisorPasswordDialog from "@/components/financeiro/SupervisorPasswordDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

const empty = {
  descricao: "", fornecedor_id: null as string | null, fornecedor_nome: "",
  valor_total: "", data_emissao: "", data_vencimento: "",
  conta_bancaria_id: null as string | null, plano_conta_id: null as string | null,
  centro_custo_id: null as string | null, parcela_num: 1, parcela_total: 1,
  observacao: "", origem: "manual",
  anexo_url: "" as string, anexo_nome: "" as string,
};

export default function ContasPagar() {
  const { contasPagar, planoContas, centrosCusto, contasBancarias, addContaPagar, updateContaPagar, deleteContaPagar } = useFinanceiro();
  const { clientes } = useClientes();
  const fornecedores = useMemo(() => clientes.filter(c => c.tipo === "Fornecedor"), [clientes]);
  const { tem } = usePermissao();
  const podeCriar = tem("financeiro.contas_pagar.criar");
  const podeEditar = tem("financeiro.contas_pagar.editar");
  const podeExcluir = tem("financeiro.contas_pagar.excluir");
  const podeBaixar = tem("financeiro.contas_pagar.baixar");
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [fFornecedor, setFFornecedor] = useState<string>("todos");
  const [fPlanoConta, setFPlanoConta] = useState<string>("todos");
  const [fCentroCusto, setFCentroCusto] = useState<string>("todos");
  const [fContaBanc, setFContaBanc] = useState<string>("todos");
  const [fDataIni, setFDataIni] = useState<string>("");
  const [fDataFim, setFDataFim] = useState<string>("");
  const [fValorMin, setFValorMin] = useState<string>("");
  const [fValorMax, setFValorMax] = useState<string>("");
  const FILTERS_KEY = "filtros_contas_pagar";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [baixaConta, setBaixaConta] = useState<ContaPagar | null>(null);
  const [estornoConta, setEstornoConta] = useState<{ conta: ContaPagar; acao: "estornar" | "cancelar" } | null>(null);
  const [supervPending, setSupervPending] = useState<ContaPagar | null>(null);
  const [uploading, setUploading] = useState(false);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  // Carrega filtros salvos
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      setFiltroStatus(p.filtroStatus ?? "todos");
      setBusca(p.busca ?? "");
      setFFornecedor(p.fFornecedor ?? "todos");
      setFPlanoConta(p.fPlanoConta ?? "todos");
      setFCentroCusto(p.fCentroCusto ?? "todos");
      setFContaBanc(p.fContaBanc ?? "todos");
      setFDataIni(p.fDataIni ?? "");
      setFDataFim(p.fDataFim ?? "");
      setFValorMin(p.fValorMin ?? "");
      setFValorMax(p.fValorMax ?? "");
    } catch { /* ignore */ }
  }, []);
  // Persiste
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({
        filtroStatus, busca, fFornecedor, fPlanoConta, fCentroCusto, fContaBanc,
        fDataIni, fDataFim, fValorMin, fValorMax,
      }));
    } catch { /* ignore */ }
  }, [filtroStatus, busca, fFornecedor, fPlanoConta, fCentroCusto, fContaBanc, fDataIni, fDataFim, fValorMin, fValorMax]);

  const limparFiltros = () => {
    setFiltroStatus("todos"); setBusca("");
    setFFornecedor("todos"); setFPlanoConta("todos"); setFCentroCusto("todos"); setFContaBanc("todos");
    setFDataIni(""); setFDataFim(""); setFValorMin(""); setFValorMax("");
    setPage(1);
  };

  const hasFiltros = filtroStatus !== "todos" || busca || fFornecedor !== "todos" ||
    fPlanoConta !== "todos" || fCentroCusto !== "todos" || fContaBanc !== "todos" ||
    fDataIni || fDataFim || fValorMin || fValorMax;

  const handleUploadAnexo = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo deve ter até 10MB."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `cp/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("financeiro-anexos").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("financeiro-anexos").getPublicUrl(path);
      setForm((f: any) => ({ ...f, anexo_url: data.publicUrl, anexo_nome: file.name }));
      toast.success("Anexo enviado!");
    } catch (e: any) {
      toast.error("Falha no upload: " + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.descricao || !form.data_vencimento || !form.valor_total) {
      toast.error("Preencha descrição, vencimento e valor."); return;
    }
    const valor = parseFloat(String(form.valor_total).replace(",", "."));
    const total = Number(form.parcela_total) || 1;
    const fornecedor = fornecedores.find(f => f.id === form.fornecedor_id);
    const baseRow = {
      ...form,
      valor_total: valor,
      valor_pago: 0,
      status: "aberta",
      fornecedor_nome: fornecedor?.nome || form.fornecedor_nome || "",
    };
    if (editingId) {
      await updateContaPagar(editingId, baseRow);
      toast.success("Conta atualizada!");
    } else if (total > 1) {
      // Gerar parcelas
      const valorParcela = +(valor / total).toFixed(2);
      const venc = new Date(form.data_vencimento + "T00:00:00");
      for (let i = 1; i <= total; i++) {
        const v = new Date(venc); v.setMonth(v.getMonth() + (i - 1));
        await addContaPagar({
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
      await addContaPagar(baseRow as any);
      toast.success("Conta a pagar criada!");
    }
    setForm(empty); setEditingId(null);
  };

  const filtradas = useMemo(() => {
    const vmin = fValorMin ? parseFloat(fValorMin.replace(",", ".")) : null;
    const vmax = fValorMax ? parseFloat(fValorMax.replace(",", ".")) : null;
    return contasPagar.filter((c) => {
      if (busca && !c.descricao.toLowerCase().includes(busca.toLowerCase()) && !(c.fornecedor_nome || "").toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroStatus !== "todos") {
        if (filtroStatus === "vencida") { if (!isVencida(c)) return false; }
        else if (c.status !== filtroStatus) return false;
      }
      if (fFornecedor !== "todos" && c.fornecedor_id !== fFornecedor) return false;
      if (fPlanoConta !== "todos" && c.plano_conta_id !== fPlanoConta) return false;
      if (fCentroCusto !== "todos" && c.centro_custo_id !== fCentroCusto) return false;
      if (fContaBanc !== "todos" && c.conta_bancaria_id !== fContaBanc) return false;
      if (fDataIni && c.data_vencimento < fDataIni) return false;
      if (fDataFim && c.data_vencimento > fDataFim) return false;
      if (vmin !== null && Number(c.valor_total) < vmin) return false;
      if (vmax !== null && Number(c.valor_total) > vmax) return false;
      return true;
    }).sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [contasPagar, busca, filtroStatus, fFornecedor, fPlanoConta, fCentroCusto, fContaBanc, fDataIni, fDataFim, fValorMin, fValorMax]);

  const { paginated, totalPages } = paginate(filtradas, page, pageSize);
  const totais = useMemo(() => ({
    total: filtradas.reduce((s, c) => s + Number(c.valor_total), 0),
    pago: filtradas.reduce((s, c) => s + Number(c.valor_pago), 0),
  }), [filtradas]);

  const statusBadge = (c: ContaPagar) => {
    if (isVencida(c)) return <Badge variant="destructive">Vencida</Badge>;
    if (c.status === "paga") return <Badge className="bg-emerald-600">Paga</Badge>;
    if (c.status === "parcial") return <Badge className="bg-amber-600">Parcial</Badge>;
    if (c.status === "cancelada") return <Badge variant="secondary">Cancelada</Badge>;
    return <Badge variant="outline">Aberta</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Contas a Pagar</h1>

      {(podeCriar || (editingId && podeEditar)) && (
      <Card>
        <CardHeader><CardTitle className="text-base">{editingId ? "Editar conta" : "Nova conta a pagar"}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <Input placeholder="Descrição *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" />
          <Select value={form.fornecedor_id || "none"} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Fornecedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Valor *" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} />
          <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} placeholder="Emissão" />
          <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} placeholder="Vencimento *" />
          <Input type="number" min={1} value={form.parcela_total} onChange={(e) => setForm({ ...form, parcela_total: Number(e.target.value) })} placeholder="Nº Parcelas" disabled={!!editingId} />
          <Select value={form.plano_conta_id || "none"} onValueChange={(v) => setForm({ ...form, plano_conta_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Categoria DRE" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {planoContas.filter(p => p.tipo === "despesa" && p.ativo).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
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
          <Input placeholder="Observação" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="md:col-span-2 lg:col-span-2" />
          <div className="md:col-span-1 lg:col-span-2 flex items-center gap-2">
            <input
              id="cp-anexo-input"
              type="file"
              className="hidden"
              accept="application/pdf,image/*,.xml"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadAnexo(f); e.currentTarget.value = ""; }}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById("cp-anexo-input")?.click()}>
              <Paperclip className="h-4 w-4 mr-1" />{uploading ? "Enviando..." : (form.anexo_url ? "Trocar anexo" : "Anexar boleto/NF")}
            </Button>
            {form.anexo_url && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <a href={form.anexo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[200px]" title={form.anexo_nome}>
                  {form.anexo_nome || "anexo"}
                </a>
                <button type="button" onClick={() => setForm({ ...form, anexo_url: "", anexo_nome: "" })} className="text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <div className="md:col-span-3 lg:col-span-4 flex gap-2">
            <Button onClick={handleSave}><Plus className="h-4 w-4 mr-1" />{editingId ? "Salvar" : "Adicionar"}</Button>
            {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              {filtradas.length} conta(s) — Total: {formatBRL(totais.total)} | Pago: {formatBRL(totais.pago)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Buscar descrição/fornecedor..." value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} className="w-64" />
              {hasFiltros && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9 gap-1 text-xs text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> Limpar filtros
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2 pt-3 border-t">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1 pb-2">
              <Filter className="h-3.5 w-3.5" /> Filtros:
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Vencimento de</label>
              <Input type="date" value={fDataIni} onChange={(e) => { setFDataIni(e.target.value); setPage(1); }} className="h-9 w-40 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">até</label>
              <Input type="date" value={fDataFim} onChange={(e) => { setFDataFim(e.target.value); setPage(1); }} className="h-9 w-40 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Status</label>
              <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberta">Em aberto</SelectItem>
                  <SelectItem value="vencida">Vencidas</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="paga">Pagas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Fornecedor</label>
              <Select value={fFornecedor} onValueChange={(v) => { setFFornecedor(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-52 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {fornecedores.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Categoria DRE</label>
              <Select value={fPlanoConta} onValueChange={(v) => { setFPlanoConta(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {planoContas.filter(p => p.tipo === "despesa").map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Centro de custo</label>
              <Select value={fCentroCusto} onValueChange={(v) => { setFCentroCusto(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {centrosCusto.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Conta bancária</label>
              <Select value={fContaBanc} onValueChange={(v) => { setFContaBanc(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {contasBancarias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Valor mín</label>
              <Input value={fValorMin} onChange={(e) => { setFValorMin(e.target.value); setPage(1); }} placeholder="0,00" className="h-9 w-28 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Valor máx</label>
              <Input value={fValorMax} onChange={(e) => { setFValorMax(e.target.value); setPage(1); }} placeholder="0,00" className="h-9 w-28 text-xs" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Pago</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((c) => (
                <TableRow key={c.id} className={isVencida(c) ? "bg-red-50/50" : ""}>
                  <TableCell className="tabular-nums">{formatDate(c.data_vencimento)}</TableCell>
                  <TableCell className="font-medium">{c.descricao}</TableCell>
                  <TableCell>{c.fornecedor_nome || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(c.valor_total))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(Number(c.valor_pago))}</TableCell>
                  <TableCell>{statusBadge(c)}</TableCell>
                  <TableCell className="text-right">
                    {podeBaixar && c.status !== "paga" && c.status !== "cancelada" && (
                      <Button size="sm" variant="ghost" onClick={() => setBaixaConta(c)} title="Baixar"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></Button>
                    )}
                    {podeBaixar && (c.status === "paga" || c.status === "parcial") && (
                      <Button size="sm" variant="ghost" onClick={() => setEstornoConta({ conta: c, acao: "estornar" })} title="Estornar pagamento"><Undo2 className="h-3.5 w-3.5 text-amber-600" /></Button>
                    )}
                    {podeEditar && c.status !== "paga" && c.status !== "cancelada" && (
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

      <BaixaDialog open={!!baixaConta} onOpenChange={(o) => !o && setBaixaConta(null)} conta={baixaConta} modo="pagar" />
      <EstornoCancelamentoDialog
        open={!!estornoConta}
        onOpenChange={(o) => !o && setEstornoConta(null)}
        conta={estornoConta?.conta || null}
        modo="pagar"
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
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && cancelDelete()} onConfirm={async () => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; } if (deleteId) { await deleteContaPagar(deleteId); cancelDelete(); } }} />
    </div>
  );
}
