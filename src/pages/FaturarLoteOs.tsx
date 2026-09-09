import { useState, useMemo } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useOrdensServico, OrdemServico } from "@/contexts/OrdensServicoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useClientes } from "@/contexts/ClientesContext";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { formatNumeroAno } from "@/lib/formatNumero";
import { usePermissao } from "@/hooks/usePermissao";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Receipt, Search } from "lucide-react";

const STATUS_PERMITIDOS = ["Validada"];

export default function FaturarLoteOs() {
  const { ordens, updateOrdem } = useOrdensServico();
  const { usuarioLogado } = useAuth();
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podeFaturarLote = tem("ordem_servico.status.faturada");

  const _saved = loadPersistedFilters<{ search: string; filterCliente: string; validadoFrom: string; validadoTo: string; }>("faturar_lote_os_filters_v1");
  const [search, setSearch] = useState(_saved?.search ?? "");
  const [filterCliente, setFilterCliente] = useState(_saved?.filterCliente ?? "all");
  const [validadoFrom, setValidadoFrom] = useState(_saved?.validadoFrom ?? "");
  const [validadoTo, setValidadoTo] = useState(_saved?.validadoTo ?? "");
  usePersistFilters("faturar_lote_os_filters_v1", { search, filterCliente, validadoFrom, validadoTo });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openConfirm, setOpenConfirm] = useState(false);
  const [dataFaturamento, setDataFaturamento] = useState(new Date().toISOString().slice(0, 10));
  const [processing, setProcessing] = useState(false);

  const buildHist = (situacao: string, existing: any[] = [], motivo?: string) => [
    ...existing,
    { situacao, data: new Date().toISOString(), usuario: usuarioLogado?.nome || "Sistema", ...(motivo ? { motivo } : {}) },
  ];

  const parseBRLNum = (s?: string) => {
    if (!s) return 0;
    const cleaned = String(s).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const calcularValorTotalOS = (os: OrdemServico): number => {
    const totalItens = (os.materiais || []).reduce((s, m) => s + (Number(m.valorTotal) || 0), 0)
      + (os.materiaisEstoque || []).reduce((s, m) => s + (Number(m.valorTotal) || 0), 0);
    const bdi = (() => { const n = Number(String(os.bdi || 0).replace(",", ".")); return isNaN(n) ? 0 : n; })();
    const valorBDI = totalItens * (bdi / 100);
    return totalItens + valorBDI;
  };

  const disponiveis = useMemo(
    () => ordens.filter((os) => STATUS_PERMITIDOS.includes(os.situacao)),
    [ordens]
  );

  const filtered = useMemo(() => {
    let result = disponiveis;
    if (filterCliente !== "all") result = result.filter((s) => s.clienteId === filterCliente);
    if (validadoFrom || validadoTo) {
      result = result.filter((s) => {
        const dataValidacao = (s.historico || []).find((h: any) => h.situacao === "Validada")?.data;
        if (!dataValidacao) return false;
        const d = new Date(dataValidacao);
        if (validadoFrom && d < new Date(validadoFrom + "T00:00:00")) return false;
        if (validadoTo && d > new Date(validadoTo + "T23:59:59.999")) return false;
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          String(s.numero).includes(q) ||
          formatNumeroAno(s.numero, s.createdAt).toLowerCase().includes(q) ||
          s.clienteNome?.toLowerCase().includes(q) ||
          s.descricaoServicos?.toLowerCase().includes(q) ||
          s.localDescricao?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [disponiveis, search, filterCliente, validadoFrom, validadoTo]);

  const { paginated } = paginate(filtered, page, pageSize);
  const allPageIds = paginated.map((s) => s.id);
  const allPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) allPageIds.forEach((id) => next.delete(id));
      else allPageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clientesUnicos = useMemo(
    () =>
      (clientes || [])
        .filter((c: any) => (c.tipo || "Cliente") === "Cliente")
        .map((c: any) => [c.id, c.nome] as [string, string])
        .sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [clientes]
  );

  const selectedTotal = useMemo(() => {
    return Array.from(selectedIds).reduce((sum, id) => {
      const os = ordens.find((o) => o.id === id);
      return os ? sum + calcularValorTotalOS(os) : sum;
    }, 0);
  }, [selectedIds, ordens]);

  const vtmInfo = useMemo(() => {
    if (filterCliente === "all") return null;
    const cli = clientes.find((c) => c.id === filterCliente);
    if (!cli) return null;
    const hoje = new Date();
    const contratoVigente = (cli.contratos || []).find((ct) => {
      if (!ct.dataInicio) return false;
      const di = new Date(ct.dataInicio + "T00:00:00");
      const df = ct.dataFim ? new Date(ct.dataFim + "T23:59:59") : null;
      return di <= hoje && (!df || df >= hoje);
    }) || (cli.contratos || [])[0];
    if (!contratoVigente) return null;
    const vtmMensal = parseBRLNum(contratoVigente.valorBase);
    if (vtmMensal <= 0) return null;
    return {
      clienteNome: cli.nome,
      vtmMensal,
      saldo: vtmMensal - selectedTotal,
    };
  }, [filterCliente, clientes, selectedTotal]);

  const handleFaturarLote = async () => {
    if (!podeFaturarLote) {
      toast.error("Você não possui permissão para faturar Ordens de Serviço.");
      return;
    }
    if (!dataFaturamento) {
      toast.error("Informe a Data de Faturamento.");
      return;
    }
    setProcessing(true);
    let ok = 0;
    let fail = 0;
    const dataBR = dataFaturamento.split("-").reverse().join("/");

    for (const id of selectedIds) {
      const os = ordens.find((o) => o.id === id);
      if (!os || !STATUS_PERMITIDOS.includes(os.situacao)) {
        fail++;
        continue;
      }
      try {
        await updateOrdem(os.id, {
          situacao: "Faturada",
          data_faturamento: dataFaturamento,
          faturado_por: usuarioLogado?.nome || "Sistema",
          faturado_em: new Date().toISOString(),
          historico: buildHist("Faturada", os.historico || [], `Data de faturamento: ${dataBR}`),
        });
        ok++;
      } catch {
        fail++;
      }
    }

    setProcessing(false);
    setOpenConfirm(false);
    setSelectedIds(new Set());

    if (ok > 0) toast.success(`${ok} OS faturada(s) em ${dataBR}.${fail > 0 ? ` ${fail} falharam.` : ""}`);
    else toast.error("Nenhuma OS pôde ser faturada.");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faturar OS em Lote</h1>
            <p className="text-sm text-muted-foreground">
              Somente Ordens de Serviço com status "Validada" podem ser faturadas
            </p>
          </div>
        </div>
        <Badge variant="secondary">{filtered.length} disponíveis</Badge>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[220px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nº, cliente, descrição..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="w-[260px]">
          <Label className="text-xs">Cliente</Label>
          <Select value={filterCliente} onValueChange={(v) => { setFilterCliente(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Clientes</SelectItem>
              {clientesUnicos.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Label className="text-xs">Data da Validação (início)</Label>
          <Input type="date" value={validadoFrom} onChange={(e) => { setValidadoFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="w-[180px]">
          <Label className="text-xs">Data da Validação (fim)</Label>
          <Input type="date" value={validadoTo} onChange={(e) => { setValidadoTo(e.target.value); setPage(1); }} />
        </div>
        <div className="w-[180px]">
          <Label className="text-xs">Data de Faturamento</Label>
          <Input type="date" value={dataFaturamento} onChange={(e) => setDataFaturamento(e.target.value)} />
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg border border-border">
          <span className="text-sm font-medium">{selectedIds.size} OS selecionada(s)</span>
          {podeFaturarLote && (
            <Button size="sm" onClick={() => setOpenConfirm(true)}>
              <Receipt className="mr-2 h-4 w-4" />
              Faturar selecionadas
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos da página"
                />
              </TableHead>
              <TableHead className="w-16">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Descrição do Serviço</TableHead>
              <TableHead className="w-32">Solicitante</TableHead>
              <TableHead className="w-40 text-center">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhuma OS disponível para faturamento
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((s: OrdemServico, idx: number) => (
                <TableRow key={s.id} className={selectedIds.has(s.id) ? "bg-accent/50" : (idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60")}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onCheckedChange={() => toggleSelect(s.id)}
                      aria-label={`Selecionar OS ${s.numero}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-bold">{formatNumeroAno(s.numero, s.createdAt)}</TableCell>
                  <TableCell>{s.clienteNome || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {[s.localDescricao, s.pavimentoDescricao, s.setorDescricao].filter(Boolean).join(" › ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate">
                    {s.descricaoServicos || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{s.solicitante || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{s.situacao}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {selectedIds.size > 0 && (
            <tfoot>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableCell colSpan={7} className="text-right py-3">
                  <span className="text-sm text-muted-foreground mr-2">
                    {selectedIds.size} OS selecionada(s) — Total:
                  </span>
                  <span className="text-base font-bold text-primary">
                    {selectedTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </TableCell>
              </TableRow>
              {vtmInfo && (
                <TableRow className="bg-emerald-50/60 hover:bg-emerald-50/60 dark:bg-emerald-900/10">
                  <TableCell colSpan={7} className="text-right py-3">
                    <span className="text-sm text-muted-foreground mr-2">
                      VTM Mensal ({vtmInfo.clienteNome}):
                    </span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {vtmInfo.vtmMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <span className="text-sm text-muted-foreground mx-2">— Selecionado:</span>
                    <span className="text-base font-bold text-foreground">
                      {selectedTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <span className="text-sm text-muted-foreground mx-2">— Saldo:</span>
                    <span className={`text-base font-bold ${vtmInfo.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      {vtmInfo.saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </TableCell>
                </TableRow>
              )}
            </tfoot>
          )}
        </Table>
      </div>

      <PaginationControls
        currentPage={page}
        totalItems={filtered.length}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />

      <Dialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Faturar OS em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você marcará <strong>{selectedIds.size} OS</strong> como <strong>Faturada</strong>.
            </p>
            <div className="space-y-2">
              <Label>Data de Faturamento *</Label>
              <Input type="date" value={dataFaturamento} onChange={(e) => setDataFaturamento(e.target.value)} />
            </div>
            <div className="bg-muted/50 border rounded p-3 text-xs">
              A data informada será registrada em todas as OS selecionadas e utilizada nos relatórios finais dos clientes.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConfirm(false)}>Cancelar</Button>
            <Button onClick={handleFaturarLote} disabled={processing || selectedIds.size === 0 || !dataFaturamento}>
              {processing ? "Faturando..." : "Faturar OS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
