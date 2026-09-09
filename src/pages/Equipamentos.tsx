import { useState, useMemo, useEffect } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { toast } from "sonner";
import { Monitor, Trash2, Search, Plus, ChevronDown, ChevronUp, Pencil, Upload, Image, FileText, Award, History, AlertTriangle, QrCode, Printer, Download, ShieldAlert } from "lucide-react";
import { LaudoCondenacaoDialog } from "@/components/laudo/LaudoCondenacaoDialog";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEquipamentos, type Equipamento } from "@/contexts/EquipamentosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { usePmoc } from "@/contexts/PmocContext";
import { supabase } from "@/integrations/supabase/client";
import { usePermissao } from "@/hooks/usePermissao";
import ImportExportEquipamentos from "@/components/ImportExportEquipamentos";

const SITUACOES = ["Ativo", "Inativo", "Em Manutenção", "Desativado", "Condenado"];
const NIVEIS_RISCO = ["Baixo", "Médio", "Alto", "Crítico"];
const NIVEIS_MANUTENCAO = ["Preventiva", "Corretiva", "Preditiva"];

const emptyForm = {
  clienteId: "", clienteNome: "", localId: "", localDescricao: "",
  pavimentoId: "", pavimentoDescricao: "", setorId: "", setorDescricao: "",
  situacao: "Ativo", tag: "", equipamento: "", serie: "", grupo: "", subgrupo: "",
  modelo: "", valor: 0, fabricante: "", dataAquisicao: "", nivelRisco: "",
  nivelManutencao: "", expectativaVida: "", dataGarantia: "", tensao: "",
  corrente: "", potencia: "", capacidadeBtu: "", contrato: "", planoManutencao: "",
  numeroAnvisa: "", fotoUrl: "", manualUrl: "", fotos: [] as string[],
  requerCalibracao: false, dataCalibracao: "", validadeCalibracao: "",
  frequenciaCalibracaoMeses: 12, certificadoCalibracaoUrl: "",
  laboratorioCalibracao: "", numeroCertificadoCalibracao: "",
  observacoesCalibracao: "", responsavelCalibracao: "",
  telefoneResponsavelCalibracao: "", emailResponsavelCalibracao: "",
};

