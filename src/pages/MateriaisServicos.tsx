import { useState, useMemo } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useMateriaisServicos, MaterialServico } from "@/contexts/MateriaisServicosContext";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Upload, FileText, FileSpreadsheet, Camera, X, Image, ShieldAlert, AlertTriangle } from "lucide-react";
import { gerarPdfMateriaisServicos, gerarExcelMateriaisServicos } from "@/lib/gerarRelatorioMateriaisServicos";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import type { ReactNode } from "react";
import { usePermissao } from "@/hooks/usePermissao";
import { guardDuplicates, scanDuplicatesGrouped, type DuplicateMatch, type GroupedDuplicatePair } from "@/lib/duplicateDetection";
import { DuplicateWarningDialog, DuplicateAnalysisDialog } from "@/components/DuplicateDialogs";
import { Badge } from "@/components/ui/badge";
import { cn as cn2 } from "@/lib/utils";
import VinculosScoDialog from "@/components/VinculosScoDialog";
import { useMaterialScoVinculos } from "@/contexts/MaterialScoVinculosContext";
import { Link2 } from "lucide-react";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const UNIDADES = ["UN", "M", "M²", "M³", "KG", "L", "CX", "PCT", "SC", "GL", "HR", "VB", "JG", "PR", "RL", "TB", "FD", "BD", "CJ", "DZ"];

