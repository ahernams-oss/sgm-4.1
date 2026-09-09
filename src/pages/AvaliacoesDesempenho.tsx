import { useMemo, useState, type ReactNode } from "react";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Plus, Pencil, Trash2, Eye, FileSpreadsheet, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import {
  AvaliacoesDesempenhoProvider,
  useAvaliacoesDesempenho,
  QUESITOS_AVALIACAO,
  type AvaliacaoDesempenho,
} from "@/contexts/AvaliacoesDesempenhoContext";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useCargos } from "@/contexts/CargosContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { gerarPdfAvaliacaoDesempenho, gerarPdfAvaliacoesLista } from "@/lib/gerarPdfAvaliacaoDesempenho";
import { gerarExcelAvaliacoesDesempenho } from "@/lib/gerarExcelAvaliacoesDesempenho";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";

const NOTA_MIN = 0;
const NOTA_MAX = 10;
const TOTAL_QUESITOS = QUESITOS_AVALIACAO.length;
const PONTUACAO_MAXIMA = TOTAL_QUESITOS * NOTA_MAX;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ANOS = Array.from({ length: 2035 - 2026 + 1 }, (_, i) => String(2026 + i));

const emptyForm = {
  funcionarioId: "",
  dataAvaliacao: new Date().toISOString().slice(0, 10),
  periodoMes: "",
  periodoAno: "",
  notas: {} as Record<string, number>,
  observacoes: "",
};

function parsePeriodo(p: string): { mes: string; ano: string } {
  if (!p) return { mes: "", ano: "" };
  const [mes, ano] = p.split("/");
  return { mes: MESES.includes(mes) ? mes : "", ano: ANOS.includes(ano) ? ano : "" };
}

function calcularTotais(notas: Record<string, number>) {
  const valores = QUESITOS_AVALIACAO.map((q) => Number(notas[q.key]) || 0);
  const total = valores.reduce((s, v) => s + v, 0);
  const media = TOTAL_QUESITOS > 0 ? total / TOTAL_QUESITOS : 0;
  return { total, media };
}

function badgeMedia(m: number) {
  if (m >= 8) return "bg-green-100 text-green-800 border-green-300";
  if (m >= 6) return "bg-blue-100 text-blue-800 border-blue-300";
  if (m >= 4) return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-red-100 text-red-800 border-red-300";
}

