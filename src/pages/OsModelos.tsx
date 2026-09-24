import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, FileText, Download, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useOsModelos } from "@/contexts/OsModelosContext";
import { toast } from "sonner";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { exportarModelosJson, exportarModelosExcel, exportarModelosCsv, lerArquivoModelos } from "@/lib/osModelosExport";

const OsModelosPage = () => {
  const { modelos, addModelo, updateModelo, deleteModelo } = useOsModelos();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const itens = await lerArquivoModelos(file);
      if (itens.length === 0) { toast.error("Nenhum modelo válido encontrado no arquivo."); return; }
      const existentes = new Map(modelos.map((m) => [m.nome.trim().toLowerCase(), m]));
      let novos = 0, atualizados = 0;
      for (const it of itens) {
        const ex = existentes.get(it.nome.toLowerCase());
        if (ex) {
          if ((ex.descricao || "") !== it.descricao) { await updateModelo(ex.id, { descricao: it.descricao }); atualizados++; }
        } else { await addModelo(it); existentes.set(it.nome.toLowerCase(), { id: "", ...it }); novos++; }
      }
      toast.success(`Importação concluída: ${novos} novo(s), ${atualizados} atualizado(s).`);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err?.message || "arquivo inválido"));
    } finally { setImporting(false); }
  };

  const resetForm = () => { setNome(""); setDescricao(""); setEditId(null); setShowForm(false); };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      if (editId) {
        await updateModelo(editId, { nome, descricao });
        toast.success("Modelo atualizado");
      } else {
        await addModelo({ nome, descricao });
        toast.success("Modelo adicionado");
      }
      resetForm();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
    }
  };

  const handleEdit = (m: any) => {
    setEditId(m.id); setNome(m.nome); setDescricao(m.descricao); setShowForm(true);
  };

  const filtered = modelos.filter(m => m.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Cadastros</span>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1">Modelo de OS</h1>
            <p className="text-sm text-muted-foreground">Cadastre os modelos de Ordem de Serviço utilizados pelos clientes.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <input ref={fileRef} type="file" accept=".json,.xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={modelos.length === 0}><Download className="h-4 w-4" /> Exportar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportarModelosJson(modelos)}>JSON (padrão SGM)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportarModelosExcel(modelos)}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportarModelosCsv(modelos)}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="gap-2" disabled={importing} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {importing ? "Importando..." : "Importar"}
            </Button>
            {!showForm && (
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Novo Modelo
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="mb-8 border rounded-lg p-4 bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold">{editId ? "Editar Modelo" : "Novo Modelo"}</h2>
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Modelo_Saude" />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do modelo" rows={1} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave}>{editId ? "Salvar" : "Adicionar Modelo"}</Button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <Input placeholder="Buscar modelo..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
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
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum modelo encontrado</TableCell></TableRow>
              ) : filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{m.descricao || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      <DoubleConfirmDelete open={deleteOpen === m.id} onOpenChange={v => setDeleteOpen(v ? m.id : null)} onConfirm={async () => { await deleteModelo(m.id); setDeleteOpen(null); toast.success("Modelo excluído"); }} />
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

export default OsModelosPage;
