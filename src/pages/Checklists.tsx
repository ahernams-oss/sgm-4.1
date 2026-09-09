import { useState, useMemo } from "react";
import { useChecklists, Checklist, ChecklistItem, ChecklistPreenchimento, PreenchimentoItem } from "@/contexts/ChecklistsContext";
import { useEvidencias } from "@/contexts/EvidenciasContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Edit, Trash2, ClipboardCheck, Play, Eye, X, CheckCircle2, XCircle, MinusCircle, Camera, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls from "@/components/PaginationControls";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

const CATEGORIAS = ["Inspeção", "Qualidade", "Segurança", "Meio Ambiente", "Operacional", "Auditoria"];

function calcPercentual(itens: PreenchimentoItem[]): number {
  const avaliados = itens.filter(i => i.status === "Conforme" || i.status === "Não Conforme");
  if (avaliados.length === 0) return 0;
  const conformes = avaliados.filter(i => i.status === "Conforme").length;
  return Math.round((conformes / avaliados.length) * 100);
}

export default function ChecklistsPage() {
  const { checklists, preenchimentos, loading, addChecklist, updateChecklist, deleteChecklist, addPreenchimento, updatePreenchimento, deletePreenchimento } = useChecklists();
  const { evidencias } = useEvidencias();
  const { usuarioLogado } = useAuth();

  const { tem } = usePermissao();
  const podeCriar = tem("checklists.criar");
  const podeEditar = tem("checklists.editar");
  const podeExcluir = tem("checklists.excluir");
  const podePreencher = tem("checklists.preencher");
  const podeAprovar = tem("checklists.aprovar");

  const [activeTab, setActiveTab] = useState("templates");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Checklist | null>(null);
  const [templateForm, setTemplateForm] = useState({ titulo: "", descricao: "", categoria: "", itens: [{ descricao: "" }] as ChecklistItem[] });

  // Preenchimento dialog
  const [preenchDialogOpen, setPreenchDialogOpen] = useState(false);
  const [editingPreench, setEditingPreench] = useState<ChecklistPreenchimento | null>(null);
  const [preenchForm, setPreenchForm] = useState<{
    checklist_id: string; evidencia_id: string; itens: PreenchimentoItem[]; observacoes: string;
  }>({ checklist_id: "", evidencia_id: "", itens: [], observacoes: "" });

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewing, setViewing] = useState<ChecklistPreenchimento | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"template" | "preenchimento">("template");

  // --- Template handlers ---
  const emptyItem = (): ChecklistItem => ({ descricao: "", quantidade: "", registro_fotografico: false });

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ titulo: "", descricao: "", categoria: "", itens: [emptyItem()] });
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (c: Checklist) => {
    setEditingTemplate(c);
    setTemplateForm({ titulo: c.titulo, descricao: c.descricao, categoria: c.categoria, itens: c.itens?.length ? c.itens.map(i => ({ descricao: i.descricao || "", quantidade: i.quantidade || "", registro_fotografico: i.registro_fotografico || false })) : [emptyItem()] });
    setTemplateDialogOpen(true);
  };

  const saveTemplate = async () => {
    if (editingTemplate ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    const cleanItens = templateForm.itens.filter(i => i.descricao.trim());
    if (!templateForm.titulo.trim() || cleanItens.length === 0) return;
    const payload = { ...templateForm, itens: cleanItens };
    if (editingTemplate) {
      await updateChecklist(editingTemplate.id, payload);
    } else {
      await addChecklist(payload);
    }
    setTemplateDialogOpen(false);
  };

  const addTemplateItem = () => setTemplateForm(f => ({ ...f, itens: [...f.itens, emptyItem()] }));
  const removeTemplateItem = (idx: number) => setTemplateForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  const updateTemplateItemField = (idx: number, field: keyof ChecklistItem, val: any) => setTemplateForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  // --- Preenchimento handlers ---
  const openNewPreench = () => {
    setEditingPreench(null);
    setPreenchForm({ checklist_id: "", evidencia_id: "", itens: [], observacoes: "" });
    setPreenchDialogOpen(true);
  };

  const openEditPreench = (p: ChecklistPreenchimento) => {
    setEditingPreench(p);
    setPreenchForm({ checklist_id: p.checklist_id, evidencia_id: p.evidencia_id || "", itens: p.itens, observacoes: p.observacoes });
    setPreenchDialogOpen(true);
  };

  const handleSelectChecklist = (checklistId: string) => {
    const tpl = checklists.find(c => c.id === checklistId);
    if (!tpl) return;
    const itens: PreenchimentoItem[] = tpl.itens.map(i => ({ descricao: i.descricao, quantidade: i.quantidade || "", registro_fotografico: i.registro_fotografico || false, status: "", foto_url: "" }));
    setPreenchForm(f => ({ ...f, checklist_id: checklistId, itens }));
  };

  const updatePreenchItem = (idx: number, status: PreenchimentoItem["status"]) => {
    setPreenchForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, status } : it) }));
  };

  const savePreench = async () => {
    if (!podePreencher) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!preenchForm.checklist_id || preenchForm.itens.length === 0) return;
    const tpl = checklists.find(c => c.id === preenchForm.checklist_id);
    const ev = evidencias.find(e => e.id === preenchForm.evidencia_id);
    const perc = calcPercentual(preenchForm.itens);
    const allFilled = preenchForm.itens.every(i => i.status !== "");
    const payload = {
      ...preenchForm,
      checklist_titulo: tpl?.titulo || "",
      evidencia_titulo: ev?.titulo || "",
      percentual_conformidade: perc,
      responsavel: usuarioLogado?.nome || "",
      status: allFilled ? "Concluído" : "Pendente",
    };
    if (editingPreench) {
      await updatePreenchimento(editingPreench.id, payload);
    } else {
      await addPreenchimento(payload);
    }
    setPreenchDialogOpen(false);
  };

  // --- Filtering ---
  const filteredTemplates = useMemo(() => {
    return checklists.filter(c =>
      !search || c.titulo.toLowerCase().includes(search.toLowerCase()) || c.categoria?.toLowerCase().includes(search.toLowerCase())
    );
  }, [checklists, search]);

  const filteredPreench = useMemo(() => {
    return preenchimentos.filter(p =>
      !search || p.checklist_titulo?.toLowerCase().includes(search.toLowerCase()) || p.evidencia_titulo?.toLowerCase().includes(search.toLowerCase())
    );
  }, [preenchimentos, search]);

  const paginatedTemplates = filteredTemplates.slice((page - 1) * pageSize, page * pageSize);
  const paginatedPreench = filteredPreench.slice((page - 1) * pageSize, page * pageSize);

  const handleDelete = async () => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); setDeleteId(null); return; }
    if (!deleteId) return;
    if (deleteType === "template") await deleteChecklist(deleteId);
    else await deletePreenchimento(deleteId);
    setDeleteId(null);
  };

  const percColor = (p: number) => {
    if (p >= 80) return "text-green-700 bg-green-100";
    if (p >= 50) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  if (loading) return <div className="flex justify-center items-center h-64"><span className="text-muted-foreground">Carregando...</span></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Checklists</h1>
          <p className="text-muted-foreground text-sm">Gerencie templates e preenchimentos de checklists vinculados a evidências</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Templates</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{checklists.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Preenchimentos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{preenchimentos.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Concluídos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{preenchimentos.filter(p => p.status === "Concluído").length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Média Conformidade</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{preenchimentos.length ? Math.round(preenchimentos.reduce((a, p) => a + (p.percentual_conformidade || 0), 0) / preenchimentos.length) : 0}%</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); setSearch(""); }}>
        <TabsList>
          <TabsTrigger value="templates">Templates de Checklist</TabsTrigger>
          <TabsTrigger value="preenchimentos">Preenchimentos</TabsTrigger>
        </TabsList>

        {/* === TEMPLATES TAB === */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {podeCriar && <Button onClick={openNewTemplate}><Plus className="h-4 w-4 mr-1" />Novo Template</Button>}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-center">Usos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTemplates.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum template encontrado</TableCell></TableRow>
                ) : paginatedTemplates.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.titulo}</TableCell>
                    <TableCell><Badge variant="outline">{c.categoria || "—"}</Badge></TableCell>
                    <TableCell className="text-center">{c.itens?.length || 0}</TableCell>
                    <TableCell className="text-center">{preenchimentos.filter(p => p.checklist_id === c.id).length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {podeEditar && <Button size="icon" variant="ghost" title="Editar" onClick={() => openEditTemplate(c)}><Edit className="h-4 w-4" /></Button>}
                        {podePreencher && <Button size="icon" variant="ghost" title="Preencher" onClick={() => { setPreenchForm({ checklist_id: c.id, evidencia_id: "", itens: c.itens.map(i => ({ descricao: i.descricao, quantidade: i.quantidade || "", registro_fotografico: i.registro_fotografico || false, status: "", foto_url: "" })), observacoes: "" }); setEditingPreench(null); setPreenchDialogOpen(true); }}><Play className="h-4 w-4" /></Button>}
                        {podeExcluir && <Button size="icon" variant="ghost" className="text-destructive" title="Excluir" onClick={() => { setDeleteId(c.id); setDeleteType("template"); }}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredTemplates.length > pageSize && <PaginationControls currentPage={page} totalItems={filteredTemplates.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
        </TabsContent>

        {/* === PREENCHIMENTOS TAB === */}
        <TabsContent value="preenchimentos" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar preenchimentos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {podePreencher && <Button onClick={openNewPreench}><Plus className="h-4 w-4 mr-1" />Novo Preenchimento</Button>}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checklist</TableHead>
                  <TableHead>Evidência Vinculada</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-center">Conformidade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPreench.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum preenchimento encontrado</TableCell></TableRow>
                ) : paginatedPreench.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.checklist_titulo}</TableCell>
                    <TableCell>{p.evidencia_titulo || "—"}</TableCell>
                    <TableCell>{p.responsavel}</TableCell>
                    <TableCell className="text-center"><Badge className={percColor(p.percentual_conformidade)}>{p.percentual_conformidade}%</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant={p.status === "Concluído" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Visualizar" onClick={() => { setViewing(p); setViewDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        {podePreencher && <Button size="icon" variant="ghost" title="Editar" onClick={() => openEditPreench(p)}><Edit className="h-4 w-4" /></Button>}
                        {podeExcluir && <Button size="icon" variant="ghost" className="text-destructive" title="Excluir" onClick={() => { setDeleteId(p.id); setDeleteType("preenchimento"); }}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredPreench.length > pageSize && <PaginationControls currentPage={page} totalItems={filteredPreench.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
        </TabsContent>
      </Tabs>

      {/* === TEMPLATE DIALOG === */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template de Checklist"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Título *</Label><Input value={templateForm.titulo} onChange={e => setTemplateForm(f => ({ ...f, titulo: e.target.value }))} /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={templateForm.categoria} onValueChange={v => setTemplateForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea value={templateForm.descricao} onChange={e => setTemplateForm(f => ({ ...f, descricao: e.target.value }))} rows={2} /></div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Itens do Checklist</Label>
                <Button size="sm" variant="outline" onClick={addTemplateItem}><Plus className="h-3 w-3 mr-1" />Adicionar Item</Button>
              </div>
              <div className="space-y-3">
                {templateForm.itens.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                    <span className="text-xs text-muted-foreground w-6 text-right mt-2.5">{idx + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <Input value={item.descricao} onChange={e => updateTemplateItemField(idx, "descricao", e.target.value)} placeholder="Descrição do item" />
                      <div className="flex gap-3 items-center">
                        <div className="flex-1">
                          <Input value={item.quantidade} onChange={e => updateTemplateItemField(idx, "quantidade", e.target.value)} placeholder="Quantidade (ex: 5 un)" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={item.registro_fotografico} onCheckedChange={(v) => updateTemplateItemField(idx, "registro_fotografico", !!v)} id={`foto-${idx}`} />
                          <Label htmlFor={`foto-${idx}`} className="text-xs whitespace-nowrap cursor-pointer flex items-center gap-1"><Camera className="h-3 w-3" />Registro Fotográfico</Label>
                        </div>
                      </div>
                    </div>
                    {templateForm.itens.length > 1 && (
                      <Button size="icon" variant="ghost" className="text-destructive shrink-0 mt-1" onClick={() => removeTemplateItem(idx)}><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveTemplate} disabled={!templateForm.titulo.trim() || !templateForm.itens.some(i => i.descricao.trim())}>{editingTemplate ? "Salvar Alterações" : "Criar Template"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* === PREENCHIMENTO DIALOG === */}
      <Dialog open={preenchDialogOpen} onOpenChange={setPreenchDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPreench ? "Editar Preenchimento" : "Preencher Checklist"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Template de Checklist *</Label>
                <Select value={preenchForm.checklist_id} onValueChange={handleSelectChecklist} disabled={!!editingPreench}>
                  <SelectTrigger><SelectValue placeholder="Selecione o checklist" /></SelectTrigger>
                  <SelectContent>{checklists.map(c => <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vincular a Evidência</Label>
                <Select value={preenchForm.evidencia_id} onValueChange={v => setPreenchForm(f => ({ ...f, evidencia_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {evidencias.map(e => <SelectItem key={e.id} value={e.id}>#{e.numero} - {e.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {preenchForm.itens.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Itens ({preenchForm.itens.filter(i => i.status).length}/{preenchForm.itens.length} avaliados)</Label>
                  <Badge className={percColor(calcPercentual(preenchForm.itens))}>{calcPercentual(preenchForm.itens)}% Conforme</Badge>
                </div>
                <div className="space-y-2">
                  {preenchForm.itens.map((item, idx) => (
                    <div key={idx} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6 text-right font-medium">{idx + 1}.</span>
                        <span className="flex-1 text-sm font-medium">{item.descricao}</span>
                        <div className="flex gap-1">
                          <Button size="sm" variant={item.status === "Conforme" ? "default" : "outline"} className={item.status === "Conforme" ? "bg-green-600 hover:bg-green-700" : ""} onClick={() => updatePreenchItem(idx, "Conforme")} title="Conforme">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant={item.status === "Não Conforme" ? "default" : "outline"} className={item.status === "Não Conforme" ? "bg-red-600 hover:bg-red-700" : ""} onClick={() => updatePreenchItem(idx, "Não Conforme")} title="Não Conforme">
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant={item.status === "N/A" ? "default" : "outline"} className={item.status === "N/A" ? "bg-gray-600 hover:bg-gray-700" : ""} onClick={() => updatePreenchItem(idx, "N/A")} title="Não Aplicável">
                            <MinusCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 ml-9">
                        {item.quantidade && <span className="text-xs text-muted-foreground">Qtd: <strong>{item.quantidade}</strong></span>}
                        {item.registro_fotografico && (
                          <div className="flex items-center gap-2">
                            <Camera className="h-3 w-3 text-muted-foreground" />
                            {item.foto_url ? (
                              <a href={item.foto_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver foto</a>
                            ) : (
                              <label className="text-xs text-primary cursor-pointer flex items-center gap-1 hover:underline">
                                <Upload className="h-3 w-3" />Enviar foto
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const path = `checklist-fotos/${Date.now()}-${file.name}`;
                                  const { error } = await supabase.storage.from("evidencias-anexos").upload(path, file);
                                  if (error) return;
                                  const { data: urlData } = supabase.storage.from("evidencias-anexos").getPublicUrl(path);
                                  setPreenchForm(f => ({ ...f, itens: f.itens.map((it, i) => i === idx ? { ...it, foto_url: urlData.publicUrl } : it) }));
                                }} />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div><Label>Observações</Label><Textarea value={preenchForm.observacoes} onChange={e => setPreenchForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPreenchDialogOpen(false)}>Cancelar</Button>
              <Button onClick={savePreench} disabled={!preenchForm.checklist_id || preenchForm.itens.length === 0}>{editingPreench ? "Salvar Alterações" : "Salvar Preenchimento"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* === VIEW DIALOG === */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do Preenchimento</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Checklist:</span> <strong>{viewing.checklist_titulo}</strong></div>
                <div><span className="text-muted-foreground">Evidência:</span> <strong>{viewing.evidencia_titulo || "—"}</strong></div>
                <div><span className="text-muted-foreground">Responsável:</span> <strong>{viewing.responsavel}</strong></div>
                <div><span className="text-muted-foreground">Conformidade:</span> <Badge className={percColor(viewing.percentual_conformidade)}>{viewing.percentual_conformidade}%</Badge></div>
              </div>
              <div className="space-y-2">
                {viewing.itens?.map((item: PreenchimentoItem, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6 text-right">{idx + 1}.</span>
                      <span className="flex-1 text-sm">{item.descricao}</span>
                      {item.status === "Conforme" && <Badge className="bg-green-100 text-green-800">Conforme</Badge>}
                      {item.status === "Não Conforme" && <Badge className="bg-red-100 text-red-800">Não Conforme</Badge>}
                      {item.status === "N/A" && <Badge variant="secondary">N/A</Badge>}
                      {!item.status && <Badge variant="outline">—</Badge>}
                    </div>
                    <div className="flex items-center gap-4 ml-9">
                      {item.quantidade && <span className="text-xs text-muted-foreground">Qtd: <strong>{item.quantidade}</strong></span>}
                      {item.foto_url && (
                        <a href={item.foto_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1"><Camera className="h-3 w-3" />Ver foto</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {viewing.observacoes && <div><Label className="text-muted-foreground">Observações</Label><p className="text-sm mt-1">{viewing.observacoes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  );
}
