import { useMemo, useState } from "react";
import { useResponsaveisTecnicos, ResponsavelTecnico } from "@/contexts/ResponsaveisTecnicosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls from "@/components/PaginationControls";
import { Plus, Edit, Trash2, Search, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { isValidCPF } from "@/lib/validators";
import { usePermissao } from "@/hooks/usePermissao";

const TITULOS = [
  "Engenheiro Civil",
  "Engenheiro Eletricista",
  "Engenheiro Mecânico",
  "Engenheiro de Segurança do Trabalho",
  "Engenheiro Ambiental",
  "Engenheiro Sanitarista",
  "Engenheiro de Produção",
  "Arquiteto e Urbanista",
  "Técnico em Edificações",
  "Técnico em Eletrotécnica",
  "Outro",
];

const empty = (): Partial<ResponsavelTecnico> => ({
  nome: "", titulo: "", crea: "", cpf: "", carteira_crea_url: "", carteira_crea_nome: "",
});

export default function ResponsaveisTecnicosPage() {
  const { responsaveis, loading, add, update, remove, uploadCarteira } = useResponsaveisTecnicos();
  const { tem } = usePermissao();
  const podeCriar = tem("responsaveis_tecnicos.criar");
  const podeEditar = tem("responsaveis_tecnicos.editar");
  const podeExcluir = tem("responsaveis_tecnicos.excluir");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResponsavelTecnico | null>(null);
  const [form, setForm] = useState<Partial<ResponsavelTecnico>>(empty());
  const [delId, setDelId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => responsaveis.filter(r =>
    !search ||
    r.nome.toLowerCase().includes(search.toLowerCase()) ||
    r.crea.toLowerCase().includes(search.toLowerCase()) ||
    r.cpf.includes(search)
  ), [responsaveis, search]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openNew = () => { setEditing(null); setForm(empty()); setOpen(true); };
  const openEdit = (r: ResponsavelTecnico) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    const res = await uploadCarteira(file);
    if (res) setForm(f => ({ ...f, carteira_crea_url: res.url, carteira_crea_nome: res.nome }));
    setUploading(false);
  };

  const onSave = async () => {
    if (editing && !podeEditar) { toast.error("Você não possui permissão para editar."); return; }
    if (!editing && !podeCriar) { toast.error("Você não possui permissão para criar."); return; }
    if (!form.nome?.trim()) { toast.error("Informe o nome."); return; }
    if (!form.titulo) { toast.error("Selecione o título."); return; }
    if (!form.crea?.trim()) { toast.error("Informe o CREA."); return; }
    if (!form.cpf?.trim()) { toast.error("Informe o CPF."); return; }
    if (!isValidCPF(form.cpf)) { toast.error("CPF inválido. Verifique o número informado."); return; }
    const ok = editing ? await update(editing.id, form) : await add(form);
    if (ok) { setOpen(false); setForm(empty()); setEditing(null); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Responsáveis Técnicos</h1>
          <p className="text-sm text-muted-foreground">Cadastro de profissionais habilitados (CREA/CAU).</p>
        </div>
        {podeCriar && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo Responsável</Button>}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por nome, CREA ou CPF..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            {search && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setPage(1); }}>
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
            <span className="text-sm text-muted-foreground">
              {filtered.length} registro(s) encontrado(s)
            </span>
          </div>
        </CardContent>

      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>CREA</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Carteira CREA</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">Carregando...</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum responsável cadastrado</TableCell></TableRow>
              ) : paged.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{r.titulo}</TableCell>
                  <TableCell>{r.crea}</TableCell>
                  <TableCell>{r.cpf}</TableCell>
                  <TableCell>
                    {r.carteira_crea_url ? (
                      <a href={r.carteira_crea_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Visualizar
                      </a>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {podeEditar && <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>}
                    {podeExcluir && <Button size="icon" variant="ghost" onClick={() => setDelId(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls
            currentPage={page} pageSize={pageSize} totalItems={filtered.length}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />

        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Responsável Técnico" : "Novo Responsável Técnico"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título do Engenheiro *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.titulo || ""}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {TITULOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label>CREA *</Label>
                <Input value={form.crea || ""} onChange={(e) => setForm({ ...form, crea: e.target.value })} placeholder="Ex: RJ-123456/D" />
              </div>
            </div>
            <div>
              <Label>CPF *</Label>
              <Input value={form.cpf || ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>

            <div>
              <Label>Carteira do CREA (Anexo)</Label>
              {form.carteira_crea_url ? (
                <div className="flex items-center justify-between border rounded-md p-2 bg-muted/30">
                  <a href={form.carteira_crea_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-2">
                    <FileText className="h-4 w-4" /> {form.carteira_crea_nome || "Carteira anexada"}
                  </a>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setForm({ ...form, carteira_crea_url: "", carteira_crea_nome: "" })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">{uploading ? "Enviando..." : "Selecionar arquivo (PDF ou imagem)"}</span>
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleUpload(e.target.files?.[0] || null)} disabled={uploading} />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={onSave}>{editing ? "Atualizar" : "Cadastrar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!delId}
        onOpenChange={(v) => { if (!v) setDelId(null); }}
        onConfirm={async () => {
          if (!podeExcluir) { toast.error("Você não possui permissão para excluir."); setDelId(null); return; }
          if (delId) await remove(delId);
          setDelId(null);
        }}
      />
    </div>
  );
}
