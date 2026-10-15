import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

interface Item { id: string; equipamento_id: string; data_execucao: string; capacidade_btu: number | null; valor: number }
interface Props<T extends Item> { itens: T[]; clienteDoItem: (i: T) => string; localDoItem: (i: T) => string }

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const cores = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const cfg: ChartConfig = { valor: { label: "Valor (R$)", color: "var(--chart-1)" }, qtd: { label: "Manutenções", color: "var(--chart-2)" } };

function agrupar<T extends Item>(itens: T[], chave: (i: T) => string) {
  const m = new Map<string, { nome: string; qtd: number; valor: number }>();
  itens.forEach((i) => {
    const k = chave(i) || "Não informado";
    const a = m.get(k) || { nome: k, qtd: 0, valor: 0 };
    a.qtd++; a.valor += Number(i.valor) || 0; m.set(k, a);
  });
  return Array.from(m.values());
}
const curto = (s: string) => (s.length > 22 ? s.slice(0, 21) + "…" : s);

export function PmocDashboard<T extends Item>({ itens, clienteDoItem, localDoItem }: Props<T>) {
  const total = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const equipamentos = new Set(itens.map((i) => i.equipamento_id)).size;
  const semPreco = itens.filter((i) => !Number(i.valor)).length;
  const ticket = itens.length ? total / itens.length : 0;

  const porDia = useMemo(() => agrupar(itens, (i) => i.data_execucao).sort((a, b) => a.nome.localeCompare(b.nome))
    .map((d) => ({ ...d, nome: d.nome.split("-").reverse().slice(0, 2).join("/") })), [itens]);
  const porCliente = useMemo(() => agrupar(itens, clienteDoItem).sort((a, b) => b.valor - a.valor).slice(0, 10).map((d) => ({ ...d, curto: curto(d.nome) })), [itens, clienteDoItem]);
  const porLocal = useMemo(() => agrupar(itens, localDoItem).sort((a, b) => b.qtd - a.qtd).slice(0, 10).map((d) => ({ ...d, curto: curto(d.nome) })), [itens, localDoItem]);
  const porBtu = useMemo(() => agrupar(itens, (i) => (i.capacidade_btu ? `${i.capacidade_btu.toLocaleString("pt-BR")} BTUs` : "")).sort((a, b) => b.qtd - a.qtd), [itens]);

  const kpi = (t: string, v: string) => (
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{v}</CardContent></Card>
  );

  if (!itens.length) return <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma manutenção confirmada no período.</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpi("Manutenções", itens.length.toLocaleString("pt-BR"))}
        {kpi("Valor total", brl(total))}
        {kpi("Ticket médio", brl(ticket))}
        {kpi("Equipamentos atendidos", equipamentos.toLocaleString("pt-BR"))}
        {kpi("Sem faixa de preço", String(semPreco))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução diária (valor)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="h-[280px] w-full">
              <LineChart data={porDia}><CartesianGrid vertical={false} /><XAxis dataKey="nome" /><YAxis tickFormatter={(v) => `R$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="valor" stroke="var(--color-valor)" strokeWidth={2} dot={false} /></LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Manutenções por capacidade</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="h-[280px] w-full">
              <PieChart><ChartTooltip content={<ChartTooltipContent nameKey="nome" />} />
                <Pie data={porBtu} dataKey="qtd" nameKey="nome" innerRadius={50} outerRadius={100} label={(e: { nome: string }) => e.nome}>
                  {porBtu.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                </Pie></PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 clientes (valor)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="h-[320px] w-full">
              <BarChart data={porCliente} layout="vertical" margin={{ left: 20 }}><CartesianGrid horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} /><YAxis type="category" dataKey="curto" width={150} />
                <ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="valor" fill="var(--color-valor)" radius={4} /></BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 locais (manutenções)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={cfg} className="h-[320px] w-full">
              <BarChart data={porLocal} layout="vertical" margin={{ left: 20 }}><CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="curto" width={150} />
                <ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="qtd" fill="var(--color-qtd)" radius={4} /></BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
