import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Wrench, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServicos } from "@/contexts/ServicosContext";
import { useCategoriasServicos } from "@/contexts/CategoriasServicosContext";
import { toast } from "sonner";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";
import { guardDuplicates, scanDuplicatesGrouped, type DuplicateMatch, type GroupedDuplicatePair } from "@/lib/duplicateDetection";
import { DuplicateWarningDialog, DuplicateAnalysisDialog } from "@/components/DuplicateDialogs";

const ServicosPage = () => {
  const { servicos, addServico, updateServico, deleteServico } = useServicos();
  const { categorias } = useCategoriasServicos();
  const { tem } = usePermissao();
  const podeCriar = tem("servicos.criar");
  const podeEditar = tem("servicos.editar");
  const podeExcluir = tem("servicos.excluir");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState<{ open: boolean; matches: DuplicateMatch<any>[]; onConfirm: () => void }>({ open: false, matches: [], onConfirm: () => {} });
  const [analiseOpen, setAnaliseOpen] = useState(false);

  const resetForm = () => { setNome(""); setDescricao(""); setCategoriaId(""); setEditId(null); setShowForm(false); };

  const persistSave = async () => {
    if (editId) {
      await updateServico(editId, { nome, descricao, categoriaId });
      toast.success("Serviço atualizado");
    } else {
      await addServico({ nome, descricao, categoriaId });
      toast.success("Serviço adicionado");
    }
    resetForm();
  };

  const handleSave = () => {
    if (editId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    // Escopo por categoria (quando informada) para evitar falsos positivos entre categorias distintas
    const escopo = categoriaId ? servicos.filter(s => s.categoriaId === categoriaId) : servicos;
    guardDuplicates({
      candidate: { nome }, list: escopo,
      options: { nome: (s) => s.nome, ignoreId: (s) => s.id === editId },
      onExact: (m) => toast.error(`Serviço já cadastrado: ${m.item.nome}`),
      onSimilar: (matches) => setDupWarn({ open: true, matches, onConfirm: persistSave }),
      onOk: persistSave,
    });
  };

  const analiseResultados = useMemo<GroupedDuplicatePair<any>[]>(() => {
    if (!analiseOpen) return [];
    // Agrupa por categoria (inclui "sem categoria")
    const grupos = [
      ...categorias.map((c) => ({ contexto: c.nome, items: servicos.filter((s) => s.categoriaId === c.id) })),
      { contexto: "Sem categoria", items: servicos.filter((s) => !s.categoriaId) },
    ];
    return scanDuplicatesGrouped(grupos, { nome: (s) => s.nome });
  }, [analiseOpen, servicos, categorias]);

  const handleEdit = (s: any) => {
    setEditId(s.id); setNome(s.nome); setDescricao(s.descricao); setCategoriaId(s.categoriaId); setShowForm(true);
  };

  const getCategoriaNome = (id: string) => categorias.find(c => c.id === id)?.nome || "—";

  const filtered = servicos.filter(s => {
    const matchSearch = s.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategoria === "all" || s.categoriaId === filterCategoria;
    return matchSearch && matchCat;
  });

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Wrench className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Cadastros</span>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1">Serviços</h1>
            <p className="text-sm text-muted-foreground">Gerencie os serviços vinculados às categorias.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAnaliseOpen(true)} className="gap-2">
              <ShieldAlert className="h-4 w-4" /> Analisar Duplicidades
            </Button>
            {!showForm && podeCriar && (
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Serviço
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="mb-8 border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editId ? "Editar Serviço" : "Novo Serviço"}</h2>
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do serviço" />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição" rows={1} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave}>{editId ? "Salvar" : "Adicionar Serviço"}</Button>
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-4">
          <Input placeholder="Buscar serviço..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categorias.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum serviço encontrado</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell>{getCategoriaNome(s.categoriaId)}</TableCell>
                  <TableCell className="text-muted-foreground">{s.descricao || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {podeEditar && <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Pencil className="h-4 w-4" /></Button>}
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      {podeExcluir && <DoubleConfirmDelete open={deleteOpen === s.id} onOpenChange={v => setDeleteOpen(v ? s.id : null)} onConfirm={() => { deleteServico(s.id); setDeleteOpen(null); }} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <DuplicateWarningDialog
        open={dupWarn.open}
        onOpenChange={(o) => setDupWarn((s) => ({ ...s, open: o }))}
        matches={dupWarn.matches}
        onConfirm={dupWarn.onConfirm}
        getNome={(s: any) => s.nome}
        entidade="serviço"
      />
      <DuplicateAnalysisDialog
        open={analiseOpen}
        onOpenChange={setAnaliseOpen}
        title="Análise de Duplicidades — Serviços"
        pairs={analiseResultados}
        showContext
        getNome={(s: any) => s.nome}
      />
    </div>
  );
};

export default ServicosPage;
