import { useState, useMemo, useRef, useEffect } from "react";
import { useRdos, Rdo, RdoEfetivoItem, RdoEquipamentoItem, RdoAtividadeItem } from "@/contexts/RdosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRdoAssinaturas } from "@/contexts/RdoAssinaturasContext";
import { useResponsaveisTecnicos } from "@/contexts/ResponsaveisTecnicosContext";
import { useObras, Obra as ObraType } from "@/contexts/ObrasContext";
import { usePermissao } from "@/hooks/usePermissao";
import { AssinaturaEletronicaOficial } from "@/components/AssinaturaEletronicaOficial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Edit, Trash2, FileDown, Upload, X, Eraser, FileText, Image as ImageIcon, Building2, Settings, Loader2, FileSignature } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls from "@/components/PaginationControls";
import { gerarPdfRdo } from "@/lib/gerarPdfRdo";
import { toast } from "sonner";

const CLIMAS = ["Ensolarado", "Nublado", "Chuvoso", "Parcialmente Nublado", "Tempestade", "Não Aplicável"];
const CONDICOES = ["Praticável", "Impraticável", "Parcialmente Praticável"];
const STATUS_LIST = ["Aberto", "Concluído"];

const statusColor = (s: string) => {
  switch (s) {
    case "Concluído": return "bg-green-100 text-green-800 border-green-300";
    case "Aberto": return "bg-yellow-100 text-yellow-800 border-yellow-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): Partial<Rdo> => ({
  data_rdo: today(),
  cliente_id: "",
  cliente_nome: "",
  obra: "",
  responsavel: "",
  clima_manha: "Ensolarado",
  clima_tarde: "Ensolarado",
  clima_noite: "Ensolarado",
  condicao_manha: "Praticável",
  condicao_tarde: "Praticável",
  condicao_noite: "Praticável",
  efetivo: [],
  equipamentos: [],
  atividades: [],
  avanco_fisico_geral: 0,
  ocorrencias: "",
  observacoes: "",
  anexos: [],
  assinatura_responsavel: "",
  assinatura_responsavel_nome: "",
  assinatura_fiscalizacao: "",
  assinatura_fiscalizacao_nome: "",
  status: "Aberto",
});

// Componente Canvas para assinatura digital
function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: (t.clientX - rect.left) * (canvas.width / rect.width), y: (t.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    drawingRef.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={140}
        className="border rounded-md w-full bg-white touch-none cursor-crosshair"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <Button type="button" variant="outline" size="sm" onClick={clear}>
        <Eraser className="h-3 w-3 mr-1" /> Limpar Assinatura
      </Button>
    </div>
  );
}

