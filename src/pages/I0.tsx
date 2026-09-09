import { useState, useMemo, useRef } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useI0, emptyI0Form } from "@/contexts/I0Context";
import { useSco } from "@/contexts/ScoContext";
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

const meses = [
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" }, { value: 4, label: "Abril" },
  { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const anos = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

export default function I0Page() {
  const { items, addItem, updateItem, deleteItem } = useI0();
  const { scos } = useSco();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriar = tem("i0.criar");
  const podeEditar = tem("i0.editar");
  const podeExcluir = tem("i0.excluir");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyI0Form);
  const [search, setSearch] = useState("");
  const [filterMes, setFilterMes] = useState<string>("todos");
  const [filterAno, setFilterAno] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const getScoDesc = (cod: string) => scos.find((s) => s.codSco === cod)?.descricaoSco ?? "";

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const matchSearch =
        i.codSco.toLowerCase().includes(search.toLowerCase()) ||
        getScoDesc(i.codSco).toLowerCase().includes(search.toLowerCase());
      const matchMes = filterMes === "todos" || i.mes === Number(filterMes);
      const matchAno = filterAno === "todos" || i.ano === Number(filterAno);
      return matchSearch && matchMes && matchAno;
    });
  }, [items, search, filterMes, filterAno, scos]);

  const openNew = () => { setForm(emptyI0Form); setEditId(null); setOpen(true); };

  const openEdit = (item: typeof items[0]) => {
    setForm({ mes: item.mes, ano: item.ano, codSco: item.codSco, valor: item.valor });
    setEditId(item.id);
    setOpen(true);
  };

  const handleSubmit = () => {
    if (editId ? !podeEditar : !podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!form.codSco) {
      toast({ title: "Selecione um código SCO", variant: "destructive" });
      return;
    }
    if (editId) {
      updateItem(editId, form);
      toast({ title: "Registro atualizado com sucesso" });
    } else {
      addItem(form);
      toast({ title: "Registro cadastrado com sucesso" });
    }
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    deleteItem(id);
    toast({ title: "Registro removido" });
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  const handleImport = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();

    const processRows = (rows: string[][]) => {
      let imported = 0;
      for (let i = 0; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols || cols.length < 4) continue;
        if (i === 0 && /m[eê]s/i.test(String(cols[0]))) continue;
        const mes = Number(cols[0]);
        const ano = Number(cols[1]);
        const codSco = String(cols[2] || "").trim();
        const valor = parseFloat(String(cols[3] || "0").replace(",", "."));
        if (!mes || !ano || !codSco) continue;
        addItem({ mes, ano, codSco, valor: isNaN(valor) ? 0 : valor });
        imported++;
      }
      toast({ title: `${imported} registro(s) importado(s)` });
    };

    if (ext === "txt" || ext === "csv") {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        const sep = ext === "csv" ? /[;,]/ : /\t/;
        const rows = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(sep).map((c) => c.trim()));
        processRows(rows);
      };
      reader.readAsText(file);
    } else {
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = (await getXLSX()).read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = (await getXLSX()).utils.sheet_to_json(ws, { header: 1 });
        processRows(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const mesLabel = (m: number) => meses.find((x) => x.value === m)?.label ?? String(m);

  const downloadTemplate = async () => {
    const ws = (await getXLSX()).utils.aoa_to_sheet([
      ["Mês (1-12)", "Ano", "Código SCO", "Valor"],
      [1, currentYear, "EXEMPLO001", 100.50],
      [2, currentYear, "EXEMPLO002", 250.75],
    ]);
    ws["!cols"] = [{ wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 12 }];
    const wb = (await getXLSX()).utils.book_new();
    (await getXLSX()).utils.book_append_sheet(wb, ws, "Modelo I0");
    (await getXLSX()).writeFile(wb, "modelo_i0.xlsx", { compression: true });
    toast({ title: "Modelo baixado com sucesso" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Cadastro I0</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
          />
          {podeCriar && <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Modelo
          </Button>}
          {podeCriar && <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>}
          {podeCriar && <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo Registro
          </Button>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código SCO..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterMes} onValueChange={v => { setFilterMes(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos meses</SelectItem>
            {meses.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAno} onValueChange={v => { setFilterAno(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos anos</SelectItem>
            {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Cód. SCO</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              paginate(filtered, page, pageSize).paginated.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{mesLabel(item.mes)}</TableCell>
                  <TableCell>{item.ano}</TableCell>
                  <TableCell className="font-mono">{item.codSco}</TableCell>
                  <TableCell className="text-muted-foreground">{getScoDesc(item.codSco)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(item.valor)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {podeEditar && <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>}
                      {podeExcluir && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => requestDelete(item.id)}>
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
            <DialogTitle>{editId ? "Editar Registro" : "Novo Registro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mês *</Label>
                <Select value={String(form.mes)} onValueChange={(v) => setForm({ ...form, mes: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano *</Label>
                <Select value={String(form.ano)} onValueChange={(v) => setForm({ ...form, ano: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Código SCO *</Label>
              <Select value={form.codSco} onValueChange={(v) => setForm({ ...form, codSco: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um item SCO" /></SelectTrigger>
                <SelectContent>
                  {scos.map((s) => (
                    <SelectItem key={s.id} value={s.codSco}>
                      {s.codSco} — {s.descricaoSco}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor || ""}
                onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                placeholder="0,00"
              />
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
