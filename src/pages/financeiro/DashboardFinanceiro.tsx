import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingDown, TrendingUp, AlertTriangle, Banknote, ArrowDownCircle, ArrowUpCircle, CalendarClock } from "lucide-react";
import KpiCardFinanceiro from "@/components/financeiro/KpiCardFinanceiro";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardExportButtons from "@/components/dashboard/DashboardExportButtons";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { useFinanceiro, formatBRL, formatDate, isVencida } from "@/contexts/FinanceiroContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from "recharts";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function DashboardFinanceiro() {
  const { contasBancarias, contasPagar, contasReceber, lancamentos, saldoConta, reload } = useFinanceiro();
  const { lastUpdated, isRefreshing, refresh, autoRefresh, setAutoRefresh } = useDashboardRefresh(reload);

  const kpi = useMemo(() => {
    const saldo = contasBancarias.reduce((s, c) => s + saldoConta(c.id), 0);
    const hoje = new Date();
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const dHoje = hoje.toISOString().slice(0, 10);
    const d30 = em30.toISOString().slice(0, 10);
    const aPagar = contasPagar.filter(c => (c.status === "aberta" || c.status === "parcial") && c.data_vencimento <= d30).reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_pago)), 0);
    const aReceber = contasReceber.filter(c => (c.status === "aberta" || c.status === "parcial") && c.data_vencimento <= d30).reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_recebido)), 0);
    const inadimp = contasReceber.filter(c => isVencida(c)).reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_recebido)), 0);
    const vencidoPagar = contasPagar.filter(c => isVencida(c)).reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_pago)), 0);

    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    const inicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10);
    const fimAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10);

    const mes = lancamentos.filter(l => l.data >= inicioMes && l.data <= dHoje && l.tipo !== "transferencia");
    const entradas = mes.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
    const saidas = mes.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
    const result = entradas - saidas;

    const ant = lancamentos.filter(l => l.data >= inicioAnterior && l.data <= fimAnterior && l.tipo !== "transferencia");
    const resultAnt = ant.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0)
                    - ant.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
    const trendResult = resultAnt !== 0 ? ((result - resultAnt) / Math.abs(resultAnt)) * 100 : null;

    const liquidez = aPagar > 0 ? ((saldo + aReceber) / aPagar) : null;

    return { saldo, aPagar, aReceber, inadimp, result, entradas, saidas, vencidoPagar, trendResult, liquidez };
  }, [contasBancarias, contasPagar, contasReceber, lancamentos, saldoConta]);

  // Evolução dos últimos 6 meses (entradas x saídas x resultado)
  const serieMensal = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
      const ini = d.toISOString().slice(0, 10);
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
      const per = lancamentos.filter(l => l.data >= ini && l.data <= fim && l.tipo !== "transferencia");
      const entradas = per.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
      const saidas = per.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
      return { mes: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, entradas, saidas, resultado: entradas - saidas };
    });
  }, [lancamentos]);

  // Aging de títulos em aberto
  const aging = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const faixas = [
      { nome: "Vencidos", test: (v: string) => v < hoje },
      { nome: "0-15 dias", test: (v: string) => v >= hoje && diasAte(v) <= 15 },
      { nome: "16-30 dias", test: (v: string) => diasAte(v) > 15 && diasAte(v) <= 30 },
      { nome: "31-60 dias", test: (v: string) => diasAte(v) > 30 && diasAte(v) <= 60 },
      { nome: "60+ dias", test: (v: string) => diasAte(v) > 60 },
    ];
    function diasAte(v: string) {
      return Math.round((new Date(v).getTime() - new Date(hoje).getTime()) / 86400000);
    }
    const abertosP = contasPagar.filter(c => c.status === "aberta" || c.status === "parcial");
    const abertosR = contasReceber.filter(c => c.status === "aberta" || c.status === "parcial");
    return faixas.map(f => ({
      faixa: f.nome,
      pagar: abertosP.filter(c => f.test(c.data_vencimento)).reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_pago)), 0),
      receber: abertosR.filter(c => f.test(c.data_vencimento)).reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_recebido)), 0),
    }));
  }, [contasPagar, contasReceber]);

  const proximas = useMemo(() => {
    const todas = [
      ...contasPagar.filter(c => c.status === "aberta" || c.status === "parcial").map(c => ({ tipo: "Pagar" as const, ...c, valor: Number(c.valor_total) - Number(c.valor_pago) })),
      ...contasReceber.filter(c => c.status === "aberta" || c.status === "parcial").map(c => ({ tipo: "Receber" as const, ...c, valor: Number(c.valor_total) - Number(c.valor_recebido) })),
    ];
    return todas.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).slice(0, 10);
  }, [contasPagar, contasReceber]);

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-up">
      <DashboardHeader
        title="Dashboard Financeiro"
        badge="Financeiro · Visão Executiva"
        description="Posição de caixa, obrigações, recebíveis e resultado consolidado da operação."
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        onRefresh={refresh}
        actions={
          <DashboardExportButtons
            title="Dashboard Financeiro"
            kpis={() => [
              { label: "Saldo total", value: formatBRL(kpi.saldo), subtitle: `${contasBancarias.length} conta(s)` },
              { label: "A pagar (30d)", value: formatBRL(kpi.aPagar) },
              { label: "A receber (30d)", value: formatBRL(kpi.aReceber) },
              { label: "Inadimplência", value: formatBRL(kpi.inadimp) },
              { label: "Vencido a pagar", value: formatBRL(kpi.vencidoPagar) },
              { label: "Entradas do mês", value: formatBRL(kpi.entradas) },
              { label: "Saídas do mês", value: formatBRL(kpi.saidas) },
              { label: "Resultado do mês", value: formatBRL(kpi.result), subtitle: kpi.liquidez != null ? `Liquidez ${kpi.liquidez.toFixed(2)}x` : "" },
            ]}
          />
        }
      />


      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <KpiCardFinanceiro title="Saldo total" value={formatBRL(kpi.saldo)} icon={Wallet} tone="info" subtitle={`${contasBancarias.length} conta(s)`} />
        <KpiCardFinanceiro title="A pagar (30d)" value={formatBRL(kpi.aPagar)} icon={TrendingDown} tone="warning" />
        <KpiCardFinanceiro title="A receber (30d)" value={formatBRL(kpi.aReceber)} icon={TrendingUp} tone="success" />
        <KpiCardFinanceiro title="Inadimplência" value={formatBRL(kpi.inadimp)} icon={AlertTriangle} tone="danger" />
        <KpiCardFinanceiro title="Vencido a pagar" value={formatBRL(kpi.vencidoPagar)} icon={CalendarClock} tone="danger" />
        <KpiCardFinanceiro title="Entradas do mês" value={formatBRL(kpi.entradas)} icon={ArrowUpCircle} tone="success" />
        <KpiCardFinanceiro title="Saídas do mês" value={formatBRL(kpi.saidas)} icon={ArrowDownCircle} tone="warning" />
        <KpiCardFinanceiro
          title="Resultado do mês"
          value={formatBRL(kpi.result)}
          icon={Banknote}
          tone={kpi.result >= 0 ? "success" : "danger"}
          trend={kpi.trendResult}
          subtitle={kpi.liquidez != null ? `Liquidez ${kpi.liquidez.toFixed(2)}x` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução — últimos 6 meses</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieMensal}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="mes" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
                <Area type="monotone" dataKey="resultado" name="Resultado" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Aging de títulos em aberto</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="faixa" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="receber" name="A receber" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pagar" name="A pagar" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Saldos por conta</CardTitle></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Conta</TableHead><TableHead>Banco</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
            <TableBody>{contasBancarias.map(c => <TableRow key={c.id}><TableCell>{c.nome}</TableCell><TableCell>{c.banco || "—"}</TableCell><TableCell className="text-right tabular-nums font-medium">{formatBRL(saldoConta(c.id))}</TableCell></TableRow>)}
            {contasBancarias.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Cadastre uma conta bancária.</TableCell></TableRow>}
            </TableBody></Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Próximos vencimentos</CardTitle></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>{proximas.map((p, i) => <TableRow key={i} className={isVencida(p) ? "bg-destructive/5" : ""}><TableCell><span className={p.tipo === "Pagar" ? "text-red-600" : "text-emerald-600"}>{p.tipo}</span></TableCell><TableCell className="tabular-nums">{formatDate(p.data_vencimento)}</TableCell><TableCell>{p.descricao}</TableCell><TableCell className="text-right tabular-nums">{formatBRL(p.valor)}</TableCell></TableRow>)}
            {proximas.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem títulos em aberto.</TableCell></TableRow>}
            </TableBody></Table>
        </CardContent>
      </Card>
    </div>
  );
}
