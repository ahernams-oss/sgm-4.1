import { useState } from "react";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCategoriasServicos } from "@/contexts/CategoriasServicosContext";
import { toast } from "sonner";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";

const CategoriasServicosPage = () => {
  const { categorias, addCategoria, updateCategoria, deleteCategoria } = useCategoriasServicos();
  const { tem } = usePermissao();
  const podeCriar = tem("categorias_servicos.criar");
  const podeEditar = tem("categorias_servicos.editar");
  const podeExcluir = tem("categorias_servicos.excluir");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);

  const resetForm = () => { setNome(""); setDescricao(""); setEditId(null); setShowForm(false); };

  const handleSave = async () => {
    if (editId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editId) {
      await updateCategoria(editId, { nome, descricao });
      toast.success("Categoria atualizada");
    } else {
      await addCategoria({ nome, descricao });
      toast.success("Categoria adicionada");
    }
    resetForm();
  };

  const handleEdit = (c: any) => {
    setEditId(c.id); setNome(c.nome); setDescricao(c.descricao); setShowForm(true);
  };

  const filtered = categorias.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Tags className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Cadastros</span>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1">Categorias de Serviços</h1>
            <p className="text-sm text-muted-foreground">Gerencie as categorias para classificar serviços.</p>
          </div>
          {!showForm && podeCriar && (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Categoria
            </Button>
          )}
        </div>

        {showForm && (
          <div className="mb-8 border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editId ? "Editar Categoria" : "Nova Categoria"}</h2>
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da categoria" />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição" rows={1} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave}>{editId ? "Salvar" : "Adicionar Categoria"}</Button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <Input placeholder="Buscar categoria..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhuma categoria encontrada</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{c.descricao || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {podeEditar && <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil className="h-4 w-4" /></Button>}
                      {podeExcluir && <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      {podeExcluir && <DoubleConfirmDelete open={deleteOpen === c.id} onOpenChange={v => setDeleteOpen(v ? c.id : null)} onConfirm={() => { deleteCategoria(c.id); setDeleteOpen(null); }} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default CategoriasServicosPage;
