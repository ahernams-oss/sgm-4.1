import { useState, useMemo, useEffect } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useSearchParams } from "@/lib/router-compat";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { usePedidoCompra, PedidoCompra, StatusPedido } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePcAssinaturas } from "@/contexts/PcAssinaturasContext";
import { AssinaturaEletronicaPc } from "@/components/AssinaturaEletronicaPc";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Clock, ArrowRight, CheckSquare, FileDown, Mail, MessageCircle, Send, FilterX, Wallet, AlertTriangle } from "lucide-react";
import { gerarContasPagarDePC } from "@/lib/financeiroFromPC";
import { matchNumero } from "@/lib/matchNumero";
import { format } from "date-fns";
import { downloadPdfOrdemCompra, uploadPdfOrdemCompra } from "@/lib/gerarPdfOrdemCompra";
import { enviarPlugSend as enviarWhatsApp, enviarPlugSendComDocumento as enviarWhatsAppComDocumento } from "@/lib/plugsend";
import { notificarCompras, formatarPrioridade, formatarDataHora, formatarData, formatarPedido } from "@/lib/notificacoesCompras";
import { supabase } from "@/integrations/supabase/client";
import { enviarEmailCompras } from "@/lib/emailCompras";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import type { ReactNode } from "react";
import { usePermissao } from "@/hooks/usePermissao";

const statusColors: Record<StatusPedido, string> = {
  Emitido: "bg-blue-100 text-blue-800",
  Comprado: "bg-indigo-100 text-indigo-800",
  "Em Entrega": "bg-purple-100 text-purple-800",
  "Entregue Parcial": "bg-amber-100 text-amber-800",
  Entregue: "bg-green-100 text-green-800",
  Cancelado: "bg-red-200 text-red-900",
};

const statusFlow: StatusPedido[] = ["Emitido", "Comprado", "Em Entrega", "Entregue Parcial", "Entregue"];

/** Horas em que a OC está com status "Em Entrega" (null se não estiver). */
function horasEmEntrega(p: PedidoCompra): number | null {
  if (p.status !== "Em Entrega") return null;
  const entradas = (p.historicoStatus || []).filter(h => h.status === "Em Entrega" && h.dataHora);
  const base = entradas.length ? entradas[entradas.length - 1].dataHora : p.dataCriacao;
  const t = new Date(base).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 36e5;
}

function getNextStatuses(current: StatusPedido): StatusPedido[] {
  if (current === "Cancelado" || current === "Entregue") return [];
  const idx = statusFlow.indexOf(current);
  if (idx < 0) return [];
  return statusFlow.slice(idx + 1).filter(s => s !== "Entregue Parcial");
}