export default function RdoPage() {
  const { rdos, loading, addRdo, updateRdo, deleteRdo, uploadAnexo } = useRdos();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();
  const { usuarioLogado } = useAuth();
  const { porRdo } = useRdoAssinaturas();
  const { responsaveis = [] } = useResponsaveisTecnicos();
  const { obras, add: addObra, update: updateObra, remove: removeObra } = useObras();
  const { tem } = usePermissao();
  const podeExcluir = tem("rdo.excluir");
  const rdosList = rdos || [];
  const clientesList = clientes || [];
  const obrasList = obras || [];

  // Gerenciar Obras
  const [obrasDialogOpen, setObrasDialogOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<ObraType | null>(null);
  const [obraForm, setObraForm] = useState<Partial<ObraType>>({ cliente_id: "", cliente_nome: "", nome: "", status: "Em Andamento" });

  const [search, setSearch] = useState("");
  const [filterCliente, setFilterCliente] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rdo | null>(null);
  const [form, setForm] = useState<Partial<Rdo>>(emptyForm());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("geral");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const assinaturasDoRdo = useMemo(() => editing ? porRdo(editing.id) : [], [editing, porRdo]);

  // Lançamentos da Obra (padrão Medição: cada obra abre lista de RDOs)
  const [selectedObra, setSelectedObra] = useState<ObraType | null>(null);
  const [obraRdosOpen, setObraRdosOpen] = useState(false);
  const [obraRdoSearch, setObraRdoSearch] = useState("");

  const clientesAtivos = useMemo(() => clientesList.filter((c) => c.tipo === "Cliente"), [clientesList]);

  // Filtros das OBRAS (tela principal)
  const obrasFiltradas = useMemo(() => {
    return obrasList.filter((o) => {
      const matchSearch = !search ||
        o.nome?.toLowerCase().includes(search.toLowerCase()) ||
        o.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
        String(o.numero || "").includes(search);
      const matchCliente = filterCliente === "Todos" || o.cliente_id === filterCliente;
      const matchStatus = filterStatus === "Todos" || (o.status || "") === filterStatus;
      return matchSearch && matchCliente && matchStatus;
    });
  }, [obrasList, search, filterCliente, filterStatus]);

  useEffect(() => { setPage(1); }, [search, filterCliente, filterStatus, pageSize]);

  const pagedObras = obrasFiltradas.slice((page - 1) * pageSize, page * pageSize);

  // RDOs filtrados da obra selecionada (dentro do dialog)
  const rdosDaObra = useMemo(() => {
    if (!selectedObra) return [];
    return rdosList
      .filter((r) => r.obra_id === selectedObra.id ||
        (!r.obra_id && r.cliente_id === selectedObra.cliente_id && (r.obra || "").toLowerCase().trim() === (selectedObra.nome || "").toLowerCase().trim()))
      .filter((r) => !obraRdoSearch ||
        String(r.numero).includes(obraRdoSearch) ||
        r.responsavel?.toLowerCase().includes(obraRdoSearch.toLowerCase()) ||
        (r.data_rdo || "").includes(obraRdoSearch))
      .sort((a, b) => (b.data_rdo || "").localeCompare(a.data_rdo || ""));
  }, [rdosList, selectedObra, obraRdoSearch]);

  // Evolução acumulada da obra: soma do avanço físico geral de todas as RDOs, limitada a 100%
  const evolucaoObra = useMemo(() => {
    const total = rdosDaObra.reduce((acc, r) => acc + (Number(r.avanco_fisico_geral) || 0), 0);
    return Math.min(100, total);
  }, [rdosDaObra]);

  const openObraRdos = (o: ObraType) => {
    setSelectedObra(o);
    setObraRdoSearch("");
    setObraRdosOpen(true);
  };

  const openNew = (obra?: ObraType) => {
    const ctx = obra || selectedObra;
    setEditing(null);
    setForm({
      ...emptyForm(),
      responsavel: usuarioLogado?.nome || "",
      cliente_id: ctx?.cliente_id || "",
      cliente_nome: ctx?.cliente_nome || "",
      obra_id: ctx?.id || null,
      obra: ctx?.nome || "",
    });
    setActiveTab("geral");
    setDialogOpen(true);
  };
  const openEdit = (r: Rdo, tab?: string) => {
    setEditing(r);
    setForm({ ...r });
    setActiveTab(tab || "geral");
    setDialogOpen(true);
  };

  const onClienteChange = (id: string) => {
    const c = clientesList.find((x) => x.id === id);
    setForm((f) => ({ ...f, cliente_id: id, cliente_nome: c?.nome || "", obra: "" }));
  };

  const obrasDoCliente = useMemo(() => obrasList.filter((o) => o.cliente_id === (form.cliente_id || "")), [obrasList, form.cliente_id]);
  const obraDoForm = useMemo(
    () => obrasList.find((o) => o.id === form.obra_id) ||
      obrasList.find((o) => o.cliente_id === form.cliente_id && (o.nome || "").toLowerCase().trim() === (form.obra || "").toLowerCase().trim()),
    [obrasList, form.obra_id, form.cliente_id, form.obra],
  );

  // Listas dinâmicas
  const addEfetivo = () => setForm((f) => ({ ...f, efetivo: [...(f.efetivo || []), { funcao: "", quantidade: 0, horas: 0 }] }));
  const updEfetivo = (i: number, k: keyof RdoEfetivoItem, v: any) =>
    setForm((f) => ({ ...f, efetivo: (f.efetivo || []).map((x, idx) => idx === i ? { ...x, [k]: k === "funcao" ? v : Number(v) || 0 } : x) }));
  const delEfetivo = (i: number) => setForm((f) => ({ ...f, efetivo: (f.efetivo || []).filter((_, idx) => idx !== i) }));

  const addEquip = () => setForm((f) => ({ ...f, equipamentos: [...(f.equipamentos || []), { descricao: "", quantidade: 0, horas: 0 }] }));
  const updEquip = (i: number, k: keyof RdoEquipamentoItem, v: any) =>
    setForm((f) => ({ ...f, equipamentos: (f.equipamentos || []).map((x, idx) => idx === i ? { ...x, [k]: k === "descricao" ? v : Number(v) || 0 } : x) }));
  const delEquip = (i: number) => setForm((f) => ({ ...f, equipamentos: (f.equipamentos || []).filter((_, idx) => idx !== i) }));

  const addAtiv = () => setForm((f) => ({ ...f, atividades: [...(f.atividades || []), { descricao: "", percentual_avanco: 0, observacao: "" }] }));
  const updAtiv = (i: number, k: keyof RdoAtividadeItem, v: any) =>
    setForm((f) => ({
      ...f,
      atividades: (f.atividades || []).map((x, idx) =>
        idx === i
          ? { ...x, [k]: k === "percentual_avanco" ? Math.min(100, Math.max(0, Number(v) || 0)) : v }
          : x
      ),
    }));
  const delAtiv = (i: number) => setForm((f) => ({ ...f, atividades: (f.atividades || []).filter((_, idx) => idx !== i) }));

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const current = form.anexos || [];
    const arr = Array.from(files);
    if (current.length + arr.length > 30) {
      toast.error("Limite de 30 imagens por RDO.");
      return;
    }
    for (const f of arr) {
      if (f.type.startsWith("image/") && f.size > 5 * 1024 * 1024) {
        toast.error(`A imagem "${f.name}" excede 5MB.`);
        return;
      }
    }
    setUploading(true);
    const tempId = editing?.id || "novo";
    const newAnexos = [...current];
    for (const file of arr) {
      const url = await uploadAnexo(file, tempId);
      if (url) newAnexos.push({ nome: file.name, url, tipo: file.type, descricao: "" });
    }
    setForm((f) => ({ ...f, anexos: newAnexos }));
    setUploading(false);
  };
  const removeAnexo = (i: number) => setForm((f) => ({ ...f, anexos: (f.anexos || []).filter((_, idx) => idx !== i) }));
  const updateAnexoDescricao = (i: number, descricao: string) =>
    setForm((f) => ({ ...f, anexos: (f.anexos || []).map((a, idx) => idx === i ? { ...a, descricao } : a) }));

  const onSave = async () => {
    if (!form.cliente_id) { toast.error("Selecione um cliente."); return; }
    if (!form.obra) { toast.error("Informe a obra."); return; }
    if (!form.data_rdo) { toast.error("Informe a data do RDO."); return; }

    // Impede que o acumulado de avanço físico da obra ultrapasse 100%
    const mesmaObra = (r: any) =>
      (form.obra_id && r.obra_id === form.obra_id) ||
      (r.cliente_id === form.cliente_id &&
        (r.obra || "").toLowerCase().trim() === (form.obra || "").toLowerCase().trim());
    const acumuladoOutros = rdosList
      .filter((r) => r.id !== editing?.id && mesmaObra(r))
      .reduce((acc, r) => acc + (Number(r.avanco_fisico_geral) || 0), 0);
    const atual = Number(form.avanco_fisico_geral) || 0;
    if (acumuladoOutros + atual > 100.0001) {
      const restante = Math.max(0, 100 - acumuladoOutros);
      toast.error(
        `Avanço acumulado da obra ultrapassaria 100%. Já lançado: ${acumuladoOutros.toFixed(1)}%. Máximo permitido neste RDO: ${restante.toFixed(1)}%.`
      );
      return;
    }

    setSaving(true);

    try {
      const payload = { ...form };
      let ok = false;
      if (editing) {
        ok = await updateRdo(editing.id, payload);
      } else {
        ok = !!(await addRdo(payload));
      }
      if (!ok) {
        toast.error("Erro ao salvar RDO. Tente novamente.");
        return;
      }
      setDialogOpen(false);
      setForm(emptyForm());
      setEditing(null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar RDO. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const onExportPdf = async (r: Rdo, incluirImagens = false) => {
    const cliente = clientesList.find((c) => c.id === r.cliente_id);
    const assinaturas = porRdo(r.id);
    await gerarPdfRdo({ rdo: r, empresa, cliente, assinaturas, incluirImagens });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">RDO - Registro Diário de Obras</h1>
          <p className="text-sm text-muted-foreground">Cadastre a obra e lance os RDOs por data dentro de cada obra.</p>
        </div>
        <Button
          onClick={() => {
            setEditingObra(null);
            setObraForm({ cliente_id: "", cliente_nome: "", nome: "", status: "Em Andamento" });
            setObrasDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> Nova Obra
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar obra..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterCliente} onValueChange={setFilterCliente}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os clientes</SelectItem>
                {clientesAtivos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os status</SelectItem>
                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                <SelectItem value="Paralisada">Paralisada</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-center">RDOs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedObras.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma obra encontrada. Clique em "Nova Obra" para cadastrar.</TableCell></TableRow>
              ) : pagedObras.map((o) => {
                const totalRdos = rdosList.filter((r) => r.obra_id === o.id ||
                  (!r.obra_id && r.cliente_id === o.cliente_id && (r.obra || "").toLowerCase().trim() === (o.nome || "").toLowerCase().trim())).length;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.numero}</TableCell>
                    <TableCell>{o.cliente_nome}</TableCell>
                    <TableCell>{o.nome}</TableCell>
                    <TableCell>{o.responsavel || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{totalRdos}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="default" onClick={() => openObraRdos(o)} title="Lançar / Ver RDOs">
                        <FileText className="h-4 w-4 mr-1" /> RDOs
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditingObra(o); setObraForm(o); setObrasDialogOpen(true); }} title="Editar Obra">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (totalRdos > 0) { toast.error("Esta obra possui RDOs lançados. Exclua-os antes."); return; }
                          if (confirm(`Excluir a obra "${o.nome}"?`)) await removeObra(o.id);
                        }}
                        title="Excluir Obra"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationControls
            currentPage={page}
            pageSize={pageSize}
            totalItems={obrasFiltradas.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* Dialog: RDOs da Obra (padrão Medição) */}
      <Dialog open={obraRdosOpen} onOpenChange={setObraRdosOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              RDOs da Obra: {selectedObra?.nome}
              <span className="text-sm font-normal text-muted-foreground">— {selectedObra?.cliente_nome}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por nº, data ou responsável..." value={obraRdoSearch} onChange={(e) => setObraRdoSearch(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[220px] max-w-md flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Evolução da obra</span>
                <span className="font-medium">{evolucaoObra.toFixed(1)}%</span>
              </div>
              <Progress value={evolucaoObra} />
            </div>
            <Button onClick={() => openNew()}>
              <Plus className="h-4 w-4 mr-2" /> Novo RDO
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-center">Avanço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6">Carregando...</TableCell></TableRow>
                  ) : rdosDaObra.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum RDO lançado nesta obra. Clique em "Novo RDO".</TableCell></TableRow>
                  ) : rdosDaObra.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.numero}</TableCell>
                      <TableCell>{r.data_rdo ? new Date(r.data_rdo + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell>{r.responsavel}</TableCell>
                      <TableCell className="text-center">{(Number(r.avanco_fisico_geral) || 0).toFixed(1)}%</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" title="Exportar PDF">
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onExportPdf(r, false)}>
                              <FileText className="h-4 w-4 mr-2" /> PDF sem imagens
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onExportPdf(r, true)}>
                              <ImageIcon className="h-4 w-4 mr-2" /> PDF com imagens
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r, "assinaturas")} title="Assinar RDO">
                          <FileSignature className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setObraRdosOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar RDO Nº ${editing.numero}` : "Novo RDO"}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="clima">Clima</TabsTrigger>
              <TabsTrigger value="efetivo">Efetivo</TabsTrigger>
              <TabsTrigger value="atividades">Atividades</TabsTrigger>
              <TabsTrigger value="anexos">Anexos</TabsTrigger>
              <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data do RDO *</Label>
                  <Input type="date" value={form.data_rdo || ""} onChange={(e) => setForm({ ...form, data_rdo: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cliente *</Label>
                  <Select value={form.cliente_id} onValueChange={onClienteChange} disabled={!!form.obra_id}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {clientesAtivos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Obra *</Label>
                  {form.obra_id ? (
                    <Input value={form.obra || ""} disabled />
                  ) : (
                    <Select
                      value={form.obra || ""}
                      onValueChange={(v) => {
                        const sel = obrasDoCliente.find(o => o.nome === v);
                        setForm({ ...form, obra: v, obra_id: sel?.id || null });
                      }}
                      disabled={!form.cliente_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!form.cliente_id ? "Selecione o cliente primeiro" : obrasDoCliente.length === 0 ? "Nenhuma obra cadastrada para este cliente" : "Selecione a obra"} />
                      </SelectTrigger>
                      <SelectContent>
                        {obrasDoCliente.map((o) => (
                          <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {obraDoForm && (
                  <div className="col-span-2 grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Contrato Nº</p>
                      <p className="font-medium">{obraDoForm.contrato_numero || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Processo Nº</p>
                      <p className="font-medium">{obraDoForm.processo_numero || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Total do Contrato</p>
                      <p className="font-medium">
                        {(Number(obraDoForm.valor_total_contrato) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <Label>Responsável Técnico</Label>
                  <Select
                    value={(form as any).responsavel_tecnico_id || ""}
                    onValueChange={(id) => {
                      const r = responsaveis.find(x => x.id === id);
                      setForm({
                        ...form,
                        ...( { responsavel_tecnico_id: id } as any),
                        responsavel: r ? `${r.nome} - ${r.titulo} - CREA ${r.crea}` : "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={responsaveis.length === 0 ? "Cadastre um Responsável Técnico" : "Selecione o responsável"} />
                    </SelectTrigger>
                    <SelectContent>
                      {responsaveis.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome} — {r.titulo} (CREA {r.crea})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Avanço Físico Geral (%)</Label>
                  <Input
                    type="number" step="0.01" min={0} max={100}
                    value={Math.min(100, Number(form.avanco_fisico_geral) || 0)}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value.replace(",", ".")) || 0));
                      setForm({ ...form, avanco_fisico_geral: val });
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Ocorrências do Dia</Label>
                <Textarea rows={3} value={form.ocorrencias || ""} onChange={(e) => setForm({ ...form, ocorrencias: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={3} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </TabsContent>

            <TabsContent value="clima" className="space-y-3 mt-4">
              {(["manha", "tarde", "noite"] as const).map((turno) => (
                <Card key={turno}>
                  <CardHeader className="pb-2"><CardTitle className="text-base capitalize">{turno === "manha" ? "Manhã" : turno}</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Clima</Label>
                      <Select
                        value={(form as any)[`clima_${turno}`]}
                        onValueChange={(v) => setForm({ ...form, [`clima_${turno}`]: v } as any)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CLIMAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Condição de Trabalho</Label>
                      <Select
                        value={(form as any)[`condicao_${turno}`]}
                        onValueChange={(v) => setForm({ ...form, [`condicao_${turno}`]: v } as any)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CONDICOES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="efetivo" className="space-y-4 mt-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Mão de Obra</h3>
                  <Button size="sm" onClick={addEfetivo}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Função</TableHead><TableHead>Quantidade</TableHead><TableHead>Horas</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(form.efetivo || []).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell><Input value={e.funcao} onChange={(ev) => updEfetivo(i, "funcao", ev.target.value)} /></TableCell>
                        <TableCell><Input type="number" min={0} value={e.quantidade} onChange={(ev) => updEfetivo(i, "quantidade", ev.target.value)} /></TableCell>
                        <TableCell><Input type="number" min={0} step="0.5" value={e.horas} onChange={(ev) => updEfetivo(i, "horas", ev.target.value)} /></TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => delEfetivo(i)}><X className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                    {(form.efetivo || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum item</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Equipamentos</h3>
                  <Button size="sm" onClick={addEquip}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Quantidade</TableHead><TableHead>Horas</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(form.equipamentos || []).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell><Input value={e.descricao} onChange={(ev) => updEquip(i, "descricao", ev.target.value)} /></TableCell>
                        <TableCell><Input type="number" min={0} value={e.quantidade} onChange={(ev) => updEquip(i, "quantidade", ev.target.value)} /></TableCell>
                        <TableCell><Input type="number" min={0} step="0.5" value={e.horas} onChange={(ev) => updEquip(i, "horas", ev.target.value)} /></TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => delEquip(i)}><X className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                    {(form.equipamentos || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum item</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="atividades" className="space-y-2 mt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Atividades Executadas e Avanço Físico</h3>
                <Button size="sm" onClick={addAtiv}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead className="w-32">% Avanço</TableHead><TableHead>Observação</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {(form.atividades || []).map((a, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={a.descricao} onChange={(ev) => updAtiv(i, "descricao", ev.target.value)} /></TableCell>
                      <TableCell><Input type="number" min={0} max={100} step="0.1" value={a.percentual_avanco} onChange={(ev) => updAtiv(i, "percentual_avanco", ev.target.value)} /></TableCell>
                      <TableCell><Input value={a.observacao} onChange={(ev) => updAtiv(i, "observacao", ev.target.value)} /></TableCell>
                      <TableCell><Button size="icon" variant="ghost" onClick={() => delAtiv(i)}><X className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {(form.atividades || []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma atividade</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="anexos" className="space-y-3 mt-4">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <Label>Adicionar Fotos / Documentos</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    disabled={uploading || (form.anexos || []).length >= 30}
                    onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
                  />
                  {uploading && <p className="text-xs text-muted-foreground mt-1">Enviando...</p>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(form.anexos || []).length}/30 anexos · máx. 5MB por imagem
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(form.anexos || []).map((a, i) => (
                  <div key={i} className="border rounded-md p-2 relative space-y-2">
                    {a.tipo?.startsWith("image/") ? (
                      <img src={a.url} alt={a.nome} className="w-full h-32 object-cover rounded" />
                    ) : (
                      <div className="h-32 flex items-center justify-center bg-muted rounded text-xs text-center px-2">{a.nome}</div>
                    )}
                    <p className="text-xs truncate">{a.nome}</p>
                    <Input
                      placeholder="Descrição da imagem"
                      value={a.descricao || ""}
                      onChange={(e) => updateAnexoDescricao(i, e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button size="icon" variant="ghost" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeAnexo(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="assinaturas" className="space-y-4 mt-4">
              <div className="bg-muted/30 border rounded p-3 text-xs text-muted-foreground">
                As assinaturas são <strong>eletrônicas oficiais</strong>, com validade jurídica conforme Lei nº 14.063, de 23 de Setembro de 2020.
                Cada assinatura registra automaticamente o signatário autenticado, data/hora, IP, hash do documento e gera um código verificador único, consultável publicamente.
              </div>
              <AssinaturaEletronicaOficial
                rdo={editing ? { ...editing, ...form } : form as any}
                papel="responsavel"
                assinaturaExistente={editing ? assinaturasDoRdo.find(a => a.papel === "responsavel") : undefined}
              />
              <AssinaturaEletronicaOficial
                rdo={editing ? { ...editing, ...form } : form as any}
                papel="fiscalizacao"
                assinaturaExistente={editing ? assinaturasDoRdo.find(a => a.papel === "fiscalizacao") : undefined}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Atualizar" : "Salvar"} RDO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={async () => {
          if (!podeExcluir) {
            toast.error("Você não possui permissão para excluir RDOs.");
            setDeleteId(null);
            return;
          }
          if (deleteId) { await deleteRdo(deleteId); setDeleteId(null); }
        }}
      />

      {/* Gerenciar Obras */}
      <Dialog open={obrasDialogOpen} onOpenChange={setObrasDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Cadastro de Obras
            </DialogTitle>
          </DialogHeader>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editingObra ? "Editar Obra" : "Nova Obra"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cliente *</Label>
                  <Select
                    value={obraForm.cliente_id || ""}
                    onValueChange={(id) => {
                      const c = clientesList.find((x) => x.id === id);
                      setObraForm({ ...obraForm, cliente_id: id, cliente_nome: c?.nome || "" });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {clientesAtivos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome da Obra *</Label>
                  <Input value={obraForm.nome || ""} onChange={(e) => setObraForm({ ...obraForm, nome: e.target.value })} placeholder="Ex.: Edifício Central - Torre A" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={obraForm.status || "Em Andamento"} onValueChange={(v) => setObraForm({ ...obraForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                      <SelectItem value="Paralisada">Paralisada</SelectItem>
                      <SelectItem value="Concluída">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Responsável Técnico</Label>
                  <Select
                    value={obraForm.responsavel || ""}
                    onValueChange={(v) => setObraForm({ ...obraForm, responsavel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={responsaveis.length === 0 ? "Cadastre um Responsável Técnico" : "Selecione o responsável"} />
                    </SelectTrigger>
                    <SelectContent>
                      {responsaveis.map((r) => (
                        <SelectItem key={r.id} value={`${r.nome} - ${r.titulo} - CREA ${r.crea}`}>
                          {r.nome} - {r.titulo} - CREA {r.crea}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Contrato Nº</Label>
                  <Input value={obraForm.contrato_numero || ""} onChange={(e) => setObraForm({ ...obraForm, contrato_numero: e.target.value })} placeholder="Ex.: 123/2025" />
                </div>
                <div>
                  <Label>Processo Nº</Label>
                  <Input value={obraForm.processo_numero || ""} onChange={(e) => setObraForm({ ...obraForm, processo_numero: e.target.value })} placeholder="Ex.: 0001234/2025" />
                </div>
                <div>
                  <Label>Valor Total do Contrato (R$)</Label>
                  <Input
                    type="number" step="0.01" min={0}
                    value={obraForm.valor_total_contrato ?? 0}
                    onChange={(e) => setObraForm({ ...obraForm, valor_total_contrato: Number(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label>Data de Início</Label>
                  <Input type="date" value={obraForm.data_inicio || ""} onChange={(e) => setObraForm({ ...obraForm, data_inicio: e.target.value })} />
                </div>
                <div>
                  <Label>Previsão de Término</Label>
                  <Input type="date" value={obraForm.data_prevista_termino || ""} onChange={(e) => setObraForm({ ...obraForm, data_prevista_termino: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input value={obraForm.endereco || ""} onChange={(e) => setObraForm({ ...obraForm, endereco: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Descrição</Label>
                  <Textarea rows={2} value={obraForm.descricao || ""} onChange={(e) => setObraForm({ ...obraForm, descricao: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {editingObra && (
                  <Button variant="outline" onClick={() => { setEditingObra(null); setObraForm({ cliente_id: form.cliente_id || "", cliente_nome: form.cliente_nome || "", nome: "", status: "Em Andamento" }); }}>
                    Cancelar Edição
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    if (!obraForm.cliente_id) { toast.error("Selecione o cliente."); return; }
                    if (!obraForm.nome?.trim()) { toast.error("Informe o nome da obra."); return; }
                    if (editingObra) {
                      await updateObra(editingObra.id, obraForm);
                    } else {
                      await addObra(obraForm);
                    }
                    setEditingObra(null);
                    setObraForm({ cliente_id: form.cliente_id || "", cliente_nome: form.cliente_nome || "", nome: "", status: "Em Andamento" });
                  }}
                >
                  {editingObra ? "Atualizar Obra" : "Cadastrar Obra"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Obras Cadastradas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {obrasList.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma obra cadastrada</TableCell></TableRow>
                  ) : obrasList.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.numero}</TableCell>
                      <TableCell>{o.cliente_nome}</TableCell>
                      <TableCell>{o.nome}</TableCell>
                      <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingObra(o); setObraForm(o); }} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={async () => { if (confirm(`Excluir obra "${o.nome}"?`)) await removeObra(o.id); }} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setObrasDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
