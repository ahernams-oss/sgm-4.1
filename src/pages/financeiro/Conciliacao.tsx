import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle2 } from "lucide-react";
import { useFinanceiro, formatBRL, formatDate } from "@/contexts/FinanceiroContext";
import { parseOfx } from "@/lib/ofxParser";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

export default function Conciliacao() {
  const { contasBancarias, movimentosOfx, addMovimentoOfx, updateMovimentoOfx, addLancamento } = useFinanceiro();
  const { tem } = usePermissao();
  const podeImportar = tem("financeiro.conciliacao.importar_ofx");
  const podeConciliar = tem("financeiro.conciliacao.conciliar");
  const [conta, setConta] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!podeImportar) { toast.error("Você não possui permissão para esta ação."); return; }
    const f = e.target.files?.[0]; if (!f) return;
    if (!conta) { toast.error("Selecione a conta antes de importar."); return; }
    const text = await f.text();
    const trns = parseOfx(text);
    if (trns.length === 0) { toast.error("Nenhum movimento encontrado no OFX."); return; }
    let ok = 0;
    for (const t of trns) {
      await addMovimentoOfx({ conta_bancaria_id: conta, fitid: t.fitid, data: t.date, valor: t.amount, descricao: t.memo, conciliado: false });
      ok++;
    }
    toast.success(`${ok} movimentos importados.`);
    e.target.value = "";
  };

  const filtrados = useMemo(() => movimentosOfx.filter(m => !conta || m.conta_bancaria_id === conta).sort((a, b) => b.data.localeCompare(a.data)), [movimentosOfx, conta]);

  const conciliarCriando = async (m: typeof movimentosOfx[0]) => {
    if (!podeConciliar) { toast.error("Você não possui permissão para esta ação."); return; }
    const lanc = await addLancamento({
      tipo: m.valor >= 0 ? "entrada" : "saida",
      conta_bancaria_id: m.conta_bancaria_id,
      valor: Math.abs(m.valor),
      data: m.data,
      descricao: m.descricao || "Importado via OFX",
      conciliado: true,
    });
    if (lanc) await updateMovimentoOfx(m.id, { conciliado: true, lancamento_id: lanc.id });
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Conciliação Bancária (OFX)</h1>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{filtrados.length} movimento(s) — {filtrados.filter(m => !m.conciliado).length} pendente(s)</CardTitle>
          <div className="flex gap-2">
            <Select value={conta} onValueChange={setConta}><SelectTrigger className="w-56"><SelectValue placeholder="Selecione a conta" /></SelectTrigger><SelectContent>{contasBancarias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
            {podeImportar && <label className="cursor-pointer"><Input type="file" accept=".ofx,.OFX" className="hidden" onChange={handleFile} /><Button asChild variant="outline"><span><Upload className="h-4 w-4 mr-1" />Importar OFX</span></Button></label>}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtrados.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="tabular-nums">{formatDate(m.data)}</TableCell>
                  <TableCell>{m.descricao}</TableCell>
                  <TableCell className={`text-right tabular-nums ${Number(m.valor) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatBRL(Number(m.valor))}</TableCell>
                  <TableCell>{m.conciliado ? <span className="text-emerald-600 text-xs">Conciliado</span> : <span className="text-amber-600 text-xs">Pendente</span>}</TableCell>
                  <TableCell className="text-right">{podeConciliar && !m.conciliado && <Button size="sm" variant="ghost" onClick={() => conciliarCriando(m)}><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />Conciliar</Button>}</TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Importe um OFX para começar.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