export default function Equipamentos() {
  const { equipamentos, addEquipamento, updateEquipamento, deleteEquipamento } = useEquipamentos();
  const { clientes } = useClientes();
  const { planos: pmocPlanos } = usePmoc();
  const { tem } = usePermissao();
  const podeCriar = tem("equipamentos.criar");
  const podeEditar = tem("equipamentos.editar");
  const podeExcluir = tem("equipamentos.excluir");
  const clientesList = useMemo(() => clientes.filter(c => c.tipo === "Cliente"), [clientes]);

  const [formOpen, setFormOpen] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const planosDoCliente = useMemo(() => (pmocPlanos || []).filter((p: any) => p.clienteId === form.clienteId), [pmocPlanos, form.clienteId]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [codLasantAtual, setCodLasantAtual] = useState("");
  const [search, setSearch] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewEquip, setViewEquip] = useState<Equipamento | null>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingManual, setUploadingManual] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [historicoEquip, setHistoricoEquip] = useState<Equipamento | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [novaCalibOpen, setNovaCalibOpen] = useState(false);
  const [novaCalib, setNovaCalib] = useState({ data_calibracao: "", validade_calibracao: "", laboratorio: "", numero_certificado: "", certificado_url: "", responsavel: "", resultado: "Aprovado", observacoes: "", custo: 0 });
  const [qrEquip, setQrEquip] = useState<Equipamento | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [laudoEquip, setLaudoEquip] = useState<Equipamento | null>(null);

  const openQr = async (eq: Equipamento) => {
    const url = `${window.location.origin}/equipamento/${eq.id}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    setQrDataUrl(dataUrl);
    setQrEquip(eq);
  };

  const printQr = () => {
    if (!qrEquip || !qrDataUrl) return;
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.write(`<html><head><title>QR ${qrEquip.equipamento}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:24px}h2{margin:8px 0}p{margin:4px 0;font-size:12px;color:#555}img{width:320px;height:320px}</style></head><body><h2>${qrEquip.equipamento}</h2>${qrEquip.tag ? `<p>TAG: ${qrEquip.tag}</p>` : ""}${qrEquip.clienteNome ? `<p>${qrEquip.clienteNome}</p>` : ""}<img src="${qrDataUrl}" /><script>window.onload=()=>{window.print();}<\/script></body></html>`);
    w.document.close();
  };

  const downloadQr = () => {
    if (!qrEquip || !qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qrcode-${(qrEquip.tag || qrEquip.equipamento || "equipamento").replace(/[^a-z0-9]/gi, "_")}.png`;
    a.click();
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const printBulkQrs = async () => {
    const list = equipamentos.filter(e => selectedIds.has(e.id));
    if (list.length === 0) { toast.error("Selecione ao menos um equipamento."); return; }
    const items = await Promise.all(list.map(async eq => {
      const url = `${window.location.origin}/equipamento/${eq.id}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 1 });
      return { eq, dataUrl };
    }));
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    const cards = items.map(({ eq, dataUrl }) => `
      <div class="label">
        <div class="title">${(eq.equipamento || "").replace(/</g, "&lt;")}</div>
        ${eq.tag ? `<div class="tag">TAG: ${eq.tag.replace(/</g, "&lt;")}</div>` : ""}
        ${eq.clienteNome ? `<div class="sub">${eq.clienteNome.replace(/</g, "&lt;")}</div>` : ""}
        ${eq.setorDescricao ? `<div class="sub">${eq.setorDescricao.replace(/</g, "&lt;")}</div>` : ""}
        <img src="${dataUrl}" />
      </div>`).join("");
    w.document.write(`<html><head><title>Etiquetas QR</title><style>
      @page { size: A4; margin: 8mm; }
      body { font-family: Arial, sans-serif; margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
      .label { border: 1px dashed #999; border-radius: 6px; padding: 6mm; text-align: center; page-break-inside: avoid; }
      .title { font-weight: bold; font-size: 12px; margin-bottom: 2px; }
      .tag { font-family: monospace; font-size: 10px; color: #333; }
      .sub { font-size: 10px; color: #555; }
      .label img { width: 100%; max-width: 50mm; height: auto; margin: 4px auto; display: block; }
    </style></head><body><div class="grid">${cards}</div><script>window.onload=()=>window.print();<\/script></body></html>`);
    w.document.close();
  };

  const selectedCliente = useMemo(() => clientesList.find(c => c.id === form.clienteId), [clientesList, form.clienteId]);
  const locais = useMemo(() => selectedCliente?.locais || [], [selectedCliente]);
  const selectedLocal = useMemo(() => locais.find(l => l.id === form.localId), [locais, form.localId]);
  const pavimentos = useMemo(() => selectedLocal?.pavimentos || [], [selectedLocal]);
  const selectedPavimento = useMemo(() => pavimentos.find(p => p.id === form.pavimentoId), [pavimentos, form.pavimentoId]);
  const setores = useMemo(() => selectedPavimento?.setores || [], [selectedPavimento]);

  const setField = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleClienteChange = (id: string) => {
    const c = clientesList.find(cl => cl.id === id);
    setForm(prev => ({ ...prev, clienteId: id, clienteNome: c?.nome || "", localId: "", localDescricao: "", pavimentoId: "", pavimentoDescricao: "", setorId: "", setorDescricao: "" }));
  };

  const handleLocalChange = (id: string) => {
    const l = locais.find(loc => loc.id === id);
    setForm(prev => ({ ...prev, localId: id, localDescricao: l?.descricao || "", pavimentoId: "", pavimentoDescricao: "", setorId: "", setorDescricao: "" }));
  };

  const handlePavimentoChange = (id: string) => {
    const p = pavimentos.find(pav => pav.id === id);
    setForm(prev => ({ ...prev, pavimentoId: id, pavimentoDescricao: p?.descricao || "", setorId: "", setorDescricao: "" }));
  };

  const handleSetorChange = (id: string) => {
    const s = setores.find(set => set.id === id);
    setForm(prev => ({ ...prev, setorId: id, setorDescricao: s?.descricao || "" }));
  };

  const handleUpload = async (file: File, type: "foto" | "manual" | "certificado") => {
    const setter = type === "foto" ? setUploadingFoto : type === "manual" ? setUploadingManual : setUploadingCert;
    setter(true);
    const ext = file.name.split(".").pop();
    const path = `equipamentos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("evidencias-anexos").upload(path, file);
    if (error) { toast.error("Erro no upload."); setter(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("evidencias-anexos").getPublicUrl(path);
    if (type === "foto") setField("fotoUrl", publicUrl);
    else if (type === "manual") setField("manualUrl", publicUrl);
    else setField("certificadoCalibracaoUrl", publicUrl);
    setter(false);
    toast.success(`Arquivo enviado!`);
  };

  const handleAddFoto = async (file: File) => {
    const fotos = form.fotos || [];
    if (fotos.length >= 5) { toast.error("Limite máximo de 5 fotos."); return; }
    setUploadingFoto(true);
    const ext = file.name.split(".").pop();
    const path = `equipamentos/foto_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("evidencias-anexos").upload(path, file);
    if (error) { toast.error("Erro no upload."); setUploadingFoto(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("evidencias-anexos").getPublicUrl(path);
    const novas = [...fotos, publicUrl];
    setForm(prev => ({ ...prev, fotos: novas, fotoUrl: prev.fotoUrl || publicUrl }));
    setUploadingFoto(false);
    toast.success("Foto enviada!");
  };

  const handleRemoveFoto = (idx: number) => {
    const novas = (form.fotos || []).filter((_, i) => i !== idx);
    setForm(prev => ({ ...prev, fotos: novas, fotoUrl: novas[0] || "" }));
  };

  const loadHistorico = async (equipId: string) => {
    const { data } = await supabase
      .from("equipamentos_calibracoes_historico" as any)
      .select("*")
      .eq("equipamento_id", equipId)
      .order("data_calibracao", { ascending: false });
    setHistorico((data as any) || []);
  };

  const openHistorico = async (eq: Equipamento) => {
    setHistoricoEquip(eq);
    await loadHistorico(eq.id);
  };

  const uploadCertificadoNova = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `equipamentos/cert_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("evidencias-anexos").upload(path, file);
    if (error) { toast.error("Erro no upload."); return; }
    const { data: { publicUrl } } = supabase.storage.from("evidencias-anexos").getPublicUrl(path);
    setNovaCalib(p => ({ ...p, certificado_url: publicUrl }));
    toast.success("Certificado enviado!");
  };

  const registrarCalibracao = async () => {
    if (!historicoEquip) return;
    if (!novaCalib.data_calibracao) { toast.error("Informe a data de calibração."); return; }
    const { error } = await supabase.from("equipamentos_calibracoes_historico" as any).insert({
      equipamento_id: historicoEquip.id,
      equipamento_nome: historicoEquip.equipamento,
      equipamento_tag: historicoEquip.tag,
      ...novaCalib,
      validade_calibracao: novaCalib.validade_calibracao || null,
    });
    if (error) { toast.error("Erro ao registrar."); return; }
    // Atualiza o equipamento com a calibração mais recente e zera flags
    await updateEquipamento(historicoEquip.id, {
      dataCalibracao: novaCalib.data_calibracao,
      validadeCalibracao: novaCalib.validade_calibracao,
      laboratorioCalibracao: novaCalib.laboratorio,
      numeroCertificadoCalibracao: novaCalib.numero_certificado,
      certificadoCalibracaoUrl: novaCalib.certificado_url,
    } as any);
    // Reset flags via direct update
    await supabase.from("equipamentos").update({
      calibracao_notificado_30d: false,
      calibracao_notificado_15d: false,
      calibracao_notificado_7d: false,
    }).eq("id", historicoEquip.id);
    toast.success("Calibração registrada!");
    setNovaCalibOpen(false);
    setNovaCalib({ data_calibracao: "", validade_calibracao: "", laboratorio: "", numero_certificado: "", certificado_url: "", responsavel: "", resultado: "Aprovado", observacoes: "", custo: 0 });
    await loadHistorico(historicoEquip.id);
  };

  const handleSubmit = () => {
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.equipamento.trim()) { toast.error("Informe o nome do equipamento."); return; }
    if (!form.clienteId) { toast.error("Selecione um cliente."); return; }
    const { ...data } = form;
    if (editingId) {
      updateEquipamento(editingId, data);
      toast.success("Equipamento atualizado!");
    } else {
      addEquipamento(data);
      toast.success("Equipamento cadastrado!");
    }
    resetForm();
  };

  const resetForm = () => { setEditingId(null); setForm(emptyForm); setCodLasantAtual(""); };

  const handleEdit = (eq: Equipamento) => {
    setEditingId(eq.id);
    const { id, codLasant, ...rest } = eq;
    setForm(rest);
    setCodLasantAtual(codLasant || "");
    setFormOpen(true);
  };


  const handleDelete = (id: string) => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; }
    deleteEquipamento(id);
    toast.success("Equipamento removido.");
    if (editingId === id) resetForm();
  };

  const filtered = useMemo(() => {
    let list = equipamentos;
    if (filterCliente) list = list.filter(e => e.clienteId === filterCliente);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(e =>
        e.equipamento.toLowerCase().includes(s) ||
        e.tag.toLowerCase().includes(s) ||
        e.serie.toLowerCase().includes(s) ||
        e.setorDescricao.toLowerCase().includes(s) ||
        e.clienteNome.toLowerCase().includes(s) ||
        (e.codLasant || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [equipamentos, search, filterCliente]);

  const { paginated: paginatedItems, totalPages } = paginate(filtered, page, pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Inventário de Equipamentos</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{equipamentos.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{equipamentos.filter(e => e.situacao === "Ativo").length}</p><p className="text-xs text-muted-foreground">Ativos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-secondary-foreground">{equipamentos.filter(e => e.situacao === "Em Manutenção").length}</p><p className="text-xs text-muted-foreground">Em Manutenção</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{equipamentos.filter(e => e.situacao === "Inativo" || e.situacao === "Desativado").length}</p><p className="text-xs text-muted-foreground">Inativos</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{equipamentos.filter(e => e.situacao === "Condenado").length}</p><p className="text-xs text-muted-foreground">Condenados</p></CardContent></Card>
      </div>

      {/* Form */}
      {(podeCriar || (editingId && podeEditar)) && (
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setFormOpen(!formOpen)}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            {editingId ? "Editar Equipamento" : "Novo Equipamento"}
            {formOpen ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
          </CardTitle>
        </CardHeader>
        {formOpen && (
          <CardContent className="space-y-4">
            {/* Vinculação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Situação</Label>
                <Select value={form.situacao} onValueChange={v => setField("situacao", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SITUACOES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente *</Label>
                <Select value={form.clienteId} onValueChange={handleClienteChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>{clientesList.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Local</Label>
                <Select value={form.localId} onValueChange={handleLocalChange} disabled={!form.clienteId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o local" /></SelectTrigger>
                  <SelectContent>{locais.map(l => <SelectItem key={l.id} value={l.id}>{l.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pavimento</Label>
                <Select value={form.pavimentoId} onValueChange={handlePavimentoChange} disabled={!form.localId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o pavimento" /></SelectTrigger>
                  <SelectContent>{pavimentos.map(p => <SelectItem key={p.id} value={p.id}>{p.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor</Label>
                <Select value={form.setorId} onValueChange={handleSetorChange} disabled={!form.pavimentoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>{setores.map(s => <SelectItem key={s.id} value={s.id}>{s.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Dados do equipamento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Cod. Lasant</Label>
                <Input value={codLasantAtual} readOnly disabled placeholder="Gerado automaticamente (LST-00000)" className="font-mono" />
              </div>
              <div><Label>TAG / Patrimônio</Label><Input value={form.tag} onChange={e => setField("tag", e.target.value)} /></div>
              <div><Label>Equipamento *</Label><Input value={form.equipamento} onChange={e => setField("equipamento", e.target.value)} /></div>
              <div><Label>Série</Label><Input value={form.serie} onChange={e => setField("serie", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Grupo</Label><Input value={form.grupo} onChange={e => setField("grupo", e.target.value)} /></div>
              <div><Label>Subgrupo</Label><Input value={form.subgrupo} onChange={e => setField("subgrupo", e.target.value)} /></div>
              <div><Label>Modelo</Label><Input value={form.modelo} onChange={e => setField("modelo", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Valor (R$)</Label><Input type="number" value={form.valor || ""} onChange={e => setField("valor", Number(e.target.value))} /></div>
              <div><Label>Fabricante</Label><Input value={form.fabricante} onChange={e => setField("fabricante", e.target.value)} /></div>
              <div><Label>Data de Aquisição</Label><Input type="date" value={form.dataAquisicao} onChange={e => setField("dataAquisicao", e.target.value)} /></div>
            </div>

            {/* Manutenção */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Nível de Risco</Label>
                <Select value={form.nivelRisco} onValueChange={v => setField("nivelRisco", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{NIVEIS_RISCO.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nível de Manutenção</Label>
                <Select value={form.nivelManutencao} onValueChange={v => setField("nivelManutencao", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{NIVEIS_MANUTENCAO.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Expectativa de Vida</Label><Input value={form.expectativaVida} onChange={e => setField("expectativaVida", e.target.value)} placeholder="Ex: 10 anos" /></div>
              <div><Label>Data de Garantia</Label><Input type="date" value={form.dataGarantia} onChange={e => setField("dataGarantia", e.target.value)} /></div>
            </div>

            {/* Elétrica */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><Label>Tensão (V)</Label><Input value={form.tensao} onChange={e => setField("tensao", e.target.value)} /></div>
              <div><Label>Corrente (A)</Label><Input value={form.corrente} onChange={e => setField("corrente", e.target.value)} /></div>
              <div><Label>Potência (W)</Label><Input value={form.potencia} onChange={e => setField("potencia", e.target.value)} /></div>
              <div><Label>Capacidade (BTU)</Label><Input value={form.capacidadeBtu} onChange={e => setField("capacidadeBtu", e.target.value)} /></div>
            </div>

            {/* Outros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Contrato</Label><Input value={form.contrato} onChange={e => setField("contrato", e.target.value)} /></div>
              <div>
                <Label>Plano de Manutenção</Label>
                <Select value={form.planoManutencao || "__none"} onValueChange={v => setField("planoManutencao", v === "__none" ? "" : v)} disabled={!form.clienteId}>
                  <SelectTrigger><SelectValue placeholder={form.clienteId ? "Selecione o plano" : "Selecione o cliente primeiro"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Sem plano —</SelectItem>
                    {planosDoCliente.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.clienteId && planosDoCliente.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">Nenhum plano PMOC cadastrado para este cliente.</p>
                )}
              </div>
              <div><Label>Nº Anvisa</Label><Input value={form.numeroAnvisa} onChange={e => setField("numeroAnvisa", e.target.value)} /></div>
            </div>

            {/* Calibração */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4 text-primary" />
                  Calibração de Equipamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={form.requerCalibracao} onCheckedChange={v => setField("requerCalibracao", v)} />
                  <Label className="cursor-pointer">Este equipamento requer calibração periódica</Label>
                </div>
                {form.requerCalibracao && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div><Label>Última Calibração</Label><Input type="date" value={form.dataCalibracao} onChange={e => setField("dataCalibracao", e.target.value)} /></div>
                      <div><Label>Validade</Label><Input type="date" value={form.validadeCalibracao} onChange={e => setField("validadeCalibracao", e.target.value)} /></div>
                      <div><Label>Frequência (meses)</Label><Input type="number" value={form.frequenciaCalibracaoMeses || ""} onChange={e => setField("frequenciaCalibracaoMeses", Number(e.target.value))} /></div>
                      <div><Label>Nº Certificado</Label><Input value={form.numeroCertificadoCalibracao} onChange={e => setField("numeroCertificadoCalibracao", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><Label>Laboratório</Label><Input value={form.laboratorioCalibracao} onChange={e => setField("laboratorioCalibracao", e.target.value)} /></div>
                      <div><Label>Responsável</Label><Input value={form.responsavelCalibracao} onChange={e => setField("responsavelCalibracao", e.target.value)} /></div>
                      <div><Label>Telefone (WhatsApp)</Label><Input value={form.telefoneResponsavelCalibracao} onChange={e => setField("telefoneResponsavelCalibracao", e.target.value)} placeholder="+55 (11) 99999-9999" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>E-mail Responsável</Label><Input type="email" value={form.emailResponsavelCalibracao} onChange={e => setField("emailResponsavelCalibracao", e.target.value)} /></div>
                      <div>
                        <Label>Certificado (arquivo)</Label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled={uploadingCert} onClick={() => document.getElementById("cert-upload")?.click()}>
                            <FileText className="h-4 w-4 mr-1" />{uploadingCert ? "Enviando..." : "Upload Certificado"}
                          </Button>
                          <input id="cert-upload" type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "certificado")} />
                          {form.certificadoCalibracaoUrl && <a href={form.certificadoCalibracaoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver</a>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea value={form.observacoesCalibracao} onChange={e => setField("observacoesCalibracao", e.target.value)} rows={2} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚡ Alertas automáticos por WhatsApp e e-mail serão enviados ao responsável 30, 15 e 7 dias antes do vencimento.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Fotos ({(form.fotos || []).length}/5)</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" disabled={uploadingFoto || (form.fotos || []).length >= 5} onClick={() => document.getElementById("foto-upload")?.click()}>
                    <Image className="h-4 w-4 mr-1" />{uploadingFoto ? "Enviando..." : "Adicionar Foto"}
                  </Button>
                  <input id="foto-upload" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAddFoto(f); e.target.value = ""; }} />
                </div>
                {(form.fotos || []).length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {(form.fotos || []).map((url, idx) => (
                      <div key={idx} className="relative group">
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`Foto ${idx + 1}`} className="h-20 w-20 object-cover rounded border" />
                        </a>
                        <button type="button" onClick={() => handleRemoveFoto(idx)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Manual</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={uploadingManual} onClick={() => document.getElementById("manual-upload")?.click()}>
                    <FileText className="h-4 w-4 mr-1" />{uploadingManual ? "Enviando..." : "Upload Manual"}
                  </Button>
                  <input id="manual-upload" type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], "manual")} />
                  {form.manualUrl && <a href={form.manualUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver manual</a>}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit}>{editingId ? "Atualizar" : "Cadastrar"}</Button>
              {editingId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
            </div>
          </CardContent>
        )}
      </Card>
      )}

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por Cod. Lasant, equipamento, TAG, série, setor..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
            </div>
            <Select value={filterCliente} onValueChange={v => { setFilterCliente(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientesList.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={selectedIds.size === 0} onClick={printBulkQrs}>
              <Printer className="h-4 w-4 mr-1" />Imprimir QRs ({selectedIds.size})
            </Button>
            <ImportExportEquipamentos />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={paginatedItems.length > 0 && paginatedItems.every(e => selectedIds.has(e.id))}
                      onCheckedChange={(c) => setSelectedIds(prev => {
                        const n = new Set(prev);
                        if (c) paginatedItems.forEach(e => n.add(e.id));
                        else paginatedItems.forEach(e => n.delete(e.id));
                        return n;
                      })}
                    />
                  </TableHead>
                  <TableHead>Cod. Lasant</TableHead>
                  <TableHead>TAG</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Calibração</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum equipamento encontrado.</TableCell></TableRow>
                ) : paginatedItems.map(eq => {
                  let calibBadge: React.ReactNode = <span className="text-xs text-muted-foreground">-</span>;
                  if (eq.requerCalibracao) {
                    if (!eq.validadeCalibracao) calibBadge = <Badge variant="outline" className="text-xs">Pendente</Badge>;
                    else {
                      const dias = Math.ceil((new Date(eq.validadeCalibracao).getTime() - Date.now()) / 86400000);
                      if (dias < 0) calibBadge = <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Vencida</Badge>;
                      else if (dias <= 30) calibBadge = <Badge className="text-xs bg-orange-500 hover:bg-orange-500 gap-1"><AlertTriangle className="h-3 w-3" />{dias}d</Badge>;
                      else calibBadge = <Badge variant="secondary" className="text-xs">{eq.validadeCalibracao.split("-").reverse().join("/")}</Badge>;
                    }
                  }
                  return (
                  <TableRow key={eq.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewEquip(eq)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(eq.id)} onCheckedChange={() => toggleSelected(eq.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{eq.codLasant || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{eq.tag || "-"}</TableCell>
                    <TableCell className="font-medium">{eq.equipamento}</TableCell>
                    <TableCell className="text-sm">{eq.clienteNome}</TableCell>
                    <TableCell className="text-sm">{eq.setorDescricao || eq.localDescricao || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={eq.situacao === "Ativo" ? "default" : eq.situacao === "Em Manutenção" ? "secondary" : "destructive"}>{eq.situacao}</Badge>
                    </TableCell>
                    <TableCell>{calibBadge}</TableCell>
                    <TableCell className="text-sm">{eq.fabricante || "-"}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="QR Code" onClick={() => openQr(eq)}><QrCode className="h-4 w-4 text-primary" /></Button>
                        {eq.requerCalibracao && <Button size="icon" variant="ghost" title="Histórico de Calibração" onClick={() => openHistorico(eq)}><History className="h-4 w-4 text-primary" /></Button>}
                        <Button size="icon" variant="ghost" title="Laudo de Condenação" onClick={() => setLaudoEquip(eq)}><ShieldAlert className="h-4 w-4 text-destructive" /></Button>
                        {podeEditar && <Button size="icon" variant="ghost" onClick={() => handleEdit(eq)}><Pencil className="h-4 w-4" /></Button>}
                        {podeExcluir && <Button size="icon" variant="ghost" onClick={() => requestDelete(eq.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );})}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewEquip} onOpenChange={() => setViewEquip(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do Equipamento</DialogTitle></DialogHeader>
          {viewEquip && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-semibold">Cod. Lasant:</span> <span className="font-mono">{viewEquip.codLasant || "-"}</span></div>
              <div><span className="font-semibold">Situação:</span> {viewEquip.situacao}</div>
              <div><span className="font-semibold">Cliente:</span> {viewEquip.clienteNome}</div>
              <div><span className="font-semibold">Local:</span> {viewEquip.localDescricao || "-"}</div>
              <div><span className="font-semibold">Pavimento:</span> {viewEquip.pavimentoDescricao || "-"}</div>
              <div><span className="font-semibold">Setor:</span> {viewEquip.setorDescricao || "-"}</div>
              <div><span className="font-semibold">TAG:</span> {viewEquip.tag || "-"}</div>
              <div><span className="font-semibold">Equipamento:</span> {viewEquip.equipamento}</div>
              <div><span className="font-semibold">Série:</span> {viewEquip.serie || "-"}</div>
              <div><span className="font-semibold">Grupo:</span> {viewEquip.grupo || "-"}</div>
              <div><span className="font-semibold">Subgrupo:</span> {viewEquip.subgrupo || "-"}</div>
              <div><span className="font-semibold">Modelo:</span> {viewEquip.modelo || "-"}</div>
              <div><span className="font-semibold">Valor:</span> {viewEquip.valor ? `R$ ${viewEquip.valor.toLocaleString("pt-BR")}` : "-"}</div>
              <div><span className="font-semibold">Fabricante:</span> {viewEquip.fabricante || "-"}</div>
              <div><span className="font-semibold">Data Aquisição:</span> {viewEquip.dataAquisicao || "-"}</div>
              <div><span className="font-semibold">Nível de Risco:</span> {viewEquip.nivelRisco || "-"}</div>
              <div><span className="font-semibold">Nível Manutenção:</span> {viewEquip.nivelManutencao || "-"}</div>
              <div><span className="font-semibold">Expectativa Vida:</span> {viewEquip.expectativaVida || "-"}</div>
              <div><span className="font-semibold">Data Garantia:</span> {viewEquip.dataGarantia || "-"}</div>
              <div><span className="font-semibold">Tensão:</span> {viewEquip.tensao || "-"}</div>
              <div><span className="font-semibold">Corrente:</span> {viewEquip.corrente || "-"}</div>
              <div><span className="font-semibold">Potência:</span> {viewEquip.potencia || "-"}</div>
              <div><span className="font-semibold">Capacidade BTU:</span> {viewEquip.capacidadeBtu || "-"}</div>
              <div><span className="font-semibold">Contrato:</span> {viewEquip.contrato || "-"}</div>
              <div><span className="font-semibold">Plano Manutenção:</span> {(pmocPlanos || []).find((p: any) => p.id === viewEquip.planoManutencao)?.titulo || viewEquip.planoManutencao || "-"}</div>
              <div><span className="font-semibold">Nº Anvisa:</span> {viewEquip.numeroAnvisa || "-"}</div>
              {((viewEquip.fotos && viewEquip.fotos.length > 0) || viewEquip.fotoUrl) && (
                <div className="col-span-2">
                  <span className="font-semibold">Fotos:</span>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {(viewEquip.fotos && viewEquip.fotos.length > 0 ? viewEquip.fotos : [viewEquip.fotoUrl]).filter(Boolean).map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Foto ${i+1}`} className="h-24 w-24 object-cover rounded border" /></a>
                    ))}
                  </div>
                </div>
              )}
              {viewEquip.manualUrl && <div className="col-span-2"><span className="font-semibold">Manual:</span> <a href={viewEquip.manualUrl} target="_blank" rel="noreferrer" className="text-primary underline ml-1">Ver manual</a></div>}
              <div className="col-span-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => { const eq = viewEquip; setViewEquip(null); setLaudoEquip(eq); }}>
                  <ShieldAlert className="h-4 w-4 mr-1 text-destructive" />Laudos de Condenação
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {laudoEquip && (
        <LaudoCondenacaoDialog
          equipamento={laudoEquip}
          open={!!laudoEquip}
          onOpenChange={(o) => { if (!o) setLaudoEquip(null); }}
        />
      )}

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => { if (!open) cancelDelete(); }} onConfirm={() => { if (deleteId) handleDelete(deleteId); }} />

      {/* Histórico de Calibração */}
      <Dialog open={!!historicoEquip} onOpenChange={() => { setHistoricoEquip(null); setNovaCalibOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Histórico de Calibração — {historicoEquip?.equipamento}
            </DialogTitle>
          </DialogHeader>
          {historicoEquip && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  TAG: <span className="font-mono">{historicoEquip.tag || "-"}</span> · Frequência: {historicoEquip.frequenciaCalibracaoMeses} meses
                </div>
                <Button size="sm" onClick={() => setNovaCalibOpen(v => !v)}>
                  <Plus className="h-4 w-4 mr-1" />Nova Calibração
                </Button>
              </div>
              {novaCalibOpen && (
                <Card className="border-primary/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><Label>Data Calibração *</Label><Input type="date" value={novaCalib.data_calibracao} onChange={e => setNovaCalib(p => ({ ...p, data_calibracao: e.target.value }))} /></div>
                      <div><Label>Validade</Label><Input type="date" value={novaCalib.validade_calibracao} onChange={e => setNovaCalib(p => ({ ...p, validade_calibracao: e.target.value }))} /></div>
                      <div><Label>Resultado</Label>
                        <Select value={novaCalib.resultado} onValueChange={v => setNovaCalib(p => ({ ...p, resultado: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Aprovado">Aprovado</SelectItem>
                            <SelectItem value="Aprovado com Ressalvas">Aprovado com Ressalvas</SelectItem>
                            <SelectItem value="Reprovado">Reprovado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Laboratório</Label><Input value={novaCalib.laboratorio} onChange={e => setNovaCalib(p => ({ ...p, laboratorio: e.target.value }))} /></div>
                      <div><Label>Nº Certificado</Label><Input value={novaCalib.numero_certificado} onChange={e => setNovaCalib(p => ({ ...p, numero_certificado: e.target.value }))} /></div>
                      <div><Label>Responsável</Label><Input value={novaCalib.responsavel} onChange={e => setNovaCalib(p => ({ ...p, responsavel: e.target.value }))} /></div>
                      <div><Label>Custo (R$)</Label><Input type="number" value={novaCalib.custo || ""} onChange={e => setNovaCalib(p => ({ ...p, custo: Number(e.target.value) }))} /></div>
                      <div className="col-span-2">
                        <Label>Certificado</Label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => document.getElementById("cert-nova-upload")?.click()}>
                            <FileText className="h-4 w-4 mr-1" />Upload
                          </Button>
                          <input id="cert-nova-upload" type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadCertificadoNova(e.target.files[0])} />
                          {novaCalib.certificado_url && <a href={novaCalib.certificado_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver</a>}
                        </div>
                      </div>
                    </div>
                    <div><Label>Observações</Label><Textarea rows={2} value={novaCalib.observacoes} onChange={e => setNovaCalib(p => ({ ...p, observacoes: e.target.value }))} /></div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setNovaCalibOpen(false)}>Cancelar</Button>
                      <Button size="sm" onClick={registrarCalibracao}>Registrar</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Laboratório</TableHead>
                    <TableHead>Nº Cert.</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Cert.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma calibração registrada.</TableCell></TableRow>
                  ) : historico.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="text-sm">{h.data_calibracao?.split("-").reverse().join("/")}</TableCell>
                      <TableCell className="text-sm">{h.validade_calibracao?.split("-").reverse().join("/") || "-"}</TableCell>
                      <TableCell className="text-sm">{h.laboratorio || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{h.numero_certificado || "-"}</TableCell>
                      <TableCell><Badge variant={h.resultado === "Reprovado" ? "destructive" : "default"} className="text-xs">{h.resultado}</Badge></TableCell>
                      <TableCell>{h.certificado_url ? <a href={h.certificado_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Ver</a> : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code */}
      <Dialog open={!!qrEquip} onOpenChange={() => setQrEquip(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />QR Code do Equipamento</DialogTitle>
          </DialogHeader>
          {qrEquip && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-semibold">{qrEquip.equipamento}</p>
                {qrEquip.tag && <p className="text-xs text-muted-foreground font-mono">TAG: {qrEquip.tag}</p>}
                {qrEquip.clienteNome && <p className="text-xs text-muted-foreground">{qrEquip.clienteNome}</p>}
              </div>
              {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="mx-auto w-64 h-64 border rounded" />}
              <p className="text-xs text-center text-muted-foreground break-all">{`${window.location.origin}/equipamento/${qrEquip.id}`}</p>
              <p className="text-xs text-center text-muted-foreground">Acesso somente leitura: informações do equipamento e histórico de manutenções.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={downloadQr}><Download className="h-4 w-4 mr-1" />Baixar PNG</Button>
            <Button onClick={printQr}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
