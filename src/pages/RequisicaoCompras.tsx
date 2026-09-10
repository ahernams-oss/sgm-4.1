import { lerArquivoBase64 } from "@/lib/compressFile";
import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { FileSpreadsheet } from "lucide-react";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useRequisicaoCompras, RequisicaoCompras, StatusRequisicaoCompras, GrauUrgencia, ItemRequisicaoCompras, AnexoRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useCotacaoCompras } from "@/contexts/CotacaoComprasContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";

import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { useFabricantes } from "@/contexts/FabricantesContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, Eye, FileText, Clock, Paperclip, X, ChevronsUpDown, Check, XCircle, Pencil, MoreHorizontal, AlertTriangle } from "lucide-react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import type { ReactNode } from "react";
import { usePermissao } from "@/hooks/usePermissao";
import { fetchAll, insertRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { notificarCompras, formatarPrioridade, formatarDataHora, formatarData, formatarPedido } from "@/lib/notificacoesCompras";

const statusColors: Record<StatusRequisicaoCompras, string> = {
  Rascunho: "bg-muted text-muted-foreground",
  Enviada: "bg-blue-100 text-blue-800",
  "Em Cotação": "bg-yellow-100 text-yellow-800",
  "Aguardando Aprovação": "bg-orange-100 text-orange-800",
  Aprovada: "bg-green-100 text-green-800",
  Reprovada: "bg-red-100 text-red-800",
  Recusada: "bg-rose-100 text-rose-800",
  "Pedido Emitido": "bg-indigo-100 text-indigo-800",
  "Em Entrega": "bg-purple-100 text-purple-800",
  "Recebida Parcial": "bg-amber-100 text-amber-800",
  Recebida: "bg-emerald-100 text-emerald-800",
  Concluída: "bg-green-200 text-green-900",
  Cancelada: "bg-red-200 text-red-900",
};

const URGENCIAS: GrauUrgencia[] = ["Baixa", "Normal", "Alta", "Urgente"];

export default function RequisicaoComprasPage() {
  const { requisicoes, addRequisicao, cancelarRequisicao, updateStatus, updateRequisicao } = useRequisicaoCompras();
  const { addCotacao, cotacoes } = useCotacaoCompras();
  const { pedidos } = usePedidoCompra();

  const { materiais } = useMateriaisServicos();
  const { getCodigoCompleto } = useCategoriasCompras();
  const codigoComposto = (m: any) => {
    const cat = m?.categoriaId ? getCodigoCompleto(m.categoriaId) : "";
    return cat ? `${cat}.${m.codigo}` : m.codigo;
  };
  const getGrupoCodigo = (materialId: string): string => {
    const m = materiais.find(x => x.id === materialId);
    if (!m?.categoriaId) return "";
    const full = getCodigoCompleto(m.categoriaId);
    return full.split(".")[0] || "";
  };
  const { fabricantes } = useFabricantes();
  const { clientes } = useClientes();
  const { usuarioLogado } = useAuth();
  const { tem } = usePermissao();
  const podeCriar = tem("requisicoes_compras.criar");
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewReq, setViewReq] = useState<RequisicaoCompras | null>(null);
  const [historicoReq, setHistoricoReq] = useState<RequisicaoCompras | null>(null);
  const [recusaReq, setRecusaReq] = useState<RequisicaoCompras | null>(null);
  const [recusaMotivo, setRecusaMotivo] = useState("");
  const [novoMotivoMode, setNovoMotivoMode] = useState(false);
  const [novoMotivoText, setNovoMotivoText] = useState("");
  const [justificativas, setJustificativas] = useState<{ id: string; motivo: string }[]>([]);
  const [gerenciarMotivosOpen, setGerenciarMotivosOpen] = useState(false);
  const { deleteId: cancelId, requestDelete: requestCancel, cancelDelete: abortCancel } = useDoubleConfirmDelete();
  const FILTERS_KEY = "requisicao_compras_filters_v1";
  const loadFilters = () => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {
        search: string; filterStatus: string; filterCentroCusto: string;
        filterUrgencia: string; filterSolicitante: string;
        filterDataIni: string; filterDataFim: string;
      };
    } catch { return null; }
  };
  const _savedFilters = loadFilters();
  const [search, setSearch] = useState(_savedFilters?.search ?? "");
  const [filterStatus, setFilterStatus] = useState<string>(_savedFilters?.filterStatus ?? "Todos");
  const [filterCentroCusto, setFilterCentroCusto] = useState<string>(_savedFilters?.filterCentroCusto ?? "Todos");
  const [filterUrgencia, setFilterUrgencia] = useState<string>(_savedFilters?.filterUrgencia ?? "Todas");
  const [filterSolicitante, setFilterSolicitante] = useState<string>(_savedFilters?.filterSolicitante ?? "Todos");
  const [filterDataIni, setFilterDataIni] = useState(_savedFilters?.filterDataIni ?? "");
  const [filterDataFim, setFilterDataFim] = useState(_savedFilters?.filterDataFim ?? "");

  const [pageReq, setPageReq] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const numeroParam = searchParams.get("numero");
    if (numeroParam) {
      setSearch(numeroParam);
      setFilterStatus("Todos");
      setFilterCentroCusto("Todos");
      setFilterUrgencia("Todas");
      setFilterSolicitante("Todos");
      setFilterDataIni("");
      setFilterDataFim("");
      setPageReq(1);
      searchParams.delete("numero");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({
        search, filterStatus, filterCentroCusto, filterUrgencia,
        filterSolicitante, filterDataIni, filterDataFim,
      }));
    } catch { /* ignore */ }
  }, [search, filterStatus, filterCentroCusto, filterUrgencia, filterSolicitante, filterDataIni, filterDataFim]);


  const loadJustificativas = async () => {
    const data = await fetchAll("requisicoes_compras_justificativas", "motivo");
    setJustificativas(data.map((d: any) => ({ id: d.id, motivo: d.motivo })));
  };
  useEffect(() => { loadJustificativas(); }, []);

  const podeRecusar = tem("requisicoes_compras.recusar") || tem("requisicoes_compras.criar");

  const colDefs: Record<string, { label: string; className?: string }> = {
    numero: { label: "Nº", className: "text-center" },
    data: { label: "Data", className: "text-center" },
    solicitante: { label: "Solicitante" },
    centroCusto: { label: "Centro de Custo" },
    urgencia: { label: "Urgência", className: "text-center" },
    itens: { label: "Itens", className: "text-center" },
    status: { label: "Status", className: "text-center" },
    ordemCompra: { label: "Ordem de Compra", className: "text-center" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "compras.requisicoes",
    ["numero", "data", "solicitante", "centroCusto", "urgencia", "itens", "status", "ordemCompra"]
  );


  // Form state
  const [centroCusto, setCentroCusto] = useState("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [urgencia, setUrgencia] = useState<GrauUrgencia>("Baixa");
  const [prazoDesejado, setPrazoDesejado] = useState("");
  const [itens, setItens] = useState<ItemRequisicaoCompras[]>([]);
  const [anexos, setAnexos] = useState<AnexoRequisicaoCompras[]>([]);

  // Item form
  const [itemMaterialId, setItemMaterialId] = useState("");
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);
  const [itemDescricao, setItemDescricao] = useState("");
  const [itemEspec, setItemEspec] = useState("");
  const [itemObs, setItemObs] = useState("");
  const [itemQtd, setItemQtd] = useState("");
  const [itemUnidade, setItemUnidade] = useState("UN");
  const [itemFabricanteId, setItemFabricanteId] = useState("");
  const [itemAnexo, setItemAnexo] = useState<{ nome: string; tipo: string; base64: string } | null>(null);
  const itemAnexoInputRef = useRef<HTMLInputElement>(null);

  const clientesLista = useMemo(() => clientes.filter(c => c.tipo === "Cliente"), [clientes]);

  const locaisEntregaDoCliente = useMemo(() => {
    if (!centroCusto) return [];
    const cliente = clientesLista.find(c => c.id === centroCusto);
    return cliente?.locaisEntrega || [];
  }, [centroCusto, clientesLista]);

  const filtered = useMemo(() => {
    let list = requisicoes;
    if (filterStatus !== "Todos") list = list.filter(r => r.status === filterStatus);
    if (filterCentroCusto !== "Todos") list = list.filter(r => r.centroCusto === filterCentroCusto);
    if (filterUrgencia !== "Todas") list = list.filter(r => r.urgencia === filterUrgencia);
    if (filterSolicitante !== "Todos") list = list.filter(r => r.solicitante === filterSolicitante);
    if (filterDataIni) list = list.filter(r => r.dataCriacao >= filterDataIni);
    if (filterDataFim) list = list.filter(r => r.dataCriacao <= filterDataFim + "T23:59:59");
    if (search) {
      const s = search.toLowerCase().trim();
      const sNum = s.replace(/^rcs-?/, "").replace(/^0+/, "");
      const numeroPad = (n: number) => String(n).padStart(4, "0");
      list = list.filter(r =>
        String(r.numero).includes(sNum) ||
        numeroPad(r.numero).includes(s.replace(/^rcs-?/, "")) ||
        `rcs-${numeroPad(r.numero)}`.includes(s) ||
        r.centroCustoNome.toLowerCase().includes(s) ||
        r.solicitante.toLowerCase().includes(s) ||
        r.itens.some(i => i.descricao.toLowerCase().includes(s))
      );
    }

    return list.sort((a, b) => b.numero - a.numero);
  }, [requisicoes, search, filterStatus, filterCentroCusto, filterUrgencia, filterSolicitante, filterDataIni, filterDataFim]);

  const solicitantesUnicos = useMemo(() =>
    Array.from(new Set(requisicoes.map(r => r.solicitante).filter(Boolean))).sort(),
    [requisicoes]
  );
  const centrosUnicos = useMemo(() => {
    const map = new Map<string, string>();
    requisicoes.forEach(r => { if (r.centroCusto) map.set(r.centroCusto, r.centroCustoNome); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requisicoes]);

  const limparFiltros = () => {
    setSearch(""); setFilterStatus("Todos"); setFilterCentroCusto("Todos");
    setFilterUrgencia("Todas"); setFilterSolicitante("Todos");
    setFilterDataIni(""); setFilterDataFim("");
  };

  const resetForm = () => {
    setCentroCusto(""); setLocalEntrega(""); setJustificativa(""); setUrgencia("Baixa"); setPrazoDesejado("");
    setItens([]); setAnexos([]);
    resetItemForm();
  };

  const resetItemForm = () => {
    setItemMaterialId(""); setItemDescricao(""); setItemEspec(""); setItemObs(""); setItemQtd(""); setItemUnidade("UN"); setItemFabricanteId("");
    setItemAnexo(null);
    if (itemAnexoInputRef.current) itemAnexoInputRef.current.value = "";
  };

  const handleItemAnexoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: `${file.name} excede 2MB`, variant: "destructive" }); e.target.value = ""; return; }
    const base64 = await lerArquivoBase64(file);
    setItemAnexo({ nome: file.name, tipo: file.type, base64 });
  };

  const grupoTravado = useMemo(() => {
    for (const it of itens) {
      const g = getGrupoCodigo(it.materialId);
      if (g) return g;
    }
    return "";
  }, [itens, materiais]);

  const addItem = () => {
    if (!itemDescricao.trim()) { toast({ title: "Descrição do item é obrigatória", variant: "destructive" }); return; }
    if (!itemQtd || Number(itemQtd) <= 0) { toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return; }
    if (!itemMaterialId) { toast({ title: "Selecione um material/serviço cadastrado", description: "É necessário selecionar um item do catálogo para validar a categoria.", variant: "destructive" }); return; }
    const grupoItem = getGrupoCodigo(itemMaterialId);
    if (grupoTravado && grupoItem && grupoItem !== grupoTravado) {
      toast({ title: "Categoria divergente", description: `Esta requisição só aceita itens da categoria ${grupoTravado}. Crie uma nova requisição para itens da categoria ${grupoItem}.`, variant: "destructive" });
      return;
    }
    setItens(prev => [...prev, {
      id: crypto.randomUUID(), materialId: itemMaterialId, descricao: itemDescricao,
      especificacaoTecnica: itemEspec, observacao: itemObs, quantidade: Number(itemQtd), unidadeMedida: itemUnidade,
      anexo: itemAnexo,
    }]);
    resetItemForm();
  };

  const removeItem = (id: string) => setItens(prev => prev.filter(i => i.id !== id));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 2 * 1024 * 1024) { toast({ title: `${file.name} excede 2MB`, variant: "destructive" }); continue; }
      const base64 = await lerArquivoBase64(file);
      setAnexos(prev => [...prev, { id: crypto.randomUUID(), nome: file.name, tipo: file.type, base64 }]);
    }
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!centroCusto) { toast({ title: "Centro de custo é obrigatório", variant: "destructive" }); return; }
    if (!justificativa.trim()) { toast({ title: "Justificativa é obrigatória", variant: "destructive" }); return; }
    if (itens.length === 0) { toast({ title: "Adicione pelo menos um item", variant: "destructive" }); return; }

    const cliente = clientesLista.find(c => c.id === centroCusto);
    if (editingId) {
      await updateRequisicao(editingId, {
        centroCusto,
        centroCustoNome: cliente?.nome || "",
        localEntrega,
        justificativa,
        urgencia,
        prazoDesejado,
        itens,
        anexos,
      });
      await updateStatus(editingId, "Enviada", usuarioLogado?.nome || "Usuário", "Requisição corrigida e reenviada");
      toast({ title: "Requisição reenviada com sucesso!" });
    } else {
      // Regra: alertar quando mais de 3 RCs "Urgente" no mesmo dia pelo mesmo solicitante
      let alertaUrgenteMsg = "";
      if (urgencia === "Urgente") {
        const solicitanteNome = usuarioLogado?.nome || "Usuário";
        const hojeInicio = new Date(); hojeInicio.setHours(0,0,0,0);
        const hojeFim = new Date(); hojeFim.setHours(23,59,59,999);
        let urgentesHoje = 0;
        try {
          const { count, error } = await (supabase as any)
            .from("requisicoes_compras")
            .select("id", { count: "exact", head: true })
            .eq("urgencia", "Urgente")
            .eq("solicitante", solicitanteNome)
            .gte("data_criacao", hojeInicio.toISOString())
            .lte("data_criacao", hojeFim.toISOString());
          if (error) throw error;
          urgentesHoje = count || 0;
        } catch (e) {
          console.error("Falha ao contar urgentes:", e);
          urgentesHoje = requisicoes.filter(r =>
            r.urgencia === "Urgente" &&
            r.solicitante === solicitanteNome &&
            (r.dataCriacao || "").slice(0, 10) === new Date().toISOString().slice(0,10)
          ).length;
        }
        console.log("[RC Urgente] count hoje:", urgentesHoje, "solicitante:", solicitanteNome);
        if (urgentesHoje + 1 > 3) {
          alertaUrgenteMsg = `Esta é sua ${urgentesHoje + 1}ª requisição 'Urgente' hoje. Planeje melhor suas compras para evitar pedidos emergenciais.`;
          // Notifica coordenadores via WhatsApp (não bloqueia o fluxo)
          (async () => {
            try {
              const { data: usuariosAll } = await (supabase as any)
                .from("usuarios")
                .select("nome,telefone,cargo_id");
              const { data: cargosAll } = await (supabase as any)
                .from("cargos")
                .select("id,nome");
              const cargosCoord = new Set(
                (cargosAll || []).filter((c: any) => /coorden/i.test(c?.nome || "")).map((c: any) => String(c.id))
              );
              const destinatarios = (usuariosAll || []).filter((u: any) =>
                u?.telefone && cargosCoord.has(String(u?.cargo_id))
              );
              const hojeBR = new Date().toLocaleDateString("pt-BR");
              const mensagem =
                `⚠️ *Alerta de RCs Urgentes*\n\n` +
                `O solicitante *${solicitanteNome}* já realizou *${urgentesHoje + 1}* requisições de compra com urgência *Urgente* hoje (${hojeBR}).\n\n` +
                `É necessário orientar o solicitante a realizar planejamento de compras para evitar pedidos emergenciais.`;
              for (const u of destinatarios) {
                try { await enviarWhatsApp(u.telefone, mensagem); } catch (e) { console.error("WA coord fail", e); }
              }
            } catch (e) { console.error("Falha ao notificar coordenadores:", e); }
          })();
        }
      }
      addRequisicao({
        solicitante: usuarioLogado?.nome || "Usuário",
        centroCusto,
        centroCustoNome: cliente?.nome || "",
        localEntrega,
        justificativa,
        urgencia,
        prazoDesejado,
        itens,
        anexos,
      });
      // Notifica grupo de WhatsApp do cliente
      if (cliente?.grupoWhatsapp) {
        const proxNumero = (requisicoes.length > 0 ? Math.max(...requisicoes.map(r => r.numero)) : 0) + 1;
        const nowIso = new Date().toISOString();
        notificarCompras({
          jid: cliente.grupoWhatsapp,
          clienteNome: cliente.nome,
          pedido: formatarPedido(proxNumero, nowIso),
          statusLabel: "REQUISIÇÃO DE COMPRA CRIADA",
          dataSolicitacao: formatarDataHora(nowIso),
          solicitante: usuarioLogado?.nome || "Usuário",
          prioridade: formatarPrioridade(urgencia),
          obs: justificativa,
          entregaPrevista: prazoDesejado ? formatarData(prazoDesejado) : undefined,
        });
      }
      if (alertaUrgenteMsg) {
        toast({
          title: "⚠️ Muitos pedidos Urgentes hoje",
          description: `${alertaUrgenteMsg} A requisição foi criada e os coordenadores foram notificados.`,
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({ title: "Requisição de compra criada com sucesso!" });
      }
    }

    setDialogOpen(false);
    setEditingId(null);
    resetForm();
  };

  const abrirEdicao = (r: RequisicaoCompras) => {
    setEditingId(r.id);
    setCentroCusto(r.centroCusto);
    setLocalEntrega(r.localEntrega);
    setJustificativa(r.justificativa);
    setUrgencia(r.urgencia);
    setPrazoDesejado(r.prazoDesejado);
    setItens(r.itens);
    setAnexos(r.anexos);
    setDialogOpen(true);
  };

  const confirmarRecusa = async () => {
    if (!recusaReq) return;
    if (!recusaMotivo.trim()) { toast({ title: "Selecione ou informe um motivo", variant: "destructive" }); return; }
    await updateStatus(recusaReq.id, "Recusada", usuarioLogado?.nome || "Comprador", recusaMotivo);
    toast({ title: "Requisição recusada" });
    setRecusaReq(null);
    setRecusaMotivo("");
    setNovoMotivoMode(false);
    setNovoMotivoText("");
  };

  const cadastrarNovoMotivo = async () => {
    const texto = novoMotivoText.trim();
    if (!texto) return;
    const novo = await insertRow("requisicoes_compras_justificativas", { motivo: texto });
    if (novo) {
      await loadJustificativas();
      setRecusaMotivo(texto);
      setNovoMotivoMode(false);
      setNovoMotivoText("");
      toast({ title: "Motivo cadastrado" });
    }
  };

  const excluirMotivo = async (id: string) => {
    if (await deleteRow("requisicoes_compras_justificativas", id)) {
      await loadJustificativas();
    }
  };

  const handleCancelar = async () => {
    if (cancelId) {
      const req = requisicoes.find(r => r.id === cancelId);
      const podeCancelar = req && (req.solicitante === (usuarioLogado?.nome || "") || podeRecusar);
      if (!podeCancelar) {
        toast({ title: "Você não possui permissão para cancelar esta requisição.", variant: "destructive" });
        abortCancel();
        return;
      }
      cancelarRequisicao(cancelId, usuarioLogado?.nome || "Usuário", "Cancelada pelo solicitante antes do início da cotação");
      toast({ title: "Requisição cancelada" });
      abortCancel();
    }
  };

  const handleMaterialSelect = (materialId: string) => {
    setItemMaterialId(materialId);
    const mat = materiais.find(m => m.id === materialId);
    if (mat) {
      setItemDescricao(mat.descricao);
      setItemUnidade(mat.unidadeMedida);
      if (mat.fabricanteId) setItemFabricanteId(mat.fabricanteId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mx-[7px]">Requisições de Compras e Serviços</h1>
        {podeCriar && <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Nova Requisição</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 items-end">
        <div className="relative sm:col-span-2 md:col-span-3 lg:col-span-2 xl:col-span-2 min-w-0">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Nº, solicitante, item..." value={search} onChange={e => { setSearch(e.target.value); setPageReq(1); }} className="pl-9" />
          </div>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Centro de Custo</Label>
          <Select value={filterCentroCusto} onValueChange={v => { setFilterCentroCusto(v); setPageReq(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {centrosUnicos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPageReq(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os Status</SelectItem>
              {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Urgência</Label>
          <Select value={filterUrgencia} onValueChange={v => { setFilterUrgencia(v); setPageReq(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas</SelectItem>
              {URGENCIAS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Solicitante</Label>
          <Select value={filterSolicitante} onValueChange={v => { setFilterSolicitante(v); setPageReq(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {solicitantesUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Data inicial</Label>
          <Input type="date" value={filterDataIni} onChange={e => { setFilterDataIni(e.target.value); setPageReq(1); }} />
        </div>
        <div className="min-w-0">
          <Label className="text-xs">Data final</Label>
          <Input type="date" value={filterDataFim} onChange={e => { setFilterDataFim(e.target.value); setPageReq(1); }} />
        </div>
        <Button variant="outline" onClick={limparFiltros} className="w-full sm:w-auto">
          <X className="mr-2 h-4 w-4" />Limpar
        </Button>
      </div>

      <div className="border rounded-lg">
        <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
        <Table>
          <TableHeader className="bg-muted/40 [&_th]:h-10 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.09em] [&_th]:text-muted-foreground/80">
            <TableRow>
              {colOrder.map(key => {
                const cd = colDefs[key];
                return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
              })}
              <TableHead className="w-36">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:text-[13px] [&_td]:leading-5">
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={colOrder.length + 1} className="text-center text-muted-foreground py-8">Nenhuma requisição encontrada</TableCell></TableRow>
            ) : paginate(filtered, pageReq, 7).paginated.map((r, idx) => {
              const cotacaoExist = cotacoes.find(c => c.requisicaoId === r.id);
              const pedidosDaReq = pedidos.filter(p => p.requisicaoId === r.id || (cotacaoExist && p.cotacaoId === cotacaoExist.id));

              const horasDesdeCriacao = (Date.now() - new Date(r.dataCriacao).getTime()) / 3600000;
              const diasDesdeCriacao = horasDesdeCriacao / 24;
              const cotacaoPendente = cotacaoExist && !["Finalizada", "Cancelada"].includes(cotacaoExist.status);
              const semCotacao = !cotacaoExist && !["Cancelada", "Recusada", "Concluída"].includes(r.status);
              const semCotacaoIniciada = !cotacaoExist && !["Rascunho", "Cancelada", "Recusada", "Concluída"].includes(r.status);
              const alertaUrgente = (r.urgencia === "Urgente" || r.urgencia === "Alta") && horasDesdeCriacao > 12 && (semCotacao || cotacaoPendente);
              const alertaAtrasoCotacao = semCotacaoIniciada && (
                (r.urgencia === "Normal" && diasDesdeCriacao > 5) ||
                (r.urgencia === "Baixa" && diasDesdeCriacao > 6)
              );
              const alertaTitle = alertaUrgente
                ? (cotacaoPendente ? `${r.urgencia}: cotação em andamento há mais de 12h sem finalização` : `${r.urgencia}: mais de 12h sem iniciar cotação`)
                : alertaAtrasoCotacao
                ? `${r.urgencia}: ${Math.floor(diasDesdeCriacao)} dias sem cotação iniciada`
                : "";
              const cellMap: Record<string, ReactNode> = {
                numero: (
                  <span className="font-mono font-bold inline-flex items-center gap-1">
                    {alertaUrgente && (
                      <AlertTriangle className="h-4 w-4 text-red-600 animate-blink-urgent" aria-label="alerta urgente" />
                    )}
                    {alertaAtrasoCotacao && !alertaUrgente && (
                      <Clock className="h-4 w-4 text-amber-600 animate-blink-urgent" aria-label="atraso cotação" />
                    )}
                    {r.status === "Recusada" && <span title="Requisição recusada" aria-label="recusada">🤦🏻‍♂️</span>}
                    RCS-{String(r.numero).padStart(4, "0")}
                  </span>
                ),
                data: format(new Date(r.dataCriacao), "dd/MM/yyyy HH:mm"),
                solicitante: r.solicitante,
                centroCusto: r.centroCustoNome,
                urgencia: (
                  <Badge title={alertaTitle} className={`${r.urgencia === "Urgente" ? "bg-red-500 text-white hover:bg-red-500" : r.urgencia === "Alta" ? "bg-orange-500 text-white hover:bg-orange-500" : r.urgencia === "Normal" ? "bg-green-600 text-white hover:bg-green-600" : "bg-muted text-muted-foreground"} ${alertaUrgente || alertaAtrasoCotacao ? "animate-blink-urgent" : ""}`}>{r.urgencia}</Badge>
                ),
                itens: r.itens.length,
                status: <Badge className={statusColors[r.status]}>{r.status}</Badge>,
                ordemCompra: pedidosDaReq.length > 0 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {pedidosDaReq.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/compras/pedidos?numero=${String(p.numero).padStart(4, "0")}`)}
                        className="font-mono text-xs text-primary underline underline-offset-2 hover:opacity-80"
                        title={`Abrir ordem de compra do fornecedor ${p.fornecedorNome}`}
                      >
                        PC-{String(p.numero).padStart(4, "0")}
                      </button>
                    ))}
                  </div>
                ) : <span className="text-muted-foreground text-xs">-</span>,
              };

              const podeIniciarCotacao = ["Enviada", "Aguardando Aprovação"].includes(r.status);
              const podeRecusarReq = podeRecusar && ["Enviada", "Em Cotação", "Aguardando Aprovação"].includes(r.status);
              const podeEditarReq = r.status === "Recusada" && r.solicitante === (usuarioLogado?.nome || "");
              const podeCancelarReq = !cotacaoExist && r.status === "Enviada" && (r.solicitante === (usuarioLogado?.nome || "") || podeRecusar);
              return (
              <TableRow key={r.id} className={idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60"}>
                {colOrder.map(key => <TableCell key={key} className={colDefs[key]?.className}>{cellMap[key]}</TableCell>)}
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewReq(r)}>
                        <Eye className="mr-2 h-4 w-4" />Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistoricoReq(r)}>
                        <Clock className="mr-2 h-4 w-4" />Histórico
                      </DropdownMenuItem>
                      {podeEditarReq && (
                        <DropdownMenuItem onClick={() => abrirEdicao(r)}>
                          <Pencil className="mr-2 h-4 w-4 text-amber-600" />Editar e reenviar
                        </DropdownMenuItem>
                      )}
                      {podeRecusarReq && (
                        <DropdownMenuItem onClick={() => { setRecusaReq(r); setRecusaMotivo(""); setNovoMotivoMode(false); }}>
                          <XCircle className="mr-2 h-4 w-4 text-rose-600" />Recusar requisição
                        </DropdownMenuItem>
                      )}
                      {podeIniciarCotacao && (
                        <DropdownMenuItem onClick={() => {
                          const existente = cotacoes.find(c => c.requisicaoId === r.id);
                          if (existente) {
                            toast({ title: "Cotação já existente", description: `Cotação Nº ${String(existente.numero).padStart(4, "0")} vinculada a esta RCS.` });
                          } else {
                            addCotacao({ requisicaoId: r.id, requisicaoNumero: r.numero, comprador: usuarioLogado?.nome || "Comprador" });
                            updateStatus(r.id, "Em Cotação", usuarioLogado?.nome || "Comprador", "Cotação iniciada");
                            const cli = clientes.find(c => c.id === r.centroCusto);
                            if (cli?.grupoWhatsapp) {
                              notificarCompras({
                                jid: cli.grupoWhatsapp,
                                clienteNome: cli.nome,
                                pedido: formatarPedido(r.numero, r.dataCriacao),
                                statusLabel: "COTAÇÃO INICIADA",
                                dataSolicitacao: formatarDataHora(r.dataCriacao),
                                dataExtraLabel: "Data início cotação",
                                dataExtraValor: formatarDataHora(new Date().toISOString()),
                                solicitante: r.solicitante,
                                prioridade: formatarPrioridade(r.urgencia),
                                obs: r.justificativa,
                                entregaPrevista: r.prazoDesejado ? formatarData(r.prazoDesejado) : undefined,
                              });
                            }
                            toast({ title: "Cotação criada com sucesso!" });
                          }
                          navigate(`/compras/cotacoes?rcsId=${r.id}`);
                        }}>
                          <FileSpreadsheet className="mr-2 h-4 w-4 text-primary" />Iniciar Cotação
                        </DropdownMenuItem>
                      )}
                      {podeCancelarReq && (
                        <DropdownMenuItem onClick={() => requestCancel(r.id)}>
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />Cancelar requisição
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
        <div className="p-2">
          <PaginationControls currentPage={pageReq} totalItems={filtered.length} onPageChange={setPageReq} pageSize={7} />
        </div>
      </div>

      <DoubleConfirmDelete open={!!cancelId} onOpenChange={o => !o && abortCancel()} onConfirm={handleCancelar} />

      {/* Dialog Nova Requisição / Editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); resetForm(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar e Reenviar Requisição" : "Nova Requisição de Compras"}</DialogTitle>
            <DialogDescription>{editingId ? "Ajuste os itens recusados pelo comprador e reenvie a requisição." : "Preencha os campos obrigatórios para criar uma nova solicitação."}</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
              <TabsTrigger value="itens">Itens ({itens.length})</TabsTrigger>
              <TabsTrigger value="anexos">Anexos ({anexos.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Centro de Custo (Cliente) *</Label>
                  <Select value={centroCusto} onValueChange={v => { setCentroCusto(v); setLocalEntrega(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{clientesLista.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Local de Entrega</Label>
                  {locaisEntregaDoCliente.length > 0 ? (
                    <Select value={localEntrega} onValueChange={setLocalEntrega}>
                      <SelectTrigger><SelectValue placeholder="Selecione o local de entrega..." /></SelectTrigger>
                      <SelectContent>
                        {locaisEntregaDoCliente.map(l => (
                          <SelectItem key={l.id} value={l.local}>
                            {l.local}{l.logradouro ? ` — ${l.logradouro}, ${l.numero}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} placeholder="Endereço ou local de entrega" />
                  )}
                </div>
                <div>
                  <Label>Grau de Urgência</Label>
                  <Select value={urgencia} onValueChange={v => setUrgencia(v as GrauUrgencia)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{URGENCIAS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo Desejado</Label>
                  <Input type="date" value={prazoDesejado} onChange={e => setPrazoDesejado(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Justificativa da Necessidade *</Label>
                <Textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Descreva a justificativa para esta solicitação..." rows={3} />
              </div>
            </TabsContent>

            <TabsContent value="itens" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>Adicionar Item</span>
                    {grupoTravado && (
                      <Badge variant="secondary" className="font-normal">Categoria travada: {grupoTravado}</Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Uma requisição só pode conter itens da mesma categoria (primeiro nível do código, ex.: 01, 02). Para outra categoria, crie uma nova requisição.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Material/Serviço cadastrado</Label>
                      <Popover open={materialPopoverOpen} onOpenChange={setMaterialPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={materialPopoverOpen} className="w-full justify-between font-normal h-10">
                            {itemMaterialId
                              ? (() => { const m = materiais.find(m => m.id === itemMaterialId); return m ? `${codigoComposto(m)} - ${m.descricao}` : "Selecionar..."; })()
                              : "Selecionar (opcional)..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar material/serviço..." />
                            <CommandList>
                              <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
                              <CommandGroup>
                                {materiais
                                  .filter(m => !grupoTravado || (m.categoriaId && getCodigoCompleto(m.categoriaId).split(".")[0] === grupoTravado))
                                  .map(m => (
                                  <CommandItem
                                    key={m.id}
                                    value={`${codigoComposto(m)} ${m.descricao}`}
                                    onSelect={() => {
                                      handleMaterialSelect(m.id);
                                      setMaterialPopoverOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", itemMaterialId === m.id ? "opacity-100" : "opacity-0")} />
                                    {codigoComposto(m)} - {m.descricao}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Descrição do Item *</Label>
                      <Input value={itemDescricao} onChange={e => setItemDescricao(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Especificação Técnica</Label>
                    <Textarea value={itemEspec} onChange={e => setItemEspec(e.target.value)} rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Observação</Label>
                      <Input value={itemObs} onChange={e => setItemObs(e.target.value)} />
                    </div>
                    <div>
                      <Label>Fabricante</Label>
                      <Select value={itemFabricanteId} onValueChange={setItemFabricanteId}>
                        <SelectTrigger><SelectValue placeholder="Selecionar (opcional)..." /></SelectTrigger>
                        <SelectContent>{fabricantes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Quantidade *</Label>
                      <Input type="number" min="0" step="0.01" value={itemQtd} onChange={e => setItemQtd(e.target.value)} />
                    </div>
                    <div>
                      <Label>Unidade</Label>
                      <Input value={itemUnidade} readOnly disabled className="bg-muted" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <Label>Anexo do Item</Label>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => itemAnexoInputRef.current?.click()} className="shrink-0">
                          <Paperclip className="mr-2 h-4 w-4" />{itemAnexo ? "Trocar arquivo" : "Anexar arquivo"}
                        </Button>
                        <input ref={itemAnexoInputRef} type="file" className="hidden" onChange={handleItemAnexoChange} />
                        {itemAnexo && (
                          <div className="flex items-center gap-1 text-sm border rounded px-2 py-1 flex-1 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{itemAnexo.nome}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setItemAnexo(null); if (itemAnexoInputRef.current) itemAnexoInputRef.current.value = ""; }}><X className="h-3 w-3" /></Button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Máx. 2MB por arquivo (opcional)</p>
                    </div>
                    <Button onClick={addItem}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
                  </div>
                </CardContent>
              </Card>

              {itens.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Especificação</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Un</TableHead>
                      <TableHead>Anexo</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.descricao}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{item.especificacaoTecnica || "-"}</TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>{item.unidadeMedida}</TableCell>
                        <TableCell className="text-xs">
                          {item.anexo ? (
                            <a href={item.anexo.base64} download={item.anexo.nome} className="text-primary hover:underline inline-flex items-center gap-1">
                              <FileText className="h-3 w-3" />{item.anexo.nome}
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="anexos" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Paperclip className="mr-2 h-4 w-4" />Anexar Arquivo</Button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              </div>
              {anexos.length > 0 && (
                <div className="space-y-2">
                  {anexos.map(a => (
                    <div key={a.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{a.nome}</span>
                      <Button variant="ghost" size="icon" onClick={() => setAnexos(prev => prev.filter(x => x.id !== a.id))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingId ? "Reenviar Requisição" : "Enviar Requisição"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes */}
      <Dialog open={!!viewReq} onOpenChange={() => setViewReq(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>RCS-{viewReq && String(viewReq.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>Detalhes da requisição de compras</DialogDescription>
          </DialogHeader>
          {viewReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium text-muted-foreground">Solicitante:</span> {viewReq.solicitante}</div>
                <div><span className="font-medium text-muted-foreground">Data:</span> {format(new Date(viewReq.dataCriacao), "dd/MM/yyyy HH:mm")}</div>
                <div><span className="font-medium text-muted-foreground">Centro de Custo:</span> {viewReq.centroCustoNome}</div>
                <div><span className="font-medium text-muted-foreground">Local Entrega:</span> {viewReq.localEntrega || "-"}</div>
                <div><span className="font-medium text-muted-foreground">Urgência:</span> <Badge variant={viewReq.urgencia === "Urgente" ? "destructive" : "secondary"}>{viewReq.urgencia}</Badge></div>
                <div><span className="font-medium text-muted-foreground">Prazo:</span> {viewReq.prazoDesejado ? format(new Date(viewReq.prazoDesejado), "dd/MM/yyyy") : "-"}</div>
                <div className="col-span-2"><span className="font-medium text-muted-foreground">Status:</span> <Badge className={statusColors[viewReq.status]}>{viewReq.status}</Badge></div>
              </div>
              <div><span className="font-medium text-muted-foreground text-sm">Justificativa:</span><p className="text-sm mt-1">{viewReq.justificativa}</p></div>
              <div>
                <span className="font-medium text-muted-foreground text-sm">Itens ({viewReq.itens.length})</span>
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Especificação</TableHead><TableHead>Obs</TableHead><TableHead>Qtd</TableHead><TableHead>Un</TableHead><TableHead>Anexo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {viewReq.itens.map(i => (
                      <TableRow key={i.id}>
                        <TableCell>{i.descricao}</TableCell>
                        <TableCell className="text-xs">{i.especificacaoTecnica || "-"}</TableCell>
                        <TableCell className="text-xs">{i.observacao || "-"}</TableCell>
                        <TableCell>{i.quantidade}</TableCell>
                        <TableCell>{i.unidadeMedida}</TableCell>
                        <TableCell className="text-xs">
                          {i.anexo ? (
                            <a href={i.anexo.base64} download={i.anexo.nome} className="text-primary hover:underline inline-flex items-center gap-1">
                              <FileText className="h-3 w-3" />{i.anexo.nome}
                            </a>
                          ) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {viewReq.anexos.length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground text-sm">Anexos ({viewReq.anexos.length})</span>
                  <div className="space-y-1 mt-1">
                    {viewReq.anexos.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <a href={a.base64} download={a.nome} className="text-primary hover:underline">{a.nome}</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico */}
      <Dialog open={!!historicoReq} onOpenChange={() => setHistoricoReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico - RCS-{historicoReq && String(historicoReq.numero).padStart(4, "0")}</DialogTitle>
            <DialogDescription>Linha do tempo de alterações de status</DialogDescription>
          </DialogHeader>
          {historicoReq && (
            <div className="space-y-3">
              {historicoReq.historicoStatus.map((h, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <Badge className={statusColors[h.status]}>{h.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(h.dataHora), "dd/MM/yyyy HH:mm")} — {h.usuario}</p>
                    {h.observacao && <p className="text-xs mt-0.5">{h.observacao}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Recusar Requisição */}
      <Dialog open={!!recusaReq} onOpenChange={(o) => { if (!o) { setRecusaReq(null); setRecusaMotivo(""); setNovoMotivoMode(false); setNovoMotivoText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Requisição {recusaReq && `RCS-${String(recusaReq.numero).padStart(4, "0")}`}</DialogTitle>
            <DialogDescription>Selecione uma justificativa pré-cadastrada para recusar a requisição. O solicitante poderá ajustar e reenviar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Justificativa *</Label>
                <Select value={recusaMotivo} onValueChange={setRecusaMotivo}>
                  <SelectTrigger><SelectValue placeholder="Selecione um motivo..." /></SelectTrigger>
                  <SelectContent>
                    {justificativas.map(j => <SelectItem key={j.id} value={j.motivo}>{j.motivo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" onClick={() => setGerenciarMotivosOpen(true)} title="Gerenciar motivos">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {novoMotivoMode ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Novo motivo</Label>
                  <Input value={novoMotivoText} onChange={e => setNovoMotivoText(e.target.value)} placeholder="Descreva o novo motivo..." />
                </div>
                <Button onClick={cadastrarNovoMotivo}>Salvar</Button>
                <Button variant="ghost" onClick={() => { setNovoMotivoMode(false); setNovoMotivoText(""); }}>Cancelar</Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setNovoMotivoMode(true)}>
                <Plus className="mr-1 h-3 w-3" /> Cadastrar novo motivo
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusaReq(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarRecusa}>Confirmar Recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Gerenciar Motivos */}
      <Dialog open={gerenciarMotivosOpen} onOpenChange={setGerenciarMotivosOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Motivos de Recusa</DialogTitle>
            <DialogDescription>Motivos pré-cadastrados disponíveis no dropdown de recusa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {justificativas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum motivo cadastrado.</p>
            ) : justificativas.map(j => (
              <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 border rounded px-3 py-2">
                <span className="text-sm">{j.motivo}</span>
                <Button variant="ghost" size="icon" onClick={() => excluirMotivo(j.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 pt-2 border-t">
            <div className="flex-1">
              <Label>Novo motivo</Label>
              <Input value={novoMotivoText} onChange={e => setNovoMotivoText(e.target.value)} placeholder="Descreva o motivo..." />
            </div>
            <Button onClick={cadastrarNovoMotivo}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
