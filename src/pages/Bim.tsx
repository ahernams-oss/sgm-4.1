import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, Upload, Box, FileText, Calculator, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBim, BimModelo } from "@/contexts/BimContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useRdos } from "@/contexts/RdosContext";
import { useCronogramas } from "@/contexts/CronogramasContext";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";
import BimViewer from "@/components/BimViewer";

const DISCIPLINAS = ["Arquitetura", "Estrutural", "Hidráulica", "Elétrica", "AVAC", "PCI", "Telecom", "Coordenação"];
const FORMATOS = ["IFC", "RVT", "RFA", "DWG", "DXF", "PDF", "PNG", "JPG"];
const STATUS = ["Em Revisão", "Aprovado", "Obsoleto", "Em Coordenação"];

const emptyForm: Partial<BimModelo> = {
  cliente_id: "",
  cliente_nome: "",
  obra: "",
  nome: "",
  descricao: "",
  disciplina: "Arquitetura",
  versao: "1.0",
  status: "Em Revisão",
  responsavel_tecnico: "",
  data_upload: new Date().toISOString().slice(0, 10),
  formato: "IFC",
  arquivo_url: "",
  arquivo_nome: "",
  arquivo_tamanho: 0,
  observacoes: "",
  tags: [],
};

export default function BimPage() {
  const { modelos, quantitativos, pranchas, addModelo, updateModelo, deleteModelo,
    addQuantitativo, deleteQuantitativo, addPrancha, deletePrancha } = useBim();
  const { clientes } = useClientes();
  const { rdos } = useRdos();
  const { cronogramas } = useCronogramas();
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("bim.excluir");

  const [search, setSearch] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroObra, setFiltroObra] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<BimModelo>>(emptyForm);
  const [uploading, setUploading] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerModelo, setViewerModelo] = useState<BimModelo | null>(null);

  // Quantitativos / Pranchas
  const [qDialogOpen, setQDialogOpen] = useState(false);
  const [qForm, setQForm] = useState({ categoria: "", elemento: "", quantidade: 0, unidade: "m²", observacao: "" });
  const [pDialogOpen, setPDialogOpen] = useState(false);
  const [pForm, setPForm] = useState({ codigo: "", titulo: "", escala: "", revisao: "00", data_revisao: "", observacao: "" });
  const [pFile, setPFile] = useState<File | null>(null);

  const obrasDoCliente = useMemo(() => {
    if (!form.cliente_id) return [] as string[];
    const set = new Set<string>();
    (rdos || []).forEach((r: any) => {
      if (r.cliente_id === form.cliente_id && (r.obra || "").trim()) set.add((r.obra || "").trim());
    });
    (cronogramas || []).forEach((c: any) => {
      if (c.cliente_id === form.cliente_id && (c.obra || "").trim()) set.add((c.obra || "").trim());
    });
    (modelos || []).forEach((m: any) => {
      if (m.cliente_id === form.cliente_id && (m.obra || "").trim()) set.add((m.obra || "").trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rdos, cronogramas, modelos, form.cliente_id]);

  const obrasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    (modelos || []).forEach((m) => { if (filtroCliente === "todos" || m.cliente_id === filtroCliente) set.add(m.obra); });
    return Array.from(set).filter(Boolean).sort();
  }, [modelos, filtroCliente]);

  const modelosFiltrados = useMemo(() => {
    return (modelos || []).filter((m) => {
      if (filtroCliente !== "todos" && m.cliente_id !== filtroCliente) return false;
      if (filtroObra !== "todas" && m.obra !== filtroObra) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!m.nome.toLowerCase().includes(s) &&
            !m.cliente_nome.toLowerCase().includes(s) &&
            !m.obra.toLowerCase().includes(s) &&
            !m.disciplina.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [modelos, filtroCliente, filtroObra, search]);

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, data_upload: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (m: BimModelo) => {
    setEditId(m.id);
    setForm(m);
    setDialogOpen(true);
  };

  const handleClienteChange = (id: string) => {
    const c = clientes.find((x) => x.id === id);
    setForm((prev) => ({ ...prev, cliente_id: id, cliente_nome: c?.nome || "", obra: "" }));
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toUpperCase() || "";
      const path = `${form.cliente_id || "geral"}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("bim-arquivos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("bim-arquivos").getPublicUrl(path);
      const formato = FORMATOS.includes(ext) ? ext : (form.formato || "IFC");
      setForm((prev) => ({
        ...prev,
        arquivo_url: data.publicUrl,
        arquivo_nome: file.name,
        arquivo_tamanho: file.size,
        formato,
      }));
      toast.success("Arquivo enviado!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar arquivo: " + (e.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.cliente_id || !form.obra || !form.nome) {
      toast.error("Cliente, Obra e Nome são obrigatórios.");
      return;
    }
    if (editId) {
      await updateModelo(editId, form);
    } else {
      await addModelo(form);
    }
    setDialogOpen(false);
    setForm(emptyForm);
    setEditId(null);
  };

  const openViewer = (m: BimModelo) => {
    setViewerModelo(m);
    setViewerOpen(true);
  };

  const formatBytes = (b: number) => {
    if (!b) return "-";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  const statusColor = (s: string) => {
    if (s === "Aprovado") return "bg-green-100 text-green-800";
    if (s === "Em Revisão") return "bg-yellow-100 text-yellow-800";
    if (s === "Obsoleto") return "bg-red-100 text-red-800";
    return "bg-blue-100 text-blue-800";
  };

  // Quantitativos do modelo no viewer
  const quantsDoModelo = viewerModelo ? quantitativos.filter((q) => q.modelo_id === viewerModelo.id) : [];
  const pranchasDoModelo = viewerModelo ? pranchas.filter((p) => p.modelo_id === viewerModelo.id) : [];

  const handleAddQuant = async () => {
    if (!viewerModelo || !qForm.elemento) return;
    await addQuantitativo({ ...qForm, modelo_id: viewerModelo.id });
    setQForm({ categoria: "", elemento: "", quantidade: 0, unidade: "m²", observacao: "" });
    setQDialogOpen(false);
  };

  const handleAddPrancha = async () => {
    if (!viewerModelo || !pForm.codigo) return;
    let url = "", nome = "";
    if (pFile) {
      const path = `${viewerModelo.cliente_id}/pranchas/${Date.now()}_${pFile.name}`;
      const { error } = await supabase.storage.from("bim-arquivos").upload(path, pFile, { upsert: true });
      if (!error) {
        url = supabase.storage.from("bim-arquivos").getPublicUrl(path).data.publicUrl;
        nome = pFile.name;
      }
    }
    await addPrancha({
      ...pForm,
      modelo_id: viewerModelo.id,
      data_revisao: pForm.data_revisao || null,
      arquivo_url: url,
      arquivo_nome: nome,
    });
    setPForm({ codigo: "", titulo: "", escala: "", revisao: "00", data_revisao: "", observacao: "" });
    setPFile(null);
    setPDialogOpen(false);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold flex items-center gap-2">
            <Box className="h-7 w-7 text-primary" />
            BIM - Building Information Modeling
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de modelos 3D, pranchas e quantitativos por Cliente + Obra.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Modelo BIM</Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Modelos cadastrados</p><p className="text-2xl font-semibold">{modelos.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aprovados</p><p className="text-2xl font-semibold text-green-700">{modelos.filter(m => m.status === "Aprovado").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em revisão</p><p className="text-2xl font-semibold text-yellow-700">{modelos.filter(m => m.status === "Em Revisão").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pranchas / Quantitativos</p><p className="text-2xl font-semibold">{pranchas.length} / {quantitativos.length}</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filtroCliente} onValueChange={(v) => { setFiltroCliente(v); setFiltroObra("todas"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.filter((c: any) => (c.tipo || "Cliente") === "Cliente").map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as obras</SelectItem>
              {obrasDisponiveis.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground self-center">
            {modelosFiltrados.length} modelo(s)
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader><CardTitle>Modelos BIM</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente / Obra</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelosFiltrados.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono">{m.numero}</TableCell>
                    <TableCell><div className="font-medium">{m.cliente_nome}</div><div className="text-xs text-muted-foreground">{m.obra}</div></TableCell>
                    <TableCell>{m.nome}</TableCell>
                    <TableCell>{m.disciplina}</TableCell>
                    <TableCell>{m.versao}</TableCell>
                    <TableCell><Badge variant="outline">{m.formato}</Badge></TableCell>
                    <TableCell><Badge className={statusColor(m.status)}>{m.status}</Badge></TableCell>
                    <TableCell>{formatBytes(m.arquivo_tamanho)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openViewer(m)} title="Visualizar 3D"><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => requestDelete(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {modelosFiltrados.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum modelo cadastrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Cadastro/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Modelo BIM</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.cliente_id} onValueChange={handleClienteChange}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clientes.filter((c: any) => (c.tipo || "Cliente") === "Cliente").map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Obra *</Label>
              {obrasDoCliente.length > 0 ? (
                <Select value={form.obra} onValueChange={(v) => setForm({ ...form, obra: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {obrasDoCliente.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.obra || ""} onChange={(e) => setForm({ ...form, obra: e.target.value })} placeholder="Nome da obra" />
              )}
            </div>
            <div className="md:col-span-2">
              <Label>Nome do Modelo *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Projeto Arquitetônico - Bloco A" />
            </div>
            <div>
              <Label>Disciplina</Label>
              <Select value={form.disciplina} onValueChange={(v) => setForm({ ...form, disciplina: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DISCIPLINAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versão</Label>
              <Input value={form.versao || ""} onChange={(e) => setForm({ ...form, versao: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={form.formato} onValueChange={(v) => setForm({ ...form, formato: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMATOS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável Técnico</Label>
              <Input value={form.responsavel_tecnico || ""} onChange={(e) => setForm({ ...form, responsavel_tecnico: e.target.value })} />
            </div>
            <div>
              <Label>Data do Upload</Label>
              <Input type="date" value={form.data_upload || ""} onChange={(e) => setForm({ ...form, data_upload: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Arquivo do Modelo</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".ifc,.rvt,.rfa,.dwg,.dxf,.pdf,.png,.jpg,.jpeg"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  disabled={uploading}
                />
                {uploading && <span className="text-sm text-muted-foreground">Enviando...</span>}
              </div>
              {form.arquivo_nome && (
                <p className="text-xs text-muted-foreground mt-1">📎 {form.arquivo_nome} ({formatBytes(form.arquivo_tamanho || 0)})</p>
              )}
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={uploading}>{editId ? "Atualizar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Viewer 3D + Quantitativos + Pranchas */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewerModelo?.nome} <Badge variant="outline" className="ml-2">{viewerModelo?.formato}</Badge>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{viewerModelo?.cliente_nome} · {viewerModelo?.obra} · v{viewerModelo?.versao}</p>
          </DialogHeader>
          <Tabs defaultValue="viewer">
            <TabsList>
              <TabsTrigger value="viewer"><Box className="h-4 w-4 mr-1" />Visualizador 3D</TabsTrigger>
              <TabsTrigger value="quantitativos"><Calculator className="h-4 w-4 mr-1" />Quantitativos ({quantsDoModelo.length})</TabsTrigger>
              <TabsTrigger value="pranchas"><FileText className="h-4 w-4 mr-1" />Pranchas ({pranchasDoModelo.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="viewer" className="space-y-3">
              {viewerModelo && <BimViewer url={viewerModelo.arquivo_url} formato={viewerModelo.formato} />}
              {viewerModelo?.arquivo_url && (
                <div className="flex justify-end">
                  <a href={viewerModelo.arquivo_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Baixar arquivo</Button>
                  </a>
                </div>
              )}
            </TabsContent>

            <TabsContent value="quantitativos" className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setQDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Adicionar Quantitativo</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Categoria</TableHead><TableHead>Elemento</TableHead>
                  <TableHead className="text-right">Qtd</TableHead><TableHead>Un</TableHead>
                  <TableHead>Obs.</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {quantsDoModelo.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>{q.categoria}</TableCell>
                      <TableCell>{q.elemento}</TableCell>
                      <TableCell className="text-right">{Number(q.quantidade).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>{q.unidade}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{q.observacao}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteQuantitativo(q.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {quantsDoModelo.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem quantitativos.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="pranchas" className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setPDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Adicionar Prancha</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Título</TableHead>
                  <TableHead>Escala</TableHead><TableHead>Rev.</TableHead>
                  <TableHead>Data</TableHead><TableHead>Arquivo</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pranchasDoModelo.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.codigo}</TableCell>
                      <TableCell>{p.titulo}</TableCell>
                      <TableCell>{p.escala}</TableCell>
                      <TableCell>{p.revisao}</TableCell>
                      <TableCell>{p.data_revisao ? new Date(p.data_revisao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell>
                        {p.arquivo_url ? <a href={p.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">Abrir</a> : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePrancha(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pranchasDoModelo.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem pranchas.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog Quantitativo */}
      <Dialog open={qDialogOpen} onOpenChange={setQDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Quantitativo</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Categoria</Label><Input value={qForm.categoria} onChange={(e) => setQForm({ ...qForm, categoria: e.target.value })} placeholder="Ex: Paredes, Lajes, Pilares" /></div>
            <div><Label>Elemento</Label><Input value={qForm.elemento} onChange={(e) => setQForm({ ...qForm, elemento: e.target.value })} placeholder="Ex: Parede 15cm bloco cerâmico" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantidade</Label><Input type="number" value={qForm.quantidade} onChange={(e) => setQForm({ ...qForm, quantidade: Number(e.target.value) })} /></div>
              <div><Label>Unidade</Label>
                <Select value={qForm.unidade} onValueChange={(v) => setQForm({ ...qForm, unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["m²", "m³", "m", "ml", "un", "kg", "t", "h"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observação</Label><Textarea value={qForm.observacao} onChange={(e) => setQForm({ ...qForm, observacao: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddQuant}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Prancha */}
      <Dialog open={pDialogOpen} onOpenChange={setPDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Prancha</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={pForm.codigo} onChange={(e) => setPForm({ ...pForm, codigo: e.target.value })} placeholder="Ex: ARQ-01" /></div>
              <div><Label>Revisão</Label><Input value={pForm.revisao} onChange={(e) => setPForm({ ...pForm, revisao: e.target.value })} /></div>
            </div>
            <div><Label>Título</Label><Input value={pForm.titulo} onChange={(e) => setPForm({ ...pForm, titulo: e.target.value })} placeholder="Ex: Planta Baixa - Pavto Térreo" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Escala</Label><Input value={pForm.escala} onChange={(e) => setPForm({ ...pForm, escala: e.target.value })} placeholder="1:50" /></div>
              <div><Label>Data Revisão</Label><Input type="date" value={pForm.data_revisao} onChange={(e) => setPForm({ ...pForm, data_revisao: e.target.value })} /></div>
            </div>
            <div><Label>Arquivo (PDF/DWG)</Label><Input type="file" accept=".pdf,.dwg,.dxf,.png,.jpg" onChange={(e) => setPFile(e.target.files?.[0] || null)} /></div>
            <div><Label>Observação</Label><Textarea value={pForm.observacao} onChange={(e) => setPForm({ ...pForm, observacao: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddPrancha}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) cancelDelete(); }}
        onConfirm={() => {
          if (!podeExcluir) {
            toast.error("Você não possui permissão para excluir modelos BIM.");
            cancelDelete();
            return;
          }
          if (deleteId) { deleteModelo(deleteId); cancelDelete(); }
        }}
      />
    </div>
  );
}

