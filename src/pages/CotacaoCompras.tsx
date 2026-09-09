import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useCotacaoCompras, CotacaoCompras, PropostaFornecedor, ItemCotacaoFornecedor, ItemVencedor } from "@/contexts/CotacaoComprasContext";
import { useRequisicaoCompras, RequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { usePedidoCompra, PedidoCompra } from "@/contexts/PedidoCompraContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLimiteAprovacao } from "@/hooks/useLimiteAprovacao";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { enviarEmailCompras } from "@/lib/emailCompras";
import { useCargos } from "@/contexts/CargosContext";
import { usePcAssinaturas } from "@/contexts/PcAssinaturasContext";
import { gerarHashPc } from "@/lib/assinaturaHashPc";
import { matchNumero } from "@/lib/matchNumero";
import { obterIpOrigem } from "@/lib/assinaturaHashOs";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissao } from "@/hooks/usePermissao";
import { Plus, Search, Eye, Trophy, XCircle, BarChart3, Trash2, MoreHorizontal, FilterX, Send, Copy, Link2, RefreshCw, CheckCircle2, Lock, ShieldCheck, Pencil, Mail, FileDown, FileText, CheckSquare, MessageCircle, AlertTriangle, Sparkles, Upload } from "lucide-react";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { notificarCompras, formatarPrioridade, formatarDataHora, formatarData, formatarPedido } from "@/lib/notificacoesCompras";
import { notificarPedidoGrupo } from "@/lib/notificacaoPedidoCompra";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadPdfCotacao } from "@/lib/gerarPdfCotacao";
import { downloadPdfPedidoCotacaoTodos, gerarBlobPedidoCotacao } from "@/lib/gerarPdfPedidoCotacao";
import { Switch } from "@/components/ui/switch";
import { format, subDays, isAfter } from "date-fns";
import ConfirmacaoValoresDialog, { AjusteConfirmacao, AlternativaFornecedor, ItemConfirmacao, MetaConfirmacao } from "@/components/compras/ConfirmacaoValoresDialog";
import { LIMITE_ALCADA_PERCENTUAL, calcularDiasAtraso, calcularImpactoAtraso } from "@/lib/alcadaReajuste";
import { useConfirmacoesValores } from "@/hooks/useConfirmacoesValores";

interface GrupoEmissao {
  fornecedorId: string;
  fornecedorNome: string;
  condicaoPagamento: string;
  prazoEntrega: string;
  itens: { itemId: string; descricao: string; quantidade: number; unidadeMedida: string; precoUnitario: number }[];
}

interface PlanoEmissao {
  cotacaoId: string;
  requisicaoId: string;
  requisicaoNumero: number;
  localEntrega: string;
  justificativa: string;
  itemizado: boolean;
  itensVencedores?: ItemVencedor[];
  principalFornecedorId: string;
  grupos: GrupoEmissao[];
  dataAprovacao?: string;
  /** Todas as propostas da cotação — base para redirecionar itens a outro fornecedor. */
  propostas?: GrupoEmissao[];
}

const statusColors: Record<string, string> = {
  "Em Andamento": "bg-yellow-100 text-yellow-800",
  "Aguardando Aprovação": "bg-blue-100 text-blue-800",
  "Revisão de Confirmação": "bg-orange-100 text-orange-800",
  Finalizada: "bg-green-100 text-green-800",
  Cancelada: "bg-red-200 text-red-900",
};

