import { useState, useMemo } from "react";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ChevronRight, ShieldAlert, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import type { ReactNode } from "react";
import { usePermissao } from "@/hooks/usePermissao";
import { guardDuplicates, scanDuplicatesGrouped, type DuplicateMatch, type GroupedDuplicatePair } from "@/lib/duplicateDetection";
import { DuplicateWarningDialog, DuplicateAnalysisDialog } from "@/components/DuplicateDialogs";

import SubGrupoCombobox, { type SubGrupoOption } from "@/components/SubGrupoCombobox";

export default function CategoriasCompras() {
  const {
    grupos, subGrupos, classes,
    addGrupo, updateGrupo, deleteGrupo,
    addSubGrupo, updateSubGrupo, deleteSubGrupo,
    addClasse, updateClasse, deleteClasse,
    getCodigoCompleto,
  } = useCategoriasCompras();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriar = tem("categorias_compras.criar");
  const podeEditar = tem("categorias_compras.editar");
  const podeExcluir = tem("categorias_compras.excluir");
  const guard = (ok: boolean) => { if (!ok) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return false; } return true; };

  const [activeTab, setActiveTab] = useState("grupos");
  const [search, setSearch] = useState("");
  const [pageGrupos, setPageGrupos] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageSubs, setPageSubs] = useState(1);
  const [pageClasses, setPageClasses] = useState(1);

  // Grupo dialog
  const [grupoDialog, setGrupoDialog] = useState(false);
  const [editGrupoId, setEditGrupoId] = useState<string | null>(null);
  const [grupoForm, setGrupoForm] = useState({ codigo: "", nome: "" });

  // SubGrupo dialog
  const [subDialog, setSubDialog] = useState(false);
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState({ grupoId: "", codigo: "", nome: "" });

  // Classe dialog
  const [classeDialog, setClasseDialog] = useState(false);
  const [editClasseId, setEditClasseId] = useState<string | null>(null);
  const [classeForm, setClasseForm] = useState({ subGrupoId: "", codigo: "", nome: "" });
  const subGrupoOptions = useMemo<SubGrupoOption[]>(() => subGrupos.map(s => {
    const g = grupos.find(gr => gr.id === s.grupoId);
    return { id: s.id, codigo: s.codigo, nome: s.nome, grupoCodigo: g?.codigo ?? "", grupoNome: g?.nome ?? "" };
  }).sort((a, b) => `${a.grupoCodigo}.${a.codigo}`.localeCompare(`${b.grupoCodigo}.${b.codigo}`)), [subGrupos, grupos]);

  // Filter
  const [filterGrupoId, setFilterGrupoId] = useState<string>("all");
  const [filterSubGrupoId, setFilterSubGrupoId] = useState<string>("all");

  const colDefsGrupos: Record<string, { label: string; className?: string }> = {
    codigo: { label: "Código", className: "w-28 text-center" },
    nome: { label: "Nome" },
    subgrupos: { label: "SubGrupos", className: "w-20 text-center" },
  };
  const { order: colOrderGrupos, setOrder: setColOrderGrupos } = useColumnOrder(
    "compras.categorias.grupos",
    ["codigo", "nome", "subgrupos"]
  );

  const colDefsSubs: Record<string, { label: string; className?: string }> = {
    codigo: { label: "Código", className: "w-28 text-center" },
    nome: { label: "Nome" },
    grupo: { label: "Grupo" },
    classes: { label: "Classes", className: "w-20 text-center" },
  };
  const { order: colOrderSubs, setOrder: setColOrderSubs } = useColumnOrder(
    "compras.categorias.subgrupos",
    ["codigo", "nome", "grupo", "classes"]
  );

  const colDefsClasses: Record<string, { label: string; className?: string }> = {
    codigoCompleto: { label: "Código Completo", className: "w-36 text-center" },
    codigo: { label: "Código", className: "w-20 text-center" },
    nome: { label: "Nome" },
    subgrupo: { label: "SubGrupo" },
    grupo: { label: "Grupo" },
  };
  const { order: colOrderClasses, setOrder: setColOrderClasses } = useColumnOrder(
    "compras.categorias.classes",
    ["codigoCompleto", "codigo", "nome", "subgrupo", "grupo"]
  );

  // === GRUPO ===
  const filteredGrupos = useMemo(() => {
    if (!search) return grupos;
    const s = search.toLowerCase();
    return grupos.filter(g => g.codigo.toLowerCase().includes(s) || g.nome.toLowerCase().includes(s));
  }, [grupos, search]);

  // === DUPLICIDADE ===
  type Tipo = "grupo" | "subgrupo" | "classe";
  const [dupWarn, setDupWarn] = useState<{
    open: boolean;
    tipo: Tipo;
    matches: DuplicateMatch<any>[];
    onConfirm: () => void;
  }>({ open: false, tipo: "grupo", matches: [], onConfirm: () => {} });
  const [analiseDialog, setAnaliseDialog] = useState<{ open: boolean; tipo: Tipo }>({ open: false, tipo: "grupo" });

  const askDuplicates = (tipo: Tipo, matches: DuplicateMatch<any>[], onConfirm: () => void) => {
    setDupWarn({ open: true, tipo, matches, onConfirm });
  };

  const openNewGrupo = () => { setGrupoForm({ codigo: "", nome: "" }); setEditGrupoId(null); setGrupoDialog(true); };
  const openEditGrupo = (g: typeof grupos[0]) => { setGrupoForm({ codigo: g.codigo, nome: g.nome }); setEditGrupoId(g.id); setGrupoDialog(true); };
  const persistGrupo = () => {
    if (editGrupoId) { if (!guard(podeEditar)) return; updateGrupo(editGrupoId, grupoForm); toast({ title: "Grupo atualizado" }); }
    else { if (!guard(podeCriar)) return; addGrupo(grupoForm); toast({ title: "Grupo criado" }); }
    setGrupoDialog(false);
  };
  const saveGrupo = () => {
    if (!grupoForm.codigo.trim() || !grupoForm.nome.trim()) { toast({ title: "Código e Nome são obrigatórios", variant: "destructive" }); return; }
    guardDuplicates({
      candidate: grupoForm, list: grupos,
      options: { nome: (g) => g.nome, codigo: (g) => g.codigo, ignoreId: (g) => g.id === editGrupoId },
      onExact: (m) => toast({ title: `Grupo já cadastrado (${m.campo}): ${m.item.codigo} - ${m.item.nome}`, variant: "destructive" }),
      onSimilar: (matches) => askDuplicates("grupo", matches, persistGrupo),
      onOk: persistGrupo,
    });
  };

  // === SUBGRUPO ===
  const filteredSubs = useMemo(() => {
    let list = subGrupos;
    if (filterGrupoId !== "all") list = list.filter(s => s.grupoId === filterGrupoId);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(sg => sg.codigo.toLowerCase().includes(s) || sg.nome.toLowerCase().includes(s));
    }
    return list;
  }, [subGrupos, search, filterGrupoId]);

  const nextSubCodigo = (grupoId: string) => {
    const max = subGrupos
      .filter(s => s.grupoId === grupoId)
      .reduce((acc, s) => Math.max(acc, parseInt(String(s.codigo).replace(/\D/g, ""), 10) || 0), 0);
    return String(max + 1).padStart(3, "0");
  };
  const openNewSub = () => { const gid = grupos[0]?.id || ""; setSubForm({ grupoId: gid, codigo: gid ? nextSubCodigo(gid) : "", nome: "" }); setEditSubId(null); setSubDialog(true); };
  const openEditSub = (s: typeof subGrupos[0]) => { setSubForm({ grupoId: s.grupoId, codigo: s.codigo, nome: s.nome }); setEditSubId(s.id); setSubDialog(true); };

  const persistSub = () => {
    if (editSubId) { if (!guard(podeEditar)) return; updateSubGrupo(editSubId, subForm); toast({ title: "SubGrupo atualizado" }); }
    else { if (!guard(podeCriar)) return; addSubGrupo(subForm); toast({ title: "SubGrupo criado" }); }
    setSubDialog(false);
  };
  const saveSub = () => {
    if (!subForm.grupoId || !subForm.codigo.trim() || !subForm.nome.trim()) { toast({ title: "Grupo, Código e Nome são obrigatórios", variant: "destructive" }); return; }
    const escopo = subGrupos.filter(s => s.grupoId === subForm.grupoId);
    guardDuplicates({
      candidate: subForm, list: escopo,
      options: { nome: (s) => s.nome, codigo: (s) => s.codigo, ignoreId: (s) => s.id === editSubId },
      onExact: (m) => toast({ title: `SubGrupo já cadastrado neste grupo (${m.campo}): ${m.item.codigo} - ${m.item.nome}`, variant: "destructive" }),
      onSimilar: (matches) => askDuplicates("subgrupo", matches, persistSub),
      onOk: persistSub,
    });
  };

  // === CLASSE ===
  const filteredClasses = useMemo(() => {
    let list = classes;
    if (filterSubGrupoId !== "all") list = list.filter(c => c.subGrupoId === filterSubGrupoId);
    else if (filterGrupoId !== "all") {
      const subIds = subGrupos.filter(s => s.grupoId === filterGrupoId).map(s => s.id);
      list = list.filter(c => subIds.includes(c.subGrupoId));
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(cl => cl.codigo.toLowerCase().includes(s) || cl.nome.toLowerCase().includes(s));
    }
    return list;
  }, [classes, subGrupos, search, filterGrupoId, filterSubGrupoId]);

  const nextClasseCodigo = (subGrupoId: string) => {
    const max = classes
      .filter(c => c.subGrupoId === subGrupoId)
      .reduce((acc, c) => Math.max(acc, parseInt(String(c.codigo).replace(/\D/g, ""), 10) || 0), 0);
    return String(max + 1).padStart(3, "0");
  };
  const openNewClasse = () => { const sid = subGrupos[0]?.id || ""; setClasseForm({ subGrupoId: sid, codigo: sid ? nextClasseCodigo(sid) : "", nome: "" }); setEditClasseId(null); setClasseDialog(true); };
  const openEditClasse = (c: typeof classes[0]) => { setClasseForm({ subGrupoId: c.subGrupoId, codigo: c.codigo, nome: c.nome }); setEditClasseId(c.id); setClasseDialog(true); };
  const persistClasse = () => {
    if (editClasseId) { if (!guard(podeEditar)) return; updateClasse(editClasseId, classeForm); toast({ title: "Classe atualizada" }); }
    else { if (!guard(podeCriar)) return; addClasse(classeForm); toast({ title: "Classe criada" }); }
    setClasseDialog(false);
  };
  const saveClasse = () => {
    if (!classeForm.subGrupoId || !classeForm.codigo.trim() || !classeForm.nome.trim()) { toast({ title: "SubGrupo, Código e Nome são obrigatórios", variant: "destructive" }); return; }
    const escopo = classes.filter(c => c.subGrupoId === classeForm.subGrupoId);
    guardDuplicates({
      candidate: classeForm, list: escopo,
      options: { nome: (c) => c.nome, codigo: (c) => c.codigo, ignoreId: (c) => c.id === editClasseId },
      onExact: (m) => toast({ title: `Classe já cadastrada neste subgrupo (${m.campo}): ${m.item.codigo} - ${m.item.nome}`, variant: "destructive" }),
      onSimilar: (matches) => askDuplicates("classe", matches, persistClasse),
      onOk: persistClasse,
    });
  };

  // === ANALISE COMPLETA ===
  const analiseResultados = useMemo<GroupedDuplicatePair<any>[]>(() => {
    if (!analiseDialog.open) return [];
    if (analiseDialog.tipo === "grupo") {
      return scanDuplicatesGrouped(
        [{ contexto: "", items: grupos }],
        { nome: (g) => g.nome, codigo: (g) => g.codigo }
      );
    }
    if (analiseDialog.tipo === "subgrupo") {
      return scanDuplicatesGrouped(
        grupos.map((g) => ({
          contexto: `${g.codigo} - ${g.nome}`,
          items: subGrupos.filter((s) => s.grupoId === g.id),
        })),
        { nome: (s) => s.nome, codigo: (s) => s.codigo }
      );
    }
    return scanDuplicatesGrouped(
      subGrupos.map((s) => {
        const g = grupos.find((gr) => gr.id === s.grupoId);
        return {
          contexto: `${g?.codigo}.${s.codigo} - ${s.nome}`,
          items: classes.filter((c) => c.subGrupoId === s.id),
        };
      }),
      { nome: (c) => c.nome, codigo: (c) => c.codigo }
    );
  }, [analiseDialog, grupos, subGrupos, classes]);


  const getGrupoNome = (id: string) => grupos.find(g => g.id === id)?.nome || "-";
  const getGrupoCodigo = (id: string) => grupos.find(g => g.id === id)?.codigo || "";
  const getSubNome = (id: string) => subGrupos.find(s => s.id === id)?.nome || "-";
  const getSubCodigo = (id: string) => subGrupos.find(s => s.id === id)?.codigo || "";
  const getSubGrupoId = (id: string) => subGrupos.find(s => s.id === id)?.grupoId || "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Categorias de Compras</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
          <TabsTrigger value="subgrupos">SubGrupos</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="arvore">Visão Geral</TabsTrigger>
        </TabsList>

        {/* Search bar */}
        <div className="relative max-w-sm mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPageGrupos(1); setPageSubs(1); setPageClasses(1); }} className="pl-9" />
        </div>

        {/* === GRUPOS === */}
        <TabsContent value="grupos" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAnaliseDialog({ open: true, tipo: "grupo" })}>
              <ShieldAlert className="mr-2 h-4 w-4" />Analisar Duplicidades
            </Button>
            {podeCriar && <Button onClick={openNewGrupo}><Plus className="mr-2 h-4 w-4" />Novo Grupo</Button>}
          </div>
          <div className="border rounded-lg">
            <SortableHeaderRow order={colOrderGrupos} onReorder={setColOrderGrupos}>
            <Table>
              <TableHeader>
                <TableRow>
                  {colOrderGrupos.map(key => {
                    const cd = colDefsGrupos[key];
                    return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                  })}
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrupos.length === 0 ? (
                  <TableRow><TableCell colSpan={colOrderGrupos.length + 1} className="text-center text-muted-foreground py-8">Nenhum grupo cadastrado</TableCell></TableRow>
                ) : paginate(filteredGrupos, pageGrupos, pageSize).paginated.map(g => {
                  const cellMap: Record<string, ReactNode> = {
                    codigo: <Badge variant="outline" className="font-mono">{g.codigo}</Badge>,
                    nome: <span className="font-medium">{g.nome}</span>,
                    subgrupos: <span className="text-center block">{subGrupos.filter(s => s.grupoId === g.id).length}</span>,
                  };
                  return (
                  <TableRow key={g.id}>
                    {colOrderGrupos.map(key => <TableCell key={key} className={colDefsGrupos[key]?.className}>{cellMap[key]}</TableCell>)}
                    <TableCell>
                      <div className="flex gap-1">
                        {podeEditar && <Button variant="ghost" size="icon" onClick={() => openEditGrupo(g)}><Pencil className="h-4 w-4" /></Button>}
                        {podeExcluir && <Button variant="ghost" size="icon" onClick={() => { deleteGrupo(g.id); toast({ title: "Grupo excluído" }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </SortableHeaderRow>
          </div>
          <PaginationControls currentPage={pageGrupos} totalItems={filteredGrupos.length} onPageChange={setPageGrupos} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageGrupos(1); }} />
        </TabsContent>

        {/* === SUBGRUPOS === */}
        <TabsContent value="subgrupos" className="space-y-4">
          <div className="flex items-center justify-between">
            <Select value={filterGrupoId} onValueChange={v => { setFilterGrupoId(v); setPageSubs(1); }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Grupos</SelectItem>
                {grupos.map(g => <SelectItem key={g.id} value={g.id}>{g.codigo} - {g.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAnaliseDialog({ open: true, tipo: "subgrupo" })}>
                <ShieldAlert className="mr-2 h-4 w-4" />Analisar Duplicidades
              </Button>
              {podeCriar && <Button onClick={openNewSub}><Plus className="mr-2 h-4 w-4" />Novo SubGrupo</Button>}
            </div>
          </div>
          <div className="border rounded-lg">
            <SortableHeaderRow order={colOrderSubs} onReorder={setColOrderSubs}>
            <Table>
              <TableHeader>
                <TableRow>
                  {colOrderSubs.map(key => {
                    const cd = colDefsSubs[key];
                    return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                  })}
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubs.length === 0 ? (
                  <TableRow><TableCell colSpan={colOrderSubs.length + 1} className="text-center text-muted-foreground py-8">Nenhum subgrupo cadastrado</TableCell></TableRow>
                ) : paginate(filteredSubs, pageSubs, pageSize).paginated.map(s => {
                  const cellMap: Record<string, ReactNode> = {
                    codigo: <Badge variant="outline" className="font-mono">{s.codigo}</Badge>,
                    nome: <span className="font-medium">{s.nome}</span>,
                    grupo: <>{getGrupoCodigo(s.grupoId)} - {getGrupoNome(s.grupoId)}</>,
                    classes: <span className="text-center block">{classes.filter(c => c.subGrupoId === s.id).length}</span>,
                  };
                  return (
                  <TableRow key={s.id}>
                    {colOrderSubs.map(key => <TableCell key={key} className={colDefsSubs[key]?.className}>{cellMap[key]}</TableCell>)}
                    <TableCell>
                      <div className="flex gap-1">
                        {podeEditar && <Button variant="ghost" size="icon" onClick={() => openEditSub(s)}><Pencil className="h-4 w-4" /></Button>}
                        {podeExcluir && <Button variant="ghost" size="icon" onClick={() => { deleteSubGrupo(s.id); toast({ title: "SubGrupo excluído" }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </SortableHeaderRow>
          </div>
          <PaginationControls currentPage={pageSubs} totalItems={filteredSubs.length} onPageChange={setPageSubs} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageSubs(1); }} />
        </TabsContent>

        {/* === CLASSES === */}
        <TabsContent value="classes" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <Select value={filterGrupoId} onValueChange={v => { setFilterGrupoId(v); setFilterSubGrupoId("all"); setPageClasses(1); }}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Grupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Grupos</SelectItem>
                  {grupos.map(g => <SelectItem key={g.id} value={g.id}>{g.codigo} - {g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSubGrupoId} onValueChange={v => { setFilterSubGrupoId(v); setPageClasses(1); }}>
                <SelectTrigger className="w-48"><SelectValue placeholder="SubGrupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os SubGrupos</SelectItem>
                  {subGrupos
                    .filter(s => filterGrupoId === "all" || s.grupoId === filterGrupoId)
                    .map(s => <SelectItem key={s.id} value={s.id}>{s.codigo} - {s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAnaliseDialog({ open: true, tipo: "classe" })}>
                <ShieldAlert className="mr-2 h-4 w-4" />Analisar Duplicidades
              </Button>
              {podeCriar && <Button onClick={openNewClasse}><Plus className="mr-2 h-4 w-4" />Nova Classe</Button>}
            </div>
          </div>
          <div className="border rounded-lg">
            <SortableHeaderRow order={colOrderClasses} onReorder={setColOrderClasses}>
            <Table>
              <TableHeader>
                <TableRow>
                  {colOrderClasses.map(key => {
                    const cd = colDefsClasses[key];
                    return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                  })}
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow><TableCell colSpan={colOrderClasses.length + 1} className="text-center text-muted-foreground py-8">Nenhuma classe cadastrada</TableCell></TableRow>
                ) : paginate(filteredClasses, pageClasses, pageSize).paginated.map(c => {
                  const cellMap: Record<string, ReactNode> = {
                    codigoCompleto: <Badge variant="secondary" className="font-mono">{getCodigoCompleto(c.id)}</Badge>,
                    codigo: <Badge variant="outline" className="font-mono">{c.codigo}</Badge>,
                    nome: <span className="font-medium">{c.nome}</span>,
                    subgrupo: <>{getSubCodigo(c.subGrupoId)} - {getSubNome(c.subGrupoId)}</>,
                    grupo: <>{getGrupoCodigo(getSubGrupoId(c.subGrupoId))} - {getGrupoNome(getSubGrupoId(c.subGrupoId))}</>,
                  };
                  return (
                  <TableRow key={c.id}>
                    {colOrderClasses.map(key => <TableCell key={key} className={colDefsClasses[key]?.className}>{cellMap[key]}</TableCell>)}
                    <TableCell>
                      <div className="flex gap-1">
                        {podeEditar && <Button variant="ghost" size="icon" onClick={() => openEditClasse(c)}><Pencil className="h-4 w-4" /></Button>}
                        {podeExcluir && <Button variant="ghost" size="icon" onClick={() => { deleteClasse(c.id); toast({ title: "Classe excluída" }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </SortableHeaderRow>
          </div>
          <PaginationControls currentPage={pageClasses} totalItems={filteredClasses.length} onPageChange={setPageClasses} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageClasses(1); }} />
        </TabsContent>

        {/* === VISÃO GERAL (ÁRVORE) === */}
        <TabsContent value="arvore" className="space-y-4">
          {grupos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum grupo cadastrado</p>
          ) : grupos.map(g => (
            <div key={g.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="font-mono">{g.codigo}</Badge>
                <span className="font-semibold text-foreground">{g.nome}</span>
              </div>
              {subGrupos.filter(s => s.grupoId === g.id).map(s => (
                <div key={s.id} className="ml-6 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className="font-mono">{s.codigo}</Badge>
                    <span className="text-foreground">{s.nome}</span>
                  </div>
                  {classes.filter(c => c.subGrupoId === s.id).map(c => (
                    <div key={c.id} className="ml-8 flex items-center gap-2 text-sm">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className="font-mono text-xs">{getCodigoCompleto(c.id)}</Badge>
                      <span className="text-muted-foreground">{c.nome}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Grupo Dialog */}
      <Dialog open={grupoDialog} onOpenChange={setGrupoDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGrupoId ? "Editar" : "Novo"} Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Código *</Label><Input placeholder="Ex: 01" value={grupoForm.codigo} onChange={e => setGrupoForm(f => ({ ...f, codigo: e.target.value }))} /></div>
            <div><Label>Nome *</Label><Input placeholder="Ex: Elétrica" value={grupoForm.nome} onChange={e => setGrupoForm(f => ({ ...f, nome: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveGrupo}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SubGrupo Dialog */}
      <Dialog open={subDialog} onOpenChange={setSubDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSubId ? "Editar" : "Novo"} SubGrupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Grupo *</Label>
              <Select value={subForm.grupoId} onValueChange={v => setSubForm(f => ({ ...f, grupoId: v, codigo: editSubId ? f.codigo : nextSubCodigo(v) }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                <SelectContent>{grupos.map(g => <SelectItem key={g.id} value={g.id}>{g.codigo} - {g.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Código</Label><Input value={subForm.codigo} readOnly disabled className="font-mono" /><p className="text-xs text-muted-foreground mt-1">Gerado automaticamente</p></div>
            <div><Label>Nome *</Label><Input placeholder="Ex: Fios" value={subForm.nome} onChange={e => setSubForm(f => ({ ...f, nome: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveSub}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Classe Dialog */}
      <Dialog open={classeDialog} onOpenChange={setClasseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editClasseId ? "Editar" : "Nova"} Classe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>SubGrupo *</Label>
              <SubGrupoCombobox
                value={classeForm.subGrupoId}
                onChange={v => setClasseForm(f => ({ ...f, subGrupoId: v, codigo: editClasseId ? f.codigo : nextClasseCodigo(v) }))}
                options={subGrupoOptions}
              />
            </div>
            <div><Label>Código</Label><Input value={classeForm.codigo} readOnly disabled className="font-mono" /><p className="text-xs text-muted-foreground mt-1">Gerado automaticamente</p></div>
            <div><Label>Nome *</Label><Input placeholder="Ex: Fio Cabinho" value={classeForm.nome} onChange={e => setClasseForm(f => ({ ...f, nome: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveClasse}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateWarningDialog
        open={dupWarn.open}
        onOpenChange={(o) => setDupWarn((s) => ({ ...s, open: o }))}
        matches={dupWarn.matches}
        onConfirm={dupWarn.onConfirm}
        getCodigo={(item: any) => item.codigo}
        getNome={(item: any) => item.nome}
      />

      <DuplicateAnalysisDialog
        open={analiseDialog.open}
        onOpenChange={(o) => setAnaliseDialog((s) => ({ ...s, open: o }))}
        title={`Análise de Duplicidades — ${analiseDialog.tipo === "grupo" ? "Grupos" : analiseDialog.tipo === "subgrupo" ? "SubGrupos" : "Classes"}`}
        pairs={analiseResultados}
        showContext={analiseDialog.tipo !== "grupo"}
        getCodigo={(item: any) => item.codigo}
        getNome={(item: any) => item.nome}
      />

    </div>
  );
}
