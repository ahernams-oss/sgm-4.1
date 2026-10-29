import { useMemo, useState } from "react";
import { Database, Layers, CalendarDays, Calendar, Search } from "lucide-react";
import { resumirI0 } from "@/lib/dashboardI0";
import type { I0 } from "@/contexts/I0Context";
import type { Sco } from "@/contexts/ScoContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const numero = (value: number) => value.toLocaleString("pt-BR");

export default function I0Dashboard({ items, scos, loading, onConsultar }: {
  items: I0[]; scos: Sco[]; loading: boolean;
  onConsultar: (mes: number, ano: number) => void;
}) {
  const [tabela, setTabela] = useState("todas");
  const [mes, setMes] = useState("todos");
  const [ano, setAno] = useState("todos");
  const resumo = useMemo(() => resumirI0(items, scos), [items, scos]);
  const tabelas = [...new Set(resumo.map(r => r.tabela))].sort();
  const anos = [...new Set(resumo.map(r => r.ano))].sort((a, b) => b - a);
  const linhas = resumo.filter(r => (tabela === "todas" || r.tabela === tabela) && (mes === "todos" || r.mes === Number(mes)) && (ano === "todos" || r.ano === Number(ano)));
  const total = linhas.reduce((sum, r) => sum + r.quantidade, 0);
  const porTabela = [...new Set(linhas.map(r => r.tabela))].map(nome => ({ nome, quantidade: linhas.filter(r => r.tabela === nome).reduce((sum, r) => sum + r.quantidade, 0) })).sort((a, b) => b.quantidade - a.quantidade);
  const indicadores = [
    { label: "Registros de I0", valor: total, icon: Database },
    { label: "Tabelas cadastradas", valor: porTabela.filter(r => r.nome !== "Tabela não identificada").length, icon: Layers },
    { label: "Referências mês/ano", valor: new Set(linhas.map(r => `${r.mes}/${r.ano}`)).size, icon: CalendarDays },
    { label: "Anos cadastrados", valor: new Set(linhas.map(r => r.ano)).size, icon: Calendar },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-3">
      <Select value={tabela} onValueChange={setTabela}>
        <SelectTrigger aria-label="Tabela do dashboard" className="w-full sm:w-60"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="todas">Todas as tabelas</SelectItem>{tabelas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={mes} onValueChange={setMes}>
        <SelectTrigger aria-label="Mês do dashboard" className="w-full sm:w-44"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="todos">Todos os meses</SelectItem>{meses.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={ano} onValueChange={setAno}>
        <SelectTrigger aria-label="Ano do dashboard" className="w-full sm:w-36"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="todos">Todos os anos</SelectItem>{anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
      </Select>
      {(tabela !== "todas" || mes !== "todos" || ano !== "todos") && <Button variant="outline" onClick={() => { setTabela("todas"); setMes("todos"); setAno("todos"); }}>Limpar filtros</Button>}
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {indicadores.map(({ label, valor, icon: Icon }) => <div key={label} className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-2"><span className="text-sm text-muted-foreground">{label}</span><Icon className="h-5 w-5 shrink-0 text-primary" /></div>
        <div className="mt-3 text-2xl font-bold tabular-nums text-foreground">{loading ? "—" : numero(valor)}</div>
      </div>)}
    </div>
    {loading ? <div role="status" className="py-8 text-center text-muted-foreground">Carregando tabelas e registros de I0...</div> : <>
      {porTabela.length > 0 && <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Registros por tabela</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {porTabela.map(t => <div key={t.nome} className="space-y-2">
            <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-foreground">{t.nome}</span><span className="tabular-nums text-muted-foreground">{numero(t.quantidade)} · {((t.quantidade / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span></div>
            <Progress aria-label={`Participação de ${t.nome}`} value={t.quantidade / total * 100} className="h-2" />
          </div>)}
        </div>
      </section>}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Tabelas e períodos cadastrados</h2>
        <div className="rounded-md border"><Table>
          <TableHeader><TableRow><TableHead>Tabela</TableHead><TableHead>Mês</TableHead><TableHead>Ano</TableHead><TableHead className="text-right">Nº de registros</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
          <TableBody>
            {linhas.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{items.length ? "Nenhum período encontrado para os filtros selecionados." : "Nenhum registro de I0 cadastrado."}</TableCell></TableRow> : linhas.map(r => <TableRow key={`${r.tabela}-${r.mes}-${r.ano}`}>
              <TableCell className="font-medium">{r.tabela}</TableCell><TableCell>{String(r.mes).padStart(2, "0")} — {meses[r.mes - 1] ?? "Mês não informado"}</TableCell><TableCell className="tabular-nums">{r.ano}</TableCell><TableCell className="text-right font-semibold tabular-nums">{numero(r.quantidade)}</TableCell>
              <TableCell><Button variant="ghost" size="icon" title={`Consultar registros de ${String(r.mes).padStart(2, "0")}/${r.ano}`} aria-label={`Consultar registros de ${String(r.mes).padStart(2, "0")}/${r.ano}`} onClick={() => onConsultar(r.mes, r.ano)}><Search className="h-4 w-4" /></Button></TableCell>
            </TableRow>)}
            {linhas.length > 0 && <TableRow className="bg-muted/50"><TableCell colSpan={3} className="font-semibold">Total</TableCell><TableCell className="text-right font-bold tabular-nums">{numero(total)}</TableCell><TableCell /></TableRow>}
          </TableBody>
        </Table></div>
      </section>
    </>}
  </div>;
}