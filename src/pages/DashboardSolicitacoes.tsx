import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardExportButtons from "@/components/dashboard/DashboardExportButtons";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { useMemo, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumeroAno } from "@/lib/formatNumero";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import {
  ClipboardList, Wrench, Filter, X, CalendarIcon, TrendingUp, Trophy, Users,
  CheckCircle2, Clock, AlertTriangle, Sparkles, Building2, BarChart3, Activity,
  FileDown, FileSpreadsheet, DollarSign, Calculator, UserCheck, ArrowRight, GitBranch, Receipt,
} from "lucide-react";
import { useSolicitacoesServicos } from "@/contexts/SolicitacoesServicosContext";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { useOrcamentos } from "@/contexts/OrcamentosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { downloadPdfDashboardSSOS, downloadExcelDashboardSSOS } from "@/lib/gerarRelatorioDashboardSSOS";
import { ChartPngExportButton } from "@/components/ChartPngExportButton";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const KPI_VARIANTS = [
  { ring: "from-blue-500 to-indigo-600", bg: "bg-blue-50", icon: "text-blue-600" },
  { ring: "from-emerald-500 to-teal-600", bg: "bg-emerald-50", icon: "text-emerald-600" },
  { ring: "from-amber-500 to-orange-600", bg: "bg-amber-50", icon: "text-amber-600" },
  { ring: "from-rose-500 to-red-600", bg: "bg-rose-50", icon: "text-rose-600" },
  { ring: "from-purple-500 to-fuchsia-600", bg: "bg-purple-50", icon: "text-purple-600" },
  { ring: "from-cyan-500 to-sky-600", bg: "bg-cyan-50", icon: "text-cyan-600" },
];

const KpiCard = ({ icon, label, value, subtitle, gradientIdx = 0, trend }: {
  icon: any; label: string; value: number | string; subtitle?: string; gradientIdx?: number; trend?: number | null;
}) => (
  <DashboardKpiCard icon={icon} label={label} value={value} subtitle={subtitle} trend={trend} gradientIdx={gradientIdx} />
);

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

