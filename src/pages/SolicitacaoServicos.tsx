import { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useSearchParams, Link } from "@/lib/router-compat";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import { useSolicitacoesServicos, SolicitacaoServico, HistoricoEntry } from "@/contexts/SolicitacoesServicosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { useLimiteAprovacao } from "@/hooks/useLimiteAprovacao";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { useOrcamentos } from "@/contexts/OrcamentosContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import OrcamentoDialog from "@/components/OrcamentoDialog";
import { gerarPdfOrcamento } from "@/lib/gerarPdfOrcamento";
import { gerarPdfMemoriaCalculo, gerarPdfMemoriaCalculoLote } from "@/lib/gerarPdfMemoriaCalculo";
import { gerarPdfMemoriaCalculoFotos, gerarPdfMemoriaCalculoFotosLote } from "@/lib/gerarPdfMemoriaCalculoFotos";
import { gerarPdfSolicitacao, gerarPdfSolicitacaoLote } from "@/lib/gerarPdfSolicitacao";
import { gerarExcelOrcamento } from "@/lib/gerarExcelOrcamento";
import { supabase } from "@/integrations/supabase/client";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { formatNumeroAno } from "@/lib/formatNumero";
import iconRevisao from "@/assets/icon-revisao.png";
import iconSetorCritico from "@/assets/icone-setor-critico.png";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ChevronDown, ChevronUp, AlertTriangle, Pencil, Trash2, MoreHorizontal, ImagePlus, X, Building2, Wrench, CheckCircle2, XCircle, FileText, ClipboardList, Download, Eye, History, Clock, ArrowUpDown, ArrowUp, ArrowDown, Camera, ReceiptText, Printer } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MemoriaCalculoView from "@/components/orcamento/MemoriaCalculoView";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import WorkflowHistorico from "@/components/WorkflowHistorico";

const SS_WORKFLOW_STEPS = [
  { label: "Aguardando aprovação" },
  { label: "Aprovada" },
  { label: "Em execução" },
  { label: "Concluída" },
];

const SITUACOES = ["Aguardando aprovação", "Orçamento Solicitado", "Orçamento Disponível", "Aprovada", "Em execução", "Concluída", "Cancelada"];

const PRIORIDADES = [
  { value: "Normal", color: "bg-green-500" },
  { value: "Urgente", color: "bg-yellow-500" },
  { value: "Emergencial", color: "bg-red-500" },
];

const emptyForm = {
  tipo: "" as "" | "Predial" | "Equipamentos",
  cliente_id: "", local_id: "", pavimento_id: "", setor_id: "",
  equipamento_id: "", descricao_servicos: "", situacao: "Aguardando aprovação",
};