export default function MateriaisServicosPage() {
  const { materiais, addMaterial, updateMaterial, deleteMaterial } = useMateriaisServicos();
  const { classes, getDescricaoCompleta } = useCategoriasCompras();
  const { getVinculos } = useMaterialScoVinculos();
  const [vinculosMaterial, setVinculosMaterial] = useState<MaterialServico | null>(null);
  const { tem } = usePermissao();
  const podeCriar = tem("materiais_servicos.criar");
  const podeEditar = tem("materiais_servicos.editar");
  const podeExcluir = tem("materiais_servicos.excluir");
  const podeExportar = tem("materiais_servicos.exportar");

  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ descricao: "", tipo: "Material" as "Material" | "Serviço", unidadeMedida: "UN", categoriaId: "", estoqueMinimo: 0, fotos: [] as string[] });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const colDefs: Record<string, { label: string; className?: string }> = {
    codigo: { label: "Código", className: "text-center" },
    descricao: { label: "Descrição" },
    tipo: { label: "Tipo", className: "text-center" },
    unidade: { label: "Unidade", className: "text-center" },
    fotos: { label: "Fotos", className: "text-center" },
    categoria: { label: "Categoria" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "compras.materiais",
    ["codigo", "descricao", "tipo", "unidade", "fotos", "categoria"]
  );

  const filtered = useMemo(() => {
    let list = materiais;
    if (filterTipo !== "Todos") list = list.filter(m => m.tipo === filterTipo);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(m => m.codigo.toLowerCase().includes(s) || m.descricao.toLowerCase().includes(s));
    }
    return list;
  }, [materiais, search, filterTipo]);

  // Reset page when filters change
  const resetPage = () => setPage(1);

  const openNew = () => { setForm({ descricao: "", tipo: "Material", unidadeMedida: "UN", categoriaId: "", estoqueMinimo: 0, fotos: [] }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (m: MaterialServico) => { setForm({ descricao: m.descricao, tipo: m.tipo, unidadeMedida: m.unidadeMedida, categoriaId: m.categoriaId, estoqueMinimo: m.estoqueMinimo, fotos: m.fotos || [] }); setEditingId(m.id); setDialogOpen(true); };

  const [dupWarn, setDupWarn] = useState<{ open: boolean; matches: DuplicateMatch<MaterialServico>[]; onConfirm: () => void }>({ open: false, matches: [], onConfirm: () => {} });
  const [analiseOpen, setAnaliseOpen] = useState(false);

  const persistSave = () => {
    if (editingId) {
      updateMaterial(editingId, { ...form, fabricanteId: "" });
      toast({ title: "Material/Serviço atualizado" });
    } else {
      addMaterial({ ...form, fabricanteId: "" });
      toast({ title: "Material/Serviço criado" });
    }
    setDialogOpen(false);
  };

  const handleSave = () => {
    if (!form.descricao.trim()) { toast({ title: "Descrição é obrigatória", variant: "destructive" }); return; }
    if (editingId ? !podeEditar : !podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    // Duplicidade: escopo pelo mesmo tipo (Material vs Serviço)
    const escopo = materiais.filter(m => m.tipo === form.tipo);
    guardDuplicates({
      candidate: { nome: form.descricao }, list: escopo,
      options: { nome: (m) => m.descricao, ignoreId: (m) => m.id === editingId },
      onExact: (m) => toast({ title: `Já existe ${form.tipo.toLowerCase()} com esta descrição: ${m.item.codigo} - ${m.item.descricao}`, variant: "destructive" }),
      onSimilar: (matches) => setDupWarn({ open: true, matches, onConfirm: persistSave }),
      onOk: persistSave,
    });
  };

  const analiseResultados = useMemo<GroupedDuplicatePair<MaterialServico>[]>(() => {
    if (!analiseOpen) return [];
    return scanDuplicatesGrouped(
      (["Material", "Serviço"] as const).map((tipo) => ({
        contexto: tipo,
        items: materiais.filter((m) => m.tipo === tipo),
      })),
      { nome: (m) => m.descricao }
    );
  }, [analiseOpen, materiais]);

  const handleImport = (file: File) => {
    if (!podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();
    if (ext === "csv" || ext === "txt") {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(l => l.trim());
        let count = 0;
        for (const line of lines) {
          const cols = line.split(/[;\t,]/).map(c => c.trim());
          if (cols[0]?.toLowerCase().includes("cod")) continue;
          if (cols.length >= 2) {
            addMaterial({ descricao: cols[1] || cols[0] || "", tipo: (cols[2] === "Serviço" ? "Serviço" : "Material"), unidadeMedida: cols[3] || "UN", categoriaId: cols[4] || "", fabricanteId: "", estoqueMinimo: 0, fotos: [] });
            count++;
          }
        }
        toast({ title: `${count} itens importados` });
      };
      reader.readAsText(file);
    } else {
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = (await getXLSX()).read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = (await getXLSX()).utils.sheet_to_json(ws, { header: 1 });
        let count = 0;
        for (const row of rows) {
          if (String(row[0] || "").toLowerCase().includes("cod")) continue;
          if (row.length >= 2) {
            addMaterial({ descricao: String(row[1] || row[0] || ""), tipo: (String(row[2] || "") === "Serviço" ? "Serviço" : "Material"), unidadeMedida: String(row[3] || "UN"), categoriaId: String(row[4] || ""), fabricanteId: "", estoqueMinimo: 0, fotos: [] });
            count++;
          }
        }
        toast({ title: `${count} itens importados` });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (form.fotos.length >= 5) { toast({ title: "Máximo de 5 fotos atingido", variant: "destructive" }); return; }
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop();
    const path = `materiais-fotos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("evidencias-anexos").upload(path, file);
    if (error) { toast({ title: "Erro no upload", variant: "destructive" }); setUploadingPhoto(false); return; }
    const { data: urlData } = supabase.storage.from("evidencias-anexos").getPublicUrl(path);
    setForm(f => ({ ...f, fotos: [...f.fotos, urlData.publicUrl] }));
    setUploadingPhoto(false);
  };

  const removePhoto = (index: number) => {
    setForm(f => ({ ...f, fotos: f.fotos.filter((_, i) => i !== index) }));
  };

  const catNome = (id: string) => id ? getDescricaoCompleta(id) || "-" : "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Materiais e Serviços</h1>
        <div className="flex gap-2">
          {podeExportar && <Button variant="outline" onClick={async () => { await gerarPdfMateriaisServicos({ materiais: filtered, getCatNome: catNome }); }}><FileText className="mr-2 h-4 w-4" />PDF</Button>}
          {podeExportar && <Button variant="outline" onClick={() => gerarExcelMateriaisServicos({ materiais: filtered, getCatNome: catNome })}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>}
          <Button variant="outline" onClick={() => setAnaliseOpen(true)}><ShieldAlert className="mr-2 h-4 w-4" />Analisar Duplicidades</Button>
          {podeCriar && <Button variant="outline" onClick={() => document.getElementById("import-mat")?.click()}><Upload className="mr-2 h-4 w-4" />Importar</Button>}
          <input id="import-mat" type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ""; }} />
          {podeCriar && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo</Button>}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} className="pl-9" />
        </div>
        <Select value={filterTipo} onValueChange={v => { setFilterTipo(v); resetPage(); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            <SelectItem value="Material">Material</SelectItem>
            <SelectItem value="Serviço">Serviço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
        <Table>
          <TableHeader>
            <TableRow>
              {colOrder.map(key => {
                const cd = colDefs[key];
                return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
              })}
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {paginate(filtered, page, pageSize).paginated.length === 0 ? (
              <TableRow><TableCell colSpan={colOrder.length + 1} className="text-center text-muted-foreground py-8">Nenhum item cadastrado</TableCell></TableRow>
            ) : paginate(filtered, page, pageSize).paginated.map(m => {
              const cellMap: Record<string, ReactNode> = {
                codigo: <span className="font-mono">{m.codigo}</span>,
                descricao: m.descricao,
                tipo: m.tipo,
                unidade: m.unidadeMedida,
                fotos: (m.fotos?.length || 0) > 0 ? <span className="flex items-center gap-1 text-primary"><Camera className="h-3.5 w-3.5" />{m.fotos.length}</span> : "-",
                categoria: catNome(m.categoriaId),
              };
              return (
              <TableRow key={m.id}>
                {colOrder.map(key => <TableCell key={key} className={colDefs[key]?.className}>{cellMap[key]}</TableCell>)}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Vínculos SCO" onClick={() => setVinculosMaterial(m)}>
                      <Link2 className={cn2(getVinculos(m.id).length > 0 ? "text-primary" : "text-muted-foreground", "h-4 w-4")} />
                    </Button>
                    {podeEditar && <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>}
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </SortableHeaderRow>
      </div>

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Material/Serviço</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição obrigatória" /></div>
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Material">Material</SelectItem><SelectItem value="Serviço">Serviço</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Unidade de Medida</Label>
              <Select value={form.unidadeMedida} onValueChange={v => setForm(f => ({ ...f, unidadeMedida: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Categoria</Label>
              <Select value={form.categoriaId} onValueChange={v => setForm(f => ({ ...f, categoriaId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{getDescricaoCompleta(c.id)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.tipo !== "Serviço" && (
              <div><Label>Estoque Mínimo</Label><Input type="number" min="0" value={form.estoqueMinimo} onChange={e => setForm(f => ({ ...f, estoqueMinimo: Number(e.target.value) }))} placeholder="0" /></div>
            )}
            <div>
              <Label className="flex items-center gap-2"><Camera className="h-4 w-4" />Fotos ({form.fotos.length}/5)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.fotos.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-border group">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {form.fotos.length < 5 && (
                  <label className="w-20 h-20 rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    {uploadingPhoto ? <span className="text-xs text-muted-foreground">...</span> : <><Image className="h-5 w-5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground mt-1">Adicionar</span></>}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={e => { if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={() => { if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); cancelDelete(); return; } if (deleteId) { deleteMaterial(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />

      <DuplicateWarningDialog
        open={dupWarn.open}
        onOpenChange={(o) => setDupWarn((s) => ({ ...s, open: o }))}
        matches={dupWarn.matches}
        onConfirm={dupWarn.onConfirm}
        getCodigo={(m) => m.codigo}
        getNome={(m) => m.descricao}
      />

      <DuplicateAnalysisDialog
        open={analiseOpen}
        onOpenChange={setAnaliseOpen}
        title="Análise de Duplicidades — Materiais e Serviços"
        pairs={analiseResultados}
        showContext
        getCodigo={(m) => m.codigo}
        getNome={(m) => m.descricao}
      />

      <VinculosScoDialog material={vinculosMaterial} open={!!vinculosMaterial} onOpenChange={(v) => { if (!v) setVinculosMaterial(null); }} readOnly={!podeEditar} />
    </div>
  );
}
