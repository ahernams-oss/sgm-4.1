import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardExportButtons from "@/components/dashboard/DashboardExportButtons";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useMedicoes, MedicaoServico } from "@/contexts/MedicoesContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { FileText, Ruler, TrendingUp, DollarSign, Clock, CheckCircle, Download, CalendarIcon, Filter, X, LayoutDashboard, AlertTriangle, Sparkles, Wallet, Activity } from "lucide-react";
import { downloadPdfMedicoes } from "@/lib/gerarPdfMedicoes";
import { downloadExcelMedicoes } from "@/lib/gerarExcelMedicoes";

const STATUS_COLORS: Record<string, string> = {
  "Em Andamento": "hsl(210, 70%, 55%)",
  "Concluída": "hsl(145, 60%, 45%)",
  "Paralisada": "hsl(0, 70%, 55%)",
  "Cancelada": "hsl(0, 0%, 55%)",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#ef4444", "#9ca3af", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const KPI_VARIANTS = [
  { ring: "from-blue-500 to-indigo-600", bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-600" },
  { ring: "from-emerald-500 to-teal-600", bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-600" },
  { ring: "from-amber-500 to-orange-600", bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-600" },
  { ring: "from-rose-500 to-red-600", bg: "bg-rose-50", text: "text-rose-700", icon: "text-rose-600" },
  { ring: "from-purple-500 to-fuchsia-600", bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-600" },
  { ring: "from-cyan-500 to-sky-600", bg: "bg-cyan-50", text: "text-cyan-700", icon: "text-cyan-600" },
];

const GradientKpiCard = ({
  icon, label, value, gradientIdx = 0, subtitle, trend,
}: {
  icon: any; label: string; value: number | string; gradientIdx?: number; subtitle?: string; trend?: number | null;
}) => (
  <DashboardKpiCard icon={icon} label={label} value={value} subtitle={subtitle} trend={trend} gradientIdx={gradientIdx} />
);

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export interface ReportFilters {
  lancamentoStart?: Date;
  lancamentoEnd?: Date;
  pagamentoStart?: Date;
  pagamentoEnd?: Date;
  clienteId: string;
  fornecedorNome: string;
  status: string;
}

function buildFilterLabel(filters: ReportFilters, clientes: { id: string; nome: string }[]): string {
  const parts: string[] = [];
  if (filters.lancamentoStart || filters.lancamentoEnd) {
    const s = filters.lancamentoStart ? format(filters.lancamentoStart, "dd/MM/yyyy") : "...";
    const e = filters.lancamentoEnd ? format(filters.lancamentoEnd, "dd/MM/yyyy") : "...";
    parts.push(`Lançamento: ${s} a ${e}`);
  }
  if (filters.pagamentoStart || filters.pagamentoEnd) {
    const s = filters.pagamentoStart ? format(filters.pagamentoStart, "dd/MM/yyyy") : "...";
    const e = filters.pagamentoEnd ? format(filters.pagamentoEnd, "dd/MM/yyyy") : "...";
    parts.push(`Pagamento: ${s} a ${e}`);
  }
  if (filters.clienteId && filters.clienteId !== "todos") {
    const c = clientes.find((x) => x.id === filters.clienteId);
    parts.push(`Cliente: ${c?.nome || filters.clienteId}`);
  }
  if (filters.fornecedorNome && filters.fornecedorNome !== "todos") {
    parts.push(`Fornecedor: ${filters.fornecedorNome}`);
  }
  if (filters.status && filters.status !== "todos") {
    parts.push(`Status: ${filters.status}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "Sem filtros aplicados";
}

export default function DashboardMedicoes() {
  const { lastUpdated, isRefreshing, refresh, autoRefresh, setAutoRefresh } = useDashboardRefresh();
  const { medicoes, loading } = useMedicoes();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();

  const [lancStart, setLancStart] = useState<Date | undefined>();
  const [lancEnd, setLancEnd] = useState<Date | undefined>();
  const [pagStart, setPagStart] = useState<Date | undefined>();
  const [pagEnd, setPagEnd] = useState<Date | undefined>();
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [fornecedorFilter, setFornecedorFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");

  const clearFilters = () => {
    setLancStart(undefined); setLancEnd(undefined);
    setPagStart(undefined); setPagEnd(undefined);
    setClienteFilter("todos"); setFornecedorFilter("todos"); setStatusFilter("todos");
  };

  const hasFilters = lancStart || lancEnd || pagStart || pagEnd || clienteFilter !== "todos" || fornecedorFilter !== "todos" || statusFilter !== "todos";

  const allStatuses = useMemo(() => {
    const s = new Set<string>();
    medicoes.forEach((m) => s.add(m.status));
    return Array.from(s);
  }, [medicoes]);

  const allFornecedores = useMemo(() => {
    const s = new Set<string>();
    medicoes.forEach((m) => { const fn = (m as any).fornecedor_nome; if (fn) s.add(fn); });
    return Array.from(s).sort();
  }, [medicoes]);

  const allClientes = useMemo(() => {
    const ids = new Set<string>();
    medicoes.forEach((m) => { if (m.cliente_id) ids.add(m.cliente_id); });
    return clientes.filter((c) => ids.has(c.id));
  }, [medicoes, clientes]);

  const filtered = useMemo(() => {
    let list = medicoes;
    if (lancStart) { const s = new Date(lancStart); s.setHours(0, 0, 0, 0); list = list.filter((m) => m.created_at && new Date(m.created_at) >= s); }
    if (lancEnd) { const e = new Date(lancEnd); e.setHours(23, 59, 59, 999); list = list.filter((m) => m.created_at && new Date(m.created_at) <= e); }
    if (pagStart) {
      const s = format(pagStart, "yyyy-MM-dd");
      list = list.filter((m) => {
        const dp = (m as any).data_pagamento;
        if (dp && dp >= s) return true;
        return (m.medicoes || []).some((lanc: any) => lanc.data_pagamento && lanc.data_pagamento >= s);
      });
    }
    if (pagEnd) {
      const e = format(pagEnd, "yyyy-MM-dd");
      list = list.filter((m) => {
        const dp = (m as any).data_pagamento;
        if (dp && dp <= e) return true;
        return (m.medicoes || []).some((lanc: any) => lanc.data_pagamento && lanc.data_pagamento <= e);
      });
    }
    if (clienteFilter !== "todos") list = list.filter((m) => m.cliente_id === clienteFilter);
    if (fornecedorFilter !== "todos") list = list.filter((m) => (m as any).fornecedor_nome === fornecedorFilter);
    if (statusFilter !== "todos") list = list.filter((m) => m.status === statusFilter);
    return list;
  }, [medicoes, lancStart, lancEnd, pagStart, pagEnd, clienteFilter, fornecedorFilter, statusFilter]);

  // KPIs
  const totalMedicoes = filtered.length;
  const valorContratado = filtered.reduce((s, m) => s + (m.valor_total_contratado || 0), 0);
  const valorMedido = filtered.reduce((s, m) => s + (m.valor_total_medido || 0), 0);
  const saldoAberto = valorContratado - valorMedido;
  const percentualMedio = totalMedicoes > 0
    ? filtered.reduce((s, m) => s + (m.percentual_medido || 0), 0) / totalMedicoes : 0;
  const emAndamento = filtered.filter((m) => m.status === "Em Andamento").length;
  const concluidas = filtered.filter((m) => m.status === "Concluída").length;
  const paralisadas = filtered.filter((m) => m.status === "Paralisada").length;

  // Charts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((m) => { counts[m.status] = (counts[m.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const byClient = useMemo(() => {
    const counts: Record<string, { contratado: number; medido: number }> = {};
    filtered.forEach((m) => {
      const key = m.cliente_nome || "Sem cliente";
      if (!counts[key]) counts[key] = { contratado: 0, medido: 0 };
      counts[key].contratado += m.valor_total_contratado || 0;
      counts[key].medido += m.valor_total_medido || 0;
    });
    return Object.entries(counts).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.contratado - a.contratado).slice(0, 10);
  }, [filtered]);

  const byMonth = useMemo(() => {
    const months: Record<string, { contratado: number; medido: number; count: number }> = {};
    filtered.forEach((m) => {
      if (!m.created_at) return;
      const d = new Date(m.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) months[key] = { contratado: 0, medido: 0, count: 0 };
      months[key].contratado += m.valor_total_contratado || 0;
      months[key].medido += m.valor_total_medido || 0;
      months[key].count += 1;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
  }, [filtered]);

  const byFornecedor = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((m) => {
      const key = (m as any).fornecedor_nome || "Sem fornecedor";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtered]);

  const currentFilters: ReportFilters = {
    lancamentoStart: lancStart, lancamentoEnd: lancEnd,
    pagamentoStart: pagStart, pagamentoEnd: pagEnd,
    clienteId: clienteFilter, fornecedorNome: fornecedorFilter, status: statusFilter,
  };
  const filterLabel = buildFilterLabel(currentFilters, clientes);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-up">
      <DashboardHeader
        title="Dashboard de Medição de Serviços e Obras"
        badge="Engenharia e Manutenção · Visão Executiva"
        description="Acompanhamento financeiro e operacional consolidado das medições de obras e contratos."
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        onRefresh={refresh}
        actions={
          <>
            <DashboardExportButtons
              title="Dashboard de Medições"
              context={filterLabel}
              kpis={() => [
                { label: "Total de medições", value: totalMedicoes },
                { label: "Valor contratado", value: fmt(valorContratado) },
                { label: "Valor medido", value: fmt(valorMedido) },
                { label: "Saldo aberto", value: fmt(saldoAberto), subtitle: "Contratado − Medido" },
                { label: "% médio de execução", value: fmtPct(percentualMedio) },
                { label: "Em andamento", value: emAndamento },
                { label: "Concluídas", value: concluidas },
                { label: "Paralisadas", value: paralisadas },
              ]}
            />
            <Button variant="secondary" size="sm" className="h-9 text-xs gap-1.5 bg-white text-primary hover:bg-white/90 shadow-sm" onClick={() => downloadPdfMedicoes(filtered, filterLabel)}>
              <FileText className="h-3.5 w-3.5" /> Relatório PDF
            </Button>
            <Button variant="secondary" size="sm" className="h-9 text-xs gap-1.5 bg-white/15 text-white hover:bg-white/25 border border-white/20 backdrop-blur-sm" onClick={() => downloadExcelMedicoes(filtered, filterLabel)}>
              <Download className="h-3.5 w-3.5" /> Relatório Excel
            </Button>
          </>
        }

      />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros do Relatório
            </CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="mr-1 h-3 w-3" /> Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data Lançamento (De)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !lancStart && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {lancStart ? format(lancStart, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={lancStart} onSelect={setLancStart} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data Lançamento (Até)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !lancEnd && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {lancEnd ? format(lancEnd, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={lancEnd} onSelect={setLancEnd} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data Pagamento (De)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !pagStart && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pagStart ? format(pagStart, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={pagStart} onSelect={setPagStart} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data Pagamento (Até)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !pagEnd && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pagEnd ? format(pagEnd, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={pagEnd} onSelect={setPagEnd} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cliente / Centro de Custo</Label>
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {allClientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Fornecedor</Label>
              <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {allFornecedores.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {allStatuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Badge variant="secondary" className="h-9 px-4 flex items-center text-sm">
                {filtered.length} medição(ões)
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <GradientKpiCard icon={Ruler} label="Total Medições" value={totalMedicoes} gradientIdx={0} />
        <GradientKpiCard icon={Wallet} label="Valor Contratado" value={fmt(valorContratado)} gradientIdx={5} />
        <GradientKpiCard icon={TrendingUp} label="Valor Medido" value={fmt(valorMedido)} gradientIdx={1} />
        <GradientKpiCard icon={DollarSign} label="Saldo Aberto" value={fmt(saldoAberto)} gradientIdx={2} subtitle="Contratado − Medido" />
        <GradientKpiCard icon={Activity} label="% Médio Exec." value={fmtPct(percentualMedio)} gradientIdx={4} />
        <GradientKpiCard icon={Clock} label="Em Andamento" value={emAndamento} gradientIdx={0} />
        <GradientKpiCard icon={CheckCircle} label="Concluídas" value={concluidas} gradientIdx={1} />
        <GradientKpiCard icon={AlertTriangle} label="Paralisadas" value={paralisadas} gradientIdx={3} />
      </div>

      {/* Execution overview */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execução Financeira Global</p>
                  <p className="text-sm text-foreground/80 mt-0.5">{fmt(valorMedido)} medidos de {fmt(valorContratado)} contratados</p>
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                  {valorContratado > 0 ? fmtPct((valorMedido / valorContratado) * 100) : "0%"}
                </span>
              </div>
              <Progress value={valorContratado > 0 ? (valorMedido / valorContratado) * 100 : 0} className="h-3" />
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Medido</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> Saldo a executar: {fmt(saldoAberto)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 md:border-l md:pl-6 md:border-border/60">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{emAndamento}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Em curso</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{concluidas}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Concluídas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-rose-600">{paralisadas}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Paralisadas</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Por Status</TabsTrigger>
          <TabsTrigger value="clientes">Por Cliente</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução Mensal</TabsTrigger>
          <TabsTrigger value="fornecedores">Por Fornecedor</TabsTrigger>
        </TabsList>

        <TabsContent value="status">
          <Card>
            <CardHeader><CardTitle className="text-sm">Medições por Status</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={120} label={({ name, value }) => `${name}: ${value}`}>
                    {statusCounts.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes">
          <Card>
            <CardHeader><CardTitle className="text-sm">Valores por Cliente / Obra</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byClient} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => fmt(v)} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="contratado" name="Contratado" fill="#3b82f6" />
                  <Bar dataKey="medido" name="Medido" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolucao">
          <Card>
            <CardHeader><CardTitle className="text-sm">Evolução Mensal</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byMonth}>
                  <defs>
                    <linearGradient id="gradContratado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMedido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Area type="monotone" dataKey="contratado" name="Contratado" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradContratado)" />
                  <Area type="monotone" dataKey="medido" name="Medido" stroke="#10b981" strokeWidth={2.5} fill="url(#gradMedido)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fornecedores">
          <Card>
            <CardHeader><CardTitle className="text-sm">Medições por Fornecedor</CardTitle></CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byFornecedor}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="Qtd. Medições" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Lista de Medições</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente / Obra</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Data Pgto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contratado</TableHead>
                  <TableHead className="text-right">Medido</TableHead>
                  <TableHead className="text-right">% Exec.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.numero}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{m.cliente_nome}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{(m as any).fornecedor_nome || "—"}</TableCell>
                    <TableCell>{m.contrato || "—"}</TableCell>
                    <TableCell>{(m as any).data_pagamento || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" style={{ background: STATUS_COLORS[m.status] || "#666", color: "#fff" }}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{fmt(m.valor_total_contratado || 0)}</TableCell>
                    <TableCell className="text-right">{fmt(m.valor_total_medido || 0)}</TableCell>
                    <TableCell className="text-right">{fmtPct(m.percentual_medido || 0)}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      Nenhuma medição encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
