import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardExportButtons from "@/components/dashboard/DashboardExportButtons";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { useState, useMemo, useEffect } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LayoutDashboard, CalendarIcon, X, FileDown, Send, MessageSquare, Loader2,
  Users, UserCheck, HardHat, Stethoscope, ClipboardCheck, Clock,
  TrendingUp, ClipboardList, FileText, AlertTriangle, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import DashboardFilters, { type DashboardFiltersState, loadDashboardFilters } from "@/components/DashboardFilters";
import { useRequisicoes } from "@/contexts/RequisicaoContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useProcessoSeletivo } from "@/contexts/ProcessoSeletivoContext";
import { useLancamentos } from "@/contexts/LancamentosContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { downloadPdfDashboard, gerarTextoDashboard } from "@/lib/gerarPdfDashboard";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { useToast } from "@/hooks/use-toast";
import { ChartPngExportButton } from "@/components/ChartPngExportButton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Pendente: "hsl(38, 92%, 50%)",
  "Em Análise": "hsl(217, 91%, 50%)",
  Aprovada: "hsl(160, 84%, 39%)",
  Reprovada: "hsl(0, 72%, 51%)",
  "Concluída": "hsl(271, 91%, 65%)",
};

const FUNC_STATUS_COLORS: Record<string, string> = {
  Ativo: "hsl(160, 84%, 39%)",
  Inativo: "hsl(0, 72%, 51%)",
  Afastado: "hsl(38, 92%, 50%)",
  "Férias": "hsl(217, 91%, 50%)",
};

const CHART_COLORS = [
  "hsl(217, 91%, 50%)", "hsl(160, 84%, 39%)", "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)", "hsl(271, 91%, 65%)", "hsl(200, 80%, 50%)",
  "hsl(30, 80%, 55%)", "hsl(340, 75%, 55%)",
];

const GRADIENT_STYLES = [
  { bg: "from-blue-500/10 to-blue-600/5", icon: "text-blue-600", border: "border-blue-200/50" },
  { bg: "from-amber-500/10 to-amber-600/5", icon: "text-amber-600", border: "border-amber-200/50" },
  { bg: "from-emerald-500/10 to-emerald-600/5", icon: "text-emerald-600", border: "border-emerald-200/50" },
  { bg: "from-red-500/10 to-red-600/5", icon: "text-red-600", border: "border-red-200/50" },
  { bg: "from-purple-500/10 to-purple-600/5", icon: "text-purple-600", border: "border-purple-200/50" },
  { bg: "from-cyan-500/10 to-cyan-600/5", icon: "text-cyan-600", border: "border-cyan-200/50" },
];

function parseDataCriacao(dateStr: string): Date | null {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  return new Date(y, m - 1, d);
}

const GradientKpiCard = ({
  icon, label, value, color, gradientIdx = 0, subtitle, trend,
}: {
  icon: any; label: string; value: number | string; color?: string;
  gradientIdx?: number; subtitle?: string; trend?: number | null;
}) => (
  <DashboardKpiCard
    icon={icon}
    label={label}
    value={value}
    subtitle={subtitle}
    trend={trend}
    valueColor={color}
    gradientIdx={gradientIdx}
  />
);

