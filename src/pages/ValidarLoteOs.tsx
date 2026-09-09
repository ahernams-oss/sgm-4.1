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
import { BadgeCheck, Search, CheckCircle2 } from "lucide-react";

const STATUS_PERMITIDOS = ["Serviço Confirmado"];

export default function ValidarLoteOs() {
  const { ordens, updateOrdem } = useOrdensServico();
  const { usuarioLogado } = useAuth();
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podeValidarLote = tem("os.validar_lote");

  const _saved = loadPersistedFilters<{ search: string; filterCliente: string; }>("validar_lote_os_filters_v1");
  const [search, setSearch] = useState(_saved?.search ?? "");
  const [filterCliente, setFilterCliente] = useState(_saved?.filterCliente ?? "all");
  usePersistFilters("validar_lote_os_filters_v1", { search, filterCliente });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openConfirm, setOpenConfirm] = useState(false);
  const [validating, setValidating] = useState(false);

  const buildHist = (situacao: string, existing: any[] = []) => [
    ...existing,
    { situacao, data: new Date().toISOString(), usuario: usuarioLogado?.nome || "Sistema" },
  ];

  const disponiveis = useMemo(
    () => ordens.filter((os) => STATUS_PERMITIDOS.includes(os.situacao)),
    [ordens]
  );

  const filtered = useMemo(() => {
    let result = disponiveis;
    if (filterCliente !== "all") result = result.filter((s) => s.clienteId === filterCliente);
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
  }, [disponiveis, search, filterCliente]);

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

  const handleValidarLote = async () => {
    if (!podeValidarLote) {
      toast.error("Você não possui permissão para esta ação.");
      return;
    }
    setValidating(true);
    let ok = 0;
    let fail = 0;

    for (const id of selectedIds) {
      const os = ordens.find((o) => o.id === id);
      if (!os || !STATUS_PERMITIDOS.includes(os.situacao)) {
        fail++;
        continue;
      }
      try {
        await updateOrdem(os.id, {
          situacao: "Validada",
          historico: buildHist("Validada", os.historico || []),
        });
        ok++;
      } catch {
        fail++;
      }
    }

    setValidating(false);
    setOpenConfirm(false);
    setSelectedIds(new Set());

    if (ok > 0) {
      toast.success(`${ok} OS validada(s).${fail > 0 ? ` ${fail} falharam.` : ""}`);
    } else {
      toast.error("Nenhuma OS pôde ser validada.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Validar OS em Lote</h1>
            <p className="text-sm text-muted-foreground">
              Ordens de Serviço com serviço confirmado, prontas para validação
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
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg border border-border">
          <span className="text-sm font-medium">{selectedIds.size} OS selecionada(s)</span>
          {podeValidarLote && (
            <Button size="sm" onClick={() => setOpenConfirm(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Validar selecionadas
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
                  <BadgeCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhuma OS disponível para validação
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
            <DialogTitle>Validar OS em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você marcará <strong>{selectedIds.size} OS</strong> como{" "}
              <strong>Validada</strong>.
            </p>
            <div className="bg-muted/50 border rounded p-3 text-xs">
              Após validação, as OS ficarão prontas para assinaturas eletrônicas.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConfirm(false)}>Cancelar</Button>
            <Button onClick={handleValidarLote} disabled={validating || selectedIds.size === 0}>
              {validating ? "Validando..." : "Validar OS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
