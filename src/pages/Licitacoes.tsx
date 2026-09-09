import { useState, useMemo } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useLicitacoes, Licitacao, DocumentoLicitacao, AnaliseLicitacao } from "@/contexts/LicitacoesContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, Eye, Pencil, Trash2, Upload, FileText, ChevronDown, ExternalLink, AlertTriangle, CheckCircle2, Clock, XCircle, Filter, Send, Phone, Settings, X, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

// ============ CONSTANTS ============

const MODALIDADES = [
  "Pregão Eletrônico", "Pregão Presencial", "Concorrência",
  "Diálogo Competitivo", "RDC",
];

const STATUS_LICITACAO = [
  "Novo", "Em Análise", "Participando", "Proposta Enviada",
  "Vencida", "Perdida", "Cancelada", "Desistência", "Em Recurso",
];

const GRAU_INTERESSE = ["Baixo", "Médio", "Alto", "Muito Alto"];
const PROBABILIDADE_EXITO = ["Baixa", "Média", "Alta", "Muito Alta"];

const CRITERIOS_JULGAMENTO = [
  "Menor Preço", "Maior Desconto", "Melhor Técnica",
  "Técnica e Preço", "Maior Lance",
];

const CATEGORIAS_DOCUMENTO = [
  "Jurídico", "Fiscal", "Trabalhista", "Econômico-Financeiro", "Técnico",
  "Atestado de Capacidade Técnica", "Contrato de Referência", "Balanço",
  "Certidão", "Procuração", "Declaração", "Outros",
];

const STATUS_DOCUMENTO = ["Válido", "Pendente", "Vencido", "Aprovado"];

const DECISOES_ANALISE = [
  "Viável", "Viável com ressalvas", "Inviável",
  "Pendente de documentação", "Pendente de decisão da diretoria",
];

const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const statusColors: Record<string, string> = {
  "Novo": "bg-blue-100 text-blue-800",
  "Em Análise": "bg-yellow-100 text-yellow-800",
  "Participando": "bg-indigo-100 text-indigo-800",
  "Proposta Enviada": "bg-purple-100 text-purple-800",
  "Vencida": "bg-green-100 text-green-800",
  "Perdida": "bg-red-100 text-red-800",
  "Cancelada": "bg-gray-200 text-gray-700",
  "Desistência": "bg-orange-100 text-orange-800",
  "Em Recurso": "bg-amber-100 text-amber-800",
};

const docStatusColors: Record<string, string> = {
  "Válido": "bg-green-100 text-green-800",
  "Pendente": "bg-yellow-100 text-yellow-800",
  "Vencido": "bg-red-100 text-red-800",
  "Aprovado": "bg-blue-100 text-blue-800",
};

const decisaoColors: Record<string, string> = {
  "Viável": "bg-green-100 text-green-800",
  "Viável com ressalvas": "bg-yellow-100 text-yellow-800",
  "Inviável": "bg-red-100 text-red-800",
  "Pendente de documentação": "bg-orange-100 text-orange-800",
  "Pendente de decisão da diretoria": "bg-blue-100 text-blue-800",
};

// ============ EMPTY FORMS ============

const EMPTY_LICITACAO: Omit<Licitacao, "id"> = {
  numeroProcesso: "", numeroEdital: "", modalidade: "", orgaoLicitante: "", uasg: "",
  objetoResumido: "", objetoDetalhado: "", cidade: "", estado: "", dataPublicacao: "",
  dataSessao: "", prazoImpugnacao: "", prazoEsclarecimento: "", portalDisputa: "",
  linkEdital: "", valorEstimado: 0, criterioJulgamento: "", regimeExecucao: "",
  prazoContratual: "", possibilidadeProrrogacao: false, exigenciaVisitaTecnica: false,
  exigenciaGarantia: false, status: "Novo", responsavelInterno: "", grauInteresse: "Médio",
  probabilidadeExito: "Média", observacoes: "",
};

const EMPTY_DOCUMENTO: Omit<DocumentoLicitacao, "id"> = {
  nome: "", tipoDocumental: "", categoria: "", orgaoEmissor: "", dataEmissao: "",
  dataValidade: "", status: "Válido", arquivoUrl: "", arquivoNome: "", observacoes: "",
  versao: 1, licitacoesVinculadas: [],
};

const EMPTY_ANALISE: Omit<AnaliseLicitacao, "id"> = {
  licitacaoId: "", resumoObjeto: "", exigenciasTecnicas: "", exigenciasEconomicas: "",
  documentosObrigatorios: "", exigenciasEquipe: "", exigenciaVistoria: "",
  exigenciaGarantiaProposta: "", necessidadeCatCreaCau: "", necessidadeCertidoes: "",
  riscosJuridicos: "", pontosRestritivos: "", oportunidadesImpugnacao: "",
  decisaoParticipar: "Pendente de decisão da diretoria", analista: "", dataAnalise: "",
  observacoes: "", analiseIaMarkdown: "", analiseIaGeradaEm: "",
};

// ============ COMPONENT ============

