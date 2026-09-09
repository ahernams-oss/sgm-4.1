import { useState, useMemo } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useFabricantes, Fabricante } from "@/contexts/FabricantesContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { usePermissao } from "@/hooks/usePermissao";

export default function FabricantesPage() {
  const { fabricantes, addFabricante, updateFabricante, deleteFabricante } = useFabricantes();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriar = tem("fabricantes.criar");
  const podeEditar = tem("fabricantes.editar");
  const podeExcluir = tem("fabricantes.excluir");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const filtered = useMemo(() => {
    if (!search) return fabricantes;
    const s = search.toLowerCase();
    return fabricantes.filter(f => f.nome.toLowerCase().includes(s));
  }, [fabricantes, search]);

  const openNew = () => { setNome(""); setEditingId(null); setDialogOpen(true); };
  const openEdit = (f: Fabricante) => { setNome(f.nome); setEditingId(f.id); setDialogOpen(true); };

  const handleSave = () => {
    if (!nome.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (editingId) {
      if (!podeEditar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
      updateFabricante(editingId, nome.trim());
      toast({ title: "Fabricante atualizado" });
    } else {
      if (!podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
      addFabricante(nome.trim());
      toast({ title: "Fabricante criado" });
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Fabricantes</h1>
        {podeCriar && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo</Button>}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">Nenhum fabricante cadastrado</TableCell></TableRow>
            ) : paginate(filtered, page, pageSize).paginated.map(f => (
              <TableRow key={f.id}>
                <TableCell>{f.nome}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {podeEditar && <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>}
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Fabricante</DialogTitle></DialogHeader>
          <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do fabricante" /></div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={() => { if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); cancelDelete(); return; } if (deleteId) { deleteFabricante(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}