export default function CotacaoComprasPage() {
  const { cotacoes, addCotacao, addProposta, updateProposta, removeProposta, submeterAprovacao, aprovarCotacao, finalizarCotacao, concluirRevisaoConfirmacao, cancelarCotacao } = useCotacaoCompras();
  const { requisicoes, updateStatus } = useRequisicaoCompras();
  const { addPedido, pedidos } = usePedidoCompra();
  const { clientes } = useClientes();
  const { usuarioLogado } = useAuth();
  const { podeAprovar } = useLimiteAprovacao();
  const { empresa } = useEmpresa();
  const { cargos } = useCargos();
  const { registrar: registrarAssinaturaPc } = usePcAssinaturas();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriarCot = tem("cotacoes.criar");
  const podeFinalizarCot = tem("cotacoes.status.finalizada");

  const assinarPedidoAutomatico = useCallback(async (pedido: PedidoCompra) => {
    if (!usuarioLogado) return;
    try {
      const hash = await gerarHashPc(pedido);
      const ip = await obterIpOrigem();
      const cargo = cargos.find((c) => c.id === usuarioLogado.cargoId);
      await registrarAssinaturaPc({
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
    } catch (e) {
      console.error("Falha ao assinar pedido automaticamente:", e);
    }
  }, [usuarioLogado, cargos, registrarAssinaturaPc]);

  const notificarPedidoNoGrupo = useCallback(async (pedido: PedidoCompra, reqId: string) => {
    const r = requisicoes.find(x => x.id === reqId);
    const cli = r ? clientes.find(c => c.id === r.centroCusto) : null;
    if (!cli?.grupoWhatsapp) return;
    await notificarPedidoGrupo({
      jid: cli.grupoWhatsapp,
      clienteNome: cli.nome,
      pedido,
      empresa,
      fornecedor: clientes.find(c => c.id === pedido.fornecedorId) || null,
      autorizadoPor: usuarioLogado?.nome || "",
    });
  }, [requisicoes, clientes, empresa, usuarioLogado]);

  const fornecedores = useMemo(() => clientes.filter(c => c.tipo === "Fornecedor"), [clientes]);
  const reqDisponiveisParaCotacao = useMemo(() => requisicoes.filter(r => r.status === "Enviada" || r.status === "Em Cotação"), [requisicoes]);

  const _cotSavedFilters = loadPersistedFilters<{ search: string; filterStatus: string; filterPeriodo: string; filterComprador: string; filterCentroCusto: string; filterUrgencia: string; filterDataIni: string; filterDataFim: string; }>("cotacao_compras_filters_v1");
  const [search, setSearch] = useState(_cotSavedFilters?.search ?? "");
  const [filterStatus, setFilterStatus] = useState(_cotSavedFilters?.filterStatus ?? "Todos");
  const [filterPeriodo, setFilterPeriodo] = useState(_cotSavedFilters?.filterPeriodo ?? "Todos");
  const [filterComprador, setFilterComprador] = useState(_cotSavedFilters?.filterComprador ?? "Todos");
  const [filterCentroCusto, setFilterCentroCusto] = useState(_cotSavedFilters?.filterCentroCusto ?? "Todos");
  const [filterUrgencia, setFilterUrgencia] = useState(_cotSavedFilters?.filterUrgencia ?? "Todas");
  const [filterDataIni, setFilterDataIni] = useState(_cotSavedFilters?.filterDataIni ?? "");
  const [filterDataFim, setFilterDataFim] = useState(_cotSavedFilters?.filterDataFim ?? "");
  usePersistFilters("cotacao_compras_filters_v1", { search, filterStatus, filterPeriodo, filterComprador, filterCentroCusto, filterUrgencia, filterDataIni, filterDataFim });
  const [pageCot, setPageCot] = useState(1);
  const [pageSizeCot, setPageSizeCot] = useState(7);

  const colDefs: Record<string, { label: string; className?: string }> = {
    numero: { label: "Nº Cotação", className: "text-center" },
    centroCusto: { label: "Centro de Custo" },
    urgencia: { label: "Urgência", className: "text-center" },
    rcs: { label: "RCS Vinculada", className: "text-center" },
    data: { label: "Data", className: "text-center" },
    comprador: { label: "Comprador" },
    propostas: { label: "Propostas", className: "text-center" },
    status: { label: "Status", className: "text-center" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "compras.cotacoes",
    ["numero", "centroCusto", "urgencia", "rcs", "data", "comprador", "propostas", "status"]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialog states
  const [novaDialogOpen, setNovaDialogOpen] = useState(false);
  const [selectedReqId, setSelectedReqId] = useState("");
  const [reqSearch, setReqSearch] = useState("");
  const [reqFilterUrgencia, setReqFilterUrgencia] = useState("Todas");

  const reqFiltradas = useMemo(() => {
    let list = reqDisponiveisParaCotacao;
    if (reqFilterUrgencia !== "Todas") list = list.filter(r => r.urgencia === reqFilterUrgencia);
    if (reqSearch) {
      const s = reqSearch.toLowerCase();
      list = list.filter(r =>
        String(r.numero).includes(s) ||
        r.centroCustoNome.toLowerCase().includes(s) ||
        r.solicitante.toLowerCase().includes(s) ||
        r.itens.some(i => i.descricao.toLowerCase().includes(s))
      );
    }
    return list.sort((a, b) => b.numero - a.numero);
  }, [reqDisponiveisParaCotacao, reqSearch, reqFilterUrgencia]);
  const [viewCotacao, setViewCotacao] = useState<CotacaoCompras | null>(null);
  const [propostaDialogOpen, setPropostaDialogOpen] = useState(false);
  const [propostaCotacaoId, setPropostaCotacaoId] = useState("");
  const [editingPropostaId, setEditingPropostaId] = useState<string | null>(null);
  const [finalizarDialogOpen, setFinalizarDialogOpen] = useState(false);
  const [finalizarCotacaoId, setFinalizarCotacaoId] = useState("");
  const [aprovarDialogOpen, setAprovarDialogOpen] = useState(false);
  const [aprovarCotacaoId, setAprovarCotacaoId] = useState("");
  const [mapaDialogOpen, setMapaDialogOpen] = useState(false);
  const [mapaCotacao, setMapaCotacao] = useState<CotacaoCompras | null>(null);
  const [confirmacaoDialogOpen, setConfirmacaoDialogOpen] = useState(false);
  const [planoEmissao, setPlanoEmissao] = useState<PlanoEmissao | null>(null);
  const { registrarConfirmacoes } = useConfirmacoesValores();

  const itensConfirmacao: ItemConfirmacao[] = useMemo(() => {
    if (!planoEmissao) return [];
    const propostas = planoEmissao.propostas ?? [];
    return planoEmissao.grupos.flatMap(g => g.itens.map(i => {
      const alternativas: AlternativaFornecedor[] = [
        { fornecedorId: g.fornecedorId, fornecedorNome: g.fornecedorNome, precoUnitario: i.precoUnitario },
        ...propostas
          .filter(p => p.fornecedorId !== g.fornecedorId)
          .map(p => {
            const li = p.itens.find(x => x.itemId === i.itemId);
            return li && li.precoUnitario > 0
              ? { fornecedorId: p.fornecedorId, fornecedorNome: p.fornecedorNome, precoUnitario: li.precoUnitario }
              : null;
          })
          .filter(Boolean) as AlternativaFornecedor[],
      ];
      return {
        key: `${g.fornecedorId}::${i.itemId}`,
        itemId: i.itemId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidadeMedida: i.unidadeMedida,
        precoAprovado: i.precoUnitario,
        fornecedorId: g.fornecedorId,
        fornecedorNome: g.fornecedorNome,
        alternativas,
      };
    }));
  }, [planoEmissao]);

  // Proposta form
  const [propFornecedorId, setPropFornecedorId] = useState("");
  const [propCondicao, setPropCondicao] = useState("");
  const [propPrazo, setPropPrazo] = useState("");
  const [propValidade, setPropValidade] = useState("");
  const [propObs, setPropObs] = useState("");
  const [propFrete, setPropFrete] = useState<number | "">("");
  const [propOperacao, setPropOperacao] = useState<number | "">("");
  const [propSeguro, setPropSeguro] = useState<number | "">("");
  const [propItens, setPropItens] = useState<ItemCotacaoFornecedor[]>([]);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaResumo, setIaResumo] = useState<{ arquivo: string; lidos: number; total: number; fornecedorNome?: string | null } | null>(null);

  const lerPropostaPdf = async (file: File) => {
    if (propItens.length === 0) { toast({ title: "Nenhum item na cotação", variant: "destructive" }); return; }
    if (file.size > 10 * 1024 * 1024) { toast({ title: "Arquivo muito grande", description: "Limite de 10 MB.", variant: "destructive" }); return; }
    setIaLoading(true);
    setIaResumo(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      const base64 = btoa(bin);

      const { data, error } = await supabase.functions.invoke("ler-proposta-cotacao", {
        body: {
          fileBase64: base64,
          mimeType: file.type || "application/pdf",
          fileName: file.name,
          itens: propItens.map(i => ({ itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade, unidadeMedida: i.unidadeMedida })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const res = data as any;
      const mapa = new Map<string, number>();
      (res.itens || []).forEach((i: any) => {
        if (i.precoUnitario != null && !Number.isNaN(Number(i.precoUnitario)) && Number(i.precoUnitario) > 0) {
          mapa.set(String(i.itemId), Number(i.precoUnitario));
        }
      });

      setPropItens(prev => prev.map(it => mapa.has(it.itemId) ? { ...it, precoUnitario: mapa.get(it.itemId)! } : it));
      if (res.condicaoPagamento) setPropCondicao(String(res.condicaoPagamento));
      if (res.prazoEntrega) setPropPrazo(String(res.prazoEntrega));
      if (res.validadeProposta && /^\d{4}-\d{2}-\d{2}$/.test(String(res.validadeProposta))) setPropValidade(String(res.validadeProposta));
      if (res.observacao) setPropObs(String(res.observacao));

      // Tenta identificar o fornecedor pelo nome/CNPJ
      if (!editingPropostaId && !propFornecedorId) {
        const digits = (s: string) => (s || "").replace(/\D/g, "");
        const cnpj = digits(res.cnpj || "");
        const nome = String(res.fornecedorNome || "").toLowerCase().trim();
        const achado = fornecedores.find((f: any) => (cnpj && digits(f.cnpj || "") === cnpj))
          || (nome ? fornecedores.find((f: any) => f.nome?.toLowerCase().includes(nome) || nome.includes(f.nome?.toLowerCase() || "###")) : undefined);
        if (achado) setPropFornecedorId(achado.id);
      }

      setIaResumo({ arquivo: file.name, lidos: mapa.size, total: propItens.length, fornecedorNome: res.fornecedorNome });
      toast({
        title: mapa.size > 0 ? "Documento lido pela IA" : "Nenhum preço identificado",
        description: mapa.size > 0
          ? `${mapa.size} de ${propItens.length} itens preenchidos. Confira os valores antes de salvar.`
          : "Não foi possível localizar preços correspondentes aos itens.",
        variant: mapa.size > 0 ? undefined : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Falha na leitura do PDF", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIaLoading(false);
    }
  };


  // Finalizar form
  const [finVencedorId, setFinVencedorId] = useState("");
  const [finJustificativa, setFinJustificativa] = useState("");
  const [finItensVencedores, setFinItensVencedores] = useState<Record<string, string>>({});
  const [finModoItemizado, setFinModoItemizado] = useState(false);

  // Enviar para fornecedor
  const [enviarDialogOpen, setEnviarDialogOpen] = useState(false);
  const [enviarCotacaoId, setEnviarCotacaoId] = useState("");
  const [enviarFornecedorId, setEnviarFornecedorId] = useState("");
  const [enviarEmail, setEnviarEmail] = useState("");
  const [enviarTelefone, setEnviarTelefone] = useState("");
  const [enviarLoading, setEnviarLoading] = useState(false);
  const [canalEmail, setCanalEmail] = useState(true);
  const [canalWhatsapp, setCanalWhatsapp] = useState(true);
  const [linkGerado, setLinkGerado] = useState("");
  const [linksGeradosTodos, setLinksGeradosTodos] = useState<Array<{ fornecedorNome: string; link: string; erro?: string }>>([]);
  const [fornecedoresSelecionadosIds, setFornecedoresSelecionadosIds] = useState<string[]>([]);
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [enviarTodosLoading, setEnviarTodosLoading] = useState(false);
  const [enviarEmailLoading, setEnviarEmailLoading] = useState(false);
  const [enviarEmailTodosLoading, setEnviarEmailTodosLoading] = useState(false);

  // Enviar PDF por e-mail (cotação direta)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfCotacaoId, setPdfCotacaoId] = useState("");
  const [pdfFornecedorIds, setPdfFornecedorIds] = useState<string[]>([]);
  const [pdfEmails, setPdfEmails] = useState<Record<string, string>>({});
  const [pdfBusca, setPdfBusca] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const compradores = useMemo(() => {
    const set = new Set(cotacoes.map(c => c.comprador));
    return Array.from(set).sort();
  }, [cotacoes]);

  const centrosCustoUnicos = useMemo(() => {
    const set = new Set<string>();
    cotacoes.forEach(c => {
      const req = requisicoes.find(r => r.id === c.requisicaoId);
      if (req?.centroCustoNome) set.add(req.centroCustoNome);
    });
    return Array.from(set).sort();
  }, [cotacoes, requisicoes]);

  const hasActiveFilters = filterStatus !== "Todos" || filterPeriodo !== "Todos" || filterComprador !== "Todos" || filterCentroCusto !== "Todos" || filterUrgencia !== "Todas" || search !== "" || filterDataIni !== "" || filterDataFim !== "";

  const clearFilters = () => { setSearch(""); setFilterStatus("Todos"); setFilterPeriodo("Todos"); setFilterComprador("Todos"); setFilterCentroCusto("Todos"); setFilterUrgencia("Todas"); setFilterDataIni(""); setFilterDataFim(""); };

  const filtered = useMemo(() => {
    let list = cotacoes;
    if (filterStatus !== "Todos") list = list.filter(c => c.status === filterStatus);
    if (filterComprador !== "Todos") list = list.filter(c => c.comprador === filterComprador);
    if (filterCentroCusto !== "Todos") {
      list = list.filter(c => {
        const req = requisicoes.find(r => r.id === c.requisicaoId);
        return req?.centroCustoNome === filterCentroCusto;
      });
    }
    if (filterUrgencia !== "Todas") {
      list = list.filter(c => {
        const req = requisicoes.find(r => r.id === c.requisicaoId);
        return req?.urgencia === filterUrgencia;
      });
    }
    if (filterPeriodo !== "Todos") {
      const dias = Number(filterPeriodo);
      const dataLimite = subDays(new Date(), dias);
      list = list.filter(c => isAfter(new Date(c.dataCriacao), dataLimite));
    }
    if (filterDataIni) list = list.filter(c => c.dataCriacao >= filterDataIni);
    if (filterDataFim) list = list.filter(c => c.dataCriacao <= filterDataFim + "T23:59:59");
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => matchNumero(c.numero, s) || c.comprador.toLowerCase().includes(s) || matchNumero(c.requisicaoNumero, s));
    }

    return list.sort((a, b) => b.numero - a.numero);
  }, [cotacoes, requisicoes, search, filterStatus, filterPeriodo, filterComprador, filterCentroCusto, filterUrgencia, filterDataIni, filterDataFim]);

  const notificarStatusReq = (reqId: string, statusLabel: string, dataExtraLabel?: string) => {
    const r = requisicoes.find(x => x.id === reqId);
    if (!r) return;
    const cli = clientes.find(c => c.id === r.centroCusto);
    if (!cli?.grupoWhatsapp) return;
    notificarCompras({
      jid: cli.grupoWhatsapp,
      clienteNome: cli.nome,
      pedido: formatarPedido(r.numero, r.dataCriacao),
      statusLabel,
      dataSolicitacao: formatarDataHora(r.dataCriacao),
      dataExtraLabel,
      dataExtraValor: dataExtraLabel ? formatarDataHora(new Date().toISOString()) : undefined,
      solicitante: r.solicitante,
      prioridade: formatarPrioridade(r.urgencia),
      obs: r.justificativa,
      entregaPrevista: r.prazoDesejado ? formatarData(r.prazoDesejado) : undefined,
    });
  };

  const handleCriarCotacao = () => {
    if (!selectedReqId) { toast({ title: "Selecione uma requisição", variant: "destructive" }); return; }
    const req = requisicoes.find(r => r.id === selectedReqId);
    if (!req) return;
    addCotacao({ requisicaoId: req.id, requisicaoNumero: req.numero, comprador: usuarioLogado?.nome || "Comprador" });
    updateStatus(req.id, "Em Cotação", usuarioLogado?.nome || "Comprador", "Cotação iniciada");
    notificarStatusReq(req.id, "COTAÇÃO INICIADA", "Data início cotação");
    toast({ title: "Cotação criada com sucesso!" });
    setNovaDialogOpen(false);
    setSelectedReqId("");
  };

  const openPropostaDialog = (cotacaoId: string) => {
    const cot = cotacoes.find(c => c.id === cotacaoId);
    if (!cot) return;
    const req = requisicoes.find(r => r.id === cot.requisicaoId);
    if (!req) return;
    setPropItens(req.itens.map(i => ({ itemId: i.id, descricao: i.descricao, quantidade: i.quantidade, unidadeMedida: i.unidadeMedida, precoUnitario: 0, prazoEntrega: "", observacao: "" })));
    setPropFornecedorId(""); setPropCondicao(""); setPropPrazo(""); setPropValidade(""); setPropObs("");
    setPropFrete(""); setPropOperacao("");
    setEditingPropostaId(null);
    setPropostaCotacaoId(cotacaoId);
    setPropostaDialogOpen(true);
  };

  const openEditPropostaDialog = (cotacaoId: string, proposta: PropostaFornecedor) => {
    setPropFornecedorId(proposta.fornecedorId);
    setPropCondicao(proposta.condicaoPagamento);
    setPropPrazo(proposta.prazoEntrega);
    setPropValidade(proposta.validadeProposta);
    setPropObs(proposta.observacao);
    setPropFrete(proposta.valorFrete ?? "");
    setPropOperacao(proposta.valorOperacao ?? "");
    setPropSeguro(proposta.valorSeguro ?? "");
    setPropItens(proposta.itens.map(i => ({ ...i })));
    setEditingPropostaId(proposta.id);
    setPropostaCotacaoId(cotacaoId);
    setPropostaDialogOpen(true);
  };

  const handleAddProposta = () => {
    if (!propFornecedorId) { toast({ title: "Selecione um fornecedor", variant: "destructive" }); return; }
    if (propItens.some(i => i.precoUnitario <= 0)) { toast({ title: "Preencha todos os preços unitários", variant: "destructive" }); return; }
    const forn = fornecedores.find(f => f.id === propFornecedorId);
    const propostaData = {
      fornecedorId: propFornecedorId,
      fornecedorNome: forn?.nome || "",
      condicaoPagamento: propCondicao,
      prazoEntrega: propPrazo,
      validadeProposta: propValidade,
      observacao: propObs,
      valorFrete: Number(propFrete) || 0,
      valorOperacao: Number(propOperacao) || 0,
      valorSeguro: Number(propSeguro) || 0,
      itens: propItens,
    };
    if (editingPropostaId) {
      updateProposta(propostaCotacaoId, editingPropostaId, propostaData);
      toast({ title: "Proposta atualizada!" });
    } else {
      addProposta(propostaCotacaoId, propostaData);
      toast({ title: "Proposta adicionada!" });
    }
    setPropostaDialogOpen(false);
  };

  const openFinalizarDialog = (cotacaoId: string) => {
    setFinalizarCotacaoId(cotacaoId);
    setFinalizarDialogOpen(true);
  };

  const handleFinalizar = () => {
    const cot = cotacoes.find(c => c.id === finalizarCotacaoId);
    if (!cot) return;
    if (cot.propostas.length < 1) {
      toast({ title: "É necessário ao menos 1 proposta para finalizar", variant: "destructive" });
      return;
    }
    submeterAprovacao(finalizarCotacaoId);
    updateStatus(cot.requisicaoId, "Em Cotação", usuarioLogado?.nome || "Comprador", "Cotação submetida para aprovação");
    notificarStatusReq(cot.requisicaoId, "COTAÇÃO CONCLUIDA - AGUARDANDO APROVAÇÃO", "Data da cotação");
    toast({ title: "Cotação finalizada e enviada para aprovação!" });
    setFinalizarDialogOpen(false);
  };

  // === Aprovar Cotação ===
  const openAprovarDialog = (cotacaoId: string) => {
    setAprovarCotacaoId(cotacaoId);
    setFinVencedorId(""); setFinJustificativa("");
    setFinItensVencedores({});
    setFinModoItemizado(false);
    setAprovarDialogOpen(true);
  };

  const handleAprovar = async () => {
    if (!podeFinalizarCot) {
      toast({ title: "Você não possui permissão para finalizar/aprovar cotações.", variant: "destructive" });
      return;
    }
    const cot = cotacoes.find(c => c.id === aprovarCotacaoId);
    if (!cot) return;
    const req = requisicoes.find(r => r.id === cot.requisicaoId);
    if (!req) return;

    // Calcula valor total da aprovação para validar limite do usuário
    const valorAprovacao = (() => {
      if (finModoItemizado) {
        return req.itens.reduce((sum, item) => {
          const fornId = finItensVencedores[item.id];
          if (!fornId) return sum;
          const prop = cot.propostas.find(p => p.fornecedorId === fornId);
          const it = prop?.itens.find(i => i.itemId === item.id);
          return sum + (it ? it.precoUnitario * it.quantidade : 0);
        }, 0);
      }
      const prop = cot.propostas.find(p => p.fornecedorId === finVencedorId);
      return prop?.valorTotal ?? 0;
    })();

    if (!podeAprovar(valorAprovacao, "compras")) return;

    let plano: PlanoEmissao;

    if (finModoItemizado) {
      const allAssigned = req.itens.every(i => finItensVencedores[i.id]);
      if (!allAssigned) { toast({ title: "Selecione um fornecedor para cada item", variant: "destructive" }); return; }

      const itensVencedores: ItemVencedor[] = req.itens.map(i => {
        const fornId = finItensVencedores[i.id];
        const prop = cot.propostas.find(p => p.fornecedorId === fornId);
        return { itemId: i.id, fornecedorId: fornId, fornecedorNome: prop?.fornecedorNome || "" };
      });

      const fornecedorIds = [...new Set(itensVencedores.map(iv => iv.fornecedorId))];

      plano = {
        cotacaoId: cot.id,
        requisicaoId: cot.requisicaoId,
        requisicaoNumero: cot.requisicaoNumero,
        localEntrega: req.localEntrega || "",
        justificativa: finJustificativa,
        itemizado: true,
        itensVencedores,
        principalFornecedorId: fornecedorIds[0],
        grupos: fornecedorIds.map(fornId => {
          const prop = cot.propostas.find(p => p.fornecedorId === fornId)!;
          const itemIds = itensVencedores.filter(iv => iv.fornecedorId === fornId).map(iv => iv.itemId);
          return {
            fornecedorId: prop.fornecedorId,
            fornecedorNome: prop.fornecedorNome,
            condicaoPagamento: prop.condicaoPagamento,
            prazoEntrega: prop.prazoEntrega,
            itens: prop.itens.filter(i => itemIds.includes(i.itemId)).map(i => ({
              itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade,
              unidadeMedida: i.unidadeMedida, precoUnitario: i.precoUnitario,
            })),
          };
        }).filter(g => g.itens.length > 0),
      };
    } else {
      if (!finVencedorId) { toast({ title: "Selecione o fornecedor vencedor", variant: "destructive" }); return; }
      const prop = cot.propostas.find(p => p.fornecedorId === finVencedorId);
      if (!prop) return;
      plano = {
        cotacaoId: cot.id,
        requisicaoId: cot.requisicaoId,
        requisicaoNumero: cot.requisicaoNumero,
        localEntrega: req.localEntrega || "",
        justificativa: finJustificativa,
        itemizado: false,
        principalFornecedorId: prop.fornecedorId,
        grupos: [{
          fornecedorId: prop.fornecedorId,
          fornecedorNome: prop.fornecedorNome,
          condicaoPagamento: prop.condicaoPagamento,
          prazoEntrega: prop.prazoEntrega,
          itens: prop.itens.map(i => ({
            itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade,
            unidadeMedida: i.unidadeMedida, precoUnitario: i.precoUnitario,
          })),
        }],
      };
    }

    // A aprovação (Diretoria/Coordenação) apenas homologa a cotação.
    // A confirmação de valores e a emissão da OC ficam com o Time de Compras.
    if (plano.itemizado) {
      aprovarCotacao(plano.cotacaoId, plano.principalFornecedorId, plano.justificativa, plano.itensVencedores || []);
    } else {
      aprovarCotacao(plano.cotacaoId, plano.principalFornecedorId, plano.justificativa);
    }
    updateStatus(plano.requisicaoId, "Aprovada", usuarioLogado?.nome || "Aprovador",
      "Cotação aprovada — aguardando confirmação de valores pelo Time de Compras");
    notificarStatusReq(plano.requisicaoId, "APROVADA - AGUARDANDO CONFIRMAÇÃO DE VALORES", "Data da aprovação");

    setAprovarDialogOpen(false);
    toast({ title: "Cotação aprovada!", description: "O Time de Compras deve confirmar os valores para emitir a Ordem de Compra." });
  };

  /** Reconstrói o plano de emissão de uma cotação já aprovada (uso do Time de Compras). */
  const openConfirmacaoValores = (cot: CotacaoCompras) => {
    const req = requisicoes.find(r => r.id === cot.requisicaoId);
    if (!req) { toast({ title: "Requisição não encontrada", variant: "destructive" }); return; }

    const itemizado = (cot.itensVencedores?.length ?? 0) > 0;
    let plano: PlanoEmissao;

    if (itemizado) {
      const fornecedorIds = [...new Set(cot.itensVencedores.map(iv => iv.fornecedorId))];
      plano = {
        cotacaoId: cot.id,
        requisicaoId: cot.requisicaoId,
        requisicaoNumero: cot.requisicaoNumero,
        localEntrega: req.localEntrega || "",
        justificativa: cot.justificativaEscolha,
        itemizado: true,
        itensVencedores: cot.itensVencedores,
        principalFornecedorId: fornecedorIds[0],
        grupos: fornecedorIds.map(fornId => {
          const prop = cot.propostas.find(p => p.fornecedorId === fornId)!;
          const itemIds = cot.itensVencedores.filter(iv => iv.fornecedorId === fornId).map(iv => iv.itemId);
          return {
            fornecedorId: prop.fornecedorId,
            fornecedorNome: prop.fornecedorNome,
            condicaoPagamento: prop.condicaoPagamento,
            prazoEntrega: prop.prazoEntrega,
            itens: prop.itens.filter(i => itemIds.includes(i.itemId)).map(i => ({
              itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade,
              unidadeMedida: i.unidadeMedida, precoUnitario: i.precoUnitario,
            })),
          };
        }).filter(g => g.itens.length > 0),
      };
    } else {
      const prop = cot.propostas.find(p => p.fornecedorId === cot.fornecedorVencedorId);
      if (!prop) { toast({ title: "Proposta vencedora não encontrada", variant: "destructive" }); return; }
      plano = {
        cotacaoId: cot.id,
        requisicaoId: cot.requisicaoId,
        requisicaoNumero: cot.requisicaoNumero,
        localEntrega: req.localEntrega || "",
        justificativa: cot.justificativaEscolha,
        itemizado: false,
        principalFornecedorId: prop.fornecedorId,
        grupos: [{
          fornecedorId: prop.fornecedorId,
          fornecedorNome: prop.fornecedorNome,
          condicaoPagamento: prop.condicaoPagamento,
          prazoEntrega: prop.prazoEntrega,
          itens: prop.itens.map(i => ({
            itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade,
            unidadeMedida: i.unidadeMedida, precoUnitario: i.precoUnitario,
          })),
        }],
      };
    }

    plano.propostas = cot.propostas.map(p => ({
      fornecedorId: p.fornecedorId,
      fornecedorNome: p.fornecedorNome,
      condicaoPagamento: p.condicaoPagamento,
      prazoEntrega: p.prazoEntrega,
      itens: p.itens.map(i => ({
        itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade,
        unidadeMedida: i.unidadeMedida, precoUnitario: i.precoUnitario,
      })),
    }));

    const histAprov = [...(req.historicoStatus || [])].reverse().find(h => (h.status || "").startsWith("Aprovada"));
    plano.dataAprovacao = histAprov?.dataHora;

    setPlanoEmissao(plano);
    setConfirmacaoDialogOpen(true);

  };

  // === Emissão da OC após confirmação de valores ===
  const handleConfirmarValores = async (ajustes: Record<string, AjusteConfirmacao>, meta: MetaConfirmacao) => {
    const plano = planoEmissao;
    if (!plano) return;

    const usuario = usuarioLogado?.nome || "Comprador";
    const diasAtraso = calcularDiasAtraso(plano.dataAprovacao);
    const agora = new Date().toISOString();
    const itensDiretoria: { descricao: string; perc: number; variacao: number; fornecedor: string }[] = [];




    const pedidosCriados: PedidoCompra[] = [];
    const linhasConfirmacao: any[] = [];
    const redirecionamentos: { descricao: string; de: string; para: string; motivo: string }[] = [];

    // Reagrupa os itens pelo fornecedor final (permite redirecionamento pós-aprovação).
    type LinhaFinal = {
      fornecedorId: string; fornecedorNome: string;
      condicaoPagamento: string; prazoEntrega: string;
      item: { itemId: string; descricao: string; quantidade: number; unidadeMedida: string; precoUnitario: number };
      precoFinal: number;
      aj?: AjusteConfirmacao;
    };
    const linhasFinais: LinhaFinal[] = [];

    for (const grupo of plano.grupos) {
      for (const i of grupo.itens) {
        const aj = ajustes[`${grupo.fornecedorId}::${i.itemId}`];
        const precoFinal = aj?.precoConfirmado ?? i.precoUnitario;
        const destinoId = aj?.fornecedorIdFinal || grupo.fornecedorId;
        const propDestino = (plano.propostas ?? []).find(p => p.fornecedorId === destinoId);
        if (aj?.redirecionado) {
          redirecionamentos.push({
            descricao: i.descricao,
            de: grupo.fornecedorNome,
            para: aj.fornecedorNomeFinal || propDestino?.fornecedorNome || "",
            motivo: aj.motivoRedirecionamento || "",
          });
        }
        linhasFinais.push({
          fornecedorId: destinoId,
          fornecedorNome: aj?.fornecedorNomeFinal || propDestino?.fornecedorNome || grupo.fornecedorNome,
          condicaoPagamento: propDestino?.condicaoPagamento ?? grupo.condicaoPagamento,
          prazoEntrega: propDestino?.prazoEntrega ?? grupo.prazoEntrega,
          item: i,
          precoFinal,
          aj,
        });
      }
    }

    const fornecedoresFinais = [...new Set(linhasFinais.map(l => l.fornecedorId))];

    for (const fornId of fornecedoresFinais) {
      const linhasForn = linhasFinais.filter(l => l.fornecedorId === fornId);
      const ref = linhasForn[0];
      const itensPedido = linhasForn.map(l => ({
        itemId: l.item.itemId, descricao: l.item.descricao, quantidade: l.item.quantidade,
        unidadeMedida: l.item.unidadeMedida, precoUnitario: l.precoFinal,
        valorTotal: l.precoFinal * l.item.quantidade,
      }));

      const novo = addPedido({
        cotacaoId: plano.cotacaoId,
        requisicaoId: plano.requisicaoId,
        requisicaoNumero: plano.requisicaoNumero,
        comprador: usuario,
        fornecedorId: ref.fornecedorId,
        fornecedorNome: ref.fornecedorNome,
        itens: itensPedido,
        condicaoPagamento: ref.condicaoPagamento,
        prazoEntrega: ref.prazoEntrega,
        localEntrega: plano.localEntrega,
        observacoes: linhasForn.some(l => l.aj?.redirecionado)
          ? "Itens redirecionados na confirmação de valores: " +
            linhasForn.filter(l => l.aj?.redirecionado).map(l => `${l.item.descricao} (${l.aj?.motivoRedirecionamento})`).join("; ")
          : "",
      });
      pedidosCriados.push(novo);

      linhasForn.forEach(l => {
        const i = l.item;
        const aj = l.aj;
        const precoFinal = l.precoFinal;
        const valorAprovado = i.precoUnitario * i.quantidade;
        const valorConfirmado = precoFinal * i.quantidade;
        linhasConfirmacao.push({
          cotacaoId: plano.cotacaoId,
          requisicaoId: plano.requisicaoId,
          requisicaoNumero: plano.requisicaoNumero,
          pedidoId: novo.id,
          fornecedorId: l.fornecedorId,
          fornecedorNome: l.fornecedorNome,
          itemId: i.itemId,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidadeMedida: i.unidadeMedida,
          precoAprovado: i.precoUnitario,
          precoConfirmado: precoFinal,
          valorAprovado,
          valorConfirmado,
          variacaoValor: valorConfirmado - valorAprovado,
          variacaoPercentual: i.precoUnitario > 0 ? ((precoFinal - i.precoUnitario) / i.precoUnitario) * 100 : 0,
          categoria: aj?.categoria ?? "Cost Avoidance",
          justificativa: [aj?.justificativa ?? "", aj?.redirecionado ? `Redirecionado: ${aj.motivoRedirecionamento}` : ""].filter(Boolean).join(" | "),
          confirmadoPor: usuario,
          alcada: aj?.alcada ?? "Sem Reajuste",
          limiteAlcadaPercentual: LIMITE_ALCADA_PERCENTUAL,
          aprovadoPorAlcada: aj?.alcada === "Expressa" ? (meta.aprovadoPorAlcada || usuario) : null,
          requerDiretoria: !!aj?.requerDiretoria,
          diretoriaNotificadaEm: aj?.requerDiretoria ? agora : null,
          diretoriaAceite: aj?.requerDiretoria ? meta.aceiteDiretoria : false,
          diasAtrasoAprovacao: diasAtraso,
          impactoAtraso: calcularImpactoAtraso(valorConfirmado - valorAprovado, diasAtraso),
        });
        if (aj?.requerDiretoria) {
          itensDiretoria.push({
            descricao: i.descricao,
            perc: i.precoUnitario > 0 ? ((precoFinal - i.precoUnitario) / i.precoUnitario) * 100 : 0,
            variacao: valorConfirmado - valorAprovado,
            fornecedor: l.fornecedorNome,
          });
        }
      });
    }

    await registrarConfirmacoes(linhasConfirmacao);
    await Promise.all(pedidosCriados.map(p => assinarPedidoAutomatico(p)));
    await Promise.all(pedidosCriados.map(p => notificarPedidoNoGrupo(p, plano.requisicaoId)));

    updateStatus(plano.requisicaoId, "Pedido Emitido", usuario,
      pedidosCriados.length > 1
        ? `${pedidosCriados.length} pedidos gerados após confirmação de valores`
        : "Pedido gerado após confirmação de valores"
    );
    notificarStatusReq(plano.requisicaoId, "APROVADA - PEDIDO EMITIDO (COMPRADO)", "Data da aprovação");

    if (itensDiretoria.length > 0) {
      const jid = (empresa?.whatsappDiretoria || "").trim();
      const totalAditivo = itensDiretoria.reduce((s, i) => s + Math.max(0, i.variacao), 0);
      const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      if (jid) {
        const linhas = [
          "*ACEITE DE ADITIVO DE VERBA — ACIMA DA ALÇADA*", "",
          `Requisição: ${plano.requisicaoNumero}`,
          `Confirmado por: ${usuario}`,
          `Dias entre aprovação e confirmação: ${diasAtraso}`, "",
          ...itensDiretoria.map(i => `• ${i.descricao} (${i.fornecedor}): ${i.perc.toFixed(2)}% / ${brl(i.variacao)}`),
          "",
          `Total do aditivo: ${brl(totalAditivo)}`,
          meta.aceiteDiretoria ? "Aceite registrado pelo Time de Compras." : "Aguardando aceite da Diretoria.",
        ];
        try { await enviarWhatsApp(jid, linhas.join("\n")); } catch (e) { console.error(e); }
      }
      updateStatus(plano.requisicaoId, "Pedido Emitido", usuario,
        `Reajuste acima da alçada de ${LIMITE_ALCADA_PERCENTUAL}% — aditivo de verba de ${brl(totalAditivo)} notificado à Diretoria`);
    }

    if (redirecionamentos.length > 0) {
      updateStatus(plano.requisicaoId, "Pedido Emitido", usuario,
        `Redirecionamento de fornecedor: ${redirecionamentos.map(r => `${r.descricao} — ${r.de} → ${r.para} (${r.motivo})`).join("; ")}`);
    }

    concluirRevisaoConfirmacao(plano.cotacaoId);

    toast({ title: `Valores confirmados! ${pedidosCriados.length} pedido(s) emitido(s) e assinado(s) eletronicamente.` });
    setConfirmacaoDialogOpen(false);
    setPlanoEmissao(null);
  };


  const openMapa = (cot: CotacaoCompras) => { setMapaCotacao(cot); setMapaDialogOpen(true); };

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : filtered.map(c => c.id));

  const handlePrintCotacoes = async () => {
    const lista = cotacoes.filter(c => selectedIds.includes(c.id));
    if (lista.length === 0) return;
    toast({ title: `Gerando ${lista.length} PDF${lista.length > 1 ? "s" : ""} de cotação...` });
    for (const c of lista) {
      const req = requisicoes.find(r => r.id === c.requisicaoId) || null;
      await downloadPdfCotacao({ cotacao: c, requisicao: req, empresa });
    }
    toast({ title: `${lista.length} PDF${lista.length > 1 ? "s gerados" : " gerado"} com sucesso` });
  };

  const handlePrintPedidosCotacao = async () => {
    const lista = cotacoes.filter(c => selectedIds.includes(c.id));
    if (lista.length === 0) return;
    let total = 0;
    toast({ title: `Gerando pedidos de cotação...` });
    for (const c of lista) {
      const req = requisicoes.find(r => r.id === c.requisicaoId) || null;
      const fornsComProposta = c.propostas.map(p => {
        const fData = fornecedores.find(f => f.id === p.fornecedorId);
        return {
          id: p.fornecedorId,
          nome: p.fornecedorNome,
          cnpj: fData?.cnpj || "",
          email: fData?.emailCompras || fData?.email || "",
          telefone: fData?.telefoneCelular || (fData?.telefones?.[0]) || "",
        };
      });
      const fornsUnicos = fornsComProposta.filter((f, i, arr) => arr.findIndex(a => a.id === f.id) === i);
      if (fornsUnicos.length === 0) continue;
      await downloadPdfPedidoCotacaoTodos(c, req, empresa, fornsUnicos);
      total += fornsUnicos.length;
    }
    toast({ title: `${total} PDF(s) de pedido de cotação gerado(s)` });
  };

  // === Enviar link para fornecedor ===
  const openEnviarDialog = (cotacaoId: string) => {
    setEnviarCotacaoId(cotacaoId);
    setEnviarFornecedorId("");
    setEnviarEmail("");
    setLinkGerado("");
    setLinksGeradosTodos([]);
    setFornecedoresSelecionadosIds(fornecedores.map(f => f.id));
    setFiltroFornecedor("");
    setEnviarDialogOpen(true);
  };

  const getTelefoneFornecedor = (forn: any): string => {
    return forn?.telefonesWhatsapp || "";
  };

  const handleSelectFornecedorEnviar = (fornId: string) => {
    setEnviarFornecedorId(fornId);
    const forn = fornecedores.find(f => f.id === fornId);
    setEnviarEmail(forn?.emailCompras || forn?.email || "");
    setEnviarTelefone(getTelefoneFornecedor(forn));
    setLinkGerado("");
  };

  const handleGerarLink = async () => {
    if (!enviarFornecedorId) { toast({ title: "Selecione um fornecedor", variant: "destructive" }); return; }
    setEnviarLoading(true);
    try {
      const cot = cotacoes.find(c => c.id === enviarCotacaoId);
      const req = requisicoes.find(r => r.id === cot?.requisicaoId);
      const forn = fornecedores.find(f => f.id === enviarFornecedorId);
      if (!cot || !req || !forn) throw new Error("Dados não encontrados");

      const itensConvite = req.itens.map(i => ({
        itemId: i.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidadeMedida: i.unidadeMedida,
      }));

      const { data, error } = await supabase.from("cotacao_convites").insert({
        cotacao_id: cot.id,
        cotacao_numero: cot.numero,
        fornecedor_id: forn.id,
        fornecedor_nome: forn.nome,
        fornecedor_email: enviarEmail,
        comprador: usuarioLogado?.nome || "Comprador",
        itens: itensConvite,
      }).select("token").single();

      if (error) throw error;

      const link = `${window.location.origin}/cotacao/proposta/${data.token}`;
      setLinkGerado(link);
      toast({ title: "Link gerado com sucesso!" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" });
    } finally {
      setEnviarLoading(false);
    }
  };

  const handleCopyLink = (link?: string) => {
    navigator.clipboard.writeText(link || linkGerado);
    toast({ title: "Link copiado!" });
  };

  const handleGerarLinkTodos = async () => {
    setEnviarTodosLoading(true);
    setLinksGeradosTodos([]);
    try {
      const cot = cotacoes.find(c => c.id === enviarCotacaoId);
      const req = requisicoes.find(r => r.id === cot?.requisicaoId);
      if (!cot || !req) throw new Error("Dados não encontrados");

      const itensConvite = req.itens.map(i => ({
        itemId: i.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidadeMedida: i.unidadeMedida,
      }));

      // Check existing convites to avoid duplicates
      const { data: existingConvites } = await supabase
        .from("cotacao_convites")
        .select("fornecedor_id")
        .eq("cotacao_id", cot.id);
      const existingIds = new Set((existingConvites || []).map(c => c.fornecedor_id));

      const results: Array<{ fornecedorNome: string; link: string; erro?: string }> = [];

      for (const forn of fornecedores) {
        if (existingIds.has(forn.id)) {
          results.push({ fornecedorNome: forn.nome, link: "", erro: "Convite já enviado anteriormente" });
          continue;
        }
        try {
          const { data, error } = await supabase.from("cotacao_convites").insert({
            cotacao_id: cot.id,
            cotacao_numero: cot.numero,
            fornecedor_id: forn.id,
            fornecedor_nome: forn.nome,
            fornecedor_email: forn.emailCompras || forn.email || "",
            comprador: usuarioLogado?.nome || "Comprador",
            itens: itensConvite,
          }).select("token").single();

          if (error) throw error;
          const link = `${window.location.origin}/cotacao/proposta/${data.token}`;
          results.push({ fornecedorNome: forn.nome, link });
        } catch (e: any) {
          results.push({ fornecedorNome: forn.nome, link: "", erro: e.message });
        }
      }

      setLinksGeradosTodos(results);
      const successCount = results.filter(r => r.link).length;
      toast({ title: `Links gerados para ${successCount} de ${fornecedores.length} fornecedores` });
    } catch (e: any) {
      toast({ title: "Erro ao gerar links", description: e.message, variant: "destructive" });
    } finally {
      setEnviarTodosLoading(false);
    }
  };

  // Gerar + enviar individual em um clique
  const montarMensagemWhatsapp = (fornNome: string, cotNum: number, link: string, comprador: string, nomeEmpresa: string) =>
    `Olá *${fornNome}*,\n\n${nomeEmpresa} convida sua empresa a participar da cotação *#${cotNum}*.\n\nPara enviar sua proposta de preços, acesse o link abaixo:\n${link}\n\nAtenciosamente,\n${comprador}\n${nomeEmpresa}`;

  const openPdfDialog = (cotId: string) => {
    setPdfCotacaoId(cotId);
    setPdfFornecedorIds([]);
    setPdfEmails({});
    setPdfBusca("");
    setPdfDialogOpen(true);
  };

  const emailPadraoFornecedor = (fornId: string) => {
    const forn = fornecedores.find(f => f.id === fornId);
    return (forn as any)?.emailCompras || forn?.email || "";
  };

  const togglePdfFornecedor = (fornId: string) => {
    setPdfFornecedorIds(prev => {
      if (prev.includes(fornId)) return prev.filter(id => id !== fornId);
      setPdfEmails(e => (e[fornId] !== undefined ? e : { ...e, [fornId]: emailPadraoFornecedor(fornId) }));
      return [...prev, fornId];
    });
  };

  const handleEnviarPdfFornecedor = async () => {
    if (pdfFornecedorIds.length === 0) { toast({ title: "Selecione ao menos um fornecedor", variant: "destructive" }); return; }
    const semEmail = pdfFornecedorIds.filter(id => !(pdfEmails[id] || "").trim());
    if (semEmail.length > 0) {
      toast({ title: "Informe o e-mail de todos os fornecedores selecionados", variant: "destructive" });
      return;
    }
    setPdfLoading(true);
    const enviados: string[] = [];
    const falhas: string[] = [];
    try {
      const cot = cotacoes.find(c => c.id === pdfCotacaoId);
      const req = requisicoes.find(r => r.id === cot?.requisicaoId) || null;
      if (!cot) throw new Error("Cotação não encontrada");

      const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || "SGM";
      const comprador = cot.comprador || usuarioLogado?.nome || "Departamento de Compras";

      for (const fornId of pdfFornecedorIds) {
        const forn = fornecedores.find(f => f.id === fornId);
        if (!forn) continue;
        const email = (pdfEmails[fornId] || "").trim();
        try {
          const { blob } = await gerarBlobPedidoCotacao({
            cotacao: cot,
            requisicao: req,
            empresa,
            fornecedor: {
              id: forn.id,
              nome: forn.nome,
              cnpj: forn.cnpj || "",
              email,
              telefone: getTelefoneFornecedor(forn) || "",
            },
          });

          const path = `cotacoes/${cot.id}/${forn.id}-${Date.now()}.pdf`;
          const { error: upErr } = await supabase.storage
            .from("documentos")
            .upload(path, blob, { contentType: "application/pdf", upsert: true });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("documentos").getPublicUrl(path);
          const pdfUrl = pub.publicUrl;

          const { error: emailErr } = await enviarEmailCompras({
            body: {
              templateName: "cotacao-confirmation",
              recipientEmail: email,
              idempotencyKey: `cotacao-pdf-${cot.id}-${forn.id}-${Date.now()}`,
              templateData: {
                fornecedorNome: forn.nome,
                cotacaoNumero: cot.numero,
                comprador,
                pdfUrl,
                nomeEmpresa,
              },
            },
          });
          if (emailErr) throw emailErr;
          enviados.push(forn.nome);
        } catch (err: any) {
          console.error(err);
          falhas.push(`${forn.nome}: ${err?.message || "erro"}`);
        }
      }

      if (enviados.length > 0) {
        toast({
          title: `PDF enviado para ${enviados.length} fornecedor(es)`,
          description: enviados.join(", "),
        });
      }
      if (falhas.length > 0) {
        toast({ title: "Falhas no envio", description: falhas.join(" | "), variant: "destructive" });
      }
      if (falhas.length === 0) setPdfDialogOpen(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao enviar PDF", description: e.message, variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };


  const handleGerarEEnviarIndividual = async () => {
    if (!enviarFornecedorId) { toast({ title: "Selecione um fornecedor", variant: "destructive" }); return; }
    if (!canalEmail && !canalWhatsapp) { toast({ title: "Selecione ao menos um canal de envio", variant: "destructive" }); return; }
    if (canalEmail && !enviarEmail && !canalWhatsapp) { toast({ title: "Informe o e-mail do fornecedor", variant: "destructive" }); return; }
    if (canalWhatsapp && !enviarTelefone && !canalEmail) { toast({ title: "Informe o WhatsApp do fornecedor", variant: "destructive" }); return; }
    if ((canalEmail && !enviarEmail) && (canalWhatsapp && !enviarTelefone)) { toast({ title: "Informe e-mail e/ou WhatsApp", variant: "destructive" }); return; }
    setEnviarLoading(true);
    try {
      const cot = cotacoes.find(c => c.id === enviarCotacaoId);
      const req = requisicoes.find(r => r.id === cot?.requisicaoId);
      const forn = fornecedores.find(f => f.id === enviarFornecedorId);
      if (!cot || !req || !forn) throw new Error("Dados não encontrados");

      const itensConvite = req.itens.map(i => ({
        itemId: i.id, descricao: i.descricao, quantidade: i.quantidade, unidadeMedida: i.unidadeMedida,
      }));

      const { data, error } = await supabase.from("cotacao_convites").insert({
        cotacao_id: cot.id,
        cotacao_numero: cot.numero,
        fornecedor_id: forn.id,
        fornecedor_nome: forn.nome,
        fornecedor_email: enviarEmail,
        comprador: usuarioLogado?.nome || "Comprador",
        itens: itensConvite,
      }).select("token").single();
      if (error) throw error;

      const link = `${window.location.origin}/cotacao/proposta/${data.token}`;
      const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || "SGM";
      const comprador = cot.comprador || usuarioLogado?.nome || "Departamento de Compras";

      // Resposta imediata: o convite já está gravado. Envio dos canais em segundo plano.
      const canais: string[] = [];
      if (canalEmail && enviarEmail) canais.push("e-mail");
      if (canalWhatsapp && enviarTelefone) canais.push("WhatsApp");

      toast({
        title: `Convite criado para ${forn.nome}!`,
        description: canais.length ? `Enviando por ${canais.join(" + ")} em segundo plano...` : "Nenhum canal selecionado",
      });
      setEnviarDialogOpen(false);

      void (async () => {
        if (canalEmail && enviarEmail) {
          const { error: emailErr } = await enviarEmailCompras({
            body: {
              templateName: "cotacao-confirmation",
              recipientEmail: enviarEmail,
              idempotencyKey: `cotacao-${cot.id}-${forn.id}`,
              templateData: { fornecedorNome: forn.nome, cotacaoNumero: cot.numero, comprador, link, nomeEmpresa },
            },
          });
          if (emailErr) {
            toast({ title: "Falha no envio do e-mail", description: String((emailErr as any)?.message || emailErr), variant: "destructive" });
          }
        }
        if (canalWhatsapp && enviarTelefone) {
          const msg = montarMensagemWhatsapp(forn.nome, cot.numero, link, comprador, nomeEmpresa);
          const r = await enviarWhatsApp(enviarTelefone, msg);
          if (!r.success) {
            toast({ title: "Falha no envio do WhatsApp", description: r.error, variant: "destructive" });
          }
        }
      })();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao enviar cotação", description: e.message, variant: "destructive" });
    } finally {
      setEnviarLoading(false);
    }
  };


  // Gerar + enviar para todos em um clique (e-mail + WhatsApp)
  const handleGerarEEnviarTodos = async () => {
    setEnviarTodosLoading(true);
    setLinksGeradosTodos([]);
    try {
      const cot = cotacoes.find(c => c.id === enviarCotacaoId);
      const req = requisicoes.find(r => r.id === cot?.requisicaoId);
      if (!cot || !req) throw new Error("Dados não encontrados");

      const itensConvite = req.itens.map(i => ({
        itemId: i.id, descricao: i.descricao, quantidade: i.quantidade, unidadeMedida: i.unidadeMedida,
      }));

      const { data: existingConvites } = await supabase
        .from("cotacao_convites").select("fornecedor_id, token, fornecedor_email")
        .eq("cotacao_id", cot.id);
      const existingMap = new Map((existingConvites || []).map(c => [c.fornecedor_id, c]));

      const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || "SGM";
      const comprador = cot.comprador || usuarioLogado?.nome || "Departamento de Compras";

      const results: Array<{ fornecedorNome: string; link: string; erro?: string }> = [];
      const pendentes: Array<{ id: string; nome: string; email: string; telefone: string; link: string }> = [];

      const alvos = fornecedores.filter(f => fornecedoresSelecionadosIds.includes(f.id));
      if (alvos.length === 0) throw new Error("Selecione ao menos um fornecedor");

      // 1) Grava os convites e responde imediatamente
      for (const forn of alvos) {
        const emailForn = forn.emailCompras || forn.email || "";
        const telForn = getTelefoneFornecedor(forn);
        try {
          let token: string;
          const existing = existingMap.get(forn.id);
          if (existing) {
            token = (existing as any).token;
          } else {
            const { data, error } = await supabase.from("cotacao_convites").insert({
              cotacao_id: cot.id, cotacao_numero: cot.numero,
              fornecedor_id: forn.id, fornecedor_nome: forn.nome,
              fornecedor_email: emailForn, comprador: usuarioLogado?.nome || "Comprador",
              itens: itensConvite,
            }).select("token").single();
            if (error) throw error;
            token = data.token;
          }
          const link = `${window.location.origin}/cotacao/proposta/${token}`;

          if (!emailForn && !telForn) {
            results.push({ fornecedorNome: forn.nome, link, erro: "Sem e-mail nem telefone cadastrados" });
            continue;
          }

          results.push({ fornecedorNome: forn.nome, link });
          pendentes.push({ id: forn.id, nome: forn.nome, email: emailForn, telefone: telForn, link });
        } catch (e: any) {
          results.push({ fornecedorNome: forn.nome, link: "", erro: e.message });
        }
      }

      setLinksGeradosTodos(results);
      toast({
        title: `${results.filter(r => r.link).length} convite(s) criado(s)`,
        description: pendentes.length ? "Enviando e-mails/WhatsApp em segundo plano..." : undefined,
      });

      // 2) Envio dos canais em segundo plano
      void (async () => {
        let enviadosEmail = 0;
        let enviadosWpp = 0;
        for (const p of pendentes) {
          if (canalEmail && p.email) {
            try {
              const { error } = await enviarEmailCompras({
                body: {
                  templateName: "cotacao-confirmation",
                  recipientEmail: p.email,
                  idempotencyKey: `cotacao-${cot.id}-${p.id}`,
                  templateData: { fornecedorNome: p.nome, cotacaoNumero: cot.numero, comprador, link: p.link, nomeEmpresa },
                },
              });
              if (!error) enviadosEmail++;
            } catch { /* ignore individual */ }
          }
          if (canalWhatsapp && p.telefone) {
            const msg = montarMensagemWhatsapp(p.nome, cot.numero, p.link, comprador, nomeEmpresa);
            const r = await enviarWhatsApp(p.telefone, msg);
            if (r.success) enviadosWpp++;
          }
        }
        toast({ title: "Envios concluídos", description: `${enviadosEmail} e-mail(s) e ${enviadosWpp} WhatsApp(s) enviados` });
      })();
    } catch (e: any) {
      toast({ title: "Erro ao enviar cotações", description: e.message, variant: "destructive" });
    } finally {
      setEnviarTodosLoading(false);
    }

  };

  const handleCopyAllLinks = () => {
    const text = linksGeradosTodos
      .filter(r => r.link)
      .map(r => `${r.fornecedorNome}: ${r.link}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Todos os links copiados!" });
  };


  const handleEnviarEmailIndividual = async () => {
    if (!linkGerado || !enviarEmail) {
      toast({ title: "Gere o link e informe o e-mail antes de enviar", variant: "destructive" });
      return;
    }
    setEnviarEmailLoading(true);
    try {
      const cot = cotacoes.find(c => c.id === enviarCotacaoId);
      const forn = fornecedores.find(f => f.id === enviarFornecedorId);
      if (!cot || !forn) throw new Error("Dados não encontrados");

      const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || "SGM";
      const comprador = cot.comprador || usuarioLogado?.nome || "Departamento de Compras";

      const { error } = await enviarEmailCompras({
        body: {
          templateName: "cotacao-confirmation",
          recipientEmail: enviarEmail,
          idempotencyKey: `cotacao-${cot.id}-${enviarFornecedorId}`,
          templateData: {
            fornecedorNome: forn.nome,
            cotacaoNumero: cot.numero,
            comprador,
            link: linkGerado,
            nomeEmpresa,
          },
        },
      });

      if (error) throw error;
      toast({ title: "E-mail enviado com sucesso!" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao enviar e-mail", description: e.message, variant: "destructive" });
    } finally {
      setEnviarEmailLoading(false);
    }
  };

  const handleEnviarEmailTodos = async () => {
    const comLink = linksGeradosTodos.filter(r => r.link);
    if (comLink.length === 0) {
      toast({ title: "Nenhum link disponível para enviar", variant: "destructive" });
      return;
    }
    setEnviarEmailTodosLoading(true);
    try {
      const cot = cotacoes.find(c => c.id === enviarCotacaoId);
      if (!cot) throw new Error("Cotação não encontrada");

      const nomeEmpresa = empresa.nomeFantasia || empresa.razaoSocial || "SGM";
      const comprador = cot.comprador || usuarioLogado?.nome || "Departamento de Compras";
      let enviados = 0;
      let erros = 0;

      for (const item of comLink) {
        const forn = fornecedores.find(f => f.nome === item.fornecedorNome);
        const emailForn = forn?.emailCompras || forn?.email || "";
        if (!emailForn) { erros++; continue; }

        try {
          await enviarEmailCompras({
            body: {
              templateName: "cotacao-confirmation",
              recipientEmail: emailForn,
              idempotencyKey: `cotacao-${cot.id}-${forn?.id || item.fornecedorNome}`,
              templateData: {
                fornecedorNome: item.fornecedorNome,
                cotacaoNumero: cot.numero,
                comprador,
                link: item.link,
                nomeEmpresa,
              },
            },
          });
          enviados++;
        } catch {
          erros++;
        }
      }

      toast({ title: `E-mails enviados: ${enviados} de ${comLink.length}${erros > 0 ? ` (${erros} erro(s))` : ""}` });
    } catch (e: any) {
      toast({ title: "Erro ao enviar e-mails", description: e.message, variant: "destructive" });
    } finally {
      setEnviarEmailTodosLoading(false);
    }
  };

  // === Sincronizar propostas externas ===
  const syncPropostasExternas = useCallback(async () => {
    try {
      const cotacaoIds = cotacoes.filter(c => c.status === "Em Andamento").map(c => c.id);
      if (cotacaoIds.length === 0) return;

      const { data: convites } = await supabase
        .from("cotacao_convites")
        .select("*, cotacao_propostas_externas(*)")
        .in("cotacao_id", cotacaoIds)
        .eq("status", "respondido");

      if (!convites || convites.length === 0) return;

      for (const convite of convites) {
        const propostas = (convite as any).cotacao_propostas_externas;
        if (!propostas || propostas.length === 0) continue;

        const cot = cotacoes.find(c => c.id === convite.cotacao_id);
        if (!cot) continue;

        for (const propExt of propostas) {
          // Check if already imported (by fornecedor)
          const alreadyExists = cot.propostas.some(p => p.fornecedorId === convite.fornecedor_id);
          if (alreadyExists) continue;

          addProposta(convite.cotacao_id, {
            fornecedorId: convite.fornecedor_id,
            fornecedorNome: convite.fornecedor_nome,
            condicaoPagamento: propExt.condicao_pagamento || "",
            prazoEntrega: propExt.prazo_entrega || "",
            validadeProposta: propExt.validade_proposta || "",
            observacao: propExt.observacao || "",
            valorFrete: Number(propExt.valor_frete) || 0,
            valorOperacao: Number(propExt.valor_operacao) || 0,
            valorSeguro: Number(propExt.valor_seguro) || 0,
            itens: (propExt.itens as any[]).map((i: any) => ({
              itemId: i.itemId,
              descricao: i.descricao,
              quantidade: i.quantidade,
              unidadeMedida: i.unidadeMedida,
              precoUnitario: i.precoUnitario,
              prazoEntrega: "",
              observacao: "",
            })),
          });

          toast({ title: `Proposta recebida de ${convite.fornecedor_nome}!` });
        }
      }
    } catch (e) {
      console.error("Erro ao sincronizar propostas:", e);
    }
  }, [cotacoes, addProposta, toast]);

  // Sync on mount and periodically
  useEffect(() => {
    syncPropostasExternas();
    const interval = setInterval(syncPropostasExternas, 30000); // every 30s
    return () => clearInterval(interval);
  }, [syncPropostasExternas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground mx-[5px]">  Cotações de Compras</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={syncPropostasExternas} title="Sincronizar propostas externas">
            <RefreshCw className="mr-2 h-4 w-4" />Sincronizar
          </Button>
          {podeCriarCot && <Button onClick={() => { setReqSearch(""); setReqFilterUrgencia("Todas"); setSelectedReqId(""); setNovaDialogOpen(true); }} disabled={reqDisponiveisParaCotacao.length === 0}><Plus className="mr-2 h-4 w-4" />Nova Cotação</Button>}
        </div>
      </div>

      <div className="space-y-3 pl-1">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px] max-w-sm">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nº cotação, RC, comprador..." value={search} onChange={e => { setSearch(e.target.value); setPageCot(1); }} className="pl-9" />
            </div>
          </div>
          <div className="w-56">
            <Label className="text-xs">Centro de Custo</Label>
            <Select value={filterCentroCusto} onValueChange={v => { setFilterCentroCusto(v); setPageCot(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Centros de Custo</SelectItem>
                {centrosCustoUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPageCot(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os Status</SelectItem>
                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                <SelectItem value="Aguardando Aprovação">Aguardando Aprovação</SelectItem>
                <SelectItem value="Revisão de Confirmação">Revisão de Confirmação</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="text-xs">Urgência</Label>
            <Select value={filterUrgencia} onValueChange={v => { setFilterUrgencia(v); setPageCot(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas as Urgências</SelectItem>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label className="text-xs">Comprador</Label>
            <Select value={filterComprador} onValueChange={v => { setFilterComprador(v); setPageCot(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Compradores</SelectItem>
                {compradores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-40">
            <Label className="text-xs">Período</Label>
            <Select value={filterPeriodo} onValueChange={v => { setFilterPeriodo(v); setPageCot(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todo Período</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Label className="text-xs">Data inicial</Label>
            <Input type="date" value={filterDataIni} onChange={e => { setFilterDataIni(e.target.value); setPageCot(1); }} />
          </div>
          <div className="w-40">
            <Label className="text-xs">Data final</Label>
            <Input type="date" value={filterDataFim} onChange={e => { setFilterDataFim(e.target.value); setPageCot(1); }} />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <FilterX className="mr-1 h-4 w-4" />Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} cotação{filtered.length !== 1 ? "ões" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
          {hasActiveFilters && ` (de ${cotacoes.length} total)`}
        </p>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 flex-wrap">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {selectedIds.length} cotação{selectedIds.length > 1 ? "ões" : ""} selecionada{selectedIds.length > 1 ? "s" : ""}
          </span>
          <Button size="sm" variant="outline" onClick={handlePrintCotacoes}>
            <FileDown className="h-4 w-4 mr-1" /> Imprimir Cotações (PDF)
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrintPedidosCotacao}>
            <FileText className="h-4 w-4 mr-1" /> Imprimir Pedidos de Cotação
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Limpar Seleção</Button>
        </div>
      )}

      <div className="border rounded-lg">
        <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected && filtered.length > 0} onCheckedChange={toggleSelectAll} />
              </TableHead>
              {colOrder.map(key => {
                const cd = colDefs[key];
                return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
              })}
              <TableHead className="w-16 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colOrder.length + 2} className="text-center text-muted-foreground py-8">Nenhuma cotação encontrada</TableCell></TableRow>
            ) : paginate(filtered, pageCot, pageSizeCot).paginated.map((c, idx) => {
              const rcVinculada = requisicoes.find(r => r.id === c.requisicaoId);
              const horasDesdeCriacao = (Date.now() - new Date(c.dataCriacao).getTime()) / (1000 * 60 * 60);
              const cotacaoAberta = c.status === "Em Andamento" || c.status === "Aguardando Aprovação";
              const alertaUrgente = (rcVinculada?.urgencia === "Urgente" || rcVinculada?.urgencia === "Alta") && horasDesdeCriacao > 12 && cotacaoAberta;
              const alertaTitle = alertaUrgente ? `${rcVinculada?.urgencia}: cotação aberta há mais de 12h sem finalização` : "";
              const cellMap: Record<string, ReactNode> = {
                numero: (
                  <span className="font-mono font-bold inline-flex items-center gap-1">
                    COT-{String(c.numero).padStart(4, "0")}
                    {alertaUrgente && <AlertTriangle className="h-4 w-4 text-red-600 animate-blink-urgent" aria-label={alertaTitle} />}
                  </span>
                ),
                centroCusto: <span className="text-sm">{rcVinculada?.centroCustoNome || "-"}</span>,
                urgencia: rcVinculada?.urgencia ? (
                  <Badge title={alertaTitle} className={`${
                    rcVinculada.urgencia === "Urgente" ? "bg-red-600 text-white hover:bg-red-700" :
                    rcVinculada.urgencia === "Alta" ? "bg-orange-500 text-white hover:bg-orange-600" :
                    rcVinculada.urgencia === "Normal" ? "bg-blue-500 text-white hover:bg-blue-600" :
                    "bg-gray-400 text-white hover:bg-gray-500"
                  } ${alertaUrgente ? "animate-blink-urgent" : ""}`}>{rcVinculada.urgencia}</Badge>
                ) : <span className="text-muted-foreground">-</span>,
                rcs: <a href={`/compras/requisicoes?numero=${c.requisicaoNumero}`} className="font-mono text-primary hover:underline">RC-{String(c.requisicaoNumero).padStart(4, "0")}</a>,
                data: format(new Date(c.dataCriacao), "dd/MM/yyyy"),
                comprador: c.comprador,
                propostas: <Badge variant="secondary">{c.propostas.length}</Badge>,
                status: <Badge className={statusColors[c.status] || ""}>{c.status}</Badge>,
              };
              return (
              <TableRow key={c.id} className={selectedIds.includes(c.id) ? "bg-primary/5" : (idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60")}>
                <TableCell>
                  <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                </TableCell>
                {colOrder.map(key => <TableCell key={key} className={colDefs[key]?.className}>{cellMap[key]}</TableCell>)}
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {c.status === "Revisão de Confirmação" && !pedidos.some(p => p.cotacaoId === c.id) && (
                        <>
                          <DropdownMenuItem onClick={() => openConfirmacaoValores(c)}>
                            <ShieldCheck className="mr-2 h-4 w-4" />Confirmar Valores e Emitir OC
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => setViewCotacao(c)}>
                        <Eye className="mr-2 h-4 w-4" />Detalhes
                      </DropdownMenuItem>

                      <DropdownMenuItem onClick={() => openMapa(c)} disabled={c.propostas.length === 0}>
                        <BarChart3 className="mr-2 h-4 w-4" />Mapa Comparativo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const req = requisicoes.find(r => r.id === c.requisicaoId) || null;
                        downloadPdfCotacao({ cotacao: c, requisicao: req, empresa });
                        toast({ title: "PDF gerado com sucesso" });
                      }}>
                        <FileDown className="mr-2 h-4 w-4" />Exportar PDF Cotação
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        const req = requisicoes.find(r => r.id === c.requisicaoId) || null;
                        const fornsComProposta = c.propostas.map(p => {
                          const fData = fornecedores.find(f => f.id === p.fornecedorId);
                          return {
                            id: p.fornecedorId,
                            nome: p.fornecedorNome,
                            cnpj: fData?.cnpj || "",
                            email: fData?.emailCompras || fData?.email || "",
                            telefone: fData?.telefoneCelular || (fData?.telefones?.[0]) || "",
                          };
                        });
                        const fornsUnicos = fornsComProposta.filter((f, i, arr) => arr.findIndex(a => a.id === f.id) === i);
                        if (fornsUnicos.length === 0) {
                          toast({ title: "Nenhum fornecedor", description: "Adicione propostas ou envie para fornecedores antes de gerar os PDFs.", variant: "destructive" });
                          return;
                        }
                        await downloadPdfPedidoCotacaoTodos(c, req, empresa, fornsUnicos);
                        toast({ title: `${fornsUnicos.length} PDF(s) de pedido de cotação gerado(s)` });
                      }}>
                        <FileText className="mr-2 h-4 w-4" />Pedido de Cotação por Fornecedor
                      </DropdownMenuItem>
                      {(c.status === "Em Andamento" || c.status === "Aguardando Aprovação") && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEnviarDialog(c.id)}>
                            <Send className="mr-2 h-4 w-4" />Enviar para Fornecedor
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPdfDialog(c.id)}>
                            <Mail className="mr-2 h-4 w-4" />Enviar PDF da Cotação por E-mail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPropostaDialog(c.id)}>
                            <Plus className="mr-2 h-4 w-4" />Adicionar Proposta Manual
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            openPropostaDialog(c.id);
                            setTimeout(() => document.getElementById("ia-proposta-file")?.click(), 350);
                          }}>
                            <Sparkles className="mr-2 h-4 w-4" />Ler Proposta em PDF com IA
                          </DropdownMenuItem>
                          {c.status === "Em Andamento" && (
                            <DropdownMenuItem onClick={() => openFinalizarDialog(c.id)} disabled={c.propostas.length < 1}>
                              <Lock className="mr-2 h-4 w-4" />Finalizar Cotação
                            </DropdownMenuItem>
                          )}
                          {c.status === "Aguardando Aprovação" && (
                            <DropdownMenuItem onClick={() => openAprovarDialog(c.id)}>
                              <ShieldCheck className="mr-2 h-4 w-4" />Aprovar Cotação
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => { cancelarCotacao(c.id); toast({ title: "Cotação cancelada" }); }}>
                            <XCircle className="mr-2 h-4 w-4" />Cancelar
                          </DropdownMenuItem>
                        </>
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
        <PaginationControls currentPage={pageCot} totalItems={filtered.length} onPageChange={setPageCot} pageSize={pageSizeCot} onPageSizeChange={(s) => { setPageSizeCot(s); setPageCot(1); }} />
      </div>

      {/* Dialog Nova Cotação */}
      <Dialog open={novaDialogOpen} onOpenChange={setNovaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Cotação</DialogTitle>
          <DialogDescription>Selecione a requisição de compras para iniciar a cotação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nº, centro de custo, solicitante, item..."
                  value={reqSearch}
                  onChange={e => setReqSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={reqFilterUrgencia} onValueChange={setReqFilterUrgencia}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas Urgências</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Requisição de Compras *</Label>
              <Select value={selectedReqId} onValueChange={setSelectedReqId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma RC..." /></SelectTrigger>
                <SelectContent>
                  {reqFiltradas.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      RCS-{String(r.numero).padStart(4, "0")} — {r.centroCustoNome} ({r.itens.length} itens) [{r.urgencia}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reqFiltradas.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">Nenhuma requisição encontrada com os filtros aplicados.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNovaDialogOpen(false); setReqSearch(""); setReqFilterUrgencia("Todas"); }}>Cancelar</Button>
            <Button onClick={handleCriarCotacao}>Criar Cotação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Adicionar Proposta */}
      <Dialog open={propostaDialogOpen} onOpenChange={setPropostaDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPropostaId ? "Editar Proposta de Fornecedor" : "Adicionar Proposta de Fornecedor"}</DialogTitle>
            <DialogDescription>Preencha os dados da proposta recebida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-3 bg-muted/40 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium">Leitura automática por IA</span>
                  <span className="text-muted-foreground">— envie o PDF da proposta do fornecedor e os preços serão preenchidos.</span>
                </div>
                <div>
                  <input
                    id="ia-proposta-file"
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) lerPropostaPdf(f); e.currentTarget.value = ""; }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={iaLoading}
                    onClick={() => document.getElementById("ia-proposta-file")?.click()}
                  >
                    {iaLoading
                      ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Lendo documento…</>
                      : <><Upload className="mr-2 h-4 w-4" />Ler PDF com IA</>}
                  </Button>
                </div>
              </div>
              {iaResumo && (
                <p className="text-xs text-muted-foreground">
                  <strong>{iaResumo.arquivo}</strong>: {iaResumo.lidos} de {iaResumo.total} itens preenchidos
                  {iaResumo.fornecedorNome ? ` • Fornecedor identificado: ${iaResumo.fornecedorNome}` : ""} — confira os valores antes de salvar.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor *</Label>
                {editingPropostaId ? (
                  <Input value={fornecedores.find(f => f.id === propFornecedorId)?.nome || ""} disabled />
                ) : (
                  <Select value={propFornecedorId} onValueChange={setPropFornecedorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{(() => {
                      const cotAtual = cotacoes.find(c => c.id === propostaCotacaoId);
                      const idsJaComProposta = cotAtual?.propostas.map(p => p.fornecedorId) || [];
                      const disponiveis = fornecedores.filter(f => !idsJaComProposta.includes(f.id));
                      return disponiveis.length > 0
                        ? disponiveis.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)
                        : <div className="px-2 py-4 text-sm text-muted-foreground text-center">Todos os fornecedores já possuem proposta</div>;
                    })()}</SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Condição de Pagamento</Label>
                <Input value={propCondicao} onChange={e => setPropCondicao(e.target.value)} placeholder="Ex: 30/60/90 dias" />
              </div>
              <div>
                <Label>Prazo de Entrega</Label>
                <Input value={propPrazo} onChange={e => setPropPrazo(e.target.value)} placeholder="Ex: 15 dias úteis" />
              </div>
              <div>
                <Label>Validade da Proposta</Label>
                <Input type="date" value={propValidade} onChange={e => setPropValidade(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Custos de Frete (R$)</Label>
                <Input type="number" min="0" step="0.01" value={propFrete} placeholder="0,00"
                  onChange={e => setPropFrete(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label>Custos de Operação (R$)</Label>
                <Input type="number" min="0" step="0.01" value={propOperacao} placeholder="0,00"
                  onChange={e => setPropOperacao(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label>Custo de Seguro (R$)</Label>
                <Input type="number" min="0" step="0.01" value={propSeguro} placeholder="0,00"
                  onChange={e => setPropSeguro(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={propObs} onChange={e => setPropObs(e.target.value)} rows={2} />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Itens e Preços</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-20">Qtd</TableHead>
                      <TableHead className="w-16">Un</TableHead>
                      <TableHead className="w-32">Preço Unit. *</TableHead>
                      <TableHead className="w-32">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propItens.map((item, idx) => (
                      <TableRow key={item.itemId}>
                        <TableCell className="text-sm">{item.descricao}</TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>{item.unidadeMedida}</TableCell>
                        <TableCell>
                          <Input type="number" min="0" step="0.01" value={item.precoUnitario || ""} onChange={e => {
                            const val = Number(e.target.value);
                            setPropItens(prev => prev.map((it, i) => i === idx ? { ...it, precoUnitario: val } : it));
                          }} className="h-8" />
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.precoUnitario * item.quantidade)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="text-right mt-2 space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Subtotal itens: {formatCurrency(propItens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Frete: {formatCurrency(Number(propFrete) || 0)} • Operação: {formatCurrency(Number(propOperacao) || 0)} • Seguro: {formatCurrency(Number(propSeguro) || 0)}
                  </div>
                  <div className="font-bold text-lg">
                    Total: {formatCurrency(propItens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0) + (Number(propFrete) || 0) + (Number(propOperacao) || 0) + (Number(propSeguro) || 0))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropostaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddProposta}>{editingPropostaId ? "Atualizar Proposta" : "Salvar Proposta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Finalizar Cotação (travar valores) */}
      <Dialog open={finalizarDialogOpen} onOpenChange={setFinalizarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Cotação</DialogTitle>
            <DialogDescription>
              Ao finalizar, os valores das propostas serão travados e a cotação será enviada para aprovação do usuário autorizador.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const cot = cotacoes.find(c => c.id === finalizarCotacaoId);
            if (!cot) return null;
            return (
              <div className="space-y-3">
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Cotação:</span> COT-{String(cot.numero).padStart(4, "0")}</p>
                  <p><span className="text-muted-foreground">Propostas recebidas:</span> {cot.propostas.length}</p>
                </div>
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Os valores das propostas serão travados
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhuma proposta poderá ser adicionada ou removida após a finalização. O aprovador poderá autorizar por pedido completo ou por item individual.
                  </p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizarDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleFinalizar}>
              <Lock className="mr-2 h-4 w-4" />Finalizar e Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Aprovar Cotação */}
      <Dialog open={aprovarDialogOpen} onOpenChange={setAprovarDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aprovar Cotação</DialogTitle>
            <DialogDescription>
              {finModoItemizado
                ? "Selecione o fornecedor vencedor para cada item usando os checkboxes. Pedidos separados serão gerados por fornecedor."
                : "Selecione o fornecedor vencedor e justifique a escolha. Um Ordem de Compra será gerado automaticamente."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Aprovar por item</Label>
                <p className="text-xs text-muted-foreground">
                  Permite escolher fornecedores diferentes para cada item
                </p>
              </div>
              <Switch
                checked={finModoItemizado}
                onCheckedChange={(checked) => {
                  setFinModoItemizado(checked);
                  if (checked) setFinVencedorId("");
                  else setFinItensVencedores({});
                }}
              />
            </div>

            {!finModoItemizado && (
              <div>
                <Label>Fornecedor Vencedor *</Label>
                <Select value={finVencedorId} onValueChange={setFinVencedorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {cotacoes.find(c => c.id === aprovarCotacaoId)?.propostas.map(p => (
                      <SelectItem key={p.fornecedorId} value={p.fornecedorId}>{p.fornecedorNome} — {formatCurrency(p.valorTotal)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {finModoItemizado && (() => {
              const cot = cotacoes.find(c => c.id === aprovarCotacaoId);
              const req = cot ? requisicoes.find(r => r.id === cot.requisicaoId) : null;
              if (!cot || !req) return null;
              const propostas = cot.propostas;

              const handleToggleItem = (itemId: string, fornId: string) => {
                setFinItensVencedores(prev => {
                  if (prev[itemId] === fornId) {
                    const next = { ...prev };
                    delete next[itemId];
                    return next;
                  }
                  return { ...prev, [itemId]: fornId };
                });
              };

              const handleToggleTodos = (fornId: string) => {
                const allSelected = req.itens.every(item => finItensVencedores[item.id] === fornId);
                if (allSelected) {
                  setFinItensVencedores({});
                } else {
                  const next: Record<string, string> = {};
                  req.itens.forEach(item => { next[item.id] = fornId; });
                  setFinItensVencedores(next);
                }
              };

              const handleSelecionarMelhorPreco = () => {
                const next: Record<string, string> = {};
                req.itens.forEach(item => {
                  let bestFornId = "";
                  let bestPrice = Infinity;
                  propostas.forEach(p => {
                    const pi = p.itens.find(i => i.itemId === item.id);
                    if (pi && pi.precoUnitario > 0 && pi.precoUnitario < bestPrice) {
                      bestPrice = pi.precoUnitario;
                      bestFornId = p.fornecedorId;
                    }
                  });
                  if (bestFornId) next[item.id] = bestFornId;
                });
                setFinItensVencedores(next);
              };

              return (
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={handleSelecionarMelhorPreco}>
                    <Trophy className="mr-2 h-4 w-4" />Selecionar Melhor Preço por Item
                  </Button>
                  <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Material / Serviço</TableHead>
                        <TableHead className="w-16">Un.</TableHead>
                        <TableHead className="w-20">Qtd.</TableHead>
                        {propostas.map(p => {
                          const allSelected = req.itens.every(item => finItensVencedores[item.id] === p.fornecedorId);
                          return (
                            <TableHead key={p.fornecedorId} className="min-w-[180px] text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-semibold text-xs">{p.fornecedorNome}</span>
                                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => handleToggleTodos(p.fornecedorId)}
                                    className="rounded border-input"
                                  />
                                  Todos
                                </label>
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {req.itens.map(item => {
                        const unitPrices = propostas.map(p => {
                          const pi = p.itens.find(i => i.itemId === item.id);
                          return pi ? pi.precoUnitario : Infinity;
                        });
                        const minPrice = Math.min(...unitPrices.filter(v => v > 0 && v !== Infinity));

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm font-medium">{item.descricao}</TableCell>
                            <TableCell className="text-sm">{item.unidadeMedida}</TableCell>
                            <TableCell className="text-sm">{item.quantidade}</TableCell>
                            {propostas.map(p => {
                              const pi = p.itens.find(i => i.itemId === item.id);
                              const isSelected = finItensVencedores[item.id] === p.fornecedorId;
                              const isCheapest = pi && pi.precoUnitario === minPrice && pi.precoUnitario > 0;

                              return (
                                <TableCell key={p.fornecedorId} className={`text-center ${isSelected ? "bg-primary/10" : ""}`}>
                                  {pi && pi.precoUnitario > 0 ? (
                                    <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleItem(item.id, p.fornecedorId)}
                                        className="rounded border-input"
                                      />
                                      <span className={`text-xs ${isCheapest ? "font-bold" : ""}`} style={isCheapest ? { color: "#4169E1" } : undefined}>
                                        {formatCurrency(pi.precoUnitario)} | {formatCurrency(pi.precoUnitario * pi.quantidade)}
                                      </span>
                                    </label>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={3}>TOTAL</TableCell>
                        {propostas.map(p => (
                          <TableCell key={p.fornecedorId} className="text-center text-sm">
                            {formatCurrency(p.valorTotal)}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground text-sm">Condição Pgto</TableCell>
                        {propostas.map(p => (
                          <TableCell key={p.fornecedorId} className="text-center text-xs">{p.condicaoPagamento || "-"}</TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground text-sm">Prazo Entrega</TableCell>
                        {propostas.map(p => (
                          <TableCell key={p.fornecedorId} className="text-center text-xs">{p.prazoEntrega || "-"}</TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              );
            })()}

            {/* Summary */}
            {finModoItemizado && Object.keys(finItensVencedores).length > 0 && (() => {
              const cot = cotacoes.find(c => c.id === aprovarCotacaoId);
              if (!cot) return null;
              const groups: Record<string, { nome: string; total: number; count: number }> = {};
              for (const [itemId, fornId] of Object.entries(finItensVencedores)) {
                const prop = cot.propostas.find(p => p.fornecedorId === fornId);
                const pi = prop?.itens.find(i => i.itemId === itemId);
                if (!prop || !pi) continue;
                if (!groups[fornId]) groups[fornId] = { nome: prop.fornecedorNome, total: 0, count: 0 };
                groups[fornId].total += pi.precoUnitario * pi.quantidade;
                groups[fornId].count++;
              }
              return (
                <div className="space-y-1 rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Resumo da aprovação:</p>
                  {Object.entries(groups).map(([id, g]) => (
                    <div key={id} className="flex justify-between text-sm">
                      <span>{g.nome} <span className="text-muted-foreground">({g.count} {g.count === 1 ? "item" : "itens"})</span></span>
                      <span className="font-medium">{formatCurrency(g.total)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                    <span>Total Geral</span>
                    <span>{formatCurrency(Object.values(groups).reduce((s, g) => s + g.total, 0))}</span>
                  </div>
                </div>
              );
            })()}

            <div>
              <Label>Justificativa da Aprovação</Label>
              <Textarea value={finJustificativa} onChange={e => setFinJustificativa(e.target.value)} placeholder="Justifique a aprovação e escolha do(s) fornecedor(es)..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAprovarDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAprovar}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {finModoItemizado ? "Aprovar e Emitir Pedidos" : "Aprovar e Emitir Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes */}
      <Dialog open={!!viewCotacao} onOpenChange={() => setViewCotacao(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>COT-{viewCotacao && String(viewCotacao.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>Detalhes da cotação de compras</DialogDescription>
          </DialogHeader>
          {viewCotacao && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">RCS Vinculada:</span> RCS-{String(viewCotacao.requisicaoNumero).padStart(4, "0")}</div>
                <div><span className="text-muted-foreground">Comprador:</span> {viewCotacao.comprador}</div>
                <div><span className="text-muted-foreground">Data:</span> {format(new Date(viewCotacao.dataCriacao), "dd/MM/yyyy HH:mm")}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[viewCotacao.status]}>{viewCotacao.status}</Badge></div>
                {viewCotacao.fornecedorVencedorId && (
                  <>
                    <div><span className="text-muted-foreground">Vencedor:</span> {viewCotacao.propostas.find(p => p.fornecedorId === viewCotacao.fornecedorVencedorId)?.fornecedorNome}</div>
                    <div><span className="text-muted-foreground">Justificativa:</span> {viewCotacao.justificativaEscolha}</div>
                  </>
                )}
              </div>
              {(() => {
                const reqView = requisicoes.find(r => r.id === viewCotacao.requisicaoId);
                const itensView = reqView?.itens || [];
                return (
                  <div>
                    <h3 className="font-semibold mt-4 mb-2">Materiais / Serviços Cotados ({itensView.length})</h3>
                    {itensView.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum item encontrado na requisição vinculada.</p>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">#</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="w-24 text-right">Qtd.</TableHead>
                              <TableHead className="w-20">Un.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itensView.map((i: any, idx: number) => (
                              <TableRow key={i.id || idx}>
                                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell>{i.descricao}</TableCell>
                                <TableCell className="text-right">{i.quantidade}</TableCell>
                                <TableCell>{i.unidadeMedida}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })()}
              <h3 className="font-semibold mt-4">Propostas ({viewCotacao.propostas.length})</h3>
              {viewCotacao.propostas.map(p => {
                const isEditable = viewCotacao.status === "Em Andamento" || viewCotacao.status === "Aguardando Aprovação";
                return (
                <Card key={p.id} className={p.fornecedorId === viewCotacao.fornecedorVencedorId ? "border-green-500 border-2" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {p.fornecedorNome}
                      {p.fornecedorId === viewCotacao.fornecedorVencedorId && <Badge className="bg-green-100 text-green-800">Vencedor</Badge>}
                      <span className="ml-auto font-bold">{formatCurrency(p.valorTotal)}</span>
                      {isEditable && (
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewCotacao(null); openEditPropostaDialog(viewCotacao.id, p); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { removeProposta(viewCotacao.id, p.id); toast({ title: "Proposta removida" }); setViewCotacao({ ...viewCotacao, propostas: viewCotacao.propostas.filter(pr => pr.id !== p.id) }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <p>Pagamento: {p.condicaoPagamento || "-"} | Prazo: {p.prazoEntrega || "-"} | Validade: {p.validadeProposta ? format(new Date(p.validadeProposta), "dd/MM/yyyy") : "-"}</p>
                    {p.observacao && <p>Obs: {p.observacao}</p>}
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Mapa Comparativo */}
      <Dialog open={mapaDialogOpen} onOpenChange={setMapaDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mapa Comparativo — COT-{mapaCotacao && String(mapaCotacao.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>Comparação de propostas dos fornecedores</DialogDescription>
          </DialogHeader>
          {mapaCotacao && mapaCotacao.propostas.length > 0 && (() => {
            const req = requisicoes.find(r => r.id === mapaCotacao.requisicaoId);
            const itensBase = req?.itens || [];
            const menorTotal = Math.min(...mapaCotacao.propostas.map(p => p.valorTotal));
            return (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Item</TableHead>
                      <TableHead className="w-16">Qtd</TableHead>
                      {mapaCotacao.propostas.map(p => (
                        <TableHead key={p.id} className="min-w-[140px] text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span>{p.fornecedorNome}</span>
                            {p.fornecedorId === mapaCotacao.fornecedorVencedorId && <Badge className="bg-green-100 text-green-800 text-[10px]">Vencedor</Badge>}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensBase.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.descricao}</TableCell>
                        <TableCell>{item.quantidade} {item.unidadeMedida}</TableCell>
                        {mapaCotacao.propostas.map(p => {
                          const pi = p.itens.find(i => i.itemId === item.id);
                          const unitPrices = mapaCotacao.propostas.map(pr => pr.itens.find(i => i.itemId === item.id)?.precoUnitario || Infinity);
                          const minPrice = Math.min(...unitPrices);
                          const isCheapest = pi && pi.precoUnitario === minPrice;
                          return (
                            <TableCell key={p.id} className={`text-center ${isCheapest ? "bg-green-50 font-bold text-green-700" : ""}`}>
                              {pi ? (
                                <div>
                                  <div className="text-xs text-muted-foreground">Unit: {formatCurrency(pi.precoUnitario)}</div>
                                  <div>{formatCurrency(pi.precoUnitario * pi.quantidade)}</div>
                                </div>
                              ) : "-"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={2}>TOTAL</TableCell>
                      {mapaCotacao.propostas.map(p => (
                        <TableCell key={p.id} className={`text-center ${p.valorTotal === menorTotal ? "bg-green-50 text-green-700" : ""}`}>
                          {formatCurrency(p.valorTotal)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground">Condição Pgto</TableCell>
                      {mapaCotacao.propostas.map(p => <TableCell key={p.id} className="text-center text-sm">{p.condicaoPagamento || "-"}</TableCell>)}
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={2} className="text-muted-foreground">Prazo Entrega</TableCell>
                      {mapaCotacao.propostas.map(p => <TableCell key={p.id} className="text-center text-sm">{p.prazoEntrega || "-"}</TableCell>)}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog Enviar para Fornecedor */}
      <Dialog open={enviarDialogOpen} onOpenChange={v => { setEnviarDialogOpen(v); if (!v) { setLinkGerado(""); setLinksGeradosTodos([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar Cotação para Fornecedores</DialogTitle>
            <DialogDescription>Gere o link para um fornecedor específico ou para todos de uma vez.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Seleção de canais de envio */}
            {linksGeradosTodos.length === 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="text-sm font-medium mb-2">Canais de envio</p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={canalEmail} onCheckedChange={v => setCanalEmail(!!v)} />
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">E-mail</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={canalWhatsapp} onCheckedChange={v => setCanalWhatsapp(!!v)} />
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">WhatsApp</span>
                  </label>
                </div>
              </div>
            )}
            {/* Seleção de fornecedores */}
            {linksGeradosTodos.length === 0 && !linkGerado && (() => {
              const fornFiltrados = fornecedores.filter(f => {
                const t = filtroFornecedor.trim().toLowerCase();
                if (!t) return true;
                return (f.nome || "").toLowerCase().includes(t) || (f.nomeFantasia || "").toLowerCase().includes(t);
              });
              const allFilteredSelected = fornFiltrados.length > 0 && fornFiltrados.every(f => fornecedoresSelecionadosIds.includes(f.id));
              const someFilteredSelected = fornFiltrados.some(f => fornecedoresSelecionadosIds.includes(f.id));
              const toggleAll = () => {
                if (allFilteredSelected) {
                  setFornecedoresSelecionadosIds(prev => prev.filter(id => !fornFiltrados.some(f => f.id === id)));
                } else {
                  setFornecedoresSelecionadosIds(prev => Array.from(new Set([...prev, ...fornFiltrados.map(f => f.id)])));
                }
              };
              const toggleOne = (id: string) => {
                setFornecedoresSelecionadosIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
              };
              const canais = [canalEmail && "e-mail", canalWhatsapp && "WhatsApp"].filter(Boolean).join(" e ") || "nenhum canal";
              return (
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">Selecionar fornecedores</p>
                      <p className="text-xs text-muted-foreground">
                        {fornecedoresSelecionadosIds.length} de {fornecedores.length} selecionado(s) — envio por {canais}
                      </p>
                    </div>
                    <Button onClick={handleGerarEEnviarTodos} disabled={enviarTodosLoading || fornecedoresSelecionadosIds.length === 0}>
                      <Send className="mr-2 h-4 w-4" />
                      {enviarTodosLoading ? "Enviando..." : `Enviar para Selecionados (${fornecedoresSelecionadosIds.length})`}
                    </Button>
                  </div>
                  <Input
                    placeholder="Filtrar fornecedores..."
                    value={filtroFornecedor}
                    onChange={e => setFiltroFornecedor(e.target.value)}
                    className="h-8"
                  />
                  <div className="flex items-center gap-2 px-1 py-1 border-b">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-xs text-muted-foreground">
                      {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
                      {filtroFornecedor && " (filtrados)"}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y">
                    {fornFiltrados.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">Nenhum fornecedor encontrado</p>
                    ) : fornFiltrados.map(f => {
                      const emailForn = (f as any).emailCompras || f.email || "";
                      const telForn = getTelefoneFornecedor(f);
                      const semContato = !emailForn && !telForn;
                      return (
                        <label key={f.id} className="flex items-center gap-2 py-2 px-1 cursor-pointer hover:bg-muted/30">
                          <Checkbox
                            checked={fornecedoresSelecionadosIds.includes(f.id)}
                            onCheckedChange={() => toggleOne(f.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{f.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {emailForn || "sem e-mail"} · {telForn || "sem WhatsApp"}
                            </p>
                          </div>
                          {semContato && <span className="text-xs text-amber-600 shrink-0">⚠ sem contato</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Resultados envio em massa */}
            {linksGeradosTodos.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-medium">Links gerados ({linksGeradosTodos.filter(r => r.link).length}/{linksGeradosTodos.length})</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyAllLinks}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copiar Todos
                    </Button>
                    <Button size="sm" onClick={handleEnviarEmailTodos} disabled={enviarEmailTodosLoading || linksGeradosTodos.filter(r => r.link).length === 0}>
                      <Mail className="mr-2 h-3.5 w-3.5" />
                      {enviarEmailTodosLoading ? "Enviando..." : "Enviar por E-mail"}
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {linksGeradosTodos.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.fornecedorNome}</p>
                        {r.erro && <p className="text-xs text-amber-600">{r.erro}</p>}
                      </div>
                      {r.link ? (
                        <Button variant="ghost" size="sm" onClick={() => handleCopyLink(r.link)} title="Copiar link">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Separador */}
            {linksGeradosTodos.length === 0 && !linkGerado && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou enviar individualmente</span></div>
              </div>
            )}

            {/* Envio individual */}
            {linksGeradosTodos.length === 0 && (
              <>
                <div>
                  <Label>Fornecedor *</Label>
                  <Select value={enviarFornecedorId} onValueChange={handleSelectFornecedorEnviar}>
                    <SelectTrigger><SelectValue placeholder="Selecione um fornecedor..." /></SelectTrigger>
                    <SelectContent>
                      {fornecedores.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>E-mail do Fornecedor</Label>
                    <Input
                      type="email"
                      value={enviarEmail}
                      onChange={e => setEnviarEmail(e.target.value)}
                      placeholder="email@fornecedor.com"
                    />
                  </div>
                  <div>
                    <Label>WhatsApp do Fornecedor</Label>
                    <Input
                      type="tel"
                      value={enviarTelefone}
                      onChange={e => setEnviarTelefone(e.target.value)}
                      placeholder="(11) 91234-5678"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">Preenchidos automaticamente do cadastro. Ajuste se necessário. O envio ocorre nos canais preenchidos.</p>

                {(() => {
                  const canais = [canalEmail && "E-mail", canalWhatsapp && "WhatsApp"].filter(Boolean).join(" + ");
                  const disabled = enviarLoading || !enviarFornecedorId || (!canalEmail && !canalWhatsapp) ||
                    (canalEmail && !enviarEmail && (!canalWhatsapp || !enviarTelefone)) ||
                    (canalWhatsapp && !enviarTelefone && (!canalEmail || !enviarEmail));
                  return (
                    <Button onClick={handleGerarEEnviarIndividual} disabled={disabled} className="w-full">
                      <Send className="mr-2 h-4 w-4" />
                      {enviarLoading ? "Enviando..." : canais ? `Enviar Cotação por ${canais}` : "Selecione um canal"}
                    </Button>
                  );
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEnviarDialogOpen(false); setLinkGerado(""); setLinksGeradosTodos([]); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Enviar PDF da Cotação por E-mail */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar PDF da Cotação por E-mail</DialogTitle>
            <DialogDescription>
              Gera o PDF do Pedido de Cotação e envia aos e-mails dos fornecedores selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Fornecedores * ({pdfFornecedorIds.length} selecionado(s))</Label>
                {pdfFornecedorIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => { setPdfFornecedorIds([]); setPdfEmails({}); }}>Limpar</Button>
                )}
              </div>
              <Input
                placeholder="Buscar fornecedor..."
                value={pdfBusca}
                onChange={e => setPdfBusca(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                {fornecedores
                  .filter(f => f.nome.toLowerCase().includes(pdfBusca.toLowerCase()))
                  .map(f => (
                    <label key={f.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={pdfFornecedorIds.includes(f.id)}
                        onCheckedChange={() => togglePdfFornecedor(f.id)}
                      />
                      <span className="text-sm">{f.nome}</span>
                    </label>
                  ))}
                {fornecedores.filter(f => f.nome.toLowerCase().includes(pdfBusca.toLowerCase())).length === 0 && (
                  <p className="text-sm text-muted-foreground py-2 text-center">Nenhum fornecedor encontrado</p>
                )}
              </div>
            </div>

            {pdfFornecedorIds.length > 0 && (
              <div className="space-y-2">
                <Label>E-mails dos Fornecedores *</Label>
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {pdfFornecedorIds.map(id => {
                    const f = fornecedores.find(x => x.id === id);
                    return (
                      <div key={id}>
                        <p className="text-xs text-muted-foreground mb-1">{f?.nome}</p>
                        <Input
                          type="email"
                          value={pdfEmails[id] || ""}
                          onChange={e => setPdfEmails(prev => ({ ...prev, [id]: e.target.value }))}
                          placeholder="email@fornecedor.com"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Preenchidos do cadastro. Ajuste se necessário.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEnviarPdfFornecedor} disabled={pdfLoading || pdfFornecedorIds.length === 0}>
              <Mail className="mr-2 h-4 w-4" />
              {pdfLoading ? "Enviando..." : `Enviar PDF${pdfFornecedorIds.length > 1 ? ` (${pdfFornecedorIds.length})` : ""}`}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      <ConfirmacaoValoresDialog
        open={confirmacaoDialogOpen}
        onOpenChange={(o) => { setConfirmacaoDialogOpen(o); if (!o) setPlanoEmissao(null); }}
        itens={itensConfirmacao}
        onConfirm={handleConfirmarValores}
        responsavel={usuarioLogado?.nome || ""}
      />
    </div>
  );
}