export default function DashboardSolicitacoes() {
  const { lastUpdated, isRefreshing, refresh, autoRefresh, setAutoRefresh } = useDashboardRefresh();
  const { solicitacoes } = useSolicitacoesServicos();
  const { ordens } = useOrdensServico();
  const { orcamentos } = useOrcamentos();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();

  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [statusSSFilter, setStatusSSFilter] = useState("todos");
  const [statusOSFilter, setStatusOSFilter] = useState("todos");
  const [orcPeriodo, setOrcPeriodo] = useState<"dia" | "semana" | "quinzena" | "mes" | "todos">("mes");

  const clearFilters = () => {
    setDateFrom(undefined); setDateTo(undefined);
    setClienteFilter("todos"); setStatusSSFilter("todos"); setStatusOSFilter("todos");
  };

  const hasFilters = dateFrom || dateTo || clienteFilter !== "todos" || statusSSFilter !== "todos" || statusOSFilter !== "todos";

  const inRange = (d: Date | null): boolean => {
    if (!d) return !dateFrom && !dateTo;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  };

  // === Filtered SS ===
  const ssFiltradas = useMemo(() => {
    return solicitacoes.filter((s) => {
      const d = parseDate(s.dataHoraSolicitacao || s.createdAt);
      if (!inRange(d)) return false;
      if (clienteFilter !== "todos" && s.clienteId !== clienteFilter) return false;
      if (statusSSFilter !== "todos" && s.situacao !== statusSSFilter) return false;
      return true;
    });
  }, [solicitacoes, dateFrom, dateTo, clienteFilter, statusSSFilter]);

  // === Filtered OS ===
  const osFiltradas = useMemo(() => {
    return ordens.filter((o) => {
      const d = parseDate(o.createdAt);
      if (!inRange(d)) return false;
      if (clienteFilter !== "todos" && o.clienteId !== clienteFilter) return false;
      if (statusOSFilter !== "todos" && o.situacao !== statusOSFilter) return false;
      return true;
    });
  }, [ordens, dateFrom, dateTo, clienteFilter, statusOSFilter]);

  // === KPIs SS ===
  const ssTotal = ssFiltradas.length;
  const SS_STATUS_LIST: { label: string; key: string; icon: any; idx: number }[] = [
    { label: "Aguardando", key: "Aguardando aprovação", icon: Clock, idx: 2 },
    { label: "Aprovadas", key: "Aprovada", icon: CheckCircle2, idx: 1 },
    { label: "Reprovadas", key: "Reprovada", icon: X, idx: 3 },
    { label: "Orç. Solicitado", key: "Orçamento Solicitado", icon: Calculator, idx: 5 },
    { label: "Orç. Disponível", key: "Orçamento Disponível", icon: DollarSign, idx: 5 },
    { label: "Em Execução", key: "Em execução", icon: Activity, idx: 0 },
    { label: "Concluídas", key: "Concluída", icon: CheckCircle2, idx: 4 },
    { label: "Canceladas", key: "Cancelada", icon: X, idx: 3 },
  ];
  const ssCountByStatus = (key: string) => ssFiltradas.filter(s => s.situacao === key).length;
  const ssAguardando = ssCountByStatus("Aguardando aprovação");
  const ssAprovadas = ssCountByStatus("Aprovada");
  const ssConcluidas = ssCountByStatus("Concluída");
  const ssCanceladas = ssCountByStatus("Cancelada");

  // === KPIs OS ===
  const osTotal = osFiltradas.length;
  const osAbertas = osFiltradas.filter(o => o.situacao === "Aberta").length;
  const osExecutadas = osFiltradas.filter(o => o.situacao === "Executada" || o.situacao === "Serviço Confirmado").length;
  const osValidadas = osFiltradas.filter(o => o.situacao === "Validada").length;
  const osFaturadas = osFiltradas.filter(o => o.situacao === "Faturada").length;
  const osEmergenciais = osFiltradas.filter(o => (o.prioridade || "").toUpperCase().includes("IMEDIATA")).length;

  // === Charts ===
  const ssStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    ssFiltradas.forEach(s => { counts[s.situacao] = (counts[s.situacao] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [ssFiltradas]);

  const osStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    osFiltradas.forEach(o => { counts[o.situacao] = (counts[o.situacao] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [osFiltradas]);

  const timelineData = useMemo(() => {
    const months: Record<string, { mes: string; ss: number; os: number }> = {};
    ssFiltradas.forEach(s => {
      const d = parseDate(s.dataHoraSolicitacao || s.createdAt);
      if (!d) return;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[k]) months[k] = { mes: k, ss: 0, os: 0 };
      months[k].ss += 1;
    });
    osFiltradas.forEach(o => {
      const d = parseDate(o.createdAt);
      if (!d) return;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[k]) months[k] = { mes: k, ss: 0, os: 0 };
      months[k].os += 1;
    });
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [ssFiltradas, osFiltradas]);

  // === Ranking de Clientes (SS + OS) ===
  const rankingClientes = useMemo(() => {
    const counts: Record<string, { cliente: string; ss: number; os: number; total: number }> = {};
    ssFiltradas.forEach(s => {
      const k = s.clienteNome || "Sem cliente";
      if (!counts[k]) counts[k] = { cliente: k, ss: 0, os: 0, total: 0 };
      counts[k].ss += 1; counts[k].total += 1;
    });
    osFiltradas.forEach(o => {
      const k = o.clienteNome || "Sem cliente";
      if (!counts[k]) counts[k] = { cliente: k, ss: 0, os: 0, total: 0 };
      counts[k].os += 1; counts[k].total += 1;
    });
    return Object.values(counts).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [ssFiltradas, osFiltradas]);

  // === Ranking de Funcionários (por OS) ===
  // Pontuação por Complexidade da OS: Baixa = 1pt | Média = 3pts | Alta = 5pts
  const pontosOS = (complexidade?: string): { pontos: number; nivel: "Baixa" | "Média" | "Alta" } => {
    const c = (complexidade || "").toLowerCase();
    if (c.startsWith("a")) return { pontos: 5, nivel: "Alta" };
    if (c.startsWith("m") || c.startsWith("mé") || c.startsWith("me")) return { pontos: 3, nivel: "Média" };
    return { pontos: 1, nivel: "Baixa" };
  };

  const rankingFuncionarios = useMemo(() => {
    const map: Record<string, {
      nome: string; cargo: string; total: number; concluidas: number; abertas: number;
      pontos: number; baixa: number; media: number; alta: number;
    }> = {};
    osFiltradas.forEach(o => {
      const profs = o.profissionais || [];
      const { pontos, nivel } = pontosOS((o as any).complexidade);
      profs.forEach((p: any) => {
        const id = p.funcionarioId || p.id || p.nome;
        if (!id) return;
        if (!map[id]) map[id] = { nome: p.nome || "Sem nome", cargo: p.cargo || "-", total: 0, concluidas: 0, abertas: 0, pontos: 0, baixa: 0, media: 0, alta: 0 };
        map[id].total += 1;
        map[id].pontos += pontos;
        if (nivel === "Baixa") map[id].baixa += 1;
        else if (nivel === "Média") map[id].media += 1;
        else map[id].alta += 1;
        if (o.situacao === "Validada" || o.situacao === "Executada" || o.situacao === "Serviço Confirmado") {
          map[id].concluidas += 1;
        } else {
          map[id].abertas += 1;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.pontos - a.pontos || b.concluidas - a.concluidas).slice(0, 10);
  }, [osFiltradas]);

  const rankingFuncionariosQtd = useMemo(() => {
    const map: Record<string, {
      nome: string; cargo: string; total: number; concluidas: number; abertas: number;
    }> = {};
    osFiltradas.forEach(o => {
      const profs = o.profissionais || [];
      profs.forEach((p: any) => {
        const id = p.funcionarioId || p.id || p.nome;
        if (!id) return;
        if (!map[id]) map[id] = { nome: p.nome || "Sem nome", cargo: p.cargo || "-", total: 0, concluidas: 0, abertas: 0 };
        map[id].total += 1;
        if (o.situacao === "Validada" || o.situacao === "Executada" || o.situacao === "Serviço Confirmado") {
          map[id].concluidas += 1;
        } else {
          map[id].abertas += 1;
        }
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total || b.concluidas - a.concluidas).slice(0, 10);
  }, [osFiltradas]);

  // === Tipo de OS distribution ===
  const tipoOSData = useMemo(() => {
    const counts: Record<string, number> = {};
    osFiltradas.forEach(o => {
      const t = o.tipoOs?.descricao || "Outros";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [osFiltradas]);

  // === Orçamentos ===
  const orcStartDate = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (orcPeriodo === "dia") return d;
    if (orcPeriodo === "semana") { const r = new Date(d); r.setDate(d.getDate() - 7); return r; }
    if (orcPeriodo === "quinzena") { const r = new Date(d); r.setDate(d.getDate() - 15); return r; }
    if (orcPeriodo === "mes") { const r = new Date(d); r.setDate(d.getDate() - 30); return r; }
    return null;
  }, [orcPeriodo]);

  const orcamentosFiltrados = useMemo(() => {
    return orcamentos.filter(o => {
      const d = parseDate(o.dataCriacao || o.createdAt);
      if (!inRange(d)) return false;
      if (orcStartDate && d && d < orcStartDate) return false;
      if (clienteFilter !== "todos" && o.clienteId !== clienteFilter) return false;
      return true;
    });
  }, [orcamentos, dateFrom, dateTo, clienteFilter, orcStartDate]);

  const orcTotalQtd = orcamentosFiltrados.length;
  const orcValorTotal = orcamentosFiltrados.reduce((s, o) => s + (Number(o.valorTotal) || 0), 0);
  const orcTicketMedio = orcTotalQtd > 0 ? orcValorTotal / orcTotalQtd : 0;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const rankingOrcUsuarios = useMemo(() => {
    const map: Record<string, { usuario: string; qtd: number; valor: number }> = {};
    orcamentosFiltrados.forEach(o => {
      const u = o.criadoPor || "Não informado";
      if (!map[u]) map[u] = { usuario: u, qtd: 0, valor: 0 };
      map[u].qtd += 1;
      map[u].valor += Number(o.valorTotal) || 0;
    });
    return Object.values(map);
  }, [orcamentosFiltrados]);

  const rankingOrcUsuariosQtd = useMemo(() =>
    [...rankingOrcUsuarios].sort((a, b) => b.qtd - a.qtd || b.valor - a.valor).slice(0, 10), [rankingOrcUsuarios]);
  const rankingOrcUsuariosValor = useMemo(() =>
    [...rankingOrcUsuarios].sort((a, b) => b.valor - a.valor || b.qtd - a.qtd).slice(0, 10), [rankingOrcUsuarios]);

  const rankingOrcClientes = useMemo(() => {
    const map: Record<string, { cliente: string; qtd: number; valor: number }> = {};
    orcamentosFiltrados.forEach(o => {
      const c = o.clienteNome || "Sem cliente";
      if (!map[c]) map[c] = { cliente: c, qtd: 0, valor: 0 };
      map[c].qtd += 1;
      map[c].valor += Number(o.valorTotal) || 0;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor || b.qtd - a.qtd).slice(0, 10);
  }, [orcamentosFiltrados]);

  // === Clientes para filtro ===
  const clientesAtivos = useMemo(() => {
    const ids = new Set<string>();
    solicitacoes.forEach(s => s.clienteId && ids.add(s.clienteId));
    ordens.forEach(o => o.clienteId && ids.add(o.clienteId));
    const filtrados = clientes.filter(c => ids.has(c.id));
    // Deduplica por label visível (nomeFantasia || nome), mantendo o primeiro id
    const seen = new Set<string>();
    const unicos = filtrados.filter(c => {
      const label = (c.nomeFantasia || c.nome || "").trim().toLowerCase();
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    return unicos.sort((a, b) => (a.nomeFantasia || a.nome).localeCompare(b.nomeFantasia || b.nome));
  }, [solicitacoes, ordens, clientes]);

  const ssStatusOptions = useMemo(() => Array.from(new Set(solicitacoes.map(s => s.situacao).filter(Boolean))), [solicitacoes]);
  const osStatusOptions = useMemo(() => Array.from(new Set(ordens.map(o => o.situacao).filter(Boolean))), [ordens]);

  const taxaConversao = ssTotal > 0 ? ((osTotal / ssTotal) * 100) : 0;
  const taxaConclusao = osTotal > 0 ? (((osValidadas + osFaturadas) / osTotal) * 100) : 0;

  const buildReportData = () => {
    const periodo = dateFrom || dateTo
      ? `Período: ${dateFrom ? format(dateFrom, "dd/MM/yyyy") : "—"} a ${dateTo ? format(dateTo, "dd/MM/yyyy") : "—"}`
      : "Período: Todos";
    const filtros: string[] = [];
    if (clienteFilter !== "todos") {
      const c = clientes.find(c => c.id === clienteFilter);
      filtros.push(`Cliente: ${c?.nomeFantasia || c?.nome || clienteFilter}`);
    }
    if (statusSSFilter !== "todos") filtros.push(`Situação SS: ${statusSSFilter}`);
    if (statusOSFilter !== "todos") filtros.push(`Situação OS: ${statusOSFilter}`);
    return {
      empresa,
      periodoLabel: periodo,
      filtroLabel: filtros.length ? `Filtros: ${filtros.join(" · ")}` : "Filtros: nenhum",
      kpisSS: { total: ssTotal, aguardando: ssAguardando, aprovadas: ssAprovadas, concluidas: ssConcluidas, canceladas: ssCanceladas },
      kpisOS: { total: osTotal, abertas: osAbertas, executadas: osExecutadas, validadas: osValidadas, faturadas: osFaturadas, emergenciais: osEmergenciais, conversao: `${taxaConversao.toFixed(1)}%`, conclusao: `${taxaConclusao.toFixed(1)}%` },
      ssStatus: ssStatusData,
      osStatus: osStatusData,
      tipoOS: tipoOSData,
      rankingClientes,
      rankingFuncionarios: rankingFuncionarios as any,
      rankingFuncionariosQtd: rankingFuncionariosQtd as any,
    };
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-up">
      <DashboardHeader
        title="Dashboard de Solicitações de Serviço"
        badge="Solicitações de Serviço · Operacional"
        description="Acompanhamento de SS e OS — abertura, fluxo, situação e produtividade por cliente."
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        onRefresh={refresh}
        actions={
          <>
            <DashboardExportButtons
              title="Dashboard de Solicitações de Serviço"
              kpis={() => [
                { grupo: "Solicitações", label: "Total SS", value: ssTotal },
                { grupo: "Solicitações", label: "Aguardando aprovação", value: ssAguardando },
                { grupo: "Solicitações", label: "Aprovadas", value: ssAprovadas },
                { grupo: "Solicitações", label: "Concluídas", value: ssConcluidas },
                { grupo: "Solicitações", label: "Canceladas", value: ssCanceladas },
                { grupo: "Ordens de Serviço", label: "Total OS", value: osTotal },
                { grupo: "Ordens de Serviço", label: "Abertas", value: osAbertas },
                { grupo: "Ordens de Serviço", label: "Executadas", value: osExecutadas },
                { grupo: "Ordens de Serviço", label: "Validadas", value: osValidadas },
                { grupo: "Ordens de Serviço", label: "Faturadas", value: osFaturadas },
                { grupo: "Ordens de Serviço", label: "Emergenciais", value: osEmergenciais },
                { grupo: "Ordens de Serviço", label: "Conversão SS→OS", value: `${taxaConversao.toFixed(1)}%` },
                { grupo: "Ordens de Serviço", label: "Taxa de conclusão", value: `${taxaConclusao.toFixed(1)}%` },
              ]}
            />
            <Button variant="secondary" size="sm" onClick={() => downloadPdfDashboardSSOS(buildReportData())} className="h-9 bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm">
              <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadExcelDashboardSSOS(buildReportData())} className="h-9 bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel
            </Button>
          </>
        }

      />

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="mr-1 h-3 w-3" /> Limpar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data (De)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data (Até)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cliente</Label>
              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {clientesAtivos.map(c => (<SelectItem key={c.id} value={c.id}>{c.nomeFantasia || c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Situação SS</Label>
              <Select value={statusSSFilter} onValueChange={setStatusSSFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {ssStatusOptions.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Situação OS</Label>
              <Select value={statusOSFilter} onValueChange={setStatusOSFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {osStatusOptions.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Principais */}
      <Tabs defaultValue="visao" className="space-y-6">
        <TabsList>
          <TabsTrigger value="visao" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2">
            <GitBranch className="h-4 w-4" /> Workflow das Solicitações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-6 mt-4">

      {/* KPIs SS */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" /> Solicitações de Serviço (SS)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <KpiCard icon={ClipboardList} label="Total SS" value={ssTotal} gradientIdx={0} />
          {SS_STATUS_LIST.map(s => (
            <KpiCard key={s.key} icon={s.icon} label={s.label} value={ssCountByStatus(s.key)} gradientIdx={s.idx} />
          ))}
        </div>
      </div>

      {/* KPIs OS */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" /> Ordens de Serviço (OS)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <KpiCard icon={Wrench} label="Total OS" value={osTotal} gradientIdx={0} />
          <KpiCard icon={Clock} label="Abertas" value={osAbertas} gradientIdx={2} />
          <KpiCard icon={Activity} label="Executadas" value={osExecutadas} gradientIdx={5} />
          <KpiCard icon={CheckCircle2} label="Validadas" value={osValidadas} gradientIdx={1} />
          <KpiCard icon={Receipt} label="Faturadas" value={osFaturadas} gradientIdx={5} />
          <KpiCard icon={AlertTriangle} label="Emergenciais" value={osEmergenciais} gradientIdx={3} />
          <KpiCard icon={TrendingUp} label="Conv. SS→OS" value={`${taxaConversao.toFixed(0)}%`} subtitle={`Conclusão: ${taxaConclusao.toFixed(0)}%`} gradientIdx={4} />
        </div>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-chart-card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> SS por Situação
            </CardTitle>
            <ChartPngExportButton filename="ss-por-situacao" />
          </CardHeader>
          <CardContent>
            {ssStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma solicitação no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={ssStatusData}
                    cx="40%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                    label={({ name, value, percent }) => {
                      if (percent < 0.05) return null;
                      const pct = (percent * 100).toFixed(0);
                      const short = name.length > 12 ? `${name.slice(0, 10)}…` : name;
                      return `${short}: ${value} (${pct}%)`;
                    }}
                  >
                    {ssStatusData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                      const total = ssStatusData.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                      return [`${value} (${pct}%)`, name];
                    }}
                    contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ paddingLeft: "1rem", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card data-chart-card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> OS por Situação
            </CardTitle>
            <ChartPngExportButton filename="os-por-situacao" />
          </CardHeader>
          <CardContent>
            {osStatusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma OS no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={osStatusData} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="OS" radius={[4, 4, 0, 0]}>
                    {osStatusData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-chart-card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Evolução Mensal — SS vs OS
            </CardTitle>
            <ChartPngExportButton filename="evolucao-mensal-ss-os" />
          </CardHeader>
          <CardContent>
            {timelineData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorSS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="ss" stroke="#3b82f6" fill="url(#colorSS)" name="Solicitações" />
                  <Area type="monotone" dataKey="os" stroke="#10b981" fill="url(#colorOS)" name="Ordens" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Clientes */}
        <Card data-chart-card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Ranking — Clientes (SS + OS)
            </CardTitle>
            <ChartPngExportButton filename="ranking-clientes" />
          </CardHeader>
          <CardContent>
            {rankingClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {rankingClientes.map((c, idx) => {
                  const max = rankingClientes[0]?.total || 1;
                  const pct = (c.total / max) * 100;
                  return (
                    <div key={c.cliente} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={cn(
                            "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                            idx === 0 && "bg-amber-100 text-amber-700",
                            idx === 1 && "bg-slate-200 text-slate-700",
                            idx === 2 && "bg-orange-100 text-orange-700",
                            idx > 2 && "bg-muted text-muted-foreground",
                          )}>{idx + 1}</span>
                          <span className="font-medium truncate">{c.cliente}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] h-5">SS {c.ss}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5">OS {c.os}</Badge>
                          <span className="font-bold text-foreground w-8 text-right">{c.total}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>



        {/* Tipo de OS */}
        <Card className="lg:col-span-2" data-chart-card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" /> OS por Tipo de Manutenção
            </CardTitle>
            <ChartPngExportButton filename="os-por-tipo-manutencao" />
          </CardHeader>
          <CardContent>
            {tipoOSData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={tipoOSData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" name="OS" radius={[0, 4, 4, 0]}>
                    {tipoOSData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

        </TabsContent>

        {/* === WORKFLOW DAS SOLICITAÇÕES === */}
        <TabsContent value="workflow" className="space-y-6 mt-4">
          {(() => {
            const WORKFLOW_STAGES: { key: string; label: string; icon: any; color: string; bg: string; ring: string }[] = [
              { key: "Aguardando aprovação", label: "Aguardando Aprovação", icon: Clock, color: "text-amber-600", bg: "bg-amber-50", ring: "from-amber-500 to-orange-600" },
              { key: "Aprovada", label: "Aprovada", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", ring: "from-emerald-500 to-teal-600" },
              { key: "Orçamento Solicitado", label: "Orçamento Solicitado", icon: Calculator, color: "text-purple-600", bg: "bg-purple-50", ring: "from-purple-500 to-fuchsia-600" },
              { key: "Orçamento Disponível", label: "Orçamento Disponível", icon: DollarSign, color: "text-cyan-600", bg: "bg-cyan-50", ring: "from-cyan-500 to-sky-600" },
              { key: "Em execução", label: "Em Execução", icon: Activity, color: "text-blue-600", bg: "bg-blue-50", ring: "from-blue-500 to-indigo-600" },
              { key: "Concluída", label: "Concluída", icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", ring: "from-emerald-600 to-green-700" },
            ];
            const SIDE_STAGES: { key: string; label: string; icon: any; color: string; bg: string; border: string }[] = [
              { key: "Reprovada", label: "Reprovadas", icon: X, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
              { key: "Cancelada", label: "Canceladas", icon: X, color: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
            ];

            const bySituacao = (key: string) => ssFiltradas.filter(s => s.situacao === key);
            const total = ssFiltradas.length || 1;
            const totalAtivas = ssFiltradas.length;

            return (
              <>
                {/* Header de contexto */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-primary" /> Fluxo Operacional das SS
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Visualize o caminho percorrido pelas solicitações desde a abertura até a conclusão.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs h-7 px-3 self-start">
                        Total no período: <span className="ml-1 font-bold text-foreground">{totalAtivas}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>

                {/* Pipeline */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-2 overflow-x-auto pb-2">
                      {WORKFLOW_STAGES.map((stage, idx) => {
                        const items = bySituacao(stage.key);
                        const pct = ((items.length / total) * 100).toFixed(1);
                        const Icon = stage.icon;
                        return (
                          <div key={stage.key} className="flex lg:flex-row items-stretch gap-2 flex-1 min-w-[200px]">
                            <div className="flex-1 rounded-xl border border-border/60 bg-card overflow-hidden hover:shadow-md transition-all">
                              <div className={cn("h-1 bg-gradient-to-r", stage.ring)} />
                              <div className="p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className={cn("rounded-lg p-1.5", stage.bg)}>
                                    <Icon className={cn("h-4 w-4", stage.color)} />
                                  </div>
                                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa {idx + 1}</span>
                                </div>
                                <p className="text-[11px] font-semibold text-foreground leading-tight">{stage.label}</p>
                                <div className="flex items-baseline gap-1.5 mt-1">
                                  <span className="text-2xl font-bold text-foreground">{items.length}</span>
                                  <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                                </div>
                                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                                  <div className={cn("h-full bg-gradient-to-r rounded-full", stage.ring)} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                            {idx < WORKFLOW_STAGES.length - 1 && (
                              <div className="hidden lg:flex items-center justify-center shrink-0">
                                <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Saídas alternativas */}
                    <div className="mt-6 pt-4 border-t border-dashed">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Saídas alternativas do fluxo
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {SIDE_STAGES.map(stage => {
                          const items = bySituacao(stage.key);
                          const Icon = stage.icon;
                          return (
                            <div key={stage.key} className={cn("rounded-xl border p-3 flex items-center justify-between gap-3", stage.bg, stage.border)}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn("rounded-lg p-2 bg-white/60")}>
                                  <Icon className={cn("h-4 w-4", stage.color)} />
                                </div>
                                <div className="min-w-0">
                                  <p className={cn("text-xs font-semibold", stage.color)}>{stage.label}</p>
                                  <p className="text-[10px] text-muted-foreground">SS encerradas fora do fluxo principal</p>
                                </div>
                              </div>
                              <span className={cn("text-2xl font-bold tabular-nums", stage.color)}>{items.length}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detalhamento por etapa */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[...WORKFLOW_STAGES, ...SIDE_STAGES.map(s => ({ ...s, ring: "from-rose-500 to-pink-600" } as any))].map((stage: any) => {
                    const items = bySituacao(stage.key);
                    const Icon = stage.icon;
                    return (
                      <Card key={stage.key} className="overflow-hidden">
                        <div className={cn("h-1 bg-gradient-to-r", stage.ring || "from-slate-400 to-slate-500")} />
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn("rounded-lg p-1.5", stage.bg)}>
                                <Icon className={cn("h-3.5 w-3.5", stage.color)} />
                              </div>
                              <span className="truncate">{stage.label}</span>
                            </div>
                            <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{items.length}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {items.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma SS nesta etapa.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                              {items.slice(0, 50).map((s: any) => (
                                <div key={s.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors border border-transparent hover:border-border/60">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-foreground truncate">
                                      SS {formatNumeroAno(s.numero, s.dataHoraSolicitacao || s.createdAt)}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">{s.clienteNome || "—"}</p>
                                  </div>
                                  {s.prioridade && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[9px] h-4 px-1.5 shrink-0",
                                        (s.prioridade || "").toUpperCase().includes("IMEDIATA") && "bg-rose-50 text-rose-700 border-rose-200",
                                      )}
                                    >
                                      {s.prioridade}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                              {items.length > 50 && (
                                <p className="text-[10px] text-muted-foreground text-center pt-2">
                                  +{items.length - 50} adicionais
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>

  );
}