const Dashboard = () => {
  const { lastUpdated, isRefreshing, refresh, autoRefresh, setAutoRefresh } = useDashboardRefresh();
  const { requisicoes } = useRequisicoes();
  const { clientes } = useClientes();
  const { funcionarios } = useFuncionarios();
  const { processos } = useProcessoSeletivo();
  const { lancamentos } = useLancamentos();
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [filters, setFilters] = useState<DashboardFiltersState>(() => loadDashboardFilters("dashboard:filters"));
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [exames, setExames] = useState<any[]>([]);

  useEffect(() => {
    (supabase as any).from("exames_periodicos").select("*").then(({ data }: any) => {
      if (data) setExames(data);
    });
  }, []);

  // ---- Requisições filtradas ----
  const filteredReqs = useMemo(() => {
    return requisicoes.filter((r) => {
      const d = parseDataCriacao(r.dataCriacao);
      if ((dateFrom || dateTo) && !d) return false;
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); if (d > end) return false; }
      if (filters.clienteId !== "todos" && (r as any).clienteId !== filters.clienteId) return false;
      if (filters.status !== "todos" && r.status !== filters.status) return false;
      return true;
    });
  }, [requisicoes, dateFrom, dateTo, filters.clienteId, filters.status]);

  // ---- Funcionários KPIs ----
  const funcStats = useMemo(() => {
    const total = funcionarios.length;
    const ativos = funcionarios.filter(f => f.status === "Ativo").length;
    const inativos = funcionarios.filter(f => f.status === "Inativo").length;
    const afastados = funcionarios.filter(f => f.status === "Afastado").length;
    const ferias = funcionarios.filter(f => f.status === "Férias").length;
    return { total, ativos, inativos, afastados, ferias };
  }, [funcionarios]);

  const funcStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    funcionarios.forEach(f => { counts[f.status] = (counts[f.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [funcionarios]);

  // ---- Experiência ----
  const experienciaAlerts = useMemo(() => {
    const hoje = new Date();
    return funcionarios.filter(f => {
      if (f.status !== "Ativo") return false;
      const fim1 = f.experienciaPrimeiraEtapa ? new Date(f.experienciaPrimeiraEtapa) : null;
      const fimFinal = f.experienciaFim ? new Date(f.experienciaFim) : null;
      if (!fim1 && !fimFinal) return false;
      if (fim1 && !f.experienciaRenovado) {
        const dias = differenceInCalendarDays(fim1, hoje);
        if (dias >= 0 && dias <= 15) return true;
      }
      if (fimFinal) {
        const dias = differenceInCalendarDays(fimFinal, hoje);
        if (dias >= 0 && dias <= 15) return true;
      }
      return false;
    });
  }, [funcionarios]);

  // ---- Processos Seletivos ----
  const psStats = useMemo(() => {
    const total = processos.length;
    let candidatosTotal = 0;
    let contratados = 0;
    let emAndamento = 0;
    processos.forEach(p => {
      const cands = p.candidatos || [];
      candidatosTotal += cands.length;
      contratados += cands.filter((c: any) => c.contratacaoFinalizada).length;
      const hasActive = cands.some((c: any) => !c.contratacaoFinalizada && c.statusPsicologico !== "reprovado" && c.statusTecnico !== "reprovado" && c.statusLiberacao !== "reprovado");
      if (hasActive) emAndamento++;
    });
    return { total, candidatosTotal, contratados, emAndamento };
  }, [processos]);

  const psCandidatosPorEtapa = useMemo(() => {
    const counts = { "Entrevista Psicológica": 0, "Entrevista Técnica": 0, "Liberação Final": 0, "Contratação": 0 };
    processos.forEach(p => {
      (p.candidatos || []).forEach((c: any) => {
        if (c.contratacaoFinalizada) return;
        if (c.etapaAtual === "entrevista_psicologica") counts["Entrevista Psicológica"]++;
        else if (c.etapaAtual === "entrevista_tecnica") counts["Entrevista Técnica"]++;
        else if (c.etapaAtual === "liberacao") counts["Liberação Final"]++;
        else if (c.etapaAtual === "contratacao") counts["Contratação"]++;
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [processos]);

  // ---- EPIs ----
  const episStats = useMemo(() => {
    let totalEpis = 0;
    let funcComEpi = 0;
    funcionarios.forEach(f => {
      if (f.epis && f.epis.length > 0) { funcComEpi++; totalEpis += f.epis.length; }
    });
    return { totalEpis, funcComEpi, funcSemEpi: Math.max(0, funcStats.ativos - funcComEpi) };
  }, [funcionarios, funcStats.ativos]);

  // ---- Exames Periódicos ----
  const examesStats = useMemo(() => {
    const hoje = new Date();
    let total = exames.length;
    let vencidos = 0;
    let aVencer30 = 0;
    exames.forEach((e: any) => {
      if (!e.data_vencimento) return;
      const dias = differenceInCalendarDays(new Date(e.data_vencimento), hoje);
      if (dias < 0) vencidos++;
      else if (dias <= 30) aVencer30++;
    });
    return { total, vencidos, aVencer30, emDia: total - vencidos - aVencer30 };
  }, [exames]);

  // ---- Lançamentos de faltas ----
  const faltasStats = useMemo(() => {
    const faltas = lancamentos.filter(l => l.tipo === "falta");
    const faltasJust = faltas.filter(l => l.tipoFalta === "justificada");
    const faltasInjust = faltas.filter(l => l.tipoFalta === "injustificada");
    const faltasSusp = faltas.filter(l => l.tipoFalta === "suspensao");
    return { totalFaltas: faltas.length, faltasJust: faltasJust.length, faltasInjust: faltasInjust.length, faltasSusp: faltasSusp.length };
  }, [lancamentos]);

  // ---- Férias ----
  const funcionariosFerias = useMemo(() => {
    return funcionarios.filter(f => f.status === "Férias");
  }, [funcionarios]);

  // ---- Taxa de aprovação ----
  const taxaAprovacao = useMemo(() => {
    const total = filteredReqs.filter(r => ["Aprovada", "Reprovada"].includes(r.status)).length;
    if (total === 0) return 0;
    return (filteredReqs.filter(r => r.status === "Aprovada").length / total) * 100;
  }, [filteredReqs]);

  // ---- Tempo médio de análise ----
  const tempoMedioAnalise = useMemo(() => {
    const tempos: number[] = [];
    filteredReqs.forEach(r => {
      if (r.historicoStatus && r.historicoStatus.length >= 2) {
        const pendente = r.historicoStatus.find(h => h.status === "Pendente");
        const decisao = r.historicoStatus.find(h => ["Aprovada", "Reprovada"].includes(h.status));
        if (pendente && decisao) {
          const diff = new Date(decisao.dataHora).getTime() - new Date(pendente.dataHora).getTime();
          if (diff > 0) tempos.push(diff / (1000 * 60 * 60 * 24));
        }
      }
    });
    return tempos.length > 0 ? (tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  }, [filteredReqs]);

  // ---- Charts requisições ----
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReqs.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredReqs]);

  const clienteData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReqs.forEach((r) => { counts[r.unidade || "Sem unidade"] = (counts[r.unidade || "Sem unidade"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredReqs]);

  const timelineData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReqs.forEach((r) => {
      const parts = r.dataCriacao.split("/");
      if (parts.length === 3) { counts[`${parts[1]}/${parts[2]}`] = (counts[`${parts[1]}/${parts[2]}`] || 0) + 1; }
    });
    return Object.entries(counts)
      .sort(([a], [b]) => { const [ma, ya] = a.split("/").map(Number); const [mb, yb] = b.split("/").map(Number); return ya !== yb ? ya - yb : ma - mb; })
      .map(([period, total]) => ({ period, total }));
  }, [filteredReqs]);

  // Funcionários por cliente
  const funcPorCliente = useMemo(() => {
    const counts: Record<string, number> = {};
    funcionarios.filter(f => f.status === "Ativo").forEach(f => {
      const cliente = clientes.find(c => c.id === f.clienteId);
      const nome = cliente?.nomeFantasia || cliente?.nome || "Sem unidade";
      counts[nome] = (counts[nome] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [funcionarios, clientes]);

  // Exames por tipo
  const examesPorTipo = useMemo(() => {
    const counts: Record<string, number> = {};
    exames.forEach((e: any) => { counts[e.tipo_exame || "Outro"] = (counts[e.tipo_exame || "Outro"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [exames]);

  // Cargo distribution
  const cargoPorReq = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReqs.forEach(r => { counts[r.cargoNome || "Sem cargo"] = (counts[r.cargoNome || "Sem cargo"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredReqs]);

  // WhatsApp phones
  const allPhones = useMemo(() => {
    const phones: { label: string; phone: string }[] = [];
    clientes.filter(c => c.tipo === "Cliente").forEach((c) => {
      if (c.telefonesWhatsapp) {
        c.telefonesWhatsapp.split(/[,;]/).map(t => t.trim()).filter(Boolean).forEach((t) => {
          phones.push({ label: `${c.nomeFantasia || c.nome} — ${t}`, phone: t });
        });
      }
    });
    return phones;
  }, [clientes]);

  const handleDownloadPdf = () => {
    downloadPdfDashboard({
      requisicoes: filteredReqs,
      dateFrom: dateFrom ? format(dateFrom, "dd/MM/yyyy") : undefined,
      dateTo: dateTo ? format(dateTo, "dd/MM/yyyy") : undefined,
      empresa,
      funcionarios,
      exames,
      processos,
      lancamentos,
    });
    toast({ title: "PDF gerado com sucesso!" });
  };

  const handleOpenSendDialog = () => { setSelectedPhones(allPhones.map(p => p.phone)); setShowSendDialog(true); };
  const togglePhone = (phone: string) => { setSelectedPhones(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]); };

  const handleSendWhatsApp = async () => {
    if (selectedPhones.length === 0) { toast({ title: "Selecione ao menos um destinatário", variant: "destructive" }); return; }
    setSending(true);
    const mensagem = gerarTextoDashboard(filteredReqs, dateFrom ? format(dateFrom, "dd/MM/yyyy") : undefined, dateTo ? format(dateTo, "dd/MM/yyyy") : undefined);
    let successCount = 0, errorCount = 0;
    for (const phone of selectedPhones) { const r = await enviarWhatsApp(phone, mensagem); r.success ? successCount++ : errorCount++; }
    setSending(false); setShowSendDialog(false);
    toast({ title: `Relatório enviado`, description: `${successCount} enviado(s)${errorCount > 0 ? `, ${errorCount} erro(s)` : ""}`, variant: errorCount > 0 ? "destructive" : "default" });
  };

  const totalReqs = filteredReqs.length;
  

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <DashboardHeader
          className="mb-6 animate-fade-up"
          title="Dashboard de Gestão de Pessoas"
          badge="Gestão de Pessoas · Operacional"
          description="Visão consolidada de todos os módulos de gestão de pessoas."
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={setAutoRefresh}
          onRefresh={refresh}
          actions={
            <>
              <DashboardExportButtons
                title="Dashboard de Gestão de Pessoas"
                kpis={() => [
                  { grupo: "Requisições", label: "Total", value: totalReqs },
                  ...["Pendente", "Em Análise", "Aprovada", "Reprovada", "Concluída"].map((status) => ({
                    grupo: "Requisições",
                    label: status,
                    value: filteredReqs.filter((r) => r.status === status).length,
                  })),
                  { grupo: "Requisições", label: "Taxa de aprovação", value: `${taxaAprovacao.toFixed(1)}%` },
                  { grupo: "Requisições", label: "Tempo médio de análise", value: tempoMedioAnalise > 0 ? `${tempoMedioAnalise.toFixed(1)}d` : "N/A" },
                  { grupo: "Processos Seletivos", label: "Processos", value: psStats.total },
                  { grupo: "Processos Seletivos", label: "Candidatos", value: psStats.candidatosTotal },
                  { grupo: "Processos Seletivos", label: "Contratados", value: psStats.contratados },
                  { grupo: "Processos Seletivos", label: "Em andamento", value: psStats.emAndamento },
                  { grupo: "Funcionários", label: "Total", value: funcStats.total },
                  { grupo: "Funcionários", label: "Ativos", value: funcStats.ativos },
                  { grupo: "Funcionários", label: "Inativos", value: funcStats.inativos },
                  { grupo: "Funcionários", label: "Afastados", value: funcStats.afastados },
                  { grupo: "Funcionários", label: "Férias", value: funcStats.ferias },
                ]}
              />
              <Button variant="secondary" size="sm" onClick={handleDownloadPdf} className="h-9 bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm gap-1.5">
                <FileDown className="h-3.5 w-3.5" /> Exportar PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={handleOpenSendDialog} disabled={allPhones.length === 0} className="h-9 bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-sm gap-1.5">
                <Send className="h-3.5 w-3.5" /> Enviar WhatsApp
              </Button>
            </>
          }

        />

        {/* Filtros fora do cabeçalho */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <DashboardFilters
            storageKey="dashboard:filters"
            value={filters}
            onChange={setFilters}
            clienteOptions={clientes.filter(c => c.tipo === "Cliente").map(c => ({ value: c.id, label: c.nomeFantasia || c.nome }))}
            statusOptions={["Pendente", "Em Análise", "Aprovada", "Reprovada", "Concluída"].map(s => ({ value: s, label: s }))}
          />
        </div>




        {/* ===== TABS ===== */}
        <Tabs defaultValue="requisicoes" className="animate-fade-up" style={{ animationDelay: "40ms" }}>
          <TabsList className="mb-6">
            <TabsTrigger value="requisicoes" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Requisições e Processos Seletivos
            </TabsTrigger>
            <TabsTrigger value="funcionarios" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Funcionários e Saúde
            </TabsTrigger>
          </TabsList>

          {/* ==================== ABA 1: REQUISIÇÕES E PROCESSOS SELETIVOS ==================== */}
          <TabsContent value="requisicoes" className="space-y-6">
            {/* Requisições KPIs */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Requisições de Colaboradores
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <GradientKpiCard icon={ClipboardList} label="Total" value={totalReqs} gradientIdx={0} />
                {["Pendente", "Em Análise", "Aprovada", "Reprovada", "Concluída"].map((status, i) => {
                  const count = filteredReqs.filter((r) => r.status === status).length;
                  return (
                    <GradientKpiCard
                      key={status}
                      icon={status === "Aprovada" ? UserCheck : status === "Reprovada" ? X : Clock}
                      label={status}
                      value={count}
                      color={STATUS_COLORS[status]}
                      gradientIdx={i + 1}
                    />
                  );
                })}
                <GradientKpiCard
                  icon={ArrowUpRight}
                  label="Taxa Aprovação"
                  value={`${taxaAprovacao.toFixed(0)}%`}
                  gradientIdx={2}
                  subtitle="Aprovadas / Decididas"
                />
                <GradientKpiCard
                  icon={Clock}
                  label="Tempo Médio"
                  value={tempoMedioAnalise > 0 ? `${tempoMedioAnalise.toFixed(1)}d` : "N/A"}
                  gradientIdx={5}
                  subtitle="Pendente → Decisão"
                />
              </div>
            </div>

            {/* Processos Seletivos KPIs */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" /> Processos Seletivos
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <GradientKpiCard icon={ClipboardCheck} label="Processos" value={psStats.total} gradientIdx={0} />
                <GradientKpiCard icon={Users} label="Candidatos" value={psStats.candidatosTotal} gradientIdx={1} />
                <GradientKpiCard icon={UserCheck} label="Contratados" value={psStats.contratados} color="hsl(160, 84%, 39%)" gradientIdx={2} />
                <GradientKpiCard icon={Clock} label="Em Andamento" value={psStats.emAndamento} color="hsl(217, 91%, 50%)" gradientIdx={0} />
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Requisições por Status</CardTitle>
                  <ChartPngExportButton filename="requisicoes-por-status" />
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhuma requisição no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`} labelLine>
                          {statusData.map((entry) => (<Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "hsl(var(--muted))"} />))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Candidatos por Etapa</CardTitle>
                  <ChartPngExportButton filename="candidatos-por-etapa" />
                </CardHeader>
                <CardContent>
                  {psCandidatosPorEtapa.every(e => e.value === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhum candidato ativo.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={psCandidatosPorEtapa} margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Candidatos" radius={[4, 4, 0, 0]}>
                          {psCandidatosPorEtapa.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Requisições por Cliente/Unidade</CardTitle>
                  <ChartPngExportButton filename="requisicoes-por-cliente-unidade" />
                </CardHeader>
                <CardContent>
                  {clienteData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhuma requisição no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={clienteData} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Solicitações" radius={[0, 4, 4, 0]}>
                          {clienteData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Evolução Temporal das Requisições</CardTitle>
                  <ChartPngExportButton filename="evolucao-temporal-requisicoes" />
                </CardHeader>
                <CardContent>
                  {timelineData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhuma requisição no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={timelineData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="total" name="Requisições" stroke="hsl(217, 91%, 50%)" fill="url(#colorTotal)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Requisições por Cargo */}
              <Card className="lg:col-span-2" data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Requisições por Cargo</CardTitle>
                  <ChartPngExportButton filename="requisicoes-por-cargo" />
                </CardHeader>
                <CardContent>
                  {cargoPorReq.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhuma requisição no período.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={cargoPorReq} margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Requisições" radius={[4, 4, 0, 0]}>
                          {cargoPorReq.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== ABA 2: FUNCIONÁRIOS, EPIs, EXAMES, ATESTADOS, FÉRIAS ==================== */}
          <TabsContent value="funcionarios" className="space-y-6">
            {/* Funcionários KPIs */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> Funcionários
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <GradientKpiCard icon={Users} label="Total" value={funcStats.total} gradientIdx={0} />
                <GradientKpiCard icon={UserCheck} label="Ativos" value={funcStats.ativos} color="hsl(160, 84%, 39%)" gradientIdx={2} />
                <GradientKpiCard icon={Users} label="Inativos" value={funcStats.inativos} color="hsl(0, 72%, 51%)" gradientIdx={3} />
                <GradientKpiCard icon={Users} label="Afastados" value={funcStats.afastados} color="hsl(38, 92%, 50%)" gradientIdx={1} />
                <GradientKpiCard icon={Users} label="Férias" value={funcStats.ferias} color="hsl(217, 91%, 50%)" gradientIdx={0} />
              </div>
            </div>

            {/* Alertas Experiência */}
            {experienciaAlerts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Período de Experiência — Atenção ({experienciaAlerts.length})
                </h2>
                <Card className="border-destructive/30">
                  <CardContent className="pt-4 pb-3">
                    <div className="space-y-2">
                      {experienciaAlerts.map(f => {
                        const hoje = new Date();
                        const fim1 = f.experienciaPrimeiraEtapa ? new Date(f.experienciaPrimeiraEtapa) : null;
                        const fimFinal = f.experienciaFim ? new Date(f.experienciaFim) : null;
                        let diasRestantes = 0;
                        let etapa = "";
                        if (fim1 && !f.experienciaRenovado) {
                          diasRestantes = differenceInCalendarDays(fim1, hoje);
                          etapa = "1ª etapa";
                        } else if (fimFinal) {
                          diasRestantes = differenceInCalendarDays(fimFinal, hoje);
                          etapa = f.experienciaRenovado ? "2ª etapa" : "Final";
                        }
                        return (
                          <div key={f.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-destructive/5">
                            <span className="font-medium">{f.nome}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">{etapa}</Badge>
                              <Badge variant="destructive" className="text-[10px]">
                                {diasRestantes <= 0 ? "Vencido" : `${diasRestantes} dias restantes`}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* EPIs, Exames e Atestados KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <HardHat className="h-4 w-4 text-primary" /> EPIs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-bold text-foreground">{episStats.totalEpis}</p>
                      <p className="text-[10px] text-muted-foreground">EPIs Entregues</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: "hsl(160, 84%, 39%)" }}>{episStats.funcComEpi}</p>
                      <p className="text-[10px] text-muted-foreground">Com EPI</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: episStats.funcSemEpi > 0 ? "hsl(38, 92%, 50%)" : undefined }}>{episStats.funcSemEpi}</p>
                      <p className="text-[10px] text-muted-foreground">Sem EPI</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-primary" /> Exames Periódicos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-bold" style={{ color: "hsl(160, 84%, 39%)" }}>{examesStats.emDia}</p>
                      <p className="text-[10px] text-muted-foreground">Em Dia</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: "hsl(38, 92%, 50%)" }}>{examesStats.aVencer30}</p>
                      <p className="text-[10px] text-muted-foreground">A Vencer (30d)</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: "hsl(0, 72%, 51%)" }}>{examesStats.vencidos}</p>
                      <p className="text-[10px] text-muted-foreground">Vencidos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Faltas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-xl font-bold text-foreground">{faltasStats.totalFaltas}</p>
                      <p className="text-[10px] text-muted-foreground">Total Faltas</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: "hsl(160, 84%, 39%)" }}>{faltasStats.faltasJust}</p>
                      <p className="text-[10px] text-muted-foreground">Justificadas</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: "hsl(0, 72%, 51%)" }}>{faltasStats.faltasInjust}</p>
                      <p className="text-[10px] text-muted-foreground">Injustificadas</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{faltasStats.faltasSusp}</p>
                      <p className="text-[10px] text-muted-foreground">Suspensões</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Funcionários em Férias */}
            {funcionariosFerias.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Funcionários em Férias ({funcionariosFerias.length})
                </h2>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <div className="space-y-2">
                      {funcionariosFerias.map(f => {
                        const cliente = clientes.find(c => c.id === f.clienteId);
                        return (
                          <div key={f.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-muted/50">
                            <span className="font-medium">{f.nome}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {cliente?.nomeFantasia || cliente?.nome || "—"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Funcionários por Status</CardTitle>
                  <ChartPngExportButton filename="funcionarios-por-status" />
                </CardHeader>
                <CardContent>
                  {funcStatusData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhum funcionário cadastrado.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={funcStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`} labelLine>
                          {funcStatusData.map((entry) => (<Cell key={entry.name} fill={FUNC_STATUS_COLORS[entry.name] || "hsl(200, 80%, 50%)"} />))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Funcionários Ativos por Unidade</CardTitle>
                  <ChartPngExportButton filename="funcionarios-ativos-por-unidade" />
                </CardHeader>
                <CardContent>
                  {funcPorCliente.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhum funcionário ativo.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={funcPorCliente} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Funcionários" radius={[0, 4, 4, 0]}>
                          {funcPorCliente.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2" data-chart-card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold">Exames por Tipo</CardTitle>
                  <ChartPngExportButton filename="exames-por-tipo" />
                </CardHeader>
                <CardContent>
                  {examesPorTipo.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhum exame cadastrado.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={examesPorTipo} margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Exames" radius={[4, 4, 0, 0]}>
                          {examesPorTipo.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Send WhatsApp Dialog */}
        <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Enviar Relatório via WhatsApp
              </DialogTitle>
              <DialogDescription>Selecione os destinatários para envio do resumo.</DialogDescription>
            </DialogHeader>
            <div className="max-h-60 overflow-y-auto space-y-2 py-2">
              {allPhones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum telefone WhatsApp cadastrado.</p>
              ) : (
                allPhones.map((p) => (
                  <label key={p.phone} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedPhones.includes(p.phone)} onCheckedChange={() => togglePhone(p.phone)} />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setShowSendDialog(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSendWhatsApp} disabled={sending || selectedPhones.length === 0} className="gap-1.5">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sending ? "Enviando..." : `Enviar (${selectedPhones.length})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;
