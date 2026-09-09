import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { matchNumero } from "@/lib/matchNumero";
import { useState, useMemo } from "react";
import { usePedidoCompra, PedidoCompra } from "@/contexts/PedidoCompraContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCargos } from "@/contexts/CargosContext";
import { usePcAssinaturas } from "@/contexts/PcAssinaturasContext";
import { gerarHashPc } from "@/lib/assinaturaHashPc";
import { obterIpOrigem } from "@/lib/assinaturaHashOs";
import PaginationControls, { paginate } from "@/components/PaginationControls";
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
import { FileSignature, Search, ShieldCheck } from "lucide-react";

export default function AssinarLotePc() {
  const { pedidos } = usePedidoCompra();
  const { usuarioLogado } = useAuth();
  const { cargos } = useCargos();
  const { assinaturas, registrar, refresh } = usePcAssinaturas();
  const { tem } = usePermissao();
  const podeAssinarLote = tem("pc.assinar_lote");

  const [search, setSearch] = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openConfirm, setOpenConfirm] = useState(false);
  const [senha, setSenha] = useState("");
  const [signing, setSigning] = useState(false);

  const disponiveis = useMemo(() => {
    return pedidos.filter((p) => {
      if (p.status === "Cancelado") return false;
      const jaAssinado = assinaturas.some(
        (a) => a.pedido_id === p.id && a.papel === "aprovador"
      );
      return !jaAssinado;
    });
  }, [pedidos, assinaturas]);

  const filtered = useMemo(() => {
    let result = disponiveis;
    if (filterFornecedor !== "all") {
      result = result.filter((p) => p.fornecedorId === filterFornecedor);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          matchNumero(p.numero, q) ||
          p.fornecedorNome?.toLowerCase().includes(q) ||
          p.comprador?.toLowerCase().includes(q) ||
          matchNumero(p.requisicaoNumero, q)
      );
    }

    return result;
  }, [disponiveis, search, filterFornecedor]);

  const { paginated } = paginate(filtered, page, pageSize);
  const allPageIds = paginated.map((p) => p.id);
  const allPageSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

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

  const fornecedoresUnicos = useMemo(
    () =>
      Array.from(
        new Map(
          disponiveis.map((p) => [p.fornecedorId, p.fornecedorNome])
        ).entries()
      )
        .filter(([id]) => !!id)
        .sort((a, b) => (a[1] || "").localeCompare(b[1] || "", "pt-BR")),
    [disponiveis]
  );

  const handleAssinarLote = async () => {
    if (!podeAssinarLote) {
      toast.error("Você não possui permissão para esta ação.");
      return;
    }
    if (!usuarioLogado) {
      toast.error("Usuário não autenticado.");
      return;
    }
    const senhaOk = await verificarSenhaUsuario(usuarioLogado.email, senha);
    if (!senhaOk) {
      toast.error("Senha incorreta.");
      return;
    }

    setSigning(true);
    const ip = await obterIpOrigem();
    const cargo = cargos.find((c) => c.id === usuarioLogado.cargoId);

    let ok = 0;
    let fail = 0;

    for (const id of selectedIds) {
      const pedido = pedidos.find((p) => p.id === id);
      if (!pedido || pedido.status === "Cancelado") {
        fail++;
        continue;
      }
      if (assinaturas.some((a) => a.pedido_id === pedido.id && a.papel === "aprovador")) {
        fail++;
        continue;
      }
      try {
        const hash = await gerarHashPc(pedido);
        const r = await registrar({
          pedido_id: pedido.id,
          pedido_numero: pedido.numero,
          papel: "aprovador",
          signatario_user_id: usuarioLogado.id,
          signatario_nome: usuarioLogado.nome,
          signatario_email: usuarioLogado.email,
          signatario_cargo: cargo?.nome || "",
          signatario_matricula: usuarioLogado.matricula || "",
          hash_documento: hash,
          ip_origem: ip,
          user_agent: navigator.userAgent,
        });
        if (r) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }

    await refresh();
    setSigning(false);
    setOpenConfirm(false);
    setSenha("");
    setSelectedIds(new Set());

    if (ok > 0) {
      toast.success(
        `${ok} Pedido(s) de Compra assinado(s).${fail > 0 ? ` ${fail} falharam.` : ""}`
      );
    } else {
      toast.error("Nenhum pedido pôde ser assinado.");
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
            <h1 className="text-2xl font-bold text-foreground">
              Assinar Ordens de Compra em Lote
            </h1>
            <p className="text-sm text-muted-foreground">
              Pedidos pendentes de assinatura do aprovador
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
              placeholder="Nº, fornecedor, comprador..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="w-[260px]">
          <Label className="text-xs">Fornecedor</Label>
          <Select value={filterFornecedor} onValueChange={(v) => { setFilterFornecedor(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Fornecedores</SelectItem>
              {fornecedoresUnicos.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg border border-border">
          <span className="text-sm font-medium">
            {selectedIds.size} pedido(s) selecionado(s)
          </span>
          {podeAssinarLote && (
            <Button size="sm" onClick={() => setOpenConfirm(true)}>
              <FileSignature className="mr-2 h-4 w-4" />
              Assinar selecionados
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
              <TableHead className="w-20">Nº PC</TableHead>
              <TableHead className="w-20">Nº RC</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="w-32">Comprador</TableHead>
              <TableHead className="w-32 text-right">Valor Total</TableHead>
              <TableHead className="w-24 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhum pedido disponível para assinatura
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((p: PedidoCompra, idx: number) => (
                <TableRow key={p.id} className={selectedIds.has(p.id) ? "bg-accent/50" : (idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60")}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                      aria-label={`Selecionar PC ${p.numero}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-bold">
                    OC-{String(p.numero).padStart(4, "0")}
                  </TableCell>
                  <TableCell className="font-mono">
                    {p.requisicaoNumero ? `RC-${String(p.requisicaoNumero).padStart(4, "0")}` : "—"}
                  </TableCell>
                  <TableCell>{p.fornecedorNome || "—"}</TableCell>
                  <TableCell className="text-sm">{p.comprador || "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(p.valorTotal || 0).toLocaleString("pt-BR", {
                      style: "currency", currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{p.status}</Badge>
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
            <DialogTitle>Assinatura Eletrônica em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Você assinará <strong>{selectedIds.size} Pedido(s) de Compra</strong> como{" "}
              <strong>Aprovador</strong>.
            </p>
            <div className="bg-muted/50 border rounded p-3 text-xs space-y-1">
              <p><strong>Signatário:</strong> {usuarioLogado?.nome}</p>
              <p><strong>E-mail:</strong> {usuarioLogado?.email}</p>
              <p className="italic text-muted-foreground mt-2">
                Cada pedido receberá uma assinatura individual com data, hora, IP, hash e
                código verificador único, conforme LEI Nº 14.063, DE 23 DE SETEMBRO DE 2020.
              </p>
            </div>
            <div>
              <Label>Confirme sua senha para prosseguir</Label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                onKeyDown={(e) => e.key === "Enter" && handleAssinarLote()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenConfirm(false); setSenha(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleAssinarLote} disabled={signing || !senha || selectedIds.size === 0}>
              {signing ? "Assinando..." : "Confirmar e Assinar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