function PageInner() {
  const { avaliacoes, addAvaliacao, updateAvaliacao, deleteAvaliacao } = useAvaliacoesDesempenho();
  const { funcionarios } = useFuncionarios();
  const { cargos } = useCargos();
  const cargoMap = useMemo(() => Object.fromEntries(cargos.map((c) => [c.id, c.nome])), [cargos]);
  const { usuarioLogado, clientesPermitidosIds } = useAuth();
  const { tem, acessoTotal } = usePermissao();

  const podeCriar = acessoTotal || tem("avaliacoes_desempenho.criar");
  const podeEditar = acessoTotal || tem("avaliacoes_desempenho.editar");
  const podeExcluir = acessoTotal || tem("avaliacoes_desempenho.excluir");

  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewing, setViewing] = useState<AvaliacaoDesempenho | null>(null);

  const [filtroFunc, setFiltroFunc] = useState("__all__");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  // Acesso: avaliador só vê funcionários dos clientes em que possui acesso (exceto acesso total)
  const funcionariosVisiveis = useMemo(() => {
    if (acessoTotal) return funcionarios;
    const setIds = new Set(clientesPermitidosIds || []);
    return funcionarios.filter((f) => f.clienteId && setIds.has(f.clienteId));
  }, [funcionarios, clientesPermitidosIds, acessoTotal]);

  const funcMap = useMemo(() => Object.fromEntries(funcionarios.map((f) => [f.id, f.nome])), [funcionarios]);
  const funcVisiveisIds = useMemo(() => new Set(funcionariosVisiveis.map((f) => f.id)), [funcionariosVisiveis]);

  const filtered = useMemo(() => {
    return avaliacoes.filter((a) => {
      if (!acessoTotal && !funcVisiveisIds.has(a.funcionarioId)) return false;
      if (filtroFunc !== "__all__" && a.funcionarioId !== filtroFunc) return false;
      if (search.trim()) {
        const nome = (funcMap[a.funcionarioId] || "").toLowerCase();
        if (!nome.includes(search.toLowerCase()) && !a.periodoReferencia.toLowerCase().includes(search.toLowerCase()))
          return false;
      }
      return true;
    });
  }, [avaliacoes, filtroFunc, search, funcMap, funcVisiveisIds, acessoTotal]);

  const { paginated, totalPages, safePage } = paginate(filtered, page, pageSize);

  const colDefs: Record<string, { label: string; className?: string }> = {
    funcionario: { label: "Funcionário" },
    data: { label: "Data" },
    periodo: { label: "Período" },
    avaliador: { label: "Avaliador" },
    pontuacao: { label: "Pontuação Total", className: "text-right" },
    media: { label: "Média Ponderada", className: "text-right" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "avaliacoes_desempenho.lista",
    ["funcionario", "data", "periodo", "avaliador", "pontuacao", "media"]
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (a: AvaliacaoDesempenho) => {
    setEditId(a.id);
    const { mes, ano } = parsePeriodo(a.periodoReferencia);
    setForm({
      funcionarioId: a.funcionarioId,
      dataAvaliacao: a.dataAvaliacao,
      periodoMes: mes,
      periodoAno: ano,
      notas: { ...a.notas },
      observacoes: a.observacoes,
    });
    setOpen(true);
  };

  const setNota = (key: string, raw: string) => {
    if (raw === "") {
      const novo = { ...form.notas };
      delete novo[key];
      setForm({ ...form, notas: novo });
      return;
    }
    let n = Number(raw.replace(",", "."));
    if (Number.isNaN(n)) return;
    if (n < NOTA_MIN) n = NOTA_MIN;
    if (n > NOTA_MAX) n = NOTA_MAX;
    setForm({ ...form, notas: { ...form.notas, [key]: n } });
  };

  const handleSubmit = async () => {
    if (editId ? !podeEditar : !podeCriar) return toast.error("Você não possui permissão para esta ação.");
    if (!form.funcionarioId) return toast.error("Selecione o funcionário.");
    if (!form.dataAvaliacao) return toast.error("Informe a data.");
    const { total, media } = calcularTotais(form.notas);
    const payload = {
      funcionarioId: form.funcionarioId,
      dataAvaliacao: form.dataAvaliacao,
      periodoReferencia: form.periodoMes && form.periodoAno ? `${form.periodoMes}/${form.periodoAno}` : (form.periodoMes || form.periodoAno || ""),
      avaliadorId: usuarioLogado?.id || "",
      avaliadorNome: usuarioLogado?.nome || "",
      notas: form.notas,
      pontuacaoTotal: total,
      mediaPonderada: media,
      observacoes: form.observacoes,
    };
    if (editId) {
      await updateAvaliacao(editId, payload);
      toast.success("Avaliação atualizada.");
    } else {
      await addAvaliacao(payload);
      toast.success("Avaliação registrada.");
    }
    setOpen(false);
    resetForm();
  };

  const totaisForm = calcularTotais(form.notas);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-serif font-semibold">Avaliações de Desempenho</h1>
            <p className="text-sm text-muted-foreground">Avaliação periódica dos funcionários — escala de 0 a 10 em 15 quesitos.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            if (filtered.length === 0) return toast.error("Nenhuma avaliação para exportar.");
            gerarPdfAvaliacoesLista(filtered, funcMap);
          }}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" onClick={() => {
            if (filtered.length === 0) return toast.error("Nenhuma avaliação para exportar.");
            gerarExcelAvaliacoesDesempenho(filtered, funcMap);
          }}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          {podeCriar && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" /> Nova Avaliação
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Funcionário</Label>
            <Select value={filtroFunc} onValueChange={(v) => { setFiltroFunc(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {funcionariosVisiveis.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}{cargoMap[f.cargoId] ? ` — ${cargoMap[f.cargoId]}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Busca</Label>
            <Input placeholder="Nome ou período..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
                {colOrder.map((key) => {
                  const c = colDefs[key];
                  if (!c) return null;
                  return (
                    <SortableTableHead key={key} id={key} className={c.className}>
                      {c.label}
                    </SortableTableHead>
                  );
                })}
                <TableHead className="text-right w-[180px]">Ações</TableHead>
              </SortableHeaderRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={colOrder.length + 1} className="text-center text-muted-foreground py-10">Nenhuma avaliação registrada.</TableCell></TableRow>
              ) : paginated.map((a, idx) => {
                const cellMap: Record<string, { node: ReactNode; className?: string }> = {
                  funcionario: { node: <span className="font-medium">{funcMap[a.funcionarioId] || "—"}</span> },
                  data: { node: a.dataAvaliacao ? new Date(a.dataAvaliacao + "T00:00:00").toLocaleDateString("pt-BR") : "—" },
                  periodo: { node: a.periodoReferencia || "—" },
                  avaliador: { node: a.avaliadorNome || "—" },
                  pontuacao: { node: <span className="font-mono">{a.pontuacaoTotal.toFixed(1)} / {PONTUACAO_MAXIMA}</span>, className: "text-right" },
                  media: { node: <Badge variant="outline" className={badgeMedia(a.mediaPonderada)}>{a.mediaPonderada.toFixed(2)}</Badge>, className: "text-right" },
                };
                return (
                  <TableRow key={a.id} className={idx % 2 === 0 ? "bg-gray-200/60" : "bg-white"}>
                    {colOrder.map((key) => {
                      const c = cellMap[key];
                      return <TableCell key={key} className={c?.className}>{c?.node}</TableCell>;
                    })}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setViewing(a); setViewOpen(true); }} title="Visualizar">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => gerarPdfAvaliacaoDesempenho(a, { funcionarioNome: funcMap[a.funcionarioId] || "" })} title="Baixar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        {podeEditar && (
                          <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {podeExcluir && (
                          <Button size="icon" variant="ghost" className="text-destructive" title="Excluir" onClick={() => requestDelete(a.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={safePage}
              totalItems={filtered.length}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
            <div className="text-xs text-muted-foreground text-right">
              Página {safePage} de {totalPages}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Avaliação" : "Nova Avaliação de Desempenho"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Funcionário *</Label>
              <Select value={form.funcionarioId} onValueChange={(v) => setForm({ ...form, funcionarioId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {funcionariosVisiveis.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}{cargoMap[f.cargoId] ? ` — ${cargoMap[f.cargoId]}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data da avaliação *</Label>
              <Input type="date" value={form.dataAvaliacao} onChange={(e) => setForm({ ...form, dataAvaliacao: e.target.value })} />
            </div>
            <div>
              <Label>Mês de referência</Label>
              <Select value={form.periodoMes} onValueChange={(v) => setForm({ ...form, periodoMes: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano de referência</Label>
              <Select value={form.periodoAno} onValueChange={(v) => setForm({ ...form, periodoAno: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Quesito</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[120px] text-right">Nota (0-10)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {QUESITOS_AVALIACAO.map((q) => (
                  <TableRow key={q.key}>
                    <TableCell className="font-medium">{q.label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.descricao}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step="0.1"
                        className="text-right"
                        value={form.notas[q.key] ?? ""}
                        onChange={(e) => setNota(q.key, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 border-t">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Pontuação Total</div>
                <div className="text-xl font-mono font-semibold">{totaisForm.total.toFixed(1)} / {PONTUACAO_MAXIMA}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Média Ponderada</div>
                <div className="text-xl font-mono font-semibold">{totaisForm.media.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editId ? "Salvar alterações" : "Registrar avaliação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Avaliação</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Funcionário</div><div className="font-medium">{funcMap[viewing.funcionarioId] || "—"}</div></div>
                <div><div className="text-muted-foreground text-xs">Data</div><div>{viewing.dataAvaliacao ? new Date(viewing.dataAvaliacao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div></div>
                <div><div className="text-muted-foreground text-xs">Período</div><div>{viewing.periodoReferencia || "—"}</div></div>
                <div><div className="text-muted-foreground text-xs">Avaliador</div><div>{viewing.avaliadorNome || "—"}</div></div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Quesito</TableHead><TableHead className="text-right">Nota</TableHead></TableRow></TableHeader>
                <TableBody>
                  {QUESITOS_AVALIACAO.map((q) => (
                    <TableRow key={q.key}>
                      <TableCell>{q.label}</TableCell>
                      <TableCell className="text-right font-mono">{(viewing.notas[q.key] ?? 0).toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-md">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Pontuação Total</div>
                  <div className="text-xl font-mono font-semibold">{viewing.pontuacaoTotal.toFixed(1)} / {PONTUACAO_MAXIMA}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Média Ponderada</div>
                  <Badge variant="outline" className={`${badgeMedia(viewing.mediaPonderada)} text-base`}>{viewing.mediaPonderada.toFixed(2)}</Badge>
                </div>
              </div>
              {viewing.observacoes && (
                <div>
                  <div className="text-xs text-muted-foreground">Observações</div>
                  <div className="text-sm whitespace-pre-wrap">{viewing.observacoes}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => !o && cancelDelete()}
        onConfirm={async () => {
          if (deleteId) {
            await deleteAvaliacao(deleteId);
            toast.success("Avaliação removida.");
            cancelDelete();
          }
        }}
      />
    </div>
  );
}

export default function AvaliacoesDesempenhoPage() {
  return (
    <AvaliacoesDesempenhoProvider>
      <PageInner />
    </AvaliacoesDesempenhoProvider>
  );
}