export default function LicitacoesPage() {
  const {
    licitacoes, documentos, analises, loading,
    addLicitacao, updateLicitacao, deleteLicitacao,
    addDocumento, updateDocumento, deleteDocumento,
    addAnalise, updateAnalise, deleteAnalise,
    uploadArquivo,
  } = useLicitacoes();
  const { usuarioLogado } = useAuth();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriar = tem("licitacoes.criar");
  const podeEditar = tem("licitacoes.editar");
  const podeExcluir = tem("licitacoes.excluir");
  const podeAnexar = tem("licitacoes.gerenciar_anexos");
  const podeIA = tem("licitacoes.extrair_datas_ia");

  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneList, setPhoneList] = useState<{ id: string; telefone: string; nome_contato: string }[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneName, setNewPhoneName] = useState("");
  const [loadingPhones, setLoadingPhones] = useState(false);
  const { deleteId: deleteLicId, requestDelete: requestDeleteLic, cancelDelete: cancelDeleteLic } = useDoubleConfirmDelete();
  const { deleteId: deleteDocId, requestDelete: requestDeleteDoc, cancelDelete: cancelDeleteDoc } = useDoubleConfirmDelete();
  const { deleteId: deleteAnaId, requestDelete: requestDeleteAna, cancelDelete: cancelDeleteAna } = useDoubleConfirmDelete();
  const { deleteId: deletePhoneId, requestDelete: requestDeletePhone, cancelDelete: cancelDeletePhone } = useDoubleConfirmDelete();

  const loadPhones = async () => {
    setLoadingPhones(true);
    const { data } = await supabase.from("licitacoes_telefones_notificacao").select("*").order("created_at");
    setPhoneList((data as any[]) || []);
    setLoadingPhones(false);
  };

  const handleAddPhone = async () => {
    if (!newPhone.trim()) { toast({ title: "Informe o telefone", variant: "destructive" }); return; }
    const { error } = await supabase.from("licitacoes_telefones_notificacao").insert({ telefone: newPhone.trim(), nome_contato: newPhoneName.trim() });
    if (error) { toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" }); return; }
    setNewPhone(""); setNewPhoneName("");
    toast({ title: "Telefone adicionado!" });
    loadPhones();
  };

  const handleRemovePhone = async (id: string) => {
    await supabase.from("licitacoes_telefones_notificacao").delete().eq("id", id);
    toast({ title: "Telefone removido!" });
    loadPhones();
  };

  // WhatsApp test notification
  const handleTesteWhatsApp = async () => {
    setSendingWhatsApp(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-documentos-vencimento', {
        body: {},
      });
      if (error) throw error;
      if (data?.notificados === 0) {
        toast({ title: "Nenhum documento com vencimento nos próximos 15 dias ou nenhum telefone cadastrado." });
      } else {
        toast({ title: `Teste enviado! ${data?.notificados || 0} documento(s) notificado(s) via WhatsApp.` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: "Erro ao enviar teste WhatsApp", description: msg, variant: "destructive" });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Tab state
  const [activeTab, setActiveTab] = useState("oportunidades");

  // ============ OPORTUNIDADES ============
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterModalidade, setFilterModalidade] = useState("Todos");
  const [licDialogOpen, setLicDialogOpen] = useState(false);
  const [licForm, setLicForm] = useState<Omit<Licitacao, "id">>(EMPTY_LICITACAO);
  const [editLicId, setEditLicId] = useState<string | null>(null);
  const [viewLicId, setViewLicId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pageLic, setPageLic] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageDoc, setPageDoc] = useState(1);
  const [pageAna, setPageAna] = useState(1);

  const filteredLicitacoes = useMemo(() => {
    return licitacoes.filter(l => {
      const matchSearch = !search ||
        l.numeroProcesso.toLowerCase().includes(search.toLowerCase()) ||
        l.orgaoLicitante.toLowerCase().includes(search.toLowerCase()) ||
        l.objetoResumido.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "Todos" || l.status === filterStatus;
      const matchModalidade = filterModalidade === "Todos" || l.modalidade === filterModalidade;
      return matchSearch && matchStatus && matchModalidade;
    });
  }, [licitacoes, search, filterStatus, filterModalidade]);

  const handleSaveLicitacao = async () => {
    if (editLicId ? !podeEditar : !podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!licForm.numeroProcesso || !licForm.orgaoLicitante) {
      toast({ title: "Preencha o número do processo e o órgão licitante", variant: "destructive" });
      return;
    }
    if (editLicId) {
      await updateLicitacao(editLicId, licForm);
      toast({ title: "Licitação atualizada!" });
    } else {
      await addLicitacao(licForm);
      toast({ title: "Licitação cadastrada!" });
    }
    setLicForm(EMPTY_LICITACAO);
    setEditLicId(null);
    setLicDialogOpen(false);
  };

  const handleEditLicitacao = (l: Licitacao) => {
    const { id, ...rest } = l;
    setLicForm(rest);
    setEditLicId(id);
    setLicDialogOpen(true);
  };

  const handleDeleteLicitacao = async (id: string) => {
    if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    await deleteLicitacao(id);
    toast({ title: "Licitação excluída!" });
  };

  // ============ DOCUMENTOS ============
  const [docSearch, setDocSearch] = useState("");
  const [filterDocCategoria, setFilterDocCategoria] = useState("Todos");
  const [filterDocStatus, setFilterDocStatus] = useState("Todos");
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docForm, setDocForm] = useState<Omit<DocumentoLicitacao, "id">>(EMPTY_DOCUMENTO);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const filteredDocumentos = useMemo(() => {
    return documentos.filter(d => {
      const matchSearch = !docSearch ||
        d.nome.toLowerCase().includes(docSearch.toLowerCase()) ||
        d.orgaoEmissor.toLowerCase().includes(docSearch.toLowerCase());
      const matchCategoria = filterDocCategoria === "Todos" || d.categoria === filterDocCategoria;
      const matchStatus = filterDocStatus === "Todos" || d.status === filterDocStatus;
      return matchSearch && matchCategoria && matchStatus;
    });
  }, [documentos, docSearch, filterDocCategoria, filterDocStatus]);

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!podeAnexar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const url = await uploadArquivo(file);
      setDocForm(prev => ({ ...prev, arquivoUrl: url, arquivoNome: file.name }));
      toast({ title: "Arquivo enviado! Analisando datas..." });

      // Extract dates from document using AI
      try {
        const formData = new FormData();
        formData.append("file", file);
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/extract-document-dates`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
            body: formData,
          }
        );
        if (res.ok) {
          const dates = await res.json();
          const updates: Partial<Omit<DocumentoLicitacao, "id">> = {};
          if (dates.dataEmissao) updates.dataEmissao = dates.dataEmissao;
          if (dates.dataValidade) updates.dataValidade = dates.dataValidade;
          if (Object.keys(updates).length > 0) {
            setDocForm(prev => ({ ...prev, ...updates }));
            const found = [];
            if (dates.dataEmissao) found.push("emissão");
            if (dates.dataValidade) found.push("validade");
            toast({ title: `Datas detectadas: ${found.join(" e ")}` });
          } else {
            toast({ title: "Nenhuma data encontrada no documento", variant: "destructive" });
          }
        }
      } catch (aiErr) {
        console.error("Erro na extração de datas:", aiErr);
      }
    } catch {
      toast({ title: "Erro ao enviar arquivo", variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSaveDocumento = async () => {
    if (editDocId ? !podeAnexar : !podeAnexar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!docForm.nome) {
      toast({ title: "Informe o nome do documento", variant: "destructive" });
      return;
    }
    if (editDocId) {
      await updateDocumento(editDocId, docForm);
      toast({ title: "Documento atualizado!" });
    } else {
      await addDocumento(docForm);
      toast({ title: "Documento cadastrado!" });
    }
    setDocForm(EMPTY_DOCUMENTO);
    setEditDocId(null);
    setDocDialogOpen(false);
  };

  const handleEditDocumento = (d: DocumentoLicitacao) => {
    const { id, ...rest } = d;
    setDocForm(rest);
    setEditDocId(id);
    setDocDialogOpen(true);
  };

  const handleDeleteDocumento = async (id: string) => {
    if (!podeAnexar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    await deleteDocumento(id);
    toast({ title: "Documento excluído!" });
  };

  // ============ ANÁLISES ============
  const [analiseDialogOpen, setAnaliseDialogOpen] = useState(false);
  const [analiseForm, setAnaliseForm] = useState<Omit<AnaliseLicitacao, "id">>(EMPTY_ANALISE);
  const [editAnaliseId, setEditAnaliseId] = useState<string | null>(null);
  const [viewAnaliseId, setViewAnaliseId] = useState<string | null>(null);

  // ===== Análise por IA =====
  const [iaDialogOpen, setIaDialogOpen] = useState(false);
  const [iaLicitacaoId, setIaLicitacaoId] = useState<string>("");
  const [iaFiles, setIaFiles] = useState<File[]>([]);
  const [iaLoading, setIaLoading] = useState(false);

  const handleAnalisarIA = async () => {
    if (!podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!iaLicitacaoId) { toast({ title: "Selecione a licitação", variant: "destructive" }); return; }
    if (iaFiles.length === 0) { toast({ title: "Anexe ao menos um PDF (edital, TR ou anexos)", variant: "destructive" }); return; }
    const naoPdf = iaFiles.find(f => f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"));
    if (naoPdf) { toast({ title: "Apenas arquivos PDF são aceitos", description: naoPdf.name, variant: "destructive" }); return; }
    const tamanhoTotalMb = iaFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024);
    if (tamanhoTotalMb > 40) { toast({ title: "Tamanho total acima de 40 MB", description: "Reduza ou divida os arquivos.", variant: "destructive" }); return; }

    setIaLoading(true);
    try {
      const fd = new FormData();
      iaFiles.forEach((f, i) => fd.append(`file${i}`, f, f.name));
      const { data, error } = await supabase.functions.invoke('analisar-edital-licitacao', { body: fd });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const markdown: string = (data as any)?.markdown || "";
      if (!markdown) throw new Error("A IA não retornou conteúdo.");

      const lic = licitacoes.find(l => l.id === iaLicitacaoId);
      const novaAnalise: Omit<AnaliseLicitacao, "id"> = {
        ...EMPTY_ANALISE,
        licitacaoId: iaLicitacaoId,
        analista: `IA (Gemini 2.5 Pro) - ${usuarioLogado?.nome || ""}`.trim(),
        dataAnalise: format(new Date(), "yyyy-MM-dd"),
        resumoObjeto: lic?.objetoResumido || "",
        observacoes: `Arquivos analisados: ${((data as any)?.arquivosAnalisados || iaFiles.map(f => f.name)).join(", ")}`,
        analiseIaMarkdown: markdown,
        analiseIaGeradaEm: new Date().toISOString(),
      };
      const created = await addAnalise(novaAnalise);
      toast({ title: "Análise gerada pela IA!", description: "Revise o conteúdo na aba Análise de Edital." });
      setIaDialogOpen(false);
      setIaFiles([]);
      setIaLicitacaoId("");
      if (created?.id) setViewAnaliseId(created.id);
    } catch (e: any) {
      toast({ title: "Erro na análise por IA", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIaLoading(false);
    }
  };

  const handleSaveAnalise = async () => {
    if (editAnaliseId ? !podeEditar : !podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!analiseForm.licitacaoId) {
      toast({ title: "Selecione a licitação", variant: "destructive" });
      return;
    }
    if (editAnaliseId) {
      await updateAnalise(editAnaliseId, analiseForm);
      toast({ title: "Análise atualizada!" });
    } else {
      await addAnalise(analiseForm);
      toast({ title: "Análise registrada!" });
    }
    setAnaliseForm(EMPTY_ANALISE);
    setEditAnaliseId(null);
    setAnaliseDialogOpen(false);
  };

  const handleEditAnalise = (a: AnaliseLicitacao) => {
    const { id, ...rest } = a;
    setAnaliseForm(rest);
    setEditAnaliseId(id);
    setAnaliseDialogOpen(true);
  };

  const handleDeleteAnalise = async (id: string) => {
    if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    await deleteAnalise(id);
    toast({ title: "Análise excluída!" });
  };

  const viewLic = viewLicId ? licitacoes.find(l => l.id === viewLicId) : null;
  const viewAnalise = viewAnaliseId ? analises.find(a => a.id === viewAnaliseId) : null;

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Licitações</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="documentos">Gestão Documental</TabsTrigger>
          <TabsTrigger value="analises">Análise de Edital</TabsTrigger>
        </TabsList>

        {/* =============== TAB OPORTUNIDADES =============== */}
        <TabsContent value="oportunidades" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por processo, órgão ou objeto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Status</SelectItem>
                {STATUS_LICITACAO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterModalidade} onValueChange={setFilterModalidade}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todas Modalidades</SelectItem>
                {MODALIDADES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            {podeCriar && (
              <Button onClick={() => { setLicForm({ ...EMPTY_LICITACAO, responsavelInterno: usuarioLogado?.nome || "" }); setEditLicId(null); setLicDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova Licitação
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{filteredLicitacoes.length} licitação(ões) encontrada(s)</p>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Processo</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Sessão</TableHead>
                  <TableHead>Valor Est.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Interesse</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLicitacoes.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma licitação encontrada</TableCell></TableRow>
                ) : paginate(filteredLicitacoes, pageLic, pageSize).paginated.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium whitespace-nowrap">{l.numeroProcesso}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.modalidade}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{l.orgaoLicitante}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.objetoResumido}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.dataSessao ? format(new Date(l.dataSessao), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.valorEstimado ? `R$ ${l.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                    <TableCell><Badge className={statusColors[l.status] || "bg-gray-100"}>{l.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{l.grauInteresse}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewLicId(l.id)}><Eye className="h-4 w-4" /></Button>
                      {podeEditar && <Button variant="ghost" size="icon" onClick={() => handleEditLicitacao(l)}><Pencil className="h-4 w-4" /></Button>}
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDeleteLic(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={pageLic} totalItems={filteredLicitacoes.length} onPageChange={setPageLic} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageLic(1); }} />
        </TabsContent>

        {/* =============== TAB DOCUMENTOS =============== */}
        <TabsContent value="documentos" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou emissor..." value={docSearch} onChange={e => setDocSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
            <Select value={filterDocCategoria} onValueChange={setFilterDocCategoria}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todas Categorias</SelectItem>
                {CATEGORIAS_DOCUMENTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDocStatus} onValueChange={setFilterDocStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Status</SelectItem>
                {STATUS_DOCUMENTO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {podeAnexar && (
              <Button onClick={() => { setDocForm(EMPTY_DOCUMENTO); setEditDocId(null); setDocDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo Documento
              </Button>
            )}
            <Button variant="outline" onClick={() => { setPhoneDialogOpen(true); loadPhones(); }}>
              <Phone className="h-4 w-4 mr-1" /> Telefones WhatsApp
            </Button>
            <Button variant="outline" onClick={handleTesteWhatsApp} disabled={sendingWhatsApp}>
              <Send className="h-4 w-4 mr-1" /> {sendingWhatsApp ? "Enviando..." : "Testar Envio"}
            </Button>
          </div>

          {/* Alert for expiring documents */}
          {documentos.filter(d => d.dataValidade && new Date(d.dataValidade) <= new Date(Date.now() + 30 * 86400000) && d.status !== "Vencido").length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="py-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  {documentos.filter(d => d.dataValidade && new Date(d.dataValidade) <= new Date(Date.now() + 30 * 86400000) && d.status !== "Vencido").length} documento(s) com vencimento próximo (30 dias)
                </span>
              </CardContent>
            </Card>
          )}

          <p className="text-sm text-muted-foreground">{filteredDocumentos.length} documento(s)</p>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Emissor</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Vinculações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocumentos.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum documento encontrado</TableCell></TableRow>
                ) : paginate(filteredDocumentos, pageDoc, pageSize).paginated.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.nome}</TableCell>
                    <TableCell>{d.categoria}</TableCell>
                    <TableCell>{d.orgaoEmissor}</TableCell>
                    <TableCell className="whitespace-nowrap">{d.dataValidade || "-"}</TableCell>
                    <TableCell><Badge className={docStatusColors[d.status] || "bg-gray-100"}>{d.status}</Badge></TableCell>
                    <TableCell className="text-center">v{d.versao}</TableCell>
                    <TableCell>
                      {d.arquivoUrl ? (
                        <a href={d.arquivoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <FileText className="h-3 w-3" /> {d.arquivoNome || "Ver"}
                        </a>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{d.licitacoesVinculadas.length}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {podeAnexar && <Button variant="ghost" size="icon" onClick={() => handleEditDocumento(d)}><Pencil className="h-4 w-4" /></Button>}
                      {podeAnexar && <Button variant="ghost" size="icon" onClick={() => requestDeleteDoc(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* =============== TAB ANÁLISES =============== */}
        <TabsContent value="analises" className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            {podeCriar && (
              <Button onClick={() => { setAnaliseForm({ ...EMPTY_ANALISE, analista: usuarioLogado?.nome || "", dataAnalise: format(new Date(), "yyyy-MM-dd") }); setEditAnaliseId(null); setAnaliseDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova Análise
              </Button>
            )}
            {podeCriar && (
              <Button
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => { setIaFiles([]); setIaLicitacaoId(""); setIaDialogOpen(true); }}
              >
                <Sparkles className="h-4 w-4 mr-1" /> Analisar com IA
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{analises.length} análise(s) registrada(s)</p>

          <div className="grid gap-4">
            {analises.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma análise registrada</CardContent></Card>
            ) : analises.map(a => {
              const lic = licitacoes.find(l => l.id === a.licitacaoId);
              return (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {lic ? `${lic.numeroProcesso} - ${lic.orgaoLicitante}` : "Licitação não encontrada"}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {a.analiseIaMarkdown && <Badge variant="outline" className="border-purple-300 text-purple-700"><Sparkles className="h-3 w-3 mr-1" />IA</Badge>}
                        <Badge className={decisaoColors[a.decisaoParticipar] || "bg-gray-100"}>{a.decisaoParticipar}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => setViewAnaliseId(a.id)}><Eye className="h-4 w-4" /></Button>
                        {podeEditar && <Button variant="ghost" size="icon" onClick={() => handleEditAnalise(a)}><Pencil className="h-4 w-4" /></Button>}
                        {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDeleteAna(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Analista:</span> {a.analista || "-"}</div>
                      <div><span className="text-muted-foreground">Data:</span> {a.dataAnalise || "-"}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">Resumo:</span> {a.resumoObjeto?.substring(0, 100) || "-"}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* =============== DIALOG: LICITAÇÃO =============== */}
      <Dialog open={licDialogOpen} onOpenChange={setLicDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLicId ? "Editar Licitação" : "Nova Licitação"}</DialogTitle>
            <DialogDescription>Preencha os dados da licitação</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Identificação */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
                <ChevronDown className="h-4 w-4" /> Identificação
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div><Label>Nº Processo *</Label><Input value={licForm.numeroProcesso} onChange={e => setLicForm(p => ({ ...p, numeroProcesso: e.target.value }))} /></div>
                <div><Label>Nº Edital</Label><Input value={licForm.numeroEdital} onChange={e => setLicForm(p => ({ ...p, numeroEdital: e.target.value }))} /></div>
                <div>
                  <Label>Modalidade</Label>
                  <Select value={licForm.modalidade} onValueChange={v => setLicForm(p => ({ ...p, modalidade: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{MODALIDADES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Órgão Licitante *</Label><Input value={licForm.orgaoLicitante} onChange={e => setLicForm(p => ({ ...p, orgaoLicitante: e.target.value }))} /></div>
                <div><Label>UASG</Label><Input value={licForm.uasg} onChange={e => setLicForm(p => ({ ...p, uasg: e.target.value }))} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={licForm.status} onValueChange={v => setLicForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_LICITACAO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Objeto */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
                <ChevronDown className="h-4 w-4" /> Objeto
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 gap-3 pt-2">
                <div><Label>Objeto Resumido</Label><Input value={licForm.objetoResumido} onChange={e => setLicForm(p => ({ ...p, objetoResumido: e.target.value }))} /></div>
                <div><Label>Objeto Detalhado</Label><Textarea value={licForm.objetoDetalhado} onChange={e => setLicForm(p => ({ ...p, objetoDetalhado: e.target.value }))} rows={3} /></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Localização e Datas */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
                <ChevronDown className="h-4 w-4" /> Localização e Datas
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div><Label>Cidade</Label><Input value={licForm.cidade} onChange={e => setLicForm(p => ({ ...p, cidade: e.target.value }))} /></div>
                <div>
                  <Label>UF</Label>
                  <Select value={licForm.estado} onValueChange={v => setLicForm(p => ({ ...p, estado: v }))}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data Publicação</Label><Input type="date" value={licForm.dataPublicacao} onChange={e => setLicForm(p => ({ ...p, dataPublicacao: e.target.value }))} /></div>
                <div><Label>Data/Hora Sessão</Label><Input type="datetime-local" value={licForm.dataSessao} onChange={e => setLicForm(p => ({ ...p, dataSessao: e.target.value }))} /></div>
                <div><Label>Prazo Impugnação</Label><Input type="date" value={licForm.prazoImpugnacao} onChange={e => setLicForm(p => ({ ...p, prazoImpugnacao: e.target.value }))} /></div>
                <div><Label>Prazo Esclarecimento</Label><Input type="date" value={licForm.prazoEsclarecimento} onChange={e => setLicForm(p => ({ ...p, prazoEsclarecimento: e.target.value }))} /></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Detalhes da Licitação */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
                <ChevronDown className="h-4 w-4" /> Detalhes
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div><Label>Portal da Disputa</Label>
                  <Select value={licForm.portalDisputa} onValueChange={v => setLicForm(p => ({ ...p, portalDisputa: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["ComprasNet", "SIGA/RJ", "Licitações-E", "Caixa Licitações"].map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Link do Edital</Label><Input value={licForm.linkEdital} onChange={e => setLicForm(p => ({ ...p, linkEdital: e.target.value }))} /></div>
                <div><Label>Valor Estimado (R$)</Label><Input type="number" value={licForm.valorEstimado || ""} onChange={e => setLicForm(p => ({ ...p, valorEstimado: parseFloat(e.target.value) || 0 }))} /></div>
                <div>
                  <Label>Critério de Julgamento</Label>
                  <Select value={licForm.criterioJulgamento} onValueChange={v => setLicForm(p => ({ ...p, criterioJulgamento: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{CRITERIOS_JULGAMENTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Regime de Execução</Label><Input value={licForm.regimeExecucao} onChange={e => setLicForm(p => ({ ...p, regimeExecucao: e.target.value }))} /></div>
                <div><Label>Prazo Contratual</Label><Input value={licForm.prazoContratual} onChange={e => setLicForm(p => ({ ...p, prazoContratual: e.target.value }))} /></div>
                <div className="flex items-center gap-2 pt-5"><Switch checked={licForm.possibilidadeProrrogacao} onCheckedChange={v => setLicForm(p => ({ ...p, possibilidadeProrrogacao: v }))} /><Label>Prorrogação</Label></div>
                <div className="flex items-center gap-2 pt-5"><Switch checked={licForm.exigenciaVisitaTecnica} onCheckedChange={v => setLicForm(p => ({ ...p, exigenciaVisitaTecnica: v }))} /><Label>Visita Técnica</Label></div>
                <div className="flex items-center gap-2 pt-5"><Switch checked={licForm.exigenciaGarantia} onCheckedChange={v => setLicForm(p => ({ ...p, exigenciaGarantia: v }))} /><Label>Garantia</Label></div>
              </CollapsibleContent>
            </Collapsible>

            {/* Avaliação */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
                <ChevronDown className="h-4 w-4" /> Avaliação Interna
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div><Label>Responsável Interno</Label><Input value={licForm.responsavelInterno} onChange={e => setLicForm(p => ({ ...p, responsavelInterno: e.target.value }))} /></div>
                <div>
                  <Label>Grau de Interesse</Label>
                  <Select value={licForm.grauInteresse} onValueChange={v => setLicForm(p => ({ ...p, grauInteresse: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{GRAU_INTERESSE.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Probabilidade de Êxito</Label>
                  <Select value={licForm.probabilidadeExito} onValueChange={v => setLicForm(p => ({ ...p, probabilidadeExito: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PROBABILIDADE_EXITO.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3"><Label>Observações</Label><Textarea value={licForm.observacoes} onChange={e => setLicForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} /></div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLicDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLicitacao}>{editLicId ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============== DIALOG: VISUALIZAR LICITAÇÃO =============== */}
      <Dialog open={!!viewLicId} onOpenChange={() => setViewLicId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Licitação</DialogTitle>
            <DialogDescription>Processo {viewLic?.numeroProcesso}</DialogDescription>
          </DialogHeader>
          {viewLic && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><span className="text-muted-foreground block">Processo:</span>{viewLic.numeroProcesso}</div>
                <div><span className="text-muted-foreground block">Edital:</span>{viewLic.numeroEdital || "-"}</div>
                <div><span className="text-muted-foreground block">Modalidade:</span>{viewLic.modalidade || "-"}</div>
                <div><span className="text-muted-foreground block">Órgão:</span>{viewLic.orgaoLicitante}</div>
                <div><span className="text-muted-foreground block">UASG:</span>{viewLic.uasg || "-"}</div>
                <div><span className="text-muted-foreground block">Status:</span><Badge className={statusColors[viewLic.status] || ""}>{viewLic.status}</Badge></div>
                <div><span className="text-muted-foreground block">Cidade/UF:</span>{viewLic.cidade} {viewLic.estado ? `- ${viewLic.estado}` : ""}</div>
                <div><span className="text-muted-foreground block">Publicação:</span>{viewLic.dataPublicacao || "-"}</div>
                <div><span className="text-muted-foreground block">Sessão:</span>{viewLic.dataSessao ? format(new Date(viewLic.dataSessao), "dd/MM/yyyy HH:mm") : "-"}</div>
                <div><span className="text-muted-foreground block">Valor Estimado:</span>{viewLic.valorEstimado ? `R$ ${viewLic.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</div>
                <div><span className="text-muted-foreground block">Critério:</span>{viewLic.criterioJulgamento || "-"}</div>
                <div><span className="text-muted-foreground block">Regime:</span>{viewLic.regimeExecucao || "-"}</div>
                <div><span className="text-muted-foreground block">Prazo Contratual:</span>{viewLic.prazoContratual || "-"}</div>
                <div><span className="text-muted-foreground block">Prorrogação:</span>{viewLic.possibilidadeProrrogacao ? "Sim" : "Não"}</div>
                <div><span className="text-muted-foreground block">Visita Técnica:</span>{viewLic.exigenciaVisitaTecnica ? "Sim" : "Não"}</div>
                <div><span className="text-muted-foreground block">Garantia:</span>{viewLic.exigenciaGarantia ? "Sim" : "Não"}</div>
                <div><span className="text-muted-foreground block">Responsável:</span>{viewLic.responsavelInterno || "-"}</div>
                <div><span className="text-muted-foreground block">Interesse:</span>{viewLic.grauInteresse}</div>
                <div><span className="text-muted-foreground block">Prob. Êxito:</span>{viewLic.probabilidadeExito}</div>
              </div>
              <div><span className="text-muted-foreground block">Objeto Resumido:</span>{viewLic.objetoResumido || "-"}</div>
              <div><span className="text-muted-foreground block">Objeto Detalhado:</span>{viewLic.objetoDetalhado || "-"}</div>
              {viewLic.linkEdital && (
                <div><a href={viewLic.linkEdital} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Link do Edital</a></div>
              )}
              <div><span className="text-muted-foreground block">Observações:</span>{viewLic.observacoes || "-"}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =============== DIALOG: DOCUMENTO =============== */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDocId ? "Editar Documento" : "Novo Documento"}</DialogTitle>
            <DialogDescription>Cadastre os dados do documento</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Nome do Documento *</Label><Input value={docForm.nome} onChange={e => setDocForm(p => ({ ...p, nome: e.target.value }))} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={docForm.categoria} onValueChange={v => setDocForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CATEGORIAS_DOCUMENTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo Documental</Label><Input value={docForm.tipoDocumental} onChange={e => setDocForm(p => ({ ...p, tipoDocumental: e.target.value }))} placeholder="Ex: CND, Balanço, ART..." /></div>
            <div><Label>Órgão Emissor</Label><Input value={docForm.orgaoEmissor} onChange={e => setDocForm(p => ({ ...p, orgaoEmissor: e.target.value }))} /></div>
            <div><Label>Data Emissão</Label><Input type="date" value={docForm.dataEmissao} onChange={e => setDocForm(p => ({ ...p, dataEmissao: e.target.value }))} /></div>
            <div><Label>Data Validade</Label><Input type="date" value={docForm.dataValidade} onChange={e => setDocForm(p => ({ ...p, dataValidade: e.target.value }))} /></div>
            <div>
              <Label>Status</Label>
              <Select value={docForm.status} onValueChange={v => setDocForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_DOCUMENTO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Versão</Label><Input type="number" value={docForm.versao} onChange={e => setDocForm(p => ({ ...p, versao: parseInt(e.target.value) || 1 }))} /></div>
            <div>
              <Label>Vincular a Licitações</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {licitacoes.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma licitação cadastrada</p> :
                  licitacoes.map(l => (
                    <label key={l.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={docForm.licitacoesVinculadas.includes(l.id)}
                        onChange={e => {
                          setDocForm(prev => ({
                            ...prev,
                            licitacoesVinculadas: e.target.checked
                              ? [...prev.licitacoesVinculadas, l.id]
                              : prev.licitacoesVinculadas.filter(id => id !== l.id),
                          }));
                        }}
                      />
                      {l.numeroProcesso} - {l.orgaoLicitante}
                    </label>
                  ))
                }
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Arquivo</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={handleUploadDoc} disabled={uploadingDoc} />
                {docForm.arquivoUrl && (
                  <a href={docForm.arquivoUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline whitespace-nowrap">
                    {docForm.arquivoNome || "Ver arquivo"}
                  </a>
                )}
              </div>
            </div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea value={docForm.observacoes} onChange={e => setDocForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDocumento}>{editDocId ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============== DIALOG: ANÁLISE =============== */}
      <Dialog open={analiseDialogOpen} onOpenChange={setAnaliseDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAnaliseId ? "Editar Análise" : "Nova Análise de Edital"}</DialogTitle>
            <DialogDescription>Registre a análise técnica e estratégica</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Licitação *</Label>
                <Select value={analiseForm.licitacaoId} onValueChange={v => setAnaliseForm(p => ({ ...p, licitacaoId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a licitação" /></SelectTrigger>
                  <SelectContent>
                    {licitacoes.map(l => <SelectItem key={l.id} value={l.id}>{l.numeroProcesso} - {l.orgaoLicitante}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Analista</Label><Input value={analiseForm.analista} onChange={e => setAnaliseForm(p => ({ ...p, analista: e.target.value }))} /></div>
              <div><Label>Data da Análise</Label><Input type="date" value={analiseForm.dataAnalise} onChange={e => setAnaliseForm(p => ({ ...p, dataAnalise: e.target.value }))} /></div>
            </div>

            <div><Label>Resumo do Objeto</Label><Textarea value={analiseForm.resumoObjeto} onChange={e => setAnaliseForm(p => ({ ...p, resumoObjeto: e.target.value }))} rows={3} /></div>

            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
                <ChevronDown className="h-4 w-4" /> Exigências
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div><Label>Qualificação Técnica</Label><Textarea value={analiseForm.exigenciasTecnicas} onChange={e => setAnaliseForm(p => ({ ...p, exigenciasTecnicas: e.target.value }))} rows={3} /></div>
                <div><Label>Qualificação Econômico-Financeira</Label><Textarea value={analiseForm.exigenciasEconomicas} onChange={e => setAnaliseForm(p => ({ ...p, exigenciasEconomicas: e.target.value }))} rows={3} /></div>
                <div><Label>Documentos Obrigatórios</Label><Textarea value={analiseForm.documentosObrigatorios} onChange={e => setAnaliseForm(p => ({ ...p, documentosObrigatorios: e.target.value }))} rows={3} /></div>
                <div><Label>Equipe Mínima</Label><Textarea value={analiseForm.exigenciasEquipe} onChange={e => setAnaliseForm(p => ({ ...p, exigenciasEquipe: e.target.value }))} rows={3} /></div>
                <div><Label>Vistoria</Label><Textarea value={analiseForm.exigenciaVistoria} onChange={e => setAnaliseForm(p => ({ ...p, exigenciaVistoria: e.target.value }))} rows={2} /></div>
                <div><Label>Garantia de Proposta</Label><Textarea value={analiseForm.exigenciaGarantiaProposta} onChange={e => setAnaliseForm(p => ({ ...p, exigenciaGarantiaProposta: e.target.value }))} rows={2} /></div>
                <div><Label>CAT/CREA/CAU</Label><Textarea value={analiseForm.necessidadeCatCreaCau} onChange={e => setAnaliseForm(p => ({ ...p, necessidadeCatCreaCau: e.target.value }))} rows={2} /></div>
                <div><Label>Certidões Específicas</Label><Textarea value={analiseForm.necessidadeCertidoes} onChange={e => setAnaliseForm(p => ({ ...p, necessidadeCertidoes: e.target.value }))} rows={2} /></div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full py-1">
                <ChevronDown className="h-4 w-4" /> Riscos e Oportunidades
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div><Label>Riscos Jurídicos</Label><Textarea value={analiseForm.riscosJuridicos} onChange={e => setAnaliseForm(p => ({ ...p, riscosJuridicos: e.target.value }))} rows={3} /></div>
                <div><Label>Pontos Restritivos/Controversos</Label><Textarea value={analiseForm.pontosRestritivos} onChange={e => setAnaliseForm(p => ({ ...p, pontosRestritivos: e.target.value }))} rows={3} /></div>
                <div className="md:col-span-2"><Label>Oportunidades de Impugnação</Label><Textarea value={analiseForm.oportunidadesImpugnacao} onChange={e => setAnaliseForm(p => ({ ...p, oportunidadesImpugnacao: e.target.value }))} rows={3} /></div>
              </CollapsibleContent>
            </Collapsible>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Decisão Final</Label>
                <Select value={analiseForm.decisaoParticipar} onValueChange={v => setAnaliseForm(p => ({ ...p, decisaoParticipar: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DECISOES_ANALISE.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Textarea value={analiseForm.observacoes} onChange={e => setAnaliseForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnaliseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAnalise}>{editAnaliseId ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =============== DIALOG: VISUALIZAR ANÁLISE =============== */}
      <Dialog open={!!viewAnaliseId} onOpenChange={() => setViewAnaliseId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Análise</DialogTitle>
            <DialogDescription>
              {viewAnalise ? (() => { const lic = licitacoes.find(l => l.id === viewAnalise.licitacaoId); return lic ? `${lic.numeroProcesso} - ${lic.orgaoLicitante}` : ""; })() : ""}
            </DialogDescription>
          </DialogHeader>
          {viewAnalise && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={decisaoColors[viewAnalise.decisaoParticipar] || ""}>{viewAnalise.decisaoParticipar}</Badge>
                {viewAnalise.analiseIaMarkdown && <Badge variant="outline" className="border-purple-300 text-purple-700"><Sparkles className="h-3 w-3 mr-1" />Gerada por IA</Badge>}
                <span className="text-muted-foreground">Analista: {viewAnalise.analista || "-"} | Data: {viewAnalise.dataAnalise || "-"}</span>
              </div>

              {viewAnalise.analiseIaMarkdown ? (
                <div className="border rounded-lg p-4 bg-muted/30 prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-th:border prose-td:border">
                  <ReactMarkdown>{viewAnalise.analiseIaMarkdown}</ReactMarkdown>
                </div>
              ) : (
                <>
                  <div><span className="font-medium">Resumo do Objeto:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.resumoObjeto || "-"}</p></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><span className="font-medium">Exigências Técnicas:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.exigenciasTecnicas || "-"}</p></div>
                    <div><span className="font-medium">Exigências Econômicas:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.exigenciasEconomicas || "-"}</p></div>
                    <div><span className="font-medium">Documentos Obrigatórios:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.documentosObrigatorios || "-"}</p></div>
                    <div><span className="font-medium">Equipe Mínima:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.exigenciasEquipe || "-"}</p></div>
                    <div><span className="font-medium">Vistoria:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.exigenciaVistoria || "-"}</p></div>
                    <div><span className="font-medium">Garantia de Proposta:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.exigenciaGarantiaProposta || "-"}</p></div>
                    <div><span className="font-medium">CAT/CREA/CAU:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.necessidadeCatCreaCau || "-"}</p></div>
                    <div><span className="font-medium">Certidões:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.necessidadeCertidoes || "-"}</p></div>
                  </div>
                  <div><span className="font-medium">Riscos Jurídicos:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.riscosJuridicos || "-"}</p></div>
                  <div><span className="font-medium">Pontos Restritivos:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.pontosRestritivos || "-"}</p></div>
                  <div><span className="font-medium">Oportunidades de Impugnação:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.oportunidadesImpugnacao || "-"}</p></div>
                  <div><span className="font-medium">Observações:</span><p className="mt-1 whitespace-pre-wrap">{viewAnalise.observacoes || "-"}</p></div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =============== DIALOG: TELEFONES WHATSAPP =============== */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Telefones para Notificação WhatsApp</DialogTitle>
            <DialogDescription>Gerencie os números que receberão avisos de vencimento de documentos (15 dias antes).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Nome do Contato</Label>
                <Input placeholder="Ex: João Silva" value={newPhoneName} onChange={e => setNewPhoneName(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label>Telefone</Label>
                <Input placeholder="+5521999999999" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddPhone} size="icon"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            {loadingPhones ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : phoneList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum telefone cadastrado</p>
            ) : (
              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {phoneList.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <span className="font-medium text-sm">{p.nome_contato || "Sem nome"}</span>
                      <span className="text-sm text-muted-foreground ml-2">{p.telefone}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => requestDeletePhone(p.id)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Os avisos são enviados automaticamente todos os dias às 8h para documentos com vencimento nos próximos 15 dias.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteLicId} onOpenChange={(open) => !open && cancelDeleteLic()} onConfirm={() => { if (deleteLicId) handleDeleteLicitacao(deleteLicId); }} />
      <DoubleConfirmDelete open={!!deleteDocId} onOpenChange={(open) => !open && cancelDeleteDoc()} onConfirm={() => { if (deleteDocId) handleDeleteDocumento(deleteDocId); }} />
      <DoubleConfirmDelete open={!!deleteAnaId} onOpenChange={(open) => !open && cancelDeleteAna()} onConfirm={() => { if (deleteAnaId) handleDeleteAnalise(deleteAnaId); }} />
      <DoubleConfirmDelete open={!!deletePhoneId} onOpenChange={(open) => !open && cancelDeletePhone()} onConfirm={() => { if (deletePhoneId) { handleRemovePhone(deletePhoneId); cancelDeletePhone(); } }} />

      {/* =============== DIALOG: ANÁLISE POR IA =============== */}
      <Dialog open={iaDialogOpen} onOpenChange={(o) => { if (!iaLoading) setIaDialogOpen(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-600" /> Análise de Edital por IA</DialogTitle>
            <DialogDescription>
              Anexe os PDFs do edital, termo de referência, minuta contratual e demais anexos. A IA (Gemini 2.5 Pro) irá gerar o checklist estratégico no formato interno da LASANT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Licitação *</Label>
              <Select value={iaLicitacaoId} onValueChange={setIaLicitacaoId} disabled={iaLoading}>
                <SelectTrigger><SelectValue placeholder="Selecione a licitação" /></SelectTrigger>
                <SelectContent>
                  {licitacoes.map(l => <SelectItem key={l.id} value={l.id}>{l.numeroProcesso} - {l.orgaoLicitante}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arquivos PDF * (edital, TR, minuta, anexos)</Label>
              <Input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                disabled={iaLoading}
                onChange={(e) => setIaFiles(Array.from(e.target.files || []))}
              />
              <p className="text-xs text-muted-foreground mt-1">Aceita múltiplos PDFs. Limite total recomendado: 40 MB.</p>
              {iaFiles.length > 0 && (
                <div className="mt-2 border rounded p-2 max-h-40 overflow-y-auto text-sm space-y-1">
                  {iaFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="truncate flex items-center gap-1"><FileText className="h-3 w-3" /> {f.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    Total: {iaFiles.length} arquivo(s) — {(iaFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              )}
            </div>
            {iaLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-purple-50 border border-purple-200 rounded p-3">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                Lendo PDFs e gerando o checklist estratégico... isso pode levar de 30s a 2 min.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIaDialogOpen(false)} disabled={iaLoading}>Cancelar</Button>
            <Button
              onClick={handleAnalisarIA}
              disabled={iaLoading || !iaLicitacaoId || iaFiles.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {iaLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analisando...</> : <><Sparkles className="h-4 w-4 mr-1" /> Gerar Análise</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
