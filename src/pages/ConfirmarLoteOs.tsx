import { useState, useMemo } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useOrdensServico, OrdemServico } from "@/contexts/OrdensServicoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEstoque } from "@/contexts/EstoqueContext";
import { updateRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
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
import { ShieldCheck, Search, CheckCircle2 } from "lucide-react";

const STATUS_PERMITIDOS = ["Executada", "Serviço Re-executado"];

export default function ConfirmarLoteOs() {
  const { ordens, updateOrdem } = useOrdensServico();
  const { usuarioLogado } = useAuth();
  const { clientes } = useClientes();
  const { registrarMovimentacao } = useEstoque();
  const { tem } = usePermissao();
  const podeConfirmarLote = tem("os.confirmar_lote");

  const _saved = loadPersistedFilters<{ search: string; filterCliente: string; }>("confirmar_lote_os_filters_v1");
  const [search, setSearch] = useState(_saved?.search ?? "");
  const [filterCliente, setFilterCliente] = useState(_saved?.filterCliente ?? "all");
  usePersistFilters("confirmar_lote_os_filters_v1", { search, filterCliente });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openConfirm, setOpenConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  const handleConfirmarLote = async () => {
    if (!podeConfirmarLote) {
      toast.error("Você não possui permissão para esta ação.");
      return;
    }
    setConfirming(true);
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
          situacao: "Serviço Confirmado",
          historico: buildHist("Serviço Confirmado", os.historico || []),
        });

        // Saída automática de estoque
        if (Array.isArray(os.materiaisEstoque) && os.materiaisEstoque.length > 0) {
          for (const mat of os.materiaisEstoque) {
            if ((Number(mat.quantidade) || 0) > 0) {
              await registrarMovimentacao({
                materialId: mat.id,
                materialCodigo: mat.codigo,
                materialDescricao: mat.descricao,
                tipo: "saida",
                quantidade: Number(mat.quantidade) || 0,
                local: os.clienteNome || "",
                documentoRef: `OS ${formatNumeroAno(os.numero, os.createdAt)}`,
                observacao: `Saída automática - Ordem de Serviço nº ${formatNumeroAno(os.numero, os.createdAt)}`,
                usuario: usuarioLogado?.nome || "Sistema",
                lote: "",
                validade: "",
                depositoOrigem: "",
                depositoDestino: "",
                fornecedorNome: "",
                valorUnitario: Number(mat.valorUnitario) || 0,
              } as any);
            }
          }
        }

        // Concluir SS vinculada
        if (os.solicitacaoId) {
          const { data: ssData } = await (supabase as any)
            .from("solicitacoes_servicos")
            .select("historico")
            .eq("id", os.solicitacaoId)
            .single();
          const histAtual = Array.isArray(ssData?.historico) ? ssData.historico : [];
          const novoHist = [
            ...histAtual,
            { situacao: "Concluída", data: new Date().toISOString(), usuario: usuarioLogado?.nome || "Sistema" },
          ];
          await updateRow("solicitacoes_servicos", os.solicitacaoId, {
            situacao: "Concluída",
            historico: novoHist,
          });
        }
        ok++;
      } catch {
        fail++;
      }
    }

    setConfirming(false);
    setOpenConfirm(false);
    setSelectedIds(new Set());

    if (ok > 0) {
      toast.success(`${ok} OS confirmada(s).${fail > 0 ? ` ${fail} falharam.` : ""}`);
    } else {
      toast.error("Nenhuma OS pôde ser confirmada.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Confirmar OS em Lote</h1>
            <p className="text-sm text-muted-foreground">
              Ordens de Serviço executadas, prontas para confirmação do serviço
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
          {podeConfirmarLote && (
            <Button size="sm" onClick={() => setOpenConfirm(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar serviço das selecionadas
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
                  <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhuma OS disponível para confirmação
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
            <DialogTitle>Confirmar Serviço em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você marcará <strong>{selectedIds.size} OS</strong> como{" "}
              <strong>Serviço Confirmado</strong>.
            </p>
            <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
              <p>Esta ação irá:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Atualizar a situação para "Serviço Confirmado"</li>
                <li>Dar saída automática dos materiais de estoque utilizados</li>
                <li>Concluir as Solicitações de Serviço vinculadas</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConfirm(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarLote} disabled={confirming || selectedIds.size === 0}>
              {confirming ? "Confirmando..." : "Confirmar Serviços"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