// Normaliza texto e calcula similaridade Jaccard entre tokens (0..1)
const STOPWORDS = new Set(["de","da","do","das","dos","a","o","e","em","para","com","no","na","nos","nas","um","uma","por","que","ao","aos","as","os","ou","se","sem"]);
function tokenize(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOPWORDS.has(t))
  );
}
function jaccardSimilarity(a: string, b: string): number {
  const A = tokenize(a), B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  const uni = A.size + B.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

export default function SolicitacaoServicosPage() {
  const { solicitacoes, addSolicitacao, updateSolicitacao, deleteSolicitacao } = useSolicitacoesServicos();
  const { clientes } = useClientes();
  const { equipamentos } = useEquipamentos();
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const { usuarioLogado } = useAuth();
  const { podeAprovar } = useLimiteAprovacao();
  const { tem } = usePermissao();
  const podeCriar = tem("solicitacao_servicos.criar");
  const podeEditar = tem("solicitacao_servicos.editar");
  const podeExcluir = tem("solicitacao_servicos.excluir");
  const podeStAprovada = tem("solicitacao_servicos.status.aprovada");
  const podeStReprovada = tem("solicitacao_servicos.status.reprovada");
  const podeStCancelada = tem("solicitacao_servicos.status.cancelada");
  const podeStConcluida = tem("solicitacao_servicos.status.concluida");
  const podeStEmAnalise = tem("solicitacao_servicos.status.em_analise");

  const setoresCriticosIds = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach(c => (c.locais || []).forEach(l => (l.pavimentos || []).forEach(p => (p.setores || []).forEach(st => { if (st.critico && st.id) set.add(st.id); }))));
    return set;
  }, [clientes]);

  const buildHistoricoEntry = (situacao: string, existingHistorico: HistoricoEntry[] = []): HistoricoEntry[] => [
    ...existingHistorico,
    { situacao, data: new Date().toISOString(), usuario: usuarioLogado?.nome || "Sistema" },
  ];

  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const _ssSavedFilters = loadPersistedFilters<{ search: string; filterCliente: string; filterTipo: string; filterSituacao: string; filterVisitado: string; filterOrigem: string; filterImpresso: string; filterPrioridade: string; filterSetorCritico: string; }>("solicitacao_servicos_filters_v1");
  const [search, setSearch] = useState(_ssSavedFilters?.search ?? "");
  const [filterCliente, setFilterCliente] = useState(() => localStorage.getItem("ss_filtroCliente") || "all");
  const [filterTipo, setFilterTipo] = useState(_ssSavedFilters?.filterTipo ?? "all");
  const [filterSituacao, setFilterSituacao] = useState(_ssSavedFilters?.filterSituacao ?? "all");
  const [filterVisitado, setFilterVisitado] = useState(_ssSavedFilters?.filterVisitado ?? "all");
  const [filterOrigem, setFilterOrigem] = useState(_ssSavedFilters?.filterOrigem ?? "all");
  const [filterImpresso, setFilterImpresso] = useState(_ssSavedFilters?.filterImpresso ?? "all");
  const [filterPrioridade, setFilterPrioridade] = useState(_ssSavedFilters?.filterPrioridade ?? "all");
  const [filterSetorCritico, setFilterSetorCritico] = useState(_ssSavedFilters?.filterSetorCritico ?? "all");
  const [filterDataIni, setFilterDataIni] = useState((_ssSavedFilters as any)?.filterDataIni ?? "");
  const [filterDataFim, setFilterDataFim] = useState((_ssSavedFilters as any)?.filterDataFim ?? "");
  usePersistFilters("solicitacao_servicos_filters_v1", { search, filterTipo, filterSituacao, filterVisitado, filterOrigem, filterImpresso, filterPrioridade, filterSetorCritico, filterDataIni, filterDataFim });
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const numero = searchParams.get("numero");
    if (numero) {
      setSearch(numero);
      setFilterCliente("all");
      setFilterTipo("all");
      setFilterSituacao("all");
      setFilterVisitado("all");
      setFilterOrigem("all");
      setFilterImpresso("all");
      setFilterPrioridade("all");
      setFilterSetorCritico("all");
      setFilterDataIni("");
      setFilterDataFim("");
      setPage(1);
      const next = new URLSearchParams(searchParams);
      next.delete("numero");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [imagens, setImagens] = useState<{ file?: File; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const requestCancel = (id: string) => { setCancelMotivo(""); setCancelId(id); };
  const abortCancel = () => { setCancelId(null); setCancelMotivo(""); };
  const { orcamentos } = useOrcamentos();

  // Orcamento dialog state
  const [orcamentoDialogOpen, setOrcamentoDialogOpen] = useState(false);
  const [orcamentoTarget, setOrcamentoTarget] = useState<{ id: string; numero: number; clienteId: string; clienteNome: string } | null>(null);

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalTargetId, setApprovalTargetId] = useState<string | null>(null);
  const [selectedPrioridade, setSelectedPrioridade] = useState<string>("");
  const [approvalRessalva, setApprovalRessalva] = useState("");
  const [prioridadeOnly, setPrioridadeOnly] = useState(false);
  
  const [viewTarget, setViewTarget] = useState<SolicitacaoServico | null>(null);

  // Diálogo de duplicidade (mesmo setor, últimos 5 dias, descrição similar)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<SolicitacaoServico[]>([]);

  const soClientes = useMemo(() => clientes.filter(c => c.tipo === "Cliente"), [clientes]);

  const selectedCliente = useMemo(() => soClientes.find(c => c.id === form.cliente_id), [soClientes, form.cliente_id]);
  const locais = useMemo(() => selectedCliente?.locais || [], [selectedCliente]);
  const selectedLocal = useMemo(() => locais.find((l: any) => l.id === form.local_id), [locais, form.local_id]);
  const pavimentos = useMemo(() => (selectedLocal as any)?.pavimentos || [], [selectedLocal]);
  const selectedPavimento = useMemo(() => pavimentos.find((p: any) => p.id === form.pavimento_id), [pavimentos, form.pavimento_id]);
  const setores = useMemo(() => (selectedPavimento as any)?.setores || [], [selectedPavimento]);

  const equipamentosFiltrados = useMemo(() => {
    if (!form.cliente_id || !form.setor_id) return [];
    return equipamentos.filter((e: any) =>
      (e.clienteId === form.cliente_id || e.cliente_id === form.cliente_id) &&
      (e.setorId === form.setor_id || e.setor_id === form.setor_id)
    );
  }, [equipamentos, form.cliente_id, form.setor_id]);


  const handleSelectTipo = (tipo: "Predial" | "Equipamentos") => {
    setForm({ ...emptyForm, tipo });
    setImagens([]);
    setEditingId(null);
    setFormOpen(true);
    setFormCollapsed(false);
  };

  const handleAddImagem = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 3 - imagens.length;
    if (remaining <= 0) { toast({ title: "Máximo de 3 imagens", variant: "destructive" }); return; }
    const newImgs = Array.from(files).slice(0, remaining).map(file => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setImagens(prev => [...prev, ...newImgs]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleRemoveImagem = (idx: number) => {
    setImagens(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadImagens = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const img of imagens) {
      if (img.file) {
        const ext = img.file.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("solicitacoes-imagens").upload(path, img.file);
        if (error) { console.error(error); continue; }
        const { data } = supabase.storage.from("solicitacoes-imagens").getPublicUrl(path);
        urls.push(data.publicUrl);
      } else {
        urls.push(img.url);
      }
    }
    return urls;
  };

  const checkDuplicates = (): SolicitacaoServico[] => {
    if (editingId) return [];
    if (!form.setor_id || !form.descricao_servicos.trim()) return [];
    const cincoDiasMs = 5 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return solicitacoes.filter(s => {
      if (s.clienteId !== form.cliente_id) return false;
      if (s.setorId !== form.setor_id) return false;
      if (s.situacao === "Cancelada") return false;
      const ref = s.dataHoraSolicitacao || s.createdAt;
      if (!ref) return false;
      const t = new Date(ref).getTime();
      if (isNaN(t) || (now - t) > cincoDiasMs) return false;
      return jaccardSimilarity(s.descricaoServicos, form.descricao_servicos) >= 0.4;
    });
  };

  const handleSave = async (keepOpen = false) => {
    if (!form.cliente_id) { toast({ title: "Selecione um cliente", variant: "destructive" }); return; }
    if (!form.descricao_servicos.trim()) { toast({ title: "Descrição dos serviços obrigatória", variant: "destructive" }); return; }
    if (form.tipo === "Equipamentos" && !form.equipamento_id) { toast({ title: "Selecione um equipamento", variant: "destructive" }); return; }

    const matches = checkDuplicates();
    if (matches.length > 0) {
      setDuplicateMatches(matches);
      setDuplicateDialogOpen(true);
      return;
    }
    await persistSave(keepOpen);
  };

  const persistSave = async (keepOpen = false) => {
    setUploading(true);
    const imagensUrls = await uploadImagens();

    const cliente = soClientes.find(c => c.id === form.cliente_id);
    const local = locais.find((l: any) => l.id === form.local_id);
    const pav = pavimentos.find((p: any) => p.id === form.pavimento_id);
    const setor = setores.find((s: any) => s.id === form.setor_id);
    const equip = equipamentosFiltrados.find((e: any) => e.id === form.equipamento_id);

    const payload: any = {
      tipo: form.tipo,
      cliente_id: form.cliente_id,
      cliente_nome: cliente?.nome || "",
      local_id: form.local_id,
      local_descricao: (local as any)?.descricao || "",
      pavimento_id: form.pavimento_id,
      pavimento_descricao: (pav as any)?.descricao || "",
      setor_id: form.setor_id,
      setor_descricao: (setor as any)?.descricao || "",
      equipamento_id: form.tipo === "Equipamentos" ? form.equipamento_id : "",
      equipamento_nome: form.tipo === "Equipamentos" ? ((equip as any)?.equipamento || (equip as any)?.tag || "") : "",
      descricao_servicos: form.descricao_servicos,
      situacao: form.situacao,
      imagens: imagensUrls,
    };

    if (!editingId) {
      payload.data_hora_solicitacao = new Date().toISOString();
      payload.solicitante_id = usuarioLogado?.id || "";
      payload.solicitante_nome = usuarioLogado?.nome || "";
    }

    if (editingId) {
      await updateSolicitacao(editingId, payload);
      toast({ title: "Solicitação atualizada" });
    } else {
      payload.historico = buildHistoricoEntry("Aguardando aprovação");
      await addSolicitacao(payload);
      toast({ title: "Solicitação cadastrada" });
    }

    if (keepOpen && !editingId) {
      // Mantém cliente/local/pavimento/setor/tipo; limpa apenas descrição, equipamento e imagens
      setForm(f => ({
        ...f,
        descricao_servicos: "",
        equipamento_id: "",
      }));
      setImagens([]);
      setEditingId(null);
      setUploading(false);
      return;
    }

    setForm({ ...emptyForm });
    setImagens([]);
    setEditingId(null);
    setFormOpen(false);
    setUploading(false);
  };


  const handleEdit = (s: any) => {
    setForm({
      tipo: s.tipo || "Predial",
      cliente_id: s.clienteId,
      local_id: s.localId,
      pavimento_id: s.pavimentoId,
      setor_id: s.setorId,
      equipamento_id: s.equipamentoId,
      descricao_servicos: s.descricaoServicos,
      situacao: s.situacao,
    });
    setImagens((s.imagens || []).map((url: string) => ({ url })));
    setEditingId(s.id);
    setFormOpen(true);
    setFormCollapsed(false);
  };

  const handleDelete = async () => {
    if (!podeExcluir) {
      toast({ title: "Você não possui permissão para excluir solicitações.", variant: "destructive" });
      cancelDelete();
      return;
    }
    if (deleteId) {
      await deleteSolicitacao(deleteId);
      toast({ title: "Solicitação excluída" });
      cancelDelete();
    }
  };

  const handleOpenApproval = (id: string, onlyPriority = false) => {
    setApprovalTargetId(id);
    setSelectedPrioridade("");
    setApprovalRessalva("");
    setPrioridadeOnly(onlyPriority);
    setApprovalDialogOpen(true);
  };


  const { ordens, addOrdem, updateOrdem } = useOrdensServico();

  const handleConfirmApproval = async () => {
    if (!approvalTargetId || !selectedPrioridade) {
      toast({ title: "Selecione o nível de prioridade", variant: "destructive" });
      return;
    }
    if (!prioridadeOnly && !podeStAprovada) {
      toast({ title: "Você não possui permissão para aprovar esta SS.", variant: "destructive" });
      return;
    }
    if (prioridadeOnly) {
      await updateSolicitacao(approvalTargetId, { prioridade: selectedPrioridade });
      const prioridadeOS =
        selectedPrioridade === "Emergencial" ? "A: IMEDIATA" :
        selectedPrioridade === "Urgente" ? "B: URGENTE" : "C: NORMAL";
      const osVinculada = ordens.find(o => o.solicitacaoId === approvalTargetId);
      if (osVinculada) {
        await updateOrdem(osVinculada.id, { prioridade: prioridadeOS });
      }
      toast({ title: `Prioridade alterada para ${selectedPrioridade}` });
    } else {
      const ressalva = approvalRessalva.trim();
      // Valida limite de aprovação (valor da SS, geralmente sem orçamento ainda = 0)
      const ssAux = solicitacoes.find(s => s.id === approvalTargetId);
      const orcVinc = orcamentos.find(o => o.solicitacaoId === approvalTargetId);
      const valorSS = Number(orcVinc?.valorTotal ?? (ssAux as any)?.valorTotal ?? 0);
      if (!podeAprovar(valorSS, "os")) return;
      const ss = solicitacoes.find(s => s.id === approvalTargetId);
      await updateSolicitacao(approvalTargetId, {
        situacao: "Aprovada",
        prioridade: selectedPrioridade,
        ressalva_aprovacao: ressalva,
        historico: buildHistoricoEntry("Aprovada", ss?.historico || []),
      });
      if (ss) {
        const prioridadeOS =
          selectedPrioridade === "Emergencial" ? "A: IMEDIATA" :
          selectedPrioridade === "Urgente" ? "B: URGENTE" : "C: NORMAL";
        await addOrdem({
          solicitacao_id: ss.id,
          solicitacao_numero: ss.numero,
          cliente_id: ss.clienteId,
          cliente_nome: ss.clienteNome,
          local_id: ss.localId,
          local_descricao: ss.localDescricao,
          pavimento_id: ss.pavimentoId,
          pavimento_descricao: ss.pavimentoDescricao,
          setor_id: ss.setorId,
          setor_descricao: ss.setorDescricao,
          descricao_servicos: ss.descricaoServicos,
          solicitante: ss.solicitanteNome,
          matricula: usuarioLogado?.matricula || "",
          ramal: usuarioLogado?.ramal || "",
          telefone: usuarioLogado?.telefone || "",
          prioridade: prioridadeOS,
          ressalva_aprovacao: ressalva,
          situacao: "Aberta",
          historico: buildHistoricoEntry("Aberta"),
          operador_id: usuarioLogado?.id || "",
          operador_nome: usuarioLogado?.nome || "",
        });
      }
      toast({ title: `Solicitação aprovada e Ordem de Serviço criada` });
    }
    setApprovalDialogOpen(false);
    setApprovalTargetId(null);
    setSelectedPrioridade("");
    setApprovalRessalva("");
    setPrioridadeOnly(false);
  };

  const handleCancelar = async () => {
    if (!cancelId) return;
    if (!podeStCancelada) {
      toast({ title: "Você não possui permissão para cancelar esta SS.", variant: "destructive" });
      abortCancel();
      return;
    }
    const motivo = cancelMotivo.trim();
    if (!motivo) {
      toast({ title: "Informe o motivo do cancelamento.", variant: "destructive" });
      return;
    }
    if (motivo.length < 5) {
      toast({ title: "O motivo deve ter pelo menos 5 caracteres.", variant: "destructive" });
      return;
    }
    const ss = solicitacoes.find(s => s.id === cancelId);
    const carimbo = `[CANCELAMENTO ${new Date().toLocaleString("pt-BR")} - ${usuarioLogado?.nome || "Sistema"}] ${motivo}`;
    const novaObs = ss?.observacoes ? `${ss.observacoes}\n${carimbo}` : carimbo;
    const histBase = buildHistoricoEntry("Cancelada", ss?.historico || []);
    (histBase[histBase.length - 1] as any).motivo = motivo;
    await updateSolicitacao(cancelId, {
      situacao: "Cancelada",
      observacoes: novaObs,
      historico: histBase,
    });
    toast({ title: "Solicitação cancelada" });
    abortCancel();
  };

  const handleSolicitarOrcamento = async (s: any) => {
    if (!podeStEmAnalise) {
      toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" });
      return;
    }
    const full = solicitacoes.find(x => x.id === s.id);
    await updateSolicitacao(s.id, {
      situacao: "Orçamento Solicitado",
      historico: buildHistoricoEntry("Orçamento Solicitado", full?.historico || []),
    });
    toast({ title: "Orçamento solicitado", description: `SS nº ${formatNumeroAno(s.numero, s.createdAt)} — Orçamento Solicitado` });

    // Envio de aviso ao grupo de WhatsApp do cliente
    try {
      const cliente = clientes.find(c => c.id === s.clienteId);
      const grupo = (cliente?.grupoWhatsapp || "").trim();
      if (grupo) {
        const numero = formatNumeroAno(s.numero, s.createdAt);
        const msg =
          `📋 *Solicitação de Orçamento*\n\n` +
          `Cliente: *${s.clienteNome || cliente?.nome || "-"}*\n` +
          `SS nº: ${numero}\n` +
          `Tipo: ${s.tipo || "-"}\n` +
          `Descrição: ${s.descricaoServicos || "-"}\n\n` +
          `Status: Orçamento Solicitado`;
        await enviarWhatsApp(grupo, msg);
      }
    } catch (err) {
      console.error("Falha ao enviar WhatsApp (Solicitar Orçamento):", err);
    }
  };

  const handleOrcarSolicitacao = (s: any) => {
    setOrcamentoTarget({ id: s.id, numero: s.numero, clienteId: s.clienteId, clienteNome: s.clienteNome });
    setOrcamentoDialogOpen(true);
  };

  const handleOrcamentoSent = async () => {
    if (!orcamentoTarget) return;
    const full = solicitacoes.find(x => x.id === orcamentoTarget.id);
    await updateSolicitacao(orcamentoTarget.id, {
      situacao: "Orçamento Disponível",
      historico: buildHistoricoEntry("Orçamento Disponível", full?.historico || []),
    });
    toast({ title: "Orçamento enviado", description: `SS nº ${formatNumeroAno(orcamentoTarget.numero, full?.createdAt)} — Orçamento Disponível` });

    // Envio de aviso ao grupo de WhatsApp do cliente
    try {
      const cliente = clientes.find(c => c.id === orcamentoTarget.clienteId);
      const grupo = (cliente?.grupoWhatsapp || "").trim();
      if (grupo) {
        const numero = formatNumeroAno(orcamentoTarget.numero, full?.createdAt);
        const msg =
          `💰 *Orçamento Disponível*\n\n` +
          `Cliente: *${orcamentoTarget.clienteNome || cliente?.nome || "-"}*\n` +
          `SS nº: ${numero}\n` +
          `Descrição: ${full?.descricaoServicos || "-"}\n\n` +
          `Status: Orçamento Disponível para aprovação`;
        await enviarWhatsApp(grupo, msg);
      }
    } catch (err) {
      console.error("Falha ao enviar WhatsApp (Orçar Solicitação):", err);
    }
  };

  const handleOrcamentoRevisao = async () => {
    if (!orcamentoTarget) return;
    const full = solicitacoes.find(x => x.id === orcamentoTarget.id);
    await updateSolicitacao(orcamentoTarget.id, {
      situacao: "Orçamento Solicitado",
      historico: buildHistoricoEntry("Revisão de Orçamento Solicitada", full?.historico || []),
    });
    toast({ title: "Revisão solicitada", description: `SS nº ${formatNumeroAno(orcamentoTarget.numero, full?.createdAt)} — aguardando novo orçamento` });
  };

  const existingOrcamentoForTarget = useMemo(() => {
    if (!orcamentoTarget) return null;
    return orcamentos.find(o => o.solicitacaoId === orcamentoTarget.id) || null;
  }, [orcamentos, orcamentoTarget]);

  const handleOrcamentoApproved = async (orcamento: any) => {
    // When budget is approved, create OS linked to it
    const ss = solicitacoes.find(s => s.id === orcamento.solicitacaoId);
    if (!ss) return;

    if (!podeStAprovada) {
      toast({ title: "Você não possui permissão para aprovar esta SS.", variant: "destructive" });
      return;
    }

    const valorOrc = Number(orcamento?.valorTotal ?? 0);
    if (!podeAprovar(valorOrc, "os")) return;

    await updateSolicitacao(ss.id, {
      situacao: "Aprovada",
      prioridade: ss.prioridade || "Normal",
      historico: buildHistoricoEntry("Aprovada", ss.historico || []),
    });

    const prioridadeOS =
      ss.prioridade === "Emergencial" ? "A: IMEDIATA" :
      ss.prioridade === "Urgente" ? "B: URGENTE" : "C: NORMAL";

    // Map SCO items from budget to OS materiais format
    const materiaisSco = (orcamento.itensSco || []).map((item: any) => ({
      id: crypto.randomUUID(),
      codigo: item.codSco || item.codigo || "",
      descricao: item.descricao || "",
      unidade: item.unidade || "",
      valorUnitario: Number(item.valorUnitario) || 0,
      quantidade: Number(item.quantidade) || 0,
      valorTotal: Number(item.valorTotal) || 0,
    }));

    // Map material items from budget to OS materiaisEstoque format
    const materiaisEstoque = (orcamento.itensMateriais || []).map((item: any) => ({
      id: crypto.randomUUID(),
      codigo: item.codigo || "",
      descricao: item.descricao || "",
      unidade: item.unidade || "",
      valorUnitario: Number(item.valorUnitario) || 0,
      quantidade: Number(item.quantidade) || 0,
      valorTotal: Number(item.valorTotal) || 0,
    }));

    // Copy attachments from budget
    const anexos = orcamento.anexos || [];

    await addOrdem({
      solicitacao_id: ss.id,
      solicitacao_numero: ss.numero,
      cliente_id: ss.clienteId,
      cliente_nome: ss.clienteNome,
      local_id: ss.localId,
      local_descricao: ss.localDescricao,
      pavimento_id: ss.pavimentoId,
      pavimento_descricao: ss.pavimentoDescricao,
      setor_id: ss.setorId,
      setor_descricao: ss.setorDescricao,
      descricao_servicos: ss.descricaoServicos,
      solicitante: ss.solicitanteNome,
      matricula: usuarioLogado?.matricula || "",
      ramal: usuarioLogado?.ramal || "",
      telefone: usuarioLogado?.telefone || "",
      prioridade: prioridadeOS,
      situacao: "Aberta",
      historico: buildHistoricoEntry("Aberta"),
      operador_id: usuarioLogado?.id || "",
      operador_nome: usuarioLogado?.nome || "",
      materiais: materiaisSco,
      materiais_estoque: materiaisEstoque,
      anexos: anexos,
    });

    toast({ title: "Orçamento aprovado e Ordem de Serviço criada!" });
  };

  const handleDownloadOrcamento = (s: any, tipo: "pdf" | "excel" | "memoria" | "memoria-fotos") => {
    const orc = orcamentos.find(o => o.solicitacaoId === s.id);
    if (!orc) {
      toast({ title: "Orçamento não encontrado", variant: "destructive" });
      return;
    }
    if (tipo === "pdf") {
      gerarPdfOrcamento(orc, empresa);
    } else if (tipo === "memoria") {
      gerarPdfMemoriaCalculo(orc, empresa);
    } else if (tipo === "memoria-fotos") {
      gerarPdfMemoriaCalculoFotos(orc, empresa);
    } else {
      gerarExcelOrcamento(orc, empresa);
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    const p = PRIORIDADES.find(x => x.value === prioridade);
    return p?.color || "";
  };

  const _ssSavedSort = loadPersistedFilters<{ sortField: string | null; sortDir: "asc" | "desc" }>("solicitacao_servicos_sort_v1");
  const [sortField, setSortField] = useState<string | null>(_ssSavedSort?.sortField ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(_ssSavedSort?.sortDir ?? "asc");
  usePersistFilters("solicitacao_servicos_sort_v1", { sortField, sortDir });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="inline ml-1 h-3.5 w-3.5 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="inline ml-1 h-3.5 w-3.5" />
      : <ArrowDown className="inline ml-1 h-3.5 w-3.5" />;
  };

  const SortHeader = ({ field, children }: { field: string; children: ReactNode }) => (
    <span className="cursor-pointer select-none flex items-center gap-1" onClick={() => handleSort(field)}>
      {children}
      <SortIcon field={field} />
    </span>
  );

  const filtered = useMemo(() => {
    let result = solicitacoes;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.clienteNome.toLowerCase().includes(q) ||
        s.descricaoServicos.toLowerCase().includes(q) ||
        s.situacao.toLowerCase().includes(q) ||
        s.tipo.toLowerCase().includes(q) ||
        String(s.numero).includes(q) ||
        formatNumeroAno(s.numero, s.createdAt).toLowerCase().includes(q) ||
        (s.setorDescricao || "").toLowerCase().includes(q) ||
        (s.pavimentoDescricao || "").toLowerCase().includes(q)
      );
    }
    if (filterCliente !== "all") result = result.filter(s => s.clienteId === filterCliente);
    if (filterTipo !== "all") result = result.filter(s => s.tipo === filterTipo);
    if (filterSituacao !== "all") result = result.filter(s => s.situacao === filterSituacao);
    if (filterPrioridade !== "all") result = result.filter(s => s.prioridade === filterPrioridade);
    if (filterVisitado !== "all") result = result.filter(s => filterVisitado === "sim" ? s.visitado : !s.visitado);
    if (filterOrigem !== "all") {
      const idsComOrcamento = new Set(orcamentos.map(o => o.solicitacaoId));
      result = result.filter(s => filterOrigem === "orcamento" ? idsComOrcamento.has(s.id) : !idsComOrcamento.has(s.id));
    }
    if (filterImpresso !== "all") result = result.filter(s => filterImpresso === "sim" ? s.impresso : !s.impresso);
    if (filterSetorCritico !== "all") {
      result = result.filter(s => filterSetorCritico === "sim" ? setoresCriticosIds.has(s.setorId) : !setoresCriticosIds.has(s.setorId));
    }
    if (filterDataIni || filterDataFim) {
      const diaDa = (s: any) => {
        const raw = s.dataHoraSolicitacao || s.createdAt || "";
        if (!raw) return "";
        const d = new Date(raw);
        if (isNaN(d.getTime())) return String(raw).slice(0, 10);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      result = result.filter(s => {
        const dia = diaDa(s);
        if (!dia) return false;
        if (filterDataIni && dia < filterDataIni) return false;
        if (filterDataFim && dia > filterDataFim) return false;
        return true;
      });
    }

    // Ordenação por coluna (padrão: prioridade → número decrescente)
    result = [...result].sort((a, b) => {
      if (!sortField) {
        const prioridadeRank = (p: string) => {
          if (p === "Emergencial") return 1;
          if (p === "Urgente") return 2;
          if (p === "Normal") return 3;
          return 4;
        };
        const rankCmp = prioridadeRank(a.prioridade) - prioridadeRank(b.prioridade);
        if (rankCmp !== 0) return rankCmp;
        return b.numero - a.numero;
      }

      let cmp = 0;
      switch (sortField) {
        case "numero":
          cmp = a.numero - b.numero;
          break;
        case "dataHora":
          cmp = (a.dataHoraSolicitacao || "").localeCompare(b.dataHoraSolicitacao || "");
          break;
        case "solicitante":
          cmp = (a.solicitanteNome || "").localeCompare(b.solicitanteNome || "");
          break;
        case "tipo":
          cmp = (a.tipo || "").localeCompare(b.tipo || "");
          break;
        case "cliente":
          cmp = (a.clienteNome || "").localeCompare(b.clienteNome || "");
          break;
        case "local":
          cmp = (a.localDescricao || "").localeCompare(b.localDescricao || "");
          break;
        case "pavimento":
          cmp = (a.pavimentoDescricao || "").localeCompare(b.pavimentoDescricao || "");
          break;
        case "setor":
          cmp = (a.setorDescricao || "").localeCompare(b.setorDescricao || "");
          break;
        case "equipamento":
          cmp = (a.equipamentoNome || "").localeCompare(b.equipamentoNome || "");
          break;
        case "descricao":
          cmp = (a.descricaoServicos || "").localeCompare(b.descricaoServicos || "");
          break;
        case "situacao":
          cmp = (a.situacao || "").localeCompare(b.situacao || "");
          break;
        case "os": {
          const osA = ordens.find(o => o.solicitacaoId === a.id)?.numero ?? 0;
          const osB = ordens.find(o => o.solicitacaoId === b.id)?.numero ?? 0;
          cmp = osA - osB;
          break;
        }
        case "visitado":
          cmp = Number(a.visitado) - Number(b.visitado);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [solicitacoes, search, filterCliente, filterTipo, filterSituacao, filterPrioridade, filterVisitado, filterOrigem, filterImpresso, filterSetorCritico, setoresCriticosIds, orcamentos, sortField, sortDir]);

  const clientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    solicitacoes.forEach(s => { if (s.clienteId && s.clienteNome) map.set(s.clienteId, s.clienteNome); });
    return Array.from(map.entries());
  }, [solicitacoes]);

  const { paginated, totalPages } = paginate(filtered, page, pageSize);

  const colDefs: Record<string, { label: ReactNode; className?: string }> = {
    numero: { label: <SortHeader field="numero">Nº</SortHeader>, className: "w-[100px] whitespace-nowrap" },
    dataHora: { label: <SortHeader field="dataHora">Data/Hora</SortHeader>, className: "whitespace-nowrap" },
    solicitante: { label: <SortHeader field="solicitante">Solicitante</SortHeader> },
    tipo: { label: <SortHeader field="tipo">Tipo</SortHeader> },
    cliente: { label: <SortHeader field="cliente">Cliente</SortHeader> },
    local: { label: <SortHeader field="local">Local</SortHeader> },
    pavimento: { label: <SortHeader field="pavimento">Pavimento</SortHeader> },
    setor: { label: <SortHeader field="setor">Setor</SortHeader> },
    equipamento: { label: <SortHeader field="equipamento">Equipamento</SortHeader> },
    descricao: { label: <SortHeader field="descricao">Descrição</SortHeader> },
    situacao: { label: <SortHeader field="situacao">Situação</SortHeader> },
    os: { label: <SortHeader field="os">OS</SortHeader>, className: "whitespace-nowrap" },
    visitado: { label: <SortHeader field="visitado">Visitado</SortHeader>, className: "w-20 text-center" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "solicitacao_servicos.lista",
    ["numero", "dataHora", "solicitante", "tipo", "cliente", "local", "pavimento", "setor", "equipamento", "descricao", "situacao", "os", "visitado"]
  );

  const allPageIds = paginated.map(s => s.id);
  const allPageSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));
  const somePageSelected = allPageIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        allPageIds.forEach(id => next.delete(id));
      } else {
        allPageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const marcarImpressa = async (ids: string[]) => {
    const pendentes = solicitacoes.filter(s => ids.includes(s.id) && !s.impresso);
    if (pendentes.length === 0) return;
    try {
      await Promise.all(pendentes.map(s => updateSolicitacao(s.id, {
        impresso: true,
        impresso_em: new Date().toISOString(),
        impresso_por: usuarioLogado?.nome || "Sistema",
      })));
    } catch { /* ignore */ }
  };

  const handleBatchPrint = async (comImagens: boolean) => {
    if (selectedIds.size === 0) return;
    setBatchPrinting(true);
    try {
      const selected = solicitacoes.filter(s => selectedIds.has(s.id));
      const lista = selected.map(s => ({
        ss: s,
        equipamento: equipamentos.find(e => e.id === s.equipamentoId),
      }));
      await gerarPdfSolicitacaoLote(lista, comImagens, empresa);
      await marcarImpressa(selected.map(s => s.id));
      toast({ title: `PDF gerado com ${selected.length} solicitação(ões)` });
    } catch {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setBatchPrinting(false);
    }
  };

  const handleBatchPrintMemoria = async (comFotos: boolean) => {
    if (selectedIds.size === 0) return;
    setBatchPrinting(true);
    try {
      const selected = solicitacoes.filter(s => selectedIds.has(s.id));
      const orcs = selected
        .map(s => orcamentos.find(o => o.solicitacaoId === s.id))
        .filter(Boolean) as any[];
      if (orcs.length === 0) {
        toast({ title: "Nenhum orçamento encontrado nas SS selecionadas", variant: "destructive" });
        return;
      }
      if (comFotos) {
        await gerarPdfMemoriaCalculoFotosLote(orcs, empresa);
      } else {
        await gerarPdfMemoriaCalculoLote(orcs, empresa);
      }
      toast({ title: `PDF gerado com ${orcs.length} memória(s) de cálculo` });
    } catch {
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setBatchPrinting(false);
    }
  };

  const showForm = formOpen && form.tipo !== "";

  return (
    <div className="space-y-6 pt-[15px] pl-0 pr-[10px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold mx-[7px]">Solicitação de Serviços</h1>
        {!formOpen && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Solicitar Serviço
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleSelectTipo("Predial")}>
                <Building2 className="mr-2 h-4 w-4" />
                Predial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSelectTipo("Equipamentos")}>
                <Wrench className="mr-2 h-4 w-4" />
                Equipamentos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Collapsible open={!formCollapsed} onOpenChange={o => setFormCollapsed(!o)}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  {editingId ? "Editar Solicitação" : `Nova Solicitação — ${form.tipo}`}
                </CardTitle>
                {!formCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <Label className="font-bold">Cliente</Label>
                    <Select value={form.cliente_id} onValueChange={v => setForm(f => ({ ...f, cliente_id: v, local_id: "", pavimento_id: "", setor_id: "", equipamento_id: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{soClientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-bold">Situação</Label>
                    <Input value={editingId ? form.situacao : "Aguardando aprovação"} disabled className="bg-muted" />
                  </div>
                </div>

                <div>
                  <Label className="font-bold">Local</Label>
                  <Select value={form.local_id} onValueChange={v => setForm(f => ({ ...f, local_id: v, pavimento_id: "", setor_id: "" }))} disabled={!form.cliente_id}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{locais.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.descricao}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-bold">Pavimento</Label>
                    <Select value={form.pavimento_id} onValueChange={v => setForm(f => ({ ...f, pavimento_id: v, setor_id: "" }))} disabled={!form.local_id}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{pavimentos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.descricao}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-bold">Setor</Label>
                    <Select value={form.setor_id} onValueChange={v => setForm(f => ({ ...f, setor_id: v, equipamento_id: "" }))} disabled={!form.pavimento_id}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{setores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.descricao}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Equipamento — only for "Equipamentos" type */}
                {form.tipo === "Equipamentos" && (
                  <div className="md:w-1/2">
                    <Label className="font-bold">Equipamento</Label>
                    <Select value={form.equipamento_id} onValueChange={v => setForm(f => ({ ...f, equipamento_id: v }))} disabled={!form.setor_id || equipamentosFiltrados.length === 0}>
                      <SelectTrigger><SelectValue placeholder={!form.setor_id ? "Selecione o setor..." : equipamentosFiltrados.length === 0 ? "Nenhum equipamento no setor" : "Selecione..."} /></SelectTrigger>
                      <SelectContent>{equipamentosFiltrados.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.tag ? `${e.tag} - ${e.equipamento}` : e.equipamento}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                )}

                <div>
                  <Label className="font-bold">Descrição dos Serviços</Label>
                  <Textarea
                    placeholder="Descrição dos Serviços"
                    value={form.descricao_servicos}
                    onChange={e => setForm(f => ({ ...f, descricao_servicos: e.target.value }))}
                    rows={4}
                  />
                </div>

                {/* Imagens — até 3 */}
                <div>
                  <Label className="font-bold">Imagens (máx. 3)</Label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {imagens.map((img, idx) => (
                      <div key={idx} className="relative group w-28 h-28 rounded-md border border-border overflow-hidden">
                        <img src={img.url} alt={`Imagem ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImagem(idx)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {imagens.length < 3 && (
                      <>
                        {isMobile && (
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="w-28 h-28 rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                          >
                            <Camera className="h-6 w-6" />
                            <span className="text-xs">Câmera</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-28 h-28 rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          <ImagePlus className="h-6 w-6" />
                          <span className="text-xs">{isMobile ? "Galeria" : "Adicionar"}</span>
                        </button>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddImagem}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleAddImagem}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setFormOpen(false); setForm({ ...emptyForm }); setImagens([]); setEditingId(null); }}>
                    Cancelar
                  </Button>
                  {!editingId && (
                    <Button variant="secondary" onClick={() => handleSave(true)} disabled={uploading}>
                      <Plus className="mr-2 h-4 w-4" />
                      {uploading ? "Salvando..." : "Adicionar e continuar"}
                    </Button>
                  )}
                  <Button onClick={() => handleSave(false)} disabled={uploading}>
                    <Plus className="mr-2 h-4 w-4" />
                    {uploading ? "Salvando..." : editingId ? "Atualizar" : "Adicionar e fechar"}
                  </Button>

                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input
          placeholder="Buscar solicitação..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Select value={filterCliente} onValueChange={v => { setFilterCliente(v); localStorage.setItem("ss_filtroCliente", v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {clientesUnicos.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={v => { setFilterTipo(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="Predial">Predial</SelectItem>
            <SelectItem value="Equipamentos">Equipamentos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSituacao} onValueChange={v => { setFilterSituacao(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Situações</SelectItem>
            {SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPrioridade} onValueChange={v => { setFilterPrioridade(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Prioridades</SelectItem>
            {PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSetorCritico} onValueChange={v => { setFilterSetorCritico(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Setor Crítico" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Setores</SelectItem>
            <SelectItem value="sim">Setor Crítico</SelectItem>
            <SelectItem value="nao">Não Crítico</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterVisitado} onValueChange={v => { setFilterVisitado(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Visitado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sim">Visitado</SelectItem>
            <SelectItem value="nao">Não Visitado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterOrigem} onValueChange={v => { setFilterOrigem(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Origens</SelectItem>
            <SelectItem value="orcamento">De Orçamento</SelectItem>
            <SelectItem value="direta">Direta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterImpresso} onValueChange={v => { setFilterImpresso(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Impressão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Impressas e não impressas</SelectItem>
            <SelectItem value="sim">Somente impressas</SelectItem>
            <SelectItem value="nao">Não impressas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg border border-border">
          <span className="text-sm font-medium">{selectedIds.size} solicitação(ões) selecionada(s)</span>
          <Button size="sm" variant="outline" onClick={() => handleBatchPrint(false)} disabled={batchPrinting}>
            <Download className="mr-2 h-4 w-4" />Imprimir sem imagem
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBatchPrint(true)} disabled={batchPrinting}>
            <Download className="mr-2 h-4 w-4" />Imprimir com imagem
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBatchPrintMemoria(false)} disabled={batchPrinting}>
            <Download className="mr-2 h-4 w-4" />Memória de Cálculo PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBatchPrintMemoria(true)} disabled={batchPrinting}>
            <Download className="mr-2 h-4 w-4" />Memória de Cálculo com Fotos PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Limpar seleção</Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
              <TableRow className="hover:bg-table-header/85">
               <TableHead className="w-10 text-center bg-card [&:has([role=checkbox])]:pr-3">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              {colOrder.map((key) => {
                const c = colDefs[key];
                if (!c) return null;
                return (
                  <SortableTableHead key={key} id={key} className={c.className}>
                    {c.label}
                  </SortableTableHead>
                );
              })}
              <TableHead className="w-16">Ações</TableHead>
             </TableRow>
            </SortableHeaderRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                  Nenhuma solicitação cadastrada
                </TableCell>
              </TableRow>
            ) : paginated.map((s, idx) => {
              const orcSS = orcamentos.find(o => o.solicitacaoId === s.id);
              const qtdRev = orcSS?.revisoes?.length ?? 0;
              const fromOrcamento = !!orcSS || (s.historico || []).some(h => (h.situacao || "").toLowerCase().includes("orçamento"));
              const osVinculada = ordens.find(o => o.solicitacaoId === s.id);
              const osLabel = osVinculada ? formatNumeroAno(osVinculada.numero, osVinculada.createdAt) : "-";
              const cellMap: Record<string, { node: ReactNode; className?: string }> = {
                numero: {
                  node: (
                    <div className="flex items-center gap-2">
                      {s.prioridade && (
                        <span className={`inline-block w-3 h-3 rounded-full ${getPrioridadeColor(s.prioridade)}`} title={s.prioridade} />
                      )}
                      {formatNumeroAno(s.numero, s.createdAt)}
                      {fromOrcamento && (
                        <ReceiptText className="h-4 w-4 text-emerald-600" aria-label="Proveniente de Orçamento" />
                      )}
                      {s.impresso && (
                        <span title={s.impressoEm ? `Impressa em ${new Date(s.impressoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${s.impressoPor ? ` por ${s.impressoPor}` : ""}` : "Impressa"}>
                          <Printer className="h-4 w-4 text-blue-600" aria-label="Impressa" />
                        </span>
                      )}
                    </div>
                  ),
                  className: "font-medium",
                },
                dataHora: {
                  node: s.dataHoraSolicitacao ? new Date(s.dataHoraSolicitacao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-",
                  className: "text-xs whitespace-nowrap",
                },
                solicitante: { node: s.solicitanteNome || "-", className: "text-xs" },
                tipo: { node: <Badge variant="outline">{s.tipo}</Badge> },
                cliente: { node: s.clienteNome || "-" },
                local: { node: s.localDescricao || "-" },
                pavimento: { node: s.pavimentoDescricao || "-" },
                setor: {
                  node: (
                    <div className="flex items-center gap-1.5">
                      {setoresCriticosIds.has(s.setorId) && (
                        <img
                          src={iconSetorCritico}
                          alt="Setor Crítico"
                          title="Setor Crítico"
                          className="h-5 w-5 object-contain"
                        />
                      )}
                      <span>{s.setorDescricao || "-"}</span>
                    </div>
                  ),
                },
                equipamento: { node: s.tipo === "Equipamentos" ? (s.equipamentoNome || "-") : "-" },
                descricao: { node: s.descricaoServicos || "-", className: "max-w-[200px] truncate" },
                situacao: {
                  node: (
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          s.situacao === "Concluída" ? "default" :
                          s.situacao === "Cancelada" ? "destructive" :
                          s.situacao === "Em execução" ? "secondary" : "outline"
                        }
                        className={
                          s.situacao === "Aprovada" ? "bg-green-600 text-white border-green-600 hover:bg-green-700" :
                          s.situacao === "Aguardando aprovação" ? "bg-yellow-500 border-yellow-500 hover:bg-yellow-600 text-primary" :
                          s.situacao === "Orçamento Solicitado" ? "bg-blue-500 border-blue-500 hover:bg-blue-600 text-white" :
                          s.situacao === "Orçamento Disponível" ? "bg-indigo-500 border-indigo-500 hover:bg-indigo-600 text-white" : ""
                        }
                      >{s.situacao}</Badge>
                      {qtdRev > 0 && (
                        <img
                          src={iconRevisao}
                          alt={`${qtdRev} pedido(s) de revisão`}
                          title={`${qtdRev} pedido(s) de revisão`}
                          className="h-5 w-5"
                        />
                      )}
                    </div>
                  ),
                },
                os: {
                  node: osVinculada ? (
                    <Link
                      to={`/engenharia/ordem-servico?numero=${osLabel}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
                    >
                      OS {osLabel}
                    </Link>
                  ) : "-",
                  className: "text-xs whitespace-nowrap",
                },
                visitado: {
                  node: (
                    <Checkbox
                      checked={s.visitado}
                      onCheckedChange={async (checked) => {
                        await updateSolicitacao(s.id, { visitado: !!checked });
                      }}
                    />
                  ),
                  className: "text-center",
                },
              };
              return (
              <TableRow key={s.id} className={selectedIds.has(s.id) ? "bg-accent/50" : (idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60")}>
                <TableCell className="text-center">
                  <Checkbox
                    checked={selectedIds.has(s.id)}
                    onCheckedChange={() => toggleSelect(s.id)}
                    aria-label={`Selecionar SS ${s.numero}`}
                  />
                </TableCell>
                {colOrder.map((key) => {
                  const c = cellMap[key];
                  return <TableCell key={key} className={c?.className}>{c?.node}</TableCell>;
                })}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setViewTarget(s)}>
                        <Eye className="mr-2 h-4 w-4" />Visualizar
                      </DropdownMenuItem>
                      {podeStAprovada && !["Aprovada", "Em execução", "Concluída", "Orçamento Solicitado", "Orçamento Disponível"].includes(s.situacao) && (
                        <DropdownMenuItem onClick={() => handleOpenApproval(s.id)}>
                          <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />Aprovar
                        </DropdownMenuItem>
                      )}
                      {["Aprovada", "Em execução"].includes(s.situacao) && (
                        <DropdownMenuItem onClick={() => handleOpenApproval(s.id, true)}>
                          <Pencil className="mr-2 h-4 w-4" />Alterar Prioridade
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={async () => {
                        const eq = equipamentos.find(e => e.id === s.equipamentoId);
                        await gerarPdfSolicitacao(s, false, empresa, eq);
                        await marcarImpressa([s.id]);
                      }}>
                        <Download className="mr-2 h-4 w-4" />Imprimir SS (sem imagem)
                      </DropdownMenuItem>
                      {s.imagens && s.imagens.length > 0 && (
                        <DropdownMenuItem onClick={async () => {
                          const eq = equipamentos.find(e => e.id === s.equipamentoId);
                          await gerarPdfSolicitacao(s, true, empresa, eq);
                          await marcarImpressa([s.id]);
                        }}>
                          <Download className="mr-2 h-4 w-4" />Imprimir SS (com imagem)
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {podeStEmAnalise && s.situacao === "Aguardando aprovação" && (
                        <DropdownMenuItem onClick={() => handleSolicitarOrcamento(s)}>
                          <FileText className="mr-2 h-4 w-4" />Solicitar Orçamento
                        </DropdownMenuItem>
                      )}
                      {s.situacao === "Orçamento Solicitado" && (
                        <DropdownMenuItem onClick={() => handleOrcarSolicitacao(s)}>
                          <ClipboardList className="mr-2 h-4 w-4 text-blue-600" />Orçar Solicitação
                        </DropdownMenuItem>
                      )}
                      {s.situacao === "Orçamento Disponível" && (
                        <DropdownMenuItem onClick={() => handleOrcarSolicitacao(s)}>
                          <FileText className="mr-2 h-4 w-4 text-indigo-600" />Ver Orçamento
                        </DropdownMenuItem>
                      )}
                      {orcamentos.some(o => o.solicitacaoId === s.id) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDownloadOrcamento(s, "pdf")}>
                            <Download className="mr-2 h-4 w-4" />Orçamento PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadOrcamento(s, "excel")}>
                            <Download className="mr-2 h-4 w-4" />Orçamento Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadOrcamento(s, "memoria")}>
                            <Download className="mr-2 h-4 w-4" />Memória de Cálculo PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadOrcamento(s, "memoria-fotos")}>
                            <Download className="mr-2 h-4 w-4" />Memória de Cálculo com Fotos PDF
                          </DropdownMenuItem>
                        </>
                      )}
                      {podeEditar && !["Aprovada", "Em execução", "Concluída", "Orçamento Solicitado", "Orçamento Disponível"].includes(s.situacao) && (
                        <DropdownMenuItem onClick={() => handleEdit(s)}>
                          <Pencil className="mr-2 h-4 w-4" />Editar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {podeStCancelada && !["Aprovada", "Em execução", "Concluída", "Orçamento Solicitado"].includes(s.situacao) && (
                        <DropdownMenuItem onClick={() => requestCancel(s.id)}>
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />Cancelar Solicitação
                        </DropdownMenuItem>
                      )}
                      {podeExcluir && !["Aprovada", "Em execução", "Concluída", "Orçamento Solicitado", "Orçamento Disponível"].includes(s.situacao) && (
                        <DropdownMenuItem onClick={() => requestDelete(s.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
          {filterSituacao === "Orçamento Disponível" && filtered.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={14} className="text-right font-semibold">
                  Total Orçamento Disponível ({filtered.length}):{" "}
                  {filtered
                    .reduce((acc, s) => acc + Number(orcamentos.find(o => o.solicitacaoId === s.id)?.valorTotal ?? 0), 0)
                    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}/>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={handleDelete} />
      <Dialog open={!!cancelId} onOpenChange={o => !o && abortCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Solicitação de Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo do cancelamento *</label>
            <Textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              rows={4}
              required
              aria-required
              placeholder="Descreva o motivo do cancelamento (mínimo 5 caracteres)"
            />
            <p className="text-xs text-muted-foreground">O motivo ficará registrado no histórico e nas observações da SS.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={abortCancel}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancelar}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Orcamento Dialog */}
      <OrcamentoDialog
        key={existingOrcamentoForTarget?.id ?? orcamentoTarget?.id ?? "novo"}
        open={orcamentoDialogOpen}
        onOpenChange={(o) => { setOrcamentoDialogOpen(o); if (!o) setOrcamentoTarget(null); }}
        solicitacao={orcamentoTarget}
        existingOrcamento={existingOrcamentoForTarget}
        onApproved={handleOrcamentoApproved}
        onSent={handleOrcamentoSent}
        onRevisaoSolicitada={handleOrcamentoRevisao}
      />

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{prioridadeOnly ? "Alterar Prioridade" : "Aprovar Solicitação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label className="font-bold">Selecione o nível de prioridade:</Label>
            <div className="flex flex-col gap-3">
              {PRIORIDADES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSelectedPrioridade(p.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                    selectedPrioridade === p.value
                      ? "border-primary bg-accent"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <span className={`inline-block w-4 h-4 rounded-full ${p.color}`} />
                  <span className="font-medium">{p.value}</span>
                </button>
              ))}
            </div>
            {!prioridadeOnly && (
              <div className="space-y-2">
                <Label htmlFor="ressalva-aprovacao">Ressalva de aprovação</Label>
                <Textarea
                  id="ressalva-aprovacao"
                  rows={3}
                  value={approvalRessalva}
                  onChange={e => setApprovalRessalva(e.target.value)}
                  placeholder="Informe observações ou ressalvas sobre a aprovação (opcional)"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmApproval} disabled={!selectedPrioridade}>{prioridadeOnly ? "Confirmar Alteração" : "Confirmar Aprovação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => { if (!o) setViewTarget(null); }}>
        <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2 pr-16">
              <Eye className="h-5 w-5" />
              Solicitação de Serviço nº {viewTarget ? formatNumeroAno(viewTarget.numero, viewTarget.createdAt) : ""}
            </DialogTitle>
            {viewTarget && (() => {
              const hasOrc = orcamentos.some(o => o.solicitacaoId === viewTarget.id);
              const fromOrc = hasOrc || (viewTarget.historico || []).some(h => (h.situacao || "").toLowerCase().includes("orçamento"));
              return fromOrc ? (
                <div
                  className="absolute right-10 top-0 flex h-11 w-9 items-center justify-center rounded-md border-2 border-foreground bg-background"
                  title="Proveniente de Orçamento"
                  aria-label="Proveniente de Orçamento"
                >
                  <ReceiptText className="h-6 w-6 text-foreground" strokeWidth={2.2} />
                </div>
              ) : null;
            })()}
          </DialogHeader>
          {viewTarget && (() => {
            const orc = orcamentos.find(o => o.solicitacaoId === viewTarget.id);
            return (
              <div className="space-y-6 py-2">
                {/* Info geral */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Data/Hora</Label>
                    <p className="text-sm font-medium">
                      {viewTarget.dataHoraSolicitacao ? new Date(viewTarget.dataHoraSolicitacao).toLocaleString("pt-BR") : "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Solicitante</Label>
                    <p className="text-sm font-medium">{viewTarget.solicitanteNome || "-"}</p>
                    {(() => {
                      const aprov = [...(viewTarget.historico || [])].reverse().find(h => h.situacao === "Aprovada");
                      return aprov?.usuario ? (
                        <>
                          <Label className="text-xs text-muted-foreground mt-2 block">Aprovador</Label>
                          <p className="text-sm font-medium">{aprov.usuario}</p>
                        </>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <p className="text-sm font-medium">{viewTarget.tipo}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Situação</Label>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">{viewTarget.situacao}</Badge>
                      {(() => {
                        const osVinc = ordens.find(o => o.solicitacaoId === viewTarget.id);
                        return osVinc ? (
                          <a
                            href={`/engenharia/ordem-servico?numero=${osVinc.numero}`}
                            className="text-xs text-primary hover:underline font-medium"
                            title="Ver Ordem de Serviço vinculada"
                          >
                            OS {formatNumeroAno(osVinc.numero, osVinc.createdAt)}
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  {viewTarget.prioridade && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Prioridade</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block w-3 h-3 rounded-full ${
                          viewTarget.prioridade === "Emergencial" ? "bg-destructive" :
                          viewTarget.prioridade === "Urgente" ? "bg-yellow-500" : "bg-green-500"
                        }`} />
                        <span className="text-sm font-medium">{viewTarget.prioridade}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Localização */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Localização</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Cliente</Label>
                      <p className="text-sm font-medium">{viewTarget.clienteNome || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Local</Label>
                      <p className="text-sm font-medium">{viewTarget.localDescricao || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Pavimento</Label>
                      <p className="text-sm font-medium">{viewTarget.pavimentoDescricao || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Setor</Label>
                      <p className="text-sm font-medium">{viewTarget.setorDescricao || "-"}</p>
                    </div>
                    {viewTarget.tipo === "Equipamentos" && (
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Equipamento</Label>
                        <p className="text-sm font-medium">{viewTarget.equipamentoNome || "-"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Descrição */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Descrição dos Serviços</h4>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{viewTarget.descricaoServicos || "-"}</p>
                </div>

                {/* Ressalva de aprovação */}
                {viewTarget.ressalvaAprovacao && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Ressalva de Aprovação</h4>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{viewTarget.ressalvaAprovacao}</p>
                  </div>
                )}

                {/* Imagens */}
                {viewTarget.imagens && viewTarget.imagens.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Imagens</h4>
                    <div className="flex gap-3 flex-wrap">
                      {viewTarget.imagens.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Imagem ${i + 1}`} className="w-32 h-32 object-cover rounded-md border hover:opacity-80 transition" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orçamento vinculado */}
                {orc && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground">Orçamento nº {orc.numero}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge variant="outline" className="mt-1">{orc.status}</Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Valor Total</Label>
                        <p className="text-sm font-bold">{orc.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                      </div>
                    </div>
                    <Tabs defaultValue="itens" className="w-full">
                      <TabsList>
                        <TabsTrigger value="itens">Itens</TabsTrigger>
                        <TabsTrigger value="memoria">Memória de Cálculo</TabsTrigger>
                      </TabsList>
                      <TabsContent value="memoria" className="mt-3">
                        <MemoriaCalculoView grupos={(orc as any).memoriaCalculo} />
                      </TabsContent>
                      <TabsContent value="itens" className="mt-3">
                    {orc.itensSco.length > 0 && (
                      <div className="mb-3">
                        <Label className="text-xs text-muted-foreground mb-1 block">Itens SCO/SINAPI/EMOP</Label>
                        <div className="border rounded-md text-xs">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Código</TableHead>
                                <TableHead className="text-xs">Descrição</TableHead>
                                <TableHead className="text-xs text-right">Qtd</TableHead>
                                <TableHead className="text-xs text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {orc.itensSco.map((item: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs font-mono">{item.codSco || item.codigo}</TableCell>
                                  <TableCell className="text-xs">{item.descricao}</TableCell>
                                  <TableCell className="text-xs text-right">{item.quantidade}</TableCell>
                                  <TableCell className="text-xs text-right">{Number(item.valorTotal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    {orc.itensMateriais.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Materiais de Estoque</Label>
                        <div className="border rounded-md text-xs">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Código</TableHead>
                                <TableHead className="text-xs">Descrição</TableHead>
                                <TableHead className="text-xs text-right">Qtd</TableHead>
                                <TableHead className="text-xs text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {orc.itensMateriais.map((item: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs font-mono">{item.codigo}</TableCell>
                                  <TableCell className="text-xs">{item.descricao}</TableCell>
                                  <TableCell className="text-xs text-right">{item.quantidade}</TableCell>
                                  <TableCell className="text-xs text-right">{Number(item.valorTotal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                    {orc.anexos && orc.anexos.length > 0 && (
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground mb-1 block">Anexos do Orçamento</Label>
                        <div className="flex flex-col gap-1">
                          {orc.anexos.map((anexo: string, i: number) => {
                            const nome = decodeURIComponent(anexo.split("/").pop() || `Anexo ${i + 1}`);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(anexo);
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = nome;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  } catch {
                                    window.open(anexo, "_blank");
                                  }
                                }}
                                className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                              >
                                <Download className="h-4 w-4" />
                                {nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
                {/* Workflow Timeline */}
                <div className="border rounded-lg p-4 bg-muted/20">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <History className="h-4 w-4" /> Workflow
                  </h4>
                  <WorkflowTimeline
                    steps={viewTarget.situacao === "Cancelada"
                      ? [...SS_WORKFLOW_STEPS, { label: "Cancelada" }]
                      : (viewTarget.situacao === "Orçamento Solicitado" || viewTarget.situacao === "Orçamento Disponível")
                        ? [{ label: "Aguardando aprovação" }, { label: "Orçamento Solicitado" }, { label: "Orçamento Disponível" }, { label: "Aprovada" }, { label: "Em execução" }, { label: "Concluída" }]
                        : SS_WORKFLOW_STEPS
                    }
                    currentStep={viewTarget.situacao}
                    historico={viewTarget.historico}
                  />
                </div>

                {/* Histórico de Alterações */}
                {viewTarget.historico && viewTarget.historico.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Histórico de Alterações
                    </h4>
                    <WorkflowHistorico historico={viewTarget.historico} />
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de aviso de duplicidade */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              Solicitação similar já existe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Foram encontradas {duplicateMatches.length} solicitação(ões) abertas nos últimos 5 dias para o mesmo setor com descrição similar:
            </p>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {duplicateMatches.map(m => (
                <div key={m.id} className="border rounded-md p-3 bg-muted/30">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm">SS Nº {formatNumeroAno(m.numero, m.createdAt)}</span>
                    <Badge variant="outline">{m.situacao}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Setor: {m.setorDescricao} • Solicitante: {m.solicitanteNome || "-"} • {m.dataHoraSolicitacao ? new Date(m.dataHoraSolicitacao).toLocaleString("pt-BR") : "-"}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.descricaoServicos}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                setDuplicateDialogOpen(false);
                await persistSave();
              }}
            >
              Abrir mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
