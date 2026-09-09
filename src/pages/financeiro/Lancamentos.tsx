import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";
import { useFinanceiro, formatBRL, formatDate } from "@/contexts/FinanceiroContext";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

export default function Lancamentos() {
  const { lancamentos, contasBancarias, deleteLancamento } = useFinanceiro();
  const { tem } = usePermissao();
  const podeEstornar = tem("financeiro.lancamentos.estornar");
  const [contaFilter, setContaFilter] = useState("todas");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const filtrados = useMemo(() => lancamentos.filter(l => {
    if (contaFilter !== "todas" && l.conta_bancaria_id !== contaFilter && l.conta_destino_id !== contaFilter) return false;
    if (tipoFilter !== "todos" && l.tipo !== tipoFilter) return false;
    if (dataIni && l.data < dataIni) return false;
    if (dataFim && l.data > dataFim) return false;
    return true;
  }).sort((a, b) => b.data.localeCompare(a.data)), [lancamentos, contaFilter, tipoFilter, dataIni, dataFim]);

  const { paginated } = paginate(filtrados, page, pageSize);
  const totais = useMemo(() => ({
    entrada: filtrados.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0),
    saida: filtrados.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0),
  }), [filtrados]);

  const nome = (id?: string | null) => contasBancarias.find(c => c.id === id)?.nome || "—";
  const icone = (t: string) => t === "entrada" ? <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> : t === "saida" ? <ArrowUpCircle className="h-4 w-4 text-red-600" /> : <ArrowLeftRight className="h-4 w-4 text-blue-600" />;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Lançamentos</h1>
      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{filtrados.length} lançamento(s) — Entradas: {formatBRL(totais.entrada)} | Saídas: {formatBRL(totais.saida)} | Saldo: {formatBRL(totais.entrada - totais.saida)}</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={contaFilter} onValueChange={setContaFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as contas</SelectItem>{contasBancarias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="entrada">Entradas</SelectItem><SelectItem value="saida">Saídas</SelectItem><SelectItem value="transferencia">Transferências</SelectItem></SelectContent></Select>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="w-40" />
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {paginated.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="tabular-nums">{formatDate(l.data)}</TableCell>
                  <TableCell><span className="flex items-center gap-1">{icone(l.tipo)} {l.tipo}</span></TableCell>
                  <TableCell>{l.descricao || "—"}</TableCell>
                  <TableCell className="text-xs">{nome(l.conta_bancaria_id)}{l.conta_destino_id ? ` → ${nome(l.conta_destino_id)}` : ""}</TableCell>
                  <TableCell className={`text-right tabular-nums ${l.tipo === "entrada" ? "text-emerald-600" : l.tipo === "saida" ? "text-red-600" : ""}`}>{formatBRL(Number(l.valor))}</TableCell>
                  <TableCell className="text-right">{podeEstornar && <Button size="sm" variant="ghost" onClick={() => requestDelete(l.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}</TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum lançamento.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <PaginationControls currentPage={page} totalItems={filtrados.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </CardContent>
      </Card>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(o) => !o && cancelDelete()} onConfirm={async () => { if (!podeEstornar) { toast.error("Você não possui permissão para esta ação."); cancelDelete(); return; } if (deleteId) { await deleteLancamento(deleteId); cancelDelete(); } }} />
    </div>
  );
}
