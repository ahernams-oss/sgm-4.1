import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceiro, formatBRL, formatDate } from "@/contexts/FinanceiroContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function FluxoCaixa() {
  const { contasPagar, contasReceber, lancamentos, contasBancarias, saldoConta } = useFinanceiro();
  const [conta, setConta] = useState("todas");
  const hoje = new Date().toISOString().slice(0, 10);
  const [ini, setIni] = useState(hoje);
  const fim30 = new Date(); fim30.setDate(fim30.getDate() + 60);
  const [fim, setFim] = useState(fim30.toISOString().slice(0, 10));

  const dias = useMemo(() => {
    const map = new Map<string, { entradas: number; saidas: number; entradasReal: number; saidasReal: number }>();
    const add = (d: string, k: keyof { entradas: number; saidas: number; entradasReal: number; saidasReal: number }, v: number) => {
      if (!map.has(d)) map.set(d, { entradas: 0, saidas: 0, entradasReal: 0, saidasReal: 0 });
      map.get(d)![k] += v;
    };
    contasPagar.forEach(c => {
      if (c.status === "cancelada" || c.status === "paga") return;
      if (c.data_vencimento >= ini && c.data_vencimento <= fim) {
        const restante = Number(c.valor_total) - Number(c.valor_pago);
        if (restante > 0) add(c.data_vencimento, "saidas", restante);
      }
    });
    contasReceber.forEach(c => {
      if (c.status === "cancelada" || c.status === "recebida") return;
      if (c.data_vencimento >= ini && c.data_vencimento <= fim) {
        const restante = Number(c.valor_total) - Number(c.valor_recebido);
        if (restante > 0) add(c.data_vencimento, "entradas", restante);
      }
    });
    lancamentos.forEach(l => {
      if (l.data < ini || l.data > fim) return;
      if (conta !== "todas" && l.conta_bancaria_id !== conta && l.conta_destino_id !== conta) return;
      if (l.tipo === "entrada") add(l.data, "entradasReal", Number(l.valor));
      else if (l.tipo === "saida") add(l.data, "saidasReal", Number(l.valor));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [contasPagar, contasReceber, lancamentos, ini, fim, conta]);

  const saldoInicial = conta === "todas" ? contasBancarias.reduce((s, c) => s + saldoConta(c.id), 0) : saldoConta(conta);
  let saldoCorrente = saldoInicial;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Fluxo de Caixa</h1>
      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Saldo atual: {formatBRL(saldoInicial)}</CardTitle>
          <div className="flex gap-2">
            <Select value={conta} onValueChange={setConta}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as contas</SelectItem>{contasBancarias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
            <Input type="date" value={ini} onChange={e => setIni(e.target.value)} className="w-40" />
            <Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead className="text-right">Entradas Previstas</TableHead><TableHead className="text-right">Saídas Previstas</TableHead><TableHead className="text-right">Realizado</TableHead><TableHead className="text-right">Saldo Projetado</TableHead></TableRow></TableHeader>
            <TableBody>
              {dias.map(([d, v]) => {
                saldoCorrente += v.entradas + v.entradasReal - v.saidas - v.saidasReal;
                return (
                  <TableRow key={d}>
                    <TableCell className="tabular-nums">{formatDate(d)}</TableCell>
                    <TableCell className="text-right text-emerald-600 tabular-nums">{v.entradas ? formatBRL(v.entradas) : "—"}</TableCell>
                    <TableCell className="text-right text-red-600 tabular-nums">{v.saidas ? formatBRL(v.saidas) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{(v.entradasReal - v.saidasReal) ? formatBRL(v.entradasReal - v.saidasReal) : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${saldoCorrente < 0 ? "text-red-600" : ""}`}>{formatBRL(saldoCorrente)}</TableCell>
                  </TableRow>
                );
              })}
              {dias.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem movimento previsto no período.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
