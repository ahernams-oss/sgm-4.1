import { useState, useMemo, useRef } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useSco, emptyScoForm, tiposSco, TipoSco } from "@/contexts/ScoContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissao } from "@/hooks/usePermissao";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

export default function Sco() {
  const { scos, addSco, updateSco, deleteSco } = useSco();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriar = tem("sco.criar");
  const podeEditar = tem("sco.editar");
  const podeExcluir = tem("sco.excluir");
  const podeImportar = tem("sco.importar");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyScoForm);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterFamilia, setFilterFamilia] = useState<string>("todas");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const downloadTemplate = async () => {
    const ws = (await getXLSX()).utils.aoa_to_sheet([
      ["Código", "Descrição", "Unidade", "Tipo (SCO/SINAPI/EMOP)"],
      ["EXEMPLO001", "Descrição do item de exemplo", "un", "SCO"],
      ["EXEMPLO002", "Outro item de exemplo", "m²", "SINAPI"],
    ]);
    ws["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 10 }, { wch: 22 }];
    const wb = (await getXLSX()).utils.book_new();
    (await getXLSX()).utils.book_append_sheet(wb, ws, "Modelo SCO");
    (await getXLSX()).writeFile(wb, "modelo_sco.xlsx", { compression: true });
    toast({ title: "Modelo baixado com sucesso" });
  };

  const handleImport = (file: File) => {
    if (!podeImportar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    if (ext === "txt" || ext === "csv") {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        const separator = ext === "csv" ? /[;,]/ : /\t/;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        let imported = 0;
        for (let i = 0; i < lines.length; i++) {
          const cols = lines[i].split(separator).map((c) => c.trim());
          if (i === 0 && /c[oó]d/i.test(cols[0])) continue; // skip header
          if (cols.length < 2) continue;
          const tipo = (cols[3]?.toUpperCase() || "SCO") as TipoSco;
          addSco({
            codSco: cols[0] || "",
            descricaoSco: cols[1] || "",
            unidade: cols[2] || "",
            tipo: tiposSco.includes(tipo) ? tipo : "SCO",
            familia: "",
          });
          imported++;
        }
        toast({ title: `${imported} item(ns) importado(s) com sucesso` });
      };
      reader.readAsText(file);
    } else {
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = (await getXLSX()).read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = (await getXLSX()).utils.sheet_to_json(ws, { header: 1 });
        let imported = 0;
        for (let i = 0; i < rows.length; i++) {
          const cols = rows[i];
          if (!cols || cols.length < 2) continue;
          if (i === 0 && /c[oó]d/i.test(String(cols[0]))) continue;
          const tipo = (String(cols[3] || "SCO").toUpperCase()) as TipoSco;
          addSco({
            codSco: String(cols[0] || ""),
            descricaoSco: String(cols[1] || ""),
            unidade: String(cols[2] || ""),
            tipo: tiposSco.includes(tipo) ? tipo : "SCO",
            familia: "",
          });
          imported++;
        }
        toast({ title: `${imported} item(ns) importado(s) com sucesso` });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const familias = useMemo(() => {
    const set = new Set<string>();
    scos.forEach((s) => { if (s.familia) set.add(s.familia); });
    return Array.from(set).sort();
  }, [scos]);

  const filtered = useMemo(() => {
    return scos.filter((s) => {
      const matchSearch =
        s.codSco.toLowerCase().includes(search.toLowerCase()) ||
        s.descricaoSco.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filterTipo === "todos" || s.tipo === filterTipo;
      const matchFamilia = filterFamilia === "todas" || s.familia === filterFamilia;
      return matchSearch && matchTipo && matchFamilia;
    });
  }, [scos, search, filterTipo, filterFamilia]);

  const openNew = () => {
    setForm(emptyScoForm);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (s: typeof scos[0]) => {
    setForm({ codSco: s.codSco, descricaoSco: s.descricaoSco, unidade: s.unidade, tipo: s.tipo, familia: s.familia });
    setEditId(s.id);
    setOpen(true);
  };

  const handleSubmit = () => {
    if (editId ? !podeEditar : !podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!form.codSco.trim() || !form.descricaoSco.trim()) {
      toast({ title: "Preencha código e descrição", variant: "destructive" });
      return;
    }
    if (editId) {
      updateSco(editId, form);
      toast({ title: "Item atualizado com sucesso" });
    } else {
      addSco(form);
      toast({ title: "Item cadastrado com sucesso" });
    }
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    deleteSco(id);
    toast({ title: "Item removido" });
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">SCO / SINAPI / EMOP</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          {podeImportar && <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Modelo
          </Button>}
          {podeImportar && <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>}
          {podeCriar && <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo Item
          </Button>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tiposSco.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterFamilia} onValueChange={(v) => { setFilterFamilia(v); setPage(1); }}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as famílias</SelectItem>
            {familias.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Família</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum item encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginate(filtered, page, pageSize).paginated.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.codSco}</TableCell>
                  <TableCell>{s.descricaoSco}</TableCell>
                  <TableCell>
                    {s.familia ? (
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {s.familia}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{s.unidade}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.tipo === "SCO" ? "bg-primary/10 text-primary" :
                      s.tipo === "SINAPI" ? "bg-accent text-accent-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {s.tipo}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {podeEditar && <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>}
                      {podeExcluir && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => requestDelete(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Código SCO *</Label>
              <Input value={form.codSco} onChange={(e) => setForm({ ...form, codSco: e.target.value })} />
            </div>
            <div>
              <Label>Família</Label>
              <Input value={form.familia} readOnly placeholder="Preenchida automaticamente pelo prefixo do código" className="bg-muted" />
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricaoSco} onChange={(e) => setForm({ ...form, descricaoSco: e.target.value })} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="Ex: m², un, kg" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoSco })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposSco.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editId ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
}
