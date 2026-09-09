import { useState, useMemo } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { matchNumero } from "@/lib/matchNumero";
import { usePedidoCompra, PedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRecebimento, Recebimento, ItemRecebimento, AnexoNF } from "@/contexts/RecebimentoContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useClientes } from "@/contexts/ClientesContext";
import { notificarCompras, formatarPrioridade, formatarDataHora, formatarData, formatarPedido } from "@/lib/notificacoesCompras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, PackageCheck, Eye, ClipboardList, MoreHorizontal, History, Paperclip, FileText, X, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import type { ReactNode } from "react";
import { usePermissao } from "@/hooks/usePermissao";

const statusColors: Record<string, string> = {
  Emitido: "bg-blue-100 text-blue-800",
  Comprado: "bg-indigo-100 text-indigo-800",
  "Em Entrega": "bg-purple-100 text-purple-800",
  "Entregue Parcial": "bg-amber-100 text-amber-800",
  Entregue: "bg-green-100 text-green-800",
  Cancelado: "bg-red-200 text-red-900",
};

export default function RecebimentoComprasPage() {
  const { pedidos, updateStatus: updatePedidoStatus } = usePedidoCompra();
  const { recebimentos, registrarRecebimento, getRecebimentosByPedido, getTotalRecebidoPorItem } = useRecebimento();
  const { usuarioLogado } = useAuth();
  const { requisicoes } = useRequisicaoCompras();
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podeRegistrar = tem("recebimento.registrar");
  const { toast } = useToast();

  const _recSavedFilters = loadPersistedFilters<{ search: string; filterStatus: string; }>("recebimento_compras_filters_v1");
  const [search, setSearch] = useState(_recSavedFilters?.search ?? "");
  const [filterStatus, setFilterStatus] = useState(_recSavedFilters?.filterStatus ?? "Pendentes");
  usePersistFilters("recebimento_compras_filters_v1", { search, filterStatus });
  const [pageRec, setPageRec] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const colDefs: Record<string, { label: string; className?: string }> = {
    numero: { label: "Nº Pedido", className: "text-center" },
    rc: { label: "RC", className: "text-center" },
    fornecedor: { label: "Fornecedor" },
    localEntrega: { label: "Local Entrega" },
    valor: { label: "Valor", className: "text-center" },
    status: { label: "Status", className: "text-center" },
    progresso: { label: "Progresso", className: "text-center" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "compras.recebimento",
    ["numero", "rc", "fornecedor", "localEntrega", "valor", "status", "progresso"]
  );

  // Recebimento dialog
  const [recDialogOpen, setRecDialogOpen] = useState(false);
  const [recPedido, setRecPedido] = useState<PedidoCompra | null>(null);
  const [recItens, setRecItens] = useState<ItemRecebimento[]>([]);
  const [recNotaFiscal, setRecNotaFiscal] = useState("");
  const [recObservacao, setRecObservacao] = useState("");
  const [recAnexos, setRecAnexos] = useState<AnexoNF[]>([]);

  // View dialog
  const [viewPedido, setViewPedido] = useState<PedidoCompra | null>(null);

  // Histórico dialog
  const [histPedidoId, setHistPedidoId] = useState<string | null>(null);

  const pedidoTemItensPendentes = (p: PedidoCompra) => {
    return p.itens.some(pi => {
      const recebido = getTotalRecebidoPorItem(p.id, pi.itemId);
      return recebido < pi.quantidade;
    });
  };

  const pedidosRecebimento = useMemo(() => {
    // Pedidos que podem receber: status ativo OU "Entregue" com itens ainda pendentes
    return pedidos.filter(p =>
      ["Comprado", "Em Entrega", "Entregue Parcial"].includes(p.status) ||
      (p.status === "Entregue" && pedidoTemItensPendentes(p))
    );
  }, [pedidos, recebimentos]);

  const filtered = useMemo(() => {
    let list = filterStatus === "Pendentes"
      ? pedidos.filter(p => ["Comprado", "Em Entrega", "Entregue Parcial"].includes(p.status) || (p.status === "Entregue" && pedidoTemItensPendentes(p)))
      : filterStatus === "Recebidos"
        ? pedidos.filter(p => p.status === "Entregue" && !pedidoTemItensPendentes(p))
        : pedidos.filter(p => p.status !== "Cancelado");

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        matchNumero(p.numero, s) ||
        p.fornecedorNome.toLowerCase().includes(s) ||
        matchNumero(p.requisicaoNumero, s) ||
        p.localEntrega?.toLowerCase().includes(s)
      );
    }

    return list.sort((a, b) => b.numero - a.numero);
  }, [pedidos, search, filterStatus]);

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const openRecebimentoDialog = (pedido: PedidoCompra) => {
    setRecPedido(pedido);
    setRecItens(
      pedido.itens.map(i => {
        const jaRecebido = getTotalRecebidoPorItem(pedido.id, i.itemId);
        const restante = Math.max(0, i.quantidade - jaRecebido);
        return {
          itemId: i.itemId,
          descricao: i.descricao,
          quantidadePedida: i.quantidade,
          quantidadeRecebida: restante,
          unidadeMedida: i.unidadeMedida,
          observacao: "",
        };
      })
    );
    setRecNotaFiscal("");
    setRecObservacao("");
    setRecAnexos([]);
    setRecDialogOpen(true);
  };

  const handleRegistrarRecebimento = () => {
    if (!podeRegistrar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!recPedido) return;
    const temRecebimento = recItens.some(i => i.quantidadeRecebida > 0);
    if (!temRecebimento) {
      toast({ title: "Informe a quantidade recebida de pelo menos um item", variant: "destructive" });
      return;
    }

    // Validate quantities
    for (const item of recItens) {
      const jaRecebido = getTotalRecebidoPorItem(recPedido.id, item.itemId);
      if (item.quantidadeRecebida + jaRecebido > item.quantidadePedida) {
        toast({ title: `Quantidade excede o pedido para: ${item.descricao}`, variant: "destructive" });
        return;
      }
    }

    registrarRecebimento({
      pedidoId: recPedido.id,
      pedidoNumero: recPedido.numero,
      requisicaoId: recPedido.requisicaoId,
      requisicaoNumero: recPedido.requisicaoNumero,
      fornecedorNome: recPedido.fornecedorNome,
      localEntrega: recPedido.localEntrega,
      usuario: usuarioLogado?.nome || "Almoxarife",
      itens: recItens.filter(i => i.quantidadeRecebida > 0),
      observacaoGeral: recObservacao,
      notaFiscal: recNotaFiscal,
      anexosNF: recAnexos,
    });

    // Notifica cliente via WhatsApp
    try {
      const req = requisicoes.find(r => r.id === recPedido.requisicaoId);
      const cli = req ? clientes.find(c => c.id === req.centroCusto) : undefined;
      if (req && cli?.grupoWhatsapp) {
        const totalPedido = recPedido.itens.reduce((s, i) => s + i.quantidade, 0);
        const totalRecebidoAcum = recPedido.itens.reduce(
          (s, i) => s + getTotalRecebidoPorItem(recPedido.id, i.itemId), 0
        );
        const totalAtual = recItens.reduce((s, i) => s + i.quantidadeRecebida, 0);
        const ehTotal = (totalRecebidoAcum + totalAtual) >= totalPedido;
        const label = ehTotal ? "RECEBIDO" : "RECEBIDO PARCIAL";
        notificarCompras({
          jid: cli.grupoWhatsapp,
          clienteNome: cli.nome,
          pedido: formatarPedido(req.numero, req.dataCriacao),
          statusLabel: label,
          dataSolicitacao: formatarDataHora(req.dataCriacao),
          dataExtraLabel: "Data do recebimento",
          dataExtraValor: formatarDataHora(new Date().toISOString()),
          solicitante: req.solicitante,
          prioridade: formatarPrioridade(req.urgencia),
          obs: recObservacao || (recNotaFiscal ? `NF: ${recNotaFiscal}` : req.justificativa),
        });
      }
    } catch (e) { console.error("[Recebimento] WhatsApp falhou:", e); }

    toast({ title: "Recebimento registrado com sucesso!" });
    setRecDialogOpen(false);
  };

  const recebimentosDoPedido = histPedidoId ? getRecebimentosByPedido(histPedidoId) : [];

  // Stats
  const totalPendentes = pedidos.filter(p => ["Comprado", "Em Entrega", "Entregue Parcial"].includes(p.status)).length;
  const totalRecebidosHoje = recebimentos.filter(r => {
    const hoje = new Date().toDateString();
    return new Date(r.dataRecebimento).toDateString() === hoje;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Recebimento de Materiais</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPendentes}</div>
            <p className="text-xs text-muted-foreground">aguardando recebimento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebimentos Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecebidosHoje}</div>
            <p className="text-xs text-muted-foreground">registros no dia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Recebimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recebimentos.length}</div>
            <p className="text-xs text-muted-foreground">registros totais</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº pedido, fornecedor, RC, local..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Pendentes">Pendentes de Recebimento</SelectItem>
            <SelectItem value="Recebidos">Já Recebidos</SelectItem>
            <SelectItem value="Todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} pedido{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div className="border rounded-lg">
        <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
        <Table>
          <TableHeader>
            <TableRow>
              {colOrder.map(key => {
                const cd = colDefs[key];
                return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
              })}
              <TableHead className="w-16 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colOrder.length + 1} className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</TableCell></TableRow>
            ) : paginate(filtered, pageRec, pageSize).paginated.map((p, idx) => {
              const recsPedido = getRecebimentosByPedido(p.id);
              const totalItens = p.itens.length;
              const itensCompletos = p.itens.filter(i => {
                const recebido = getTotalRecebidoPorItem(p.id, i.itemId);
                return recebido >= i.quantidade;
              }).length;
              const cellMap: Record<string, ReactNode> = {
                numero: <span className="font-mono font-bold">OC-{String(p.numero).padStart(4, "0")}</span>,
                rc: <span className="font-mono">RCS-{String(p.requisicaoNumero).padStart(4, "0")}</span>,
                fornecedor: p.fornecedorNome,
                localEntrega: <span className="text-sm">{p.localEntrega || "-"}</span>,
                valor: <span className="font-medium">{formatCurrency(p.valorTotal)}</span>,
                status: <Badge className={statusColors[p.status] || ""}>{p.status}</Badge>,
                progresso: (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${totalItens > 0 ? (itensCompletos / totalItens) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{itensCompletos}/{totalItens}</span>
                  </div>
                ),
              };
              return (
                <TableRow key={p.id} className={idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60"}>
                  {colOrder.map(key => <TableCell key={key} className={colDefs[key]?.className}>{cellMap[key]}</TableCell>)}
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewPedido(p)}>
                          <Eye className="mr-2 h-4 w-4" />Detalhes do Pedido
                        </DropdownMenuItem>
                        {recsPedido.length > 0 && (
                          <DropdownMenuItem onClick={() => setHistPedidoId(p.id)}>
                            <History className="mr-2 h-4 w-4" />Histórico de Recebimentos
                          </DropdownMenuItem>
                        )}
                        {podeRegistrar && (["Comprado", "Em Entrega", "Entregue Parcial"].includes(p.status) || (p.status === "Entregue" && pedidoTemItensPendentes(p))) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openRecebimentoDialog(p)}>
                              <PackageCheck className="mr-2 h-4 w-4" />Registrar Recebimento
                            </DropdownMenuItem>
                          </>
                        )}
                        {p.status === "Entregue" && pedidoTemItensPendentes(p) && (
                          <DropdownMenuItem onClick={() => {
                            updatePedidoStatus(p.id, "Entregue Parcial", usuarioLogado?.nome || "Sistema", "Status corrigido - itens pendentes de recebimento");
                            toast({ title: "Status corrigido para 'Entregue Parcial'" });
                          }}>
                            <ClipboardList className="mr-2 h-4 w-4" />Corrigir Status (Entregue Parcial)
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </SortableHeaderRow>
      </div>
      <PaginationControls currentPage={pageRec} totalItems={filtered.length} onPageChange={setPageRec} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageRec(1); }} />

      {/* Dialog Registrar Recebimento */}
      <Dialog open={recDialogOpen} onOpenChange={setRecDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento — OC-{recPedido && String(recPedido.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>
              Fornecedor: {recPedido?.fornecedorNome} | Local: {recPedido?.localEntrega || "-"}
            </DialogDescription>
          </DialogHeader>
          {recPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nota Fiscal</Label>
                  <Input value={recNotaFiscal} onChange={e => setRecNotaFiscal(e.target.value)} placeholder="Nº da nota fiscal..." />
                </div>
                <div>
                  <Label>Recebido por</Label>
                  <Input value={usuarioLogado?.nome || "Almoxarife"} readOnly className="bg-muted" />
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Itens do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-16">Un.</TableHead>
                        <TableHead className="w-24 text-right">Pedido</TableHead>
                        <TableHead className="w-24 text-right">Já Recebido</TableHead>
                        <TableHead className="w-24 text-right">Restante</TableHead>
                        <TableHead className="w-32">Recebendo</TableHead>
                        <TableHead className="min-w-[200px]">Obs. Item</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recItens.map((item, idx) => {
                        const jaRecebido = getTotalRecebidoPorItem(recPedido.id, item.itemId);
                        const restante = Math.max(0, item.quantidadePedida - jaRecebido);
                        const isCompleto = jaRecebido >= item.quantidadePedida;

                        return (
                          <TableRow key={item.itemId} className={isCompleto ? "opacity-50" : ""}>
                            <TableCell className="text-sm font-medium">{item.descricao}</TableCell>
                            <TableCell className="text-sm">{item.unidadeMedida}</TableCell>
                            <TableCell className="text-right text-sm">{item.quantidadePedida}</TableCell>
                            <TableCell className="text-right text-sm">{jaRecebido}</TableCell>
                            <TableCell className="text-right text-sm font-medium">{restante}</TableCell>
                            <TableCell>
                              {isCompleto ? (
                                <Badge variant="secondary" className="text-xs">Completo</Badge>
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  max={restante}
                                  value={item.quantidadeRecebida || ""}
                                  onChange={e => {
                                    const val = Math.min(Number(e.target.value), restante);
                                    setRecItens(prev => prev.map((it, i) => i === idx ? { ...it, quantidadeRecebida: val } : it));
                                  }}
                                  className="h-8 w-20"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {!isCompleto && (
                                <Textarea
                                  value={item.observacao}
                                  onChange={e => setRecItens(prev => prev.map((it, i) => i === idx ? { ...it, observacao: e.target.value } : it))}
                                  placeholder="Divergência..."
                                  className="text-xs min-h-[32px] resize-y"
                                  rows={1}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Anexo NF */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Anexar Nota Fiscal (PDF, Imagem)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    className="flex-1"
                    onChange={e => {
                      const files = e.target.files;
                      if (!files) return;
                      Array.from(files).forEach(file => {
                        if (file.size > 2 * 1024 * 1024) {
                          toast({ title: `Arquivo "${file.name}" excede 2MB`, variant: "destructive" });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setRecAnexos(prev => [...prev, {
                            nome: file.name,
                            tipo: file.type,
                            dados: reader.result as string,
                          }]);
                        };
                        reader.readAsDataURL(file);
                      });
                      e.target.value = "";
                    }}
                  />
                </div>
                {recAnexos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recAnexos.map((a, i) => (
                      <Badge key={i} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                        <FileText className="h-3 w-3" />
                        <span className="text-xs max-w-[150px] truncate">{a.nome}</span>
                        <button onClick={() => setRecAnexos(prev => prev.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Observação Geral</Label>
                <Textarea value={recObservacao} onChange={e => setRecObservacao(e.target.value)} placeholder="Observações sobre o recebimento..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegistrarRecebimento}>
              <PackageCheck className="mr-2 h-4 w-4" />Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes do Pedido */}
      <Dialog open={!!viewPedido} onOpenChange={() => setViewPedido(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>OC-{viewPedido && String(viewPedido.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>Detalhes do ordem de compra</DialogDescription>
          </DialogHeader>
          {viewPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">RC:</span> RCS-{String(viewPedido.requisicaoNumero).padStart(4, "0")}</div>
                <div><span className="text-muted-foreground">Fornecedor:</span> {viewPedido.fornecedorNome}</div>
                <div><span className="text-muted-foreground">Comprador:</span> {viewPedido.comprador}</div>
                <div><span className="text-muted-foreground">Data:</span> {format(new Date(viewPedido.dataCriacao), "dd/MM/yyyy")}</div>
                <div><span className="text-muted-foreground">Pagamento:</span> {viewPedido.condicaoPagamento || "-"}</div>
                <div><span className="text-muted-foreground">Prazo:</span> {viewPedido.prazoEntrega || "-"}</div>
                <div><span className="text-muted-foreground">Local:</span> {viewPedido.localEntrega || "-"}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[viewPedido.status]}>{viewPedido.status}</Badge></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-20">Qtd</TableHead>
                    <TableHead className="w-16">Un</TableHead>
                    <TableHead className="w-28">Preço Unit.</TableHead>
                    <TableHead className="w-28">Total</TableHead>
                    <TableHead className="w-24">Recebido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewPedido.itens.map(i => {
                    const recebido = getTotalRecebidoPorItem(viewPedido.id, i.itemId);
                    return (
                      <TableRow key={i.itemId}>
                        <TableCell>{i.descricao}</TableCell>
                        <TableCell>{i.quantidade}</TableCell>
                        <TableCell>{i.unidadeMedida}</TableCell>
                        <TableCell>{formatCurrency(i.precoUnitario)}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(i.valorTotal)}</TableCell>
                        <TableCell>
                          <span className={recebido >= i.quantidade ? "text-green-600 font-medium" : recebido > 0 ? "text-amber-600" : "text-muted-foreground"}>
                            {recebido}/{i.quantidade}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="text-right font-bold text-lg">Total: {formatCurrency(viewPedido.valorTotal)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico de Recebimentos */}
      <Dialog open={!!histPedidoId} onOpenChange={() => setHistPedidoId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Recebimentos</DialogTitle>
            <DialogDescription>
              OC-{histPedidoId && String(pedidos.find(p => p.id === histPedidoId)?.numero || 0).padStart(4, "0")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {recebimentosDoPedido.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum recebimento registrado.</p>
            ) : recebimentosDoPedido.map(r => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Badge variant={r.tipo === "Total" ? "default" : "secondary"}>{r.tipo}</Badge>
                      {r.notaFiscal && <span className="text-muted-foreground font-normal">NF: {r.notaFiscal}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {format(new Date(r.dataRecebimento), "dd/MM/yyyy HH:mm")} — {r.usuario}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24 text-right">Recebido</TableHead>
                        <TableHead>Obs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.itens.map(i => (
                        <TableRow key={i.itemId}>
                          <TableCell className="text-xs">{i.descricao}</TableCell>
                          <TableCell className="text-right text-xs">{i.quantidadeRecebida} {i.unidadeMedida}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{i.observacao || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {r.observacaoGeral && <p className="text-xs text-muted-foreground mt-2">Obs: {r.observacaoGeral}</p>}
                  {r.anexosNF && r.anexosNF.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.anexosNF.map((a, i) => (
                        <a
                          key={i}
                          href={a.dados}
                          download={a.nome}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" />{a.nome}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
