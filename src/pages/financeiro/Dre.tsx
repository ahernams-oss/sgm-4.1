import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFinanceiro, formatBRL } from "@/contexts/FinanceiroContext";

export default function Dre() {
  const { lancamentos, planoContas } = useFinanceiro();
  const hoje = new Date();
  const ini0 = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim0 = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [ini, setIni] = useState(ini0);
  const [fim, setFim] = useState(fim0);

  const dados = useMemo(() => {
    const periodo = lancamentos.filter(l => l.data >= ini && l.data <= fim && l.tipo !== "transferencia");
    const porPlano = new Map<string, { nome: string; tipo: string; valor: number }>();
    let receitas = 0, despesas = 0;
    periodo.forEach(l => {
      const v = Number(l.valor);
      if (l.tipo === "entrada") receitas += v; else despesas += v;
      const p = planoContas.find(x => x.id === l.plano_conta_id);
      const key = p?.id || "_sem";
      const cur = porPlano.get(key) || { nome: p?.nome || "(Sem categoria)", tipo: p?.tipo || (l.tipo === "entrada" ? "receita" : "despesa"), valor: 0 };
      cur.valor += v;
      porPlano.set(key, cur);
    });
    return { receitas, despesas, resultado: receitas - despesas, grupos: Array.from(porPlano.values()).sort((a, b) => b.valor - a.valor) };
  }, [lancamentos, planoContas, ini, fim]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">DRE Gerencial</h1>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Período</CardTitle>
          <div className="flex gap-2">
            <Input type="date" value={ini} onChange={e => setIni(e.target.value)} className="w-40" />
            <Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="w-40" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-4 bg-emerald-50"><p className="text-xs text-muted-foreground">Receitas</p><p className="text-xl font-serif font-semibold text-emerald-700">{formatBRL(dados.receitas)}</p></div>
            <div className="rounded-lg border p-4 bg-red-50"><p className="text-xs text-muted-foreground">Despesas</p><p className="text-xl font-serif font-semibold text-red-700">{formatBRL(dados.despesas)}</p></div>
            <div className={`rounded-lg border p-4 ${dados.resultado >= 0 ? "bg-primary/10" : "bg-amber-50"}`}><p className="text-xs text-muted-foreground">Resultado</p><p className={`text-xl font-serif font-semibold ${dados.resultado >= 0 ? "text-primary" : "text-amber-700"}`}>{formatBRL(dados.resultado)}</p></div>
          </div>
          <div className="mt-6">
            <h3 className="font-medium mb-2">Por categoria</h3>
            {dados.grupos.map((g, i) => (
              <div key={i} className="flex items-center justify-between border-b py-2 text-sm">
                <span><span className={g.tipo === "receita" ? "text-emerald-600" : "text-red-600"}>●</span> {g.nome}</span>
                <span className="tabular-nums font-medium">{formatBRL(g.valor)}</span>
              </div>
            ))}
            {dados.grupos.length === 0 && <p className="text-center text-muted-foreground py-6">Sem lançamentos no período.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