export default function PedidoCompraPage() {
  const { pedidos, updateStatus, cancelarPedido } = usePedidoCompra();
  const { requisicoes } = useRequisicaoCompras();
  const { materiais } = useMateriaisServicos();
  const { grupos, subGrupos, classes } = useCategoriasCompras();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();
  const { usuarioLogado } = useAuth();
  const { porPedido: assinaturasPorPedido } = usePcAssinaturas();
  const { tem } = usePermissao();
  const podeEditar = tem("pedidos_compra.editar");
  const podeCancelar = tem("pedidos_compra.cancelar");
  const podeStatusPC = (status: string) => {
    const map: Record<string, string> = {
      "Emitido": "pedidos_compra.status.emitido",
      "Comprado": "pedidos_compra.status.comprado",
      "Em Entrega": "pedidos_compra.status.em_entrega",
      "Entregue Parcial": "pedidos_compra.status.entregue_parcial",
      "Entregue": "pedidos_compra.status.entregue",
      "Cancelado": "pedidos_compra.status.cancelado",
    };
    return tem(map[status] || "");
  };
  const { toast } = useToast();

  const _pedSavedFilters = loadPersistedFilters<{ search: string; filterStatus: string; filterFornecedor: string; filterComprador: string; filterCentroCusto: string; filterCategoria: string; filterDataIni: string; filterDataFim: string; }>("pedido_compra_filters_v1");
  const [search, setSearch] = useState(_pedSavedFilters?.search ?? "");
  const [filterStatus, setFilterStatus] = useState(_pedSavedFilters?.filterStatus ?? "Todos");
  const [filterFornecedor, setFilterFornecedor] = useState(_pedSavedFilters?.filterFornecedor ?? "Todos");
  const [filterComprador, setFilterComprador] = useState(_pedSavedFilters?.filterComprador ?? "Todos");
  const [filterCentroCusto, setFilterCentroCusto] = useState(_pedSavedFilters?.filterCentroCusto ?? "Todos");
  const [filterCategoria, setFilterCategoria] = useState(_pedSavedFilters?.filterCategoria ?? "Todos");
  const [filterDataIni, setFilterDataIni] = useState(_pedSavedFilters?.filterDataIni ?? "");
  const [filterDataFim, setFilterDataFim] = useState(_pedSavedFilters?.filterDataFim ?? "");
  usePersistFilters("pedido_compra_filters_v1", { search, filterStatus, filterFornecedor, filterComprador, filterCentroCusto, filterCategoria, filterDataIni, filterDataFim });
  const [pagePed, setPagePed] = useState(1);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const numero = searchParams.get("numero");
    if (numero) {
      setSearch(numero);
      setFilterStatus("Todos");
      setFilterFornecedor("Todos");
      setFilterComprador("Todos");
      setFilterCentroCusto("Todos");
      setFilterDataIni("");
      setFilterDataFim("");
      setPagePed(1);
      const next = new URLSearchParams(searchParams);
      next.delete("numero");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [pageSize, setPageSize] = useState(7);
  const [viewPedido, setViewPedido] = useState<PedidoCompra | null>(null);
  const [historicoPedido, setHistoricoPedido] = useState<PedidoCompra | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusPedidoIds, setStatusPedidoIds] = useState<string[]>([]);
  const [newStatus, setNewStatus] = useState<StatusPedido | "">("");
  const [statusObs, setStatusObs] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const colDefs: Record<string, { label: string; className?: string }> = {
    numero: { label: "Nº Pedido", className: "text-center" },
    centroCusto: { label: "Centro de Custo" },
    rc: { label: "RC", className: "text-center" },
    data: { label: "Data", className: "text-center" },
    fornecedor: { label: "Fornecedor" },
    valorTotal: { label: "Valor Total", className: "text-center" },
    prazo: { label: "Prazo", className: "text-center" },
    status: { label: "Status", className: "text-center" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "compras.pedidos",
    ["numero", "centroCusto", "rc", "data", "fornecedor", "valorTotal", "prazo", "status"]
  );

  // Send dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendPedido, setSendPedido] = useState<PedidoCompra | null>(null);
  const [sendMethod, setSendMethod] = useState<"email" | "whatsapp" | "">("");
  const [sendEmail, setSendEmail] = useState("");
  const [sendPhone, setSendPhone] = useState("");
  const [sending, setSending] = useState(false);

  // Batch send state
  const [batchSendOpen, setBatchSendOpen] = useState(false);
  const [batchMethod, setBatchMethod] = useState<"email" | "whatsapp" | "">("");
  const [batchSending, setBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });

  const epiClasseIds = useMemo(() => {
    const epiGrupoIds = new Set(grupos.filter(g => /epi/i.test(g.nome)).map(g => g.id));
    const epiSubIds = new Set(subGrupos.filter(s => epiGrupoIds.has(s.grupoId)).map(s => s.id));
    return new Set(classes.filter(c => epiSubIds.has(c.subGrupoId)).map(c => c.id));
  }, [grupos, subGrupos, classes]);

  const filtered = useMemo(() => {
    let list = pedidos;
    if (filterStatus !== "Todos") list = list.filter(p => p.status === filterStatus);
    if (filterFornecedor !== "Todos") list = list.filter(p => p.fornecedorId === filterFornecedor);
    if (filterComprador !== "Todos") list = list.filter(p => p.comprador === filterComprador);
    if (filterCentroCusto !== "Todos") {
      list = list.filter(p => {
        const req = requisicoes.find(r => r.id === p.requisicaoId);
        return req?.centroCustoNome === filterCentroCusto;
      });
    }
    if (filterCategoria === "EPIs") {
      list = list.filter(p => p.itens.some(it => {
        const mat = materiais.find(m => m.id === it.itemId);
        return mat && epiClasseIds.has(mat.categoriaId);
      }));
    }
    if (filterDataIni) list = list.filter(p => p.dataCriacao >= filterDataIni);
    if (filterDataFim) list = list.filter(p => p.dataCriacao <= filterDataFim + "T23:59:59");
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => matchNumero(p.numero, s) || p.fornecedorNome.toLowerCase().includes(s) || p.comprador.toLowerCase().includes(s) || matchNumero(p.requisicaoNumero, s));
    }

    return list.sort((a, b) => b.numero - a.numero);
  }, [pedidos, requisicoes, materiais, epiClasseIds, search, filterStatus, filterFornecedor, filterComprador, filterCentroCusto, filterCategoria, filterDataIni, filterDataFim]);

  const fornecedoresUnicos = useMemo(() => {
    const map = new Map<string, string>();
    pedidos.forEach(p => { if (p.fornecedorId) map.set(p.fornecedorId, p.fornecedorNome); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [pedidos]);
  const compradoresUnicos = useMemo(() =>
    Array.from(new Set(pedidos.map(p => p.comprador).filter(Boolean))).sort(),
    [pedidos]
  );
  const centrosCustoUnicos = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach(p => {
      const req = requisicoes.find(r => r.id === p.requisicaoId);
      if (req?.centroCustoNome) set.add(req.centroCustoNome);
    });
    return Array.from(set).sort();
  }, [pedidos, requisicoes]);
  const hasActiveFilters = search !== "" || filterStatus !== "Todos" || filterFornecedor !== "Todos" || filterComprador !== "Todos" || filterCentroCusto !== "Todos" || filterCategoria !== "Todos" || filterDataIni !== "" || filterDataFim !== "";
  const clearFilters = () => {
    setSearch(""); setFilterStatus("Todos"); setFilterFornecedor("Todos");
    setFilterComprador("Todos"); setFilterCentroCusto("Todos"); setFilterCategoria("Todos"); setFilterDataIni(""); setFilterDataFim("");
  };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getFornecedor = (fornecedorId: string) => clientes.find(c => c.id === fornecedorId) || null;

  const handleDownloadPdf = async (pedido: PedidoCompra) => {
    const assinatura = assinaturasPorPedido(pedido.id).find(a => a.papel === "aprovador") || null;
    await downloadPdfOrdemCompra({
      pedido,
      empresa: empresa.id ? empresa : null,
      fornecedor: getFornecedor(pedido.fornecedorId),
      autorizadoPor: usuarioLogado?.nome || "Usuário",
      assinatura,
    });
    toast({ title: "PDF da Ordem de Compra baixado com sucesso" });
  };

  const openSendDialog = (pedido: PedidoCompra) => {
    const fornecedor = getFornecedor(pedido.fornecedorId);
    setSendPedido(pedido);
    setSendEmail(fornecedor?.email || fornecedor?.emailCompras || "");
    setSendPhone(fornecedor?.telefoneCelular || fornecedor?.telefonesWhatsapp || "");
    setSendMethod("");
    setSendDialogOpen(true);
  };

  const handleSend = async () => {
    if (!sendPedido) return;
    setSending(true);

    const assinatura = assinaturasPorPedido(sendPedido.id).find(a => a.papel === "aprovador") || null;
    const pdfData = {
      pedido: sendPedido,
      empresa: empresa.id ? empresa : null,
      fornecedor: getFornecedor(sendPedido.fornecedorId),
      autorizadoPor: usuarioLogado?.nome || "Usuário",
      assinatura,
    };

    try {
      // Upload PDF to storage and get public URL
      const pdfUrl = await uploadPdfOrdemCompra(pdfData);
      const pcNum = `OC-${String(sendPedido.numero).padStart(4, "0")}`;

      if (sendMethod === "email") {
        if (!sendEmail.trim()) {
          toast({ title: "Informe o e-mail do fornecedor", variant: "destructive" });
          setSending(false);
          return;
        }
        const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || "SGM";

        const { error } = await enviarEmailCompras({
          body: {
            templateName: "ordem-compra-confirmation",
            recipientEmail: sendEmail,
            idempotencyKey: `ordem-compra-${sendPedido.id}-${Date.now()}`,
            templateData: {
              fornecedorNome: sendPedido.fornecedorNome,
              pedidoNumero: sendPedido.numero,
              valorTotal: formatCurrency(sendPedido.valorTotal),
              condicaoPagamento: sendPedido.condicaoPagamento || "A vista",
              prazoEntrega: sendPedido.prazoEntrega || "A combinar",
              comprador: usuarioLogado?.nome || "Departamento de Compras",
              nomeEmpresa,
              pdfUrl,
            },
          },
        });

        if (error) throw new Error(error.message);
        toast({ title: `Ordem de compra enviada por e-mail para ${sendEmail}` });
      } else if (sendMethod === "whatsapp") {
        if (!sendPhone.trim()) {
          toast({ title: "Informe o telefone do fornecedor", variant: "destructive" });
          setSending(false);
          return;
        }

        const mensagem = `*Ordem de Compra ${pcNum}*\n\n` +
          `Fornecedor: ${sendPedido.fornecedorNome}\n` +
          `Valor Total: ${formatCurrency(sendPedido.valorTotal)}\n` +
          `Prazo de Entrega: ${sendPedido.prazoEntrega || "A combinar"}\n` +
          `Condição de Pagamento: ${sendPedido.condicaoPagamento || "A vista"}`;

        const result = await enviarWhatsAppComDocumento({
          telefone: sendPhone,
          mensagem,
          documentUrl: pdfUrl,
          documentFilename: `Ordem_Compra_${pcNum}.pdf`,
        });
        if (!result.success) throw new Error(result.error || "Erro ao enviar WhatsApp");
        toast({ title: `Ordem de compra enviada via WhatsApp para ${sendPhone}` });
      }
      setSendDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: `Erro ao enviar: ${msg}`, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const openStatusDialog = (pedidoOrIds: PedidoCompra | string[]) => {
    const ids = Array.isArray(pedidoOrIds) ? pedidoOrIds : [pedidoOrIds.id];
    setStatusPedidoIds(ids);
    setNewStatus("");
    setStatusObs("");
    setStatusDialogOpen(true);
  };

  const commonNextStatuses = useMemo(() => {
    if (statusPedidoIds.length === 0) return [];
    const sets = statusPedidoIds.map(id => {
      const p = pedidos.find(x => x.id === id);
      return p ? getNextStatuses(p.status) : [];
    });
    const first = new Set(sets[0] || []);
    for (let i = 1; i < sets.length; i++) {
      const s = new Set(sets[i]);
      first.forEach(v => { if (!s.has(v)) first.delete(v); });
    }
    return Array.from(first);
  }, [statusPedidoIds, pedidos]);

  const handleUpdateStatus = () => {
    if (!newStatus) { toast({ title: "Selecione um status", variant: "destructive" }); return; }
    if (!podeStatusPC(newStatus)) {
      toast({ title: `Você não possui permissão para alterar o pedido para "${newStatus}".`, variant: "destructive" });
      return;
    }
    if (newStatus === "Cancelado") {
      if (!podeCancelar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
      if (!statusObs.trim()) { toast({ title: "Motivo é obrigatório para cancelamento", variant: "destructive" }); return; }
      statusPedidoIds.forEach(id => cancelarPedido(id, usuarioLogado?.nome || "Usuário", statusObs));
    } else {
      if (!podeEditar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
      statusPedidoIds.forEach(id => updateStatus(id, newStatus, usuarioLogado?.nome || "Usuário", statusObs));
    }
    // Notifica cliente via WhatsApp sobre a mudança de status
    if (newStatus !== "Cancelado") {
      const statusLabelMap: Record<string, string> = {
        "Comprado": "COMPRADO",
        "Em Entrega": "EM ENTREGA",
        "Entregue Parcial": "ENTREGUE PARCIAL",
        "Entregue": "ENTREGUE",
      };
      const label = statusLabelMap[newStatus] || String(newStatus).toUpperCase();
      statusPedidoIds.forEach(id => {
        const ped = pedidos.find(p => p.id === id);
        if (!ped) return;
        const req = requisicoes.find(r => r.id === ped.requisicaoId);
        if (!req) return;
        const cli = clientes.find(c => c.id === req.centroCusto);
        if (!cli?.grupoWhatsapp) return;
        notificarCompras({
          jid: cli.grupoWhatsapp,
          clienteNome: cli.nome,
          pedido: formatarPedido(req.numero, req.dataCriacao),
          statusLabel: label,
          dataSolicitacao: formatarDataHora(req.dataCriacao),
          dataExtraLabel: `Data ${label.toLowerCase()}`,
          dataExtraValor: formatarDataHora(new Date().toISOString()),
          solicitante: req.solicitante,
          prioridade: formatarPrioridade(req.urgencia),
          obs: statusObs || req.justificativa,
          entregaPrevista: ped.prazoEntrega || (req.prazoDesejado ? formatarData(req.prazoDesejado) : undefined),
        });
      });
    }
    toast({ title: `Status atualizado para: ${newStatus} (${statusPedidoIds.length} pedido${statusPedidoIds.length > 1 ? "s" : ""})` });
    setStatusDialogOpen(false);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectableFiltered = filtered;
  const allSelectableSelected = selectableFiltered.length > 0 && selectableFiltered.every(p => selectedIds.includes(p.id));
  const toggleSelectAll = () => {
    if (allSelectableSelected) setSelectedIds([]);
    else setSelectedIds(selectableFiltered.map(p => p.id));
  };

  const selectedCanUpdate = selectedIds.some(id => {
    const p = pedidos.find(x => x.id === id);
    return p ? getNextStatuses(p.status).length > 0 : false;
  });

  const handlePrintSelected = async () => {
    const lista = pedidos.filter(p => selectedIds.includes(p.id));
    if (lista.length === 0) return;
    toast({ title: `Gerando ${lista.length} PDF${lista.length > 1 ? "s" : ""}...` });
    for (const p of lista) {
      const assinatura = assinaturasPorPedido(p.id).find(a => a.papel === "aprovador") || null;
      await downloadPdfOrdemCompra({
        pedido: p,
        empresa: empresa.id ? empresa : null,
        fornecedor: getFornecedor(p.fornecedorId),
        autorizadoPor: usuarioLogado?.nome || "Usuário",
        assinatura,
      });
    }
    toast({ title: `${lista.length} PDF${lista.length > 1 ? "s gerados" : " gerado"} com sucesso` });
  };

  const handleBatchSend = async () => {
    if (!batchMethod) { toast({ title: "Selecione o método de envio", variant: "destructive" }); return; }
    const lista = pedidos.filter(p => selectedIds.includes(p.id));
    if (lista.length === 0) return;
    setBatchSending(true);
    setBatchProgress({ done: 0, total: lista.length, ok: 0, fail: 0 });
    const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || "SGM";
    let ok = 0, fail = 0;
    const erros: string[] = [];
    for (const p of lista) {
      try {
        const fornecedor = getFornecedor(p.fornecedorId);
        const assinatura = assinaturasPorPedido(p.id).find(a => a.papel === "aprovador") || null;
        const pdfUrl = await uploadPdfOrdemCompra({
          pedido: p,
          empresa: empresa.id ? empresa : null,
          fornecedor,
          autorizadoPor: usuarioLogado?.nome || "Usuário",
          assinatura,
        });
        const pcNum = `OC-${String(p.numero).padStart(4, "0")}`;
        if (batchMethod === "email") {
          const email = fornecedor?.email || fornecedor?.emailCompras || "";
          if (!email) throw new Error(`${pcNum}: fornecedor sem e-mail`);
          const { error } = await enviarEmailCompras({
            body: {
              templateName: "ordem-compra-confirmation",
              recipientEmail: email,
              idempotencyKey: `ordem-compra-${p.id}-${Date.now()}`,
              templateData: {
                fornecedorNome: p.fornecedorNome,
                pedidoNumero: p.numero,
                valorTotal: formatCurrency(p.valorTotal),
                condicaoPagamento: p.condicaoPagamento || "A vista",
                prazoEntrega: p.prazoEntrega || "A combinar",
                comprador: usuarioLogado?.nome || "Departamento de Compras",
                nomeEmpresa,
                pdfUrl,
              },
            },
          });
          if (error) throw new Error(error.message);
        } else {
          const phone = fornecedor?.telefoneCelular || fornecedor?.telefonesWhatsapp || "";
          if (!phone) throw new Error(`${pcNum}: fornecedor sem WhatsApp`);
          const mensagem = `*Ordem de Compra ${pcNum}*\n\n` +
            `Fornecedor: ${p.fornecedorNome}\n` +
            `Valor Total: ${formatCurrency(p.valorTotal)}\n` +
            `Prazo de Entrega: ${p.prazoEntrega || "A combinar"}\n` +
            `Condição de Pagamento: ${p.condicaoPagamento || "A vista"}`;
          const result = await enviarWhatsAppComDocumento({
            telefone: phone,
            mensagem,
            documentUrl: pdfUrl,
            documentFilename: `Ordem_Compra_${pcNum}.pdf`,
          });
          if (!result.success) throw new Error(`${pcNum}: ${result.error || "falha WhatsApp"}`);
        }
        ok++;
      } catch (err: unknown) {
        fail++;
        erros.push(err instanceof Error ? err.message : "erro desconhecido");
      } finally {
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1, ok, fail }));
      }
    }
    setBatchSending(false);
    toast({
      title: `Envio em lote concluído: ${ok} sucesso, ${fail} falha${fail !== 1 ? "s" : ""}`,
      description: erros.length ? erros.slice(0, 3).join(" | ") : undefined,
      variant: fail > 0 ? "destructive" : "default",
    });
    if (fail === 0) {
      setBatchSendOpen(false);
      setSelectedIds([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Ordens de Compra</h1>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nº, fornecedor, comprador..." value={search} onChange={e => { setSearch(e.target.value); setPagePed(1); }} className="pl-9" />
          </div>
        </div>
        <div className="w-56">
          <Label className="text-xs">Centro de Custo</Label>
          <Select value={filterCentroCusto} onValueChange={v => { setFilterCentroCusto(v); setPagePed(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {centrosCustoUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPagePed(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os Status</SelectItem>
              {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-52">
          <Label className="text-xs">Fornecedor</Label>
          <Select value={filterFornecedor} onValueChange={v => { setFilterFornecedor(v); setPagePed(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {fornecedoresUnicos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label className="text-xs">Categoria</Label>
          <Select value={filterCategoria} onValueChange={v => { setFilterCategoria(v); setPagePed(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todas</SelectItem>
              <SelectItem value="EPIs">EPIs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs">Data inicial</Label>
          <Input type="date" value={filterDataIni} onChange={e => { setFilterDataIni(e.target.value); setPagePed(1); }} />
        </div>
        <div className="w-40">
          <Label className="text-xs">Data final</Label>
          <Input type="date" value={filterDataFim} onChange={e => { setFilterDataFim(e.target.value); setPagePed(1); }} />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <FilterX className="mr-1 h-4 w-4" />Limpar
          </Button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 flex-wrap">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selectedIds.length} pedido{selectedIds.length > 1 ? "s" : ""} selecionado{selectedIds.length > 1 ? "s" : ""}</span>
          <Button size="sm" variant="outline" onClick={handlePrintSelected}>
            <FileDown className="h-4 w-4 mr-1" /> Imprimir PDFs
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setBatchMethod(""); setBatchProgress({ done: 0, total: 0, ok: 0, fail: 0 }); setBatchSendOpen(true); }}>
            <Send className="h-4 w-4 mr-1" /> Enviar em Lote
          </Button>
          {selectedCanUpdate && podeEditar && (
            <Button size="sm" onClick={() => openStatusDialog(selectedIds.filter(id => {
              const p = pedidos.find(x => x.id === id);
              return p ? getNextStatuses(p.status).length > 0 : false;
            }))}>
              <ArrowRight className="h-4 w-4 mr-1" /> Atualizar Status em Lote
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Limpar Seleção</Button>
        </div>
      )}

      <div className="border rounded-lg">
        <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelectableSelected && selectableFiltered.length > 0} onCheckedChange={toggleSelectAll} />
              </TableHead>
              {colOrder.map(key => {
                const cd = colDefs[key];
                return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
              })}
              <TableHead className="w-48">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colOrder.length + 2} className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</TableCell></TableRow>
            ) : paginate(filtered, pagePed, pageSize).paginated.map((p, idx) => {
              const rcVinculada = requisicoes.find(r => r.id === p.requisicaoId);
              const canUpdate = getNextStatuses(p.status).length > 0;
              const hEntrega = horasEmEntrega(p);
              const atrasoEntrega = hEntrega !== null && hEntrega >= 48;
              const atrasoTitle = atrasoEntrega
                ? `Em Entrega há ${Math.floor(hEntrega!)}h sem baixa para Entregue`
                : undefined;
              const cellMap: Record<string, ReactNode> = {
                numero: (
                  <span className="flex items-center justify-center gap-1">
                    {atrasoEntrega && <AlertTriangle className="h-4 w-4 text-red-600 animate-blink-urgent" aria-label="entrega atrasada" />}
                    <a href={`/compras/pedidos?numero=${p.numero}`} title={atrasoTitle} className="font-mono font-bold text-primary hover:underline">OC-{String(p.numero).padStart(4, "0")}</a>
                  </span>
                ),
                centroCusto: <span className="text-sm">{rcVinculada?.centroCustoNome || "-"}</span>,
                rc: <a href={`/compras/requisicoes?numero=${p.requisicaoNumero}`} className="font-mono text-primary hover:underline">RCS-{String(p.requisicaoNumero).padStart(4, "0")}</a>,
                data: format(new Date(p.dataCriacao), "dd/MM/yyyy"),
                fornecedor: p.fornecedorNome,
                valorTotal: <span className="font-medium">{formatCurrency(p.valorTotal)}</span>,
                prazo: p.prazoEntrega || "-",
                status: <Badge title={atrasoTitle} className={`${statusColors[p.status]} ${atrasoEntrega ? "animate-blink-urgent" : ""}`}>{p.status}</Badge>,
              };
              return (
                <TableRow key={p.id} className={selectedIds.includes(p.id) ? "bg-primary/5" : (idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60")}>
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                  </TableCell>
                  {colOrder.map(key => <TableCell key={key} className={colDefs[key]?.className}>{cellMap[key]}</TableCell>)}
                  <TableCell>
                    {(() => {
                      const assinatura = assinaturasPorPedido(p.id).find(a => a.papel === "aprovador");
                      return (
                        <div className="flex gap-1 items-center">
                          <Button variant="ghost" size="icon" title="Detalhes" onClick={() => setViewPedido(p)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Histórico" onClick={() => setHistoricoPedido(p)}><Clock className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Baixar PDF" onClick={() => handleDownloadPdf(p)}><FileDown className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Enviar ao Fornecedor" onClick={() => openSendDialog(p)}><Send className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" title="Gerar Financeiro (Contas a Pagar)" onClick={() => gerarContasPagarDePC(p)}><Wallet className="h-4 w-4" /></Button>
                          {assinatura ? (
                            <span title={`Assinado por ${assinatura.signatario_nome} em ${format(new Date(assinatura.signed_at), "dd/MM/yyyy HH:mm")}`}>
                              <ShieldCheck className="h-4 w-4 text-green-600" />
                            </span>
                          ) : (
                            <AssinaturaEletronicaPc pedido={p} variant="ghost" size="icon" label="" />
                          )}
                          {canUpdate && podeEditar && (
                            <Button variant="ghost" size="icon" title="Atualizar Status" onClick={() => openStatusDialog(p)}><ArrowRight className="h-4 w-4" /></Button>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {filtered.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={colOrder.length + 2} className="bg-muted/50">
                  <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Total de pedidos: <span className="font-semibold text-foreground">{filtered.length}</span></span>
                    <span className="text-muted-foreground">Soma valor total: <span className="font-bold text-foreground">{formatCurrency(filtered.reduce((s, p) => s + (p.valorTotal || 0), 0))}</span></span>
                    {selectedIds.length > 0 && (
                      <span className="text-muted-foreground">Selecionados: <span className="font-semibold text-foreground">{selectedIds.length}</span> — <span className="font-bold text-foreground">{formatCurrency(filtered.filter(p => selectedIds.includes(p.id)).reduce((s, p) => s + (p.valorTotal || 0), 0))}</span></span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
        </SortableHeaderRow>
      </div>
      <PaginationControls currentPage={pagePed} totalItems={filtered.length} onPageChange={setPagePed} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPagePed(1); }} />

      {/* Dialog Detalhes */}
      <Dialog open={!!viewPedido} onOpenChange={() => setViewPedido(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>OC-{viewPedido && String(viewPedido.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>Detalhes do ordem de compra</DialogDescription>
          </DialogHeader>
          {viewPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">RCS Vinculada:</span> RCS-{String(viewPedido.requisicaoNumero).padStart(4, "0")}</div>
                <div><span className="text-muted-foreground">Fornecedor:</span> {viewPedido.fornecedorNome}</div>
                <div><span className="text-muted-foreground">Comprador:</span> {viewPedido.comprador}</div>
                <div><span className="text-muted-foreground">Data:</span> {format(new Date(viewPedido.dataCriacao), "dd/MM/yyyy HH:mm")}</div>
                <div><span className="text-muted-foreground">Pagamento:</span> {viewPedido.condicaoPagamento || "-"}</div>
                <div><span className="text-muted-foreground">Prazo:</span> {viewPedido.prazoEntrega || "-"}</div>
                <div><span className="text-muted-foreground">Local Entrega:</span> {viewPedido.localEntrega || "-"}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[viewPedido.status]}>{viewPedido.status}</Badge></div>
              </div>

              <h3 className="font-semibold mt-4">Itens</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-20">Qtd</TableHead>
                    <TableHead className="w-16">Un</TableHead>
                    <TableHead className="w-28">Preço Unit.</TableHead>
                    <TableHead className="w-28">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewPedido.itens.map(i => (
                    <TableRow key={i.itemId}>
                      <TableCell>{i.descricao}</TableCell>
                      <TableCell>{i.quantidade}</TableCell>
                      <TableCell>{i.unidadeMedida}</TableCell>
                      <TableCell>{formatCurrency(i.precoUnitario)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(i.valorTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right font-bold text-lg">Total: {formatCurrency(viewPedido.valorTotal)}</div>

              {viewPedido.observacoes && <div><span className="text-muted-foreground text-sm">Observações:</span><p className="text-sm">{viewPedido.observacoes}</p></div>}

              {(() => {
                const a = assinaturasPorPedido(viewPedido.id).find(x => x.papel === "aprovador");
                if (!a) return null;
                return (
                  <div className="border-2 border-primary/30 bg-primary/5 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Aprovador — Assinado Eletronicamente
                    </div>
                    <p><strong>Signatário:</strong> {a.signatario_nome}</p>
                    {a.signatario_cargo && <p><strong>Cargo:</strong> {a.signatario_cargo}</p>}
                    {a.signatario_matricula && <p><strong>Matrícula:</strong> {a.signatario_matricula}</p>}
                    <p><strong>Data/Hora:</strong> {format(new Date(a.signed_at), "dd/MM/yyyy HH:mm")}</p>
                    {a.ip_origem && <p><strong>IP:</strong> {a.ip_origem}</p>}
                    <p className="text-xs"><strong>Código:</strong> <code className="bg-muted px-1 rounded">{a.codigo_verificador}</code></p>
                    <p className="text-xs italic text-muted-foreground">{a.base_legal}</p>
                  </div>
                );
              })()}

              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button onClick={() => handleDownloadPdf(viewPedido)} variant="outline">
                  <FileDown className="h-4 w-4 mr-2" /> Baixar PDF
                </Button>
                <Button onClick={() => { setViewPedido(null); openSendDialog(viewPedido); }}>
                  <Send className="h-4 w-4 mr-2" /> Enviar ao Fornecedor
                </Button>
                {!assinaturasPorPedido(viewPedido.id).find(x => x.papel === "aprovador") && (
                  <AssinaturaEletronicaPc pedido={viewPedido} fullLabel size="default" />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico */}
      <Dialog open={!!historicoPedido} onOpenChange={() => setHistoricoPedido(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico — OC-{historicoPedido && String(historicoPedido.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>Linha do tempo do pedido</DialogDescription>
          </DialogHeader>
          {historicoPedido && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historicoPedido.historicoStatus.map((h, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[h.status] || ""} variant="secondary">{h.status}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(h.dataHora), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.usuario}</p>
                    {h.observacao && <p className="text-sm mt-0.5">{h.observacao}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Atualizar Status */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Status {statusPedidoIds.length > 1 ? `(${statusPedidoIds.length} pedidos)` : "do Pedido"}</DialogTitle>
            <DialogDescription>Selecione o novo status e adicione observações se necessário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Novo Status *</Label>
              <Select value={newStatus} onValueChange={v => setNewStatus(v as StatusPedido)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {commonNextStatuses.filter(s => podeStatusPC(s)).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação {newStatus === "Cancelado" ? "*" : ""}</Label>
              <Textarea value={statusObs} onChange={e => setStatusObs(e.target.value)} placeholder="Observações sobre a mudança de status..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateStatus}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Enviar Ordem de Compra */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Ordem de Compra</DialogTitle>
            <DialogDescription>
              {sendPedido && `OC-${String(sendPedido.numero).padStart(4, "0")} — ${sendPedido.fornecedorNome}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Método de Envio *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Button
                  variant={sendMethod === "email" ? "default" : "outline"}
                  className="h-20 flex flex-col gap-2"
                  onClick={() => setSendMethod("email")}
                >
                  <Mail className="h-6 w-6" />
                  <span>E-mail</span>
                </Button>
                <Button
                  variant={sendMethod === "whatsapp" ? "default" : "outline"}
                  className="h-20 flex flex-col gap-2"
                  onClick={() => setSendMethod("whatsapp")}
                >
                  <MessageCircle className="h-6 w-6" />
                  <span>WhatsApp</span>
                </Button>
              </div>
            </div>

            {sendMethod === "email" && (
              <div>
                <Label>E-mail do Fornecedor *</Label>
                <Input
                  type="email"
                  value={sendEmail}
                  onChange={e => setSendEmail(e.target.value)}
                  placeholder="fornecedor@email.com"
                />
              </div>
            )}

            {sendMethod === "whatsapp" && (
              <div>
                <Label>Telefone WhatsApp do Fornecedor *</Label>
                <Input
                  value={sendPhone}
                  onChange={e => setSendPhone(e.target.value)}
                  placeholder="+55 21 99999-9999"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O PDF será baixado automaticamente para você anexar na conversa.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={!sendMethod || sending}>
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Enviar em Lote */}
      <Dialog open={batchSendOpen} onOpenChange={(o) => { if (!batchSending) setBatchSendOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Pedidos em Lote</DialogTitle>
            <DialogDescription>
              {selectedIds.length} pedido{selectedIds.length > 1 ? "s" : ""} selecionado{selectedIds.length > 1 ? "s" : ""}. Cada pedido será enviado ao seu respectivo fornecedor cadastrado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Método de Envio *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Button
                  type="button"
                  variant={batchMethod === "email" ? "default" : "outline"}
                  className="h-20 flex flex-col gap-2"
                  onClick={() => setBatchMethod("email")}
                  disabled={batchSending}
                >
                  <Mail className="h-6 w-6" />
                  <span>E-mail</span>
                </Button>
                <Button
                  type="button"
                  variant={batchMethod === "whatsapp" ? "default" : "outline"}
                  className="h-20 flex flex-col gap-2"
                  onClick={() => setBatchMethod("whatsapp")}
                  disabled={batchSending}
                >
                  <MessageCircle className="h-6 w-6" />
                  <span>WhatsApp</span>
                </Button>
              </div>
            </div>
            {batchMethod && (() => {
              const lista = pedidos.filter(p => selectedIds.includes(p.id));
              const semContato = lista.filter(p => {
                const f = getFornecedor(p.fornecedorId);
                if (batchMethod === "email") return !(f?.email || f?.emailCompras);
                return !(f?.telefoneCelular || f?.telefonesWhatsapp);
              });
              return semContato.length > 0 ? (
                <div className="text-xs p-2 rounded border border-amber-300 bg-amber-50 text-amber-900">
                  ⚠ {semContato.length} fornecedor{semContato.length > 1 ? "es" : ""} sem {batchMethod === "email" ? "e-mail" : "WhatsApp"} cadastrado. Esses pedidos falharão.
                </div>
              ) : null;
            })()}
            {batchProgress.total > 0 && (
              <div className="text-sm space-y-1">
                <div>Progresso: {batchProgress.done} / {batchProgress.total}</div>
                <div className="text-xs text-muted-foreground">✓ {batchProgress.ok} sucesso · ✗ {batchProgress.fail} falha{batchProgress.fail !== 1 ? "s" : ""}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchSendOpen(false)} disabled={batchSending}>Fechar</Button>
            <Button onClick={handleBatchSend} disabled={!batchMethod || batchSending}>
              {batchSending ? `Enviando ${batchProgress.done}/${batchProgress.total}...` : `Enviar ${selectedIds.length} pedido${selectedIds.length > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
