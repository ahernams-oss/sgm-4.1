import DashboardKpiCard from "@/components/dashboard/DashboardKpiCard";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardExportButtons from "@/components/dashboard/DashboardExportButtons";
import { useDashboardRefresh } from "@/hooks/useDashboardRefresh";
import { useMemo, useState, useCallback } from "react";
import { format } from "date-fns";
import { useRequisicaoCompras, RequisicaoCompras, StatusRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { FileText, ShoppingCart, Clock, AlertTriangle, CheckCircle, XCircle, Package, TrendingUp, LayoutDashboard, DollarSign, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import DashboardFilters, { type DashboardFiltersState, loadDashboardFilters } from "@/components/DashboardFilters";
import RelatoriosComprasDialog from "@/components/compras/RelatoriosComprasDialog";
import { useConfirmacoesValores } from "@/hooks/useConfirmacoesValores";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const STATUS_COLORS: Record<string, string> = {
  "Enviada": "hsl(210, 70%, 55%)",
  "Em Cotação": "hsl(40, 85%, 55%)",
  "Aguardando Aprovação": "hsl(30, 80%, 55%)",
  "Aprovada": "hsl(145, 60%, 45%)",
  "Reprovada": "hsl(0, 70%, 55%)",
  "Pedido Emitido": "hsl(260, 60%, 55%)",
  "Em Entrega": "hsl(190, 70%, 50%)",
  "Recebida Parcial": "hsl(50, 70%, 50%)",
  "Recebida": "hsl(145, 50%, 40%)",
  "Concluída": "hsl(160, 60%, 35%)",
  "Cancelada": "hsl(0, 0%, 55%)",
  "Rascunho": "hsl(0, 0%, 70%)",
};

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#9ca3af"];

const GRADIENT_STYLES = [
  { bg: "from-blue-500/10 to-blue-600/5", icon: "text-blue-600", border: "border-blue-200/50" },
  { bg: "from-amber-500/10 to-amber-600/5", icon: "text-amber-600", border: "border-amber-200/50" },
  { bg: "from-emerald-500/10 to-emerald-600/5", icon: "text-emerald-600", border: "border-emerald-200/50" },
  { bg: "from-red-500/10 to-red-600/5", icon: "text-red-600", border: "border-red-200/50" },
  { bg: "from-purple-500/10 to-purple-600/5", icon: "text-purple-600", border: "border-purple-200/50" },
  { bg: "from-cyan-500/10 to-cyan-600/5", icon: "text-cyan-600", border: "border-cyan-200/50" },
];

const GradientKpiCard = ({
  icon, label, value, gradientIdx = 0, subtitle, trend,
}: {
  icon: any; label: string; value: number | string; gradientIdx?: number; subtitle?: string; trend?: number | null;
}) => (
  <DashboardKpiCard icon={icon} label={label} value={value} subtitle={subtitle} trend={trend} gradientIdx={gradientIdx} />
);

function diffHours(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60);
}

function formatHours(h: number) {
  if (h < 24) return `${h.toFixed(1)}h`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return `${d}d ${rem.toFixed(0)}h`;
}

export default function DashboardCompras() {
  const { lastUpdated, isRefreshing, refresh, autoRefresh, setAutoRefresh } = useDashboardRefresh();
  const { requisicoes } = useRequisicaoCompras();
  const { pedidos } = usePedidoCompra();
  const { materiais } = useMateriaisServicos();
  const { getDescricaoCompleta } = useCategoriasCompras();
  const { empresa } = useEmpresa();
  const [filters, setFilters] = useState<DashboardFiltersState>(() => loadDashboardFilters("dashboard-compras:filters"));
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "Material" | "Serviço">("todos");
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);
  const { confirmacoes } = useConfirmacoesValores();

  const savingMetrics = useMemo(() => {
    let saving = 0, avoidance = 0, reajuste = 0, impactoAtraso = 0, itensAtraso = 0, acimaAlcada = 0;
    confirmacoes.forEach(c => {
      if ((c.impactoAtraso ?? 0) > 0) { impactoAtraso += c.impactoAtraso; itensAtraso++; }
      if (c.requerDiretoria) acimaAlcada++;
      if (c.categoria === "Saving") saving += Math.max(0, -c.variacaoValor);
      else if (c.categoria === "Reajuste") reajuste += Math.max(0, c.variacaoValor);
      else avoidance += c.valorConfirmado;
    });
    const liquido = reajuste - saving;
    const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return {
      saving, avoidance, reajuste, liquido, impactoAtraso, itensAtraso, acimaAlcada,
      savingFmt: brl(saving), avoidanceFmt: brl(avoidance), reajusteFmt: brl(reajuste), liquidoFmt: brl(liquido),
      impactoAtrasoFmt: brl(impactoAtraso),
      chart: [
        { name: "Saving", value: saving, color: "#10b981" },
        { name: "Cost Avoidance", value: avoidance, color: "#3b82f6" },
        { name: "Reajuste", value: reajuste, color: "#f59e0b" },
      ],
    };
  }, [confirmacoes]);

  // Helper: tipo de um item (Material/Serviço) baseado no cadastro
  const tipoDoItem = useCallback((itemId: string): "Material" | "Serviço" => {
    const mat = materiais.find(m => m.id === itemId);
    return mat?.tipo === "Serviço" ? "Serviço" : "Material";
  }, [materiais]);

  const itemMatchesTipo = useCallback((itemId: string) => {
    if (tipoFiltro === "todos") return true;
    return tipoDoItem(itemId) === tipoFiltro;
  }, [tipoFiltro, tipoDoItem]);

  const centroCustoOptions = useMemo(() => {
    const map = new Map<string, string>();
    requisicoes.forEach(r => {
      if (r.centroCusto && r.centroCustoNome && !map.has(r.centroCusto)) {
        map.set(r.centroCusto, r.centroCustoNome);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [requisicoes]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    requisicoes.forEach(r => set.add(r.status));
    return Array.from(set).sort().map(s => ({ value: s, label: s }));
  }, [requisicoes]);

  const filtered = useMemo(() => {
    return requisicoes.filter(r => {
      const d = new Date(r.dataCriacao);
      if (filters.dateFrom && d < filters.dateFrom) return false;
      if (filters.dateTo) { const end = new Date(filters.dateTo); end.setHours(23, 59, 59, 999); if (d > end) return false; }
      if (filters.clienteId !== "todos" && r.centroCusto !== filters.clienteId) return false;
      if (filters.status !== "todos" && r.status !== filters.status) return false;
      if (tipoFiltro !== "todos" && !r.itens.some(it => itemMatchesTipo(it.materialId))) return false;
      return true;
    });
  }, [requisicoes, filters, tipoFiltro, itemMatchesTipo]);

  // KPIs
  const totalReqs = filtered.length;
  const abertas = filtered.filter(r => !["Concluída", "Cancelada", "Reprovada"].includes(r.status)).length;
  const concluidas = filtered.filter(r => r.status === "Concluída").length;
  const reprovadas = filtered.filter(r => r.status === "Reprovada").length;
  const canceladas = filtered.filter(r => r.status === "Cancelada").length;
  const totalItens = filtered.reduce((s, r) => s + r.itens.filter(it => itemMatchesTipo(it.materialId)).length, 0);
  const urgentes = filtered.filter(r => r.urgencia === "Urgente" || r.urgencia === "Alta").length;

  // Status distribution
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Urgency distribution
  const urgenciaData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.urgencia] = (map[r.urgencia] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // By cost center
  const centroCustoData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const nome = r.centroCustoNome || "Não informado";
      map[nome] = (map[nome] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // By category
  const categoriaData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      r.itens.forEach(item => {
        if (!itemMatchesTipo(item.materialId)) return;
        const mat = materiais.find(m => m.id === item.materialId);
        const catName = mat?.categoriaId ? (getDescricaoCompleta(mat.categoriaId) || "Sem categoria") : "Sem categoria";
        map[catName] = (map[catName] || 0) + item.quantidade;
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtered, materiais, getDescricaoCompleta, itemMatchesTipo]);

  // Timeline
  const timelineData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const d = new Date(r.dataCriacao);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort().map(([name, total]) => ({ name, total }));
  }, [filtered]);

  // Time metrics
  const timeMetrics = useMemo(() => {
    const approvalTimes: number[] = [];
    const completionTimes: number[] = [];
    filtered.forEach(r => {
      const hist = r.historicoStatus;
      const envio = hist.find(h => h.status === "Enviada");
      const aprovacao = hist.find(h => h.status === "Aprovada");
      const conclusao = hist.find(h => h.status === "Concluída");
      if (envio && aprovacao) approvalTimes.push(diffHours(envio.dataHora, aprovacao.dataHora));
      if (envio && conclusao) completionTimes.push(diffHours(envio.dataHora, conclusao.dataHora));
    });
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return { avgApproval: avg(approvalTimes), avgCompletion: avg(completionTimes), approvalCount: approvalTimes.length, completionCount: completionTimes.length };
  }, [filtered]);

  // Solicitante ranking
  const solicitanteData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.solicitante || "Não informado"] = (map[r.solicitante || "Não informado"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtered]);

  const reprovadaList = useMemo(() => filtered.filter(r => r.status === "Reprovada"), [filtered]);
  const pendentesEntrega = useMemo(() => filtered.filter(r => ["Pedido Emitido", "Em Entrega"].includes(r.status)), [filtered]);

  // ---- Filtros e paginação das grids de acompanhamento ----
  const [pendBusca, setPendBusca] = useState("");
  const [pendStatus, setPendStatus] = useState("todos");
  const [pendUrgencia, setPendUrgencia] = useState("todas");
  const [pendPage, setPendPage] = useState(1);
  const [pendSize, setPendSize] = useState(10);

  const [repBusca, setRepBusca] = useState("");
  const [repPage, setRepPage] = useState(1);
  const [repSize, setRepSize] = useState(10);

  const [audBusca, setAudBusca] = useState("");
  const [audStatus, setAudStatus] = useState("todos");
  const [audPage, setAudPage] = useState(1);
  const [audSize, setAudSize] = useState(10);

  const norm = (s: any) => String(s ?? "").toLowerCase();

  const pendentesFiltradas = useMemo(() => {
    const t = pendBusca.trim().toLowerCase();
    return pendentesEntrega.filter(r =>
      (pendStatus === "todos" || r.status === pendStatus) &&
      (pendUrgencia === "todas" || r.urgencia === pendUrgencia) &&
      (!t || [r.numero, r.solicitante, r.centroCustoNome].some(v => norm(v).includes(t)))
    );
  }, [pendentesEntrega, pendBusca, pendStatus, pendUrgencia]);

  const reprovadasFiltradas = useMemo(() => {
    const t = repBusca.trim().toLowerCase();
    if (!t) return reprovadaList;
    return reprovadaList.filter(r => {
      const motivo = r.historicoStatus.find(h => h.status === "Reprovada")?.observacao || "";
      return [r.numero, r.solicitante, r.centroCustoNome, motivo].some(v => norm(v).includes(t));
    });
  }, [reprovadaList, repBusca]);

  const auditoriaEventos = useMemo(() => {
    const all = filtered.flatMap(r => r.historicoStatus.map(h => ({ ...h, reqNumero: r.numero })))
      .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
    const t = audBusca.trim().toLowerCase();
    return all.filter(ev =>
      (audStatus === "todos" || ev.status === audStatus) &&
      (!t || [ev.reqNumero, ev.usuario, ev.observacao].some(v => norm(v).includes(t)))
    );
  }, [filtered, audBusca, audStatus]);

  const auditoriaStatusOpcoes = useMemo(
    () => Array.from(new Set(filtered.flatMap(r => r.historicoStatus.map(h => h.status)))).sort(),
    [filtered]
  );


  // Pedidos filtrados pelo mesmo período (data de criação) — exclui cancelados
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (p.status === "Cancelado") return false;
      const d = new Date(p.dataCriacao);
      if (filters.dateFrom && d < filters.dateFrom) return false;
      if (filters.dateTo) { const end = new Date(filters.dateTo); end.setHours(23, 59, 59, 999); if (d > end) return false; }
      return true;
    });
  }, [pedidos, filters]);

  // Ranking materiais e serviços — volume (quantidade) e valor financeiro
  const { topMaterialVolume, topMaterialValor, topServicoVolume, topServicoValor } = useMemo(() => {
    const aggMat: Record<string, { descricao: string; quantidade: number; valor: number }> = {};
    const aggServ: Record<string, { descricao: string; quantidade: number; valor: number }> = {};
    pedidosFiltrados.forEach(p => {
      p.itens.forEach(it => {
        const key = it.itemId || it.descricao;
        const mat = materiais.find(m => m.id === it.itemId);
        // Determina tipo: prioriza cadastro; fallback heurístico pela descrição
        const descRaw = (mat?.descricao || it.descricao || "").toLowerCase();
        let tipo: "Material" | "Serviço";
        if (mat?.tipo === "Serviço" || mat?.tipo === "Material") {
          tipo = mat.tipo;
        } else {
          tipo = /\bservi[cç]o/.test(descRaw) ? "Serviço" : "Material";
        }
        const desc = mat ? `${mat.codigo} - ${mat.descricao}` : (it.descricao || "Item sem descrição");
        const target = tipo === "Serviço" ? aggServ : aggMat;
        if (!target[key]) target[key] = { descricao: desc, quantidade: 0, valor: 0 };
        target[key].quantidade += Number(it.quantidade) || 0;
        target[key].valor += Number(it.valorTotal) || 0;
      });
    });
    const truncar = (s: string) => s.length > 40 ? s.slice(0, 38) + "…" : s;
    const buildVol = (agg: typeof aggMat) => Object.values(agg).sort((a, b) => b.quantidade - a.quantidade).slice(0, 10).map(x => ({ name: truncar(x.descricao), value: x.quantidade }));
    const buildVal = (agg: typeof aggMat) => Object.values(agg).sort((a, b) => b.valor - a.valor).slice(0, 10).map(x => ({ name: truncar(x.descricao), value: Number(x.valor.toFixed(2)) }));
    return {
      topMaterialVolume: buildVol(aggMat),
      topMaterialValor: buildVal(aggMat),
      topServicoVolume: buildVol(aggServ),
      topServicoValor: buildVal(aggServ),
    };
  }, [pedidosFiltrados, materiais]);

  // PDF Export
  const exportPdf = async () => {
    const doc = new (await getJsPDF())({ compress: true });
    const pw = doc.internal.pageSize.getWidth();
    const DARK_BLUE: [number, number, number] = [30, 58, 107];

    doc.setFillColor(...DARK_BLUE);
    doc.rect(0, 0, pw, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(empresa?.nomeFantasia || empresa?.razaoSocial || "SGM Lasant", 14, 14);
    doc.setFontSize(11);
    doc.text("Dashboard — Compras e Suprimentos", 14, 22);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, 14, { align: "right" });
    doc.text(`Período: ${filters.dateFrom || filters.dateTo ? `${filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "—"} a ${filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "—"}` : "Todos"}`, pw - 14, 22, { align: "right" });
    if (empresa?.cnpj) doc.text(`CNPJ: ${empresa.cnpj}`, pw - 14, 28, { align: "right" });

    doc.setTextColor(30, 30, 30);
    let y = 44;

    // Resumo
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_BLUE);
    doc.text("Resumo Geral", 14, y); y += 3;
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de Requisições", String(totalReqs)],
        ["Em Andamento", String(abertas)],
        ["Concluídas", String(concluidas)],
        ["Reprovadas", String(reprovadas)],
        ["Canceladas", String(canceladas)],
        ["Total de Itens", String(totalItens)],
        ["Urgentes / Alta Prioridade", String(urgentes)],
        ["Tempo Médio Aprovação", timeMetrics.approvalCount > 0 ? formatHours(timeMetrics.avgApproval) : "N/A"],
        ["Tempo Médio Conclusão", timeMetrics.completionCount > 0 ? formatHours(timeMetrics.avgCompletion) : "N/A"],
      ],
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: DARK_BLUE },
      margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Status
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_BLUE);
    doc.text("Distribuição por Status", 14, y); y += 3;
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Status", "Quantidade", "Percentual"]],
      body: statusData.map(s => [s.name, String(s.value), `${((s.value / totalReqs) * 100).toFixed(1)}%`]),
      styles: { fontSize: 8 }, headStyles: { fillColor: DARK_BLUE }, margin: { left: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Centro de custo
    if (centroCustoData.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_BLUE);
      doc.text("Requisições por Centro de Custo", 14, y); y += 3;
      (await getAutoTable())(doc, {
        startY: y,
        head: [["Centro de Custo", "Quantidade", "Percentual"]],
        body: centroCustoData.map(c => [c.name, String(c.value), `${((c.value / totalReqs) * 100).toFixed(1)}%`]),
        styles: { fontSize: 8 }, headStyles: { fillColor: DARK_BLUE }, margin: { left: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Urgência
    if (urgenciaData.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_BLUE);
      doc.text("Distribuição por Urgência", 14, y); y += 3;
      (await getAutoTable())(doc, {
        startY: y,
        head: [["Urgência", "Quantidade", "Percentual"]],
        body: urgenciaData.map(u => [u.name, String(u.value), `${((u.value / totalReqs) * 100).toFixed(1)}%`]),
        styles: { fontSize: 8 }, headStyles: { fillColor: DARK_BLUE }, margin: { left: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Top Solicitantes
    if (solicitanteData.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_BLUE);
      doc.text("Top Solicitantes", 14, y); y += 3;
      (await getAutoTable())(doc, {
        startY: y,
        head: [["Solicitante", "Requisições"]],
        body: solicitanteData.map(s => [s.name, String(s.value)]),
        styles: { fontSize: 8 }, headStyles: { fillColor: DARK_BLUE }, margin: { left: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Reprovadas
    if (reprovadaList.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_BLUE);
      doc.text("Processos Reprovados", 14, y); y += 3;
      (await getAutoTable())(doc, {
        startY: y,
        head: [["Nº", "Data", "Solicitante", "Centro de Custo", "Motivo"]],
        body: reprovadaList.map(r => {
          const motivo = r.historicoStatus.find(h => h.status === "Reprovada")?.observacao || "-";
          return [String(r.numero), new Date(r.dataCriacao).toLocaleDateString("pt-BR"), r.solicitante, r.centroCustoNome, motivo];
        }),
        styles: { fontSize: 7 }, headStyles: { fillColor: [180, 30, 30] }, margin: { left: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Pendentes entrega
    if (pendentesEntrega.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK_BLUE);
      doc.text("Pedidos Pendentes de Entrega", 14, y); y += 3;
      (await getAutoTable())(doc, {
        startY: y,
        head: [["Nº", "Data", "Status", "Solicitante", "Centro de Custo", "Itens", "Urgência"]],
        body: pendentesEntrega.map(r => [
          String(r.numero), new Date(r.dataCriacao).toLocaleDateString("pt-BR"),
          r.status, r.solicitante, r.centroCustoNome, String(r.itens.length), r.urgencia,
        ]),
        styles: { fontSize: 7 }, headStyles: { fillColor: [30, 100, 60] }, margin: { left: 14 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const ph = doc.internal.pageSize.getHeight();
      doc.setDrawColor(200, 200, 200);
      doc.line(14, ph - 20, pw - 14, ph - 20);
      doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal");
      doc.text(`Relatório gerado automaticamente — ${empresa?.nomeFantasia || "SGM Lasant"}`, 14, ph - 14);
      doc.text(`Página ${i} de ${pageCount}`, pw / 2, ph - 14, { align: "center" });
    }

    doc.save("dashboard_compras.pdf");
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-up">
      <DashboardHeader
        title="Dashboard de Compras"
        badge="Compras e Suprimentos"
        description="Indicadores de desempenho do processo de compras."
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        onRefresh={refresh}
        actions={
          <DashboardExportButtons
            title="Dashboard de Compras"
            kpis={() => [
              { label: "Total de requisições", value: totalReqs },
              { label: "Em andamento", value: abertas },
              { label: "Concluídas", value: concluidas },
              { label: "Reprovadas", value: reprovadas },
              { label: "Itens", value: totalItens },
              { label: "Urgentes", value: urgentes, subtitle: "Urgente + Alta" },
              { label: "Tempo médio de aprovação", value: timeMetrics.approvalCount > 0 ? formatHours(timeMetrics.avgApproval) : "N/A" },
              { label: "Tempo médio de conclusão", value: timeMetrics.completionCount > 0 ? formatHours(timeMetrics.avgCompletion) : "N/A" },
            ]}
          />
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div />
        <div className="flex gap-3 items-center flex-wrap">
          <DashboardFilters
            storageKey="dashboard-compras:filters"
            value={filters}
            onChange={setFilters}
            clienteOptions={centroCustoOptions}
            clienteLabel="Centro de Custo"
            statusOptions={statusOptions}
          />
          <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as typeof tipoFiltro)}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="Material">Apenas Materiais</SelectItem>
              <SelectItem value="Serviço">Apenas Serviços</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => setRelatoriosOpen(true)}>
            <FileText className="h-3.5 w-3.5" />Relatórios
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={exportPdf}>
            <FileText className="h-3.5 w-3.5" />Relatório PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <GradientKpiCard icon={ShoppingCart} label="Total" value={totalReqs} gradientIdx={0} />
        <GradientKpiCard icon={Clock} label="Em Andamento" value={abertas} gradientIdx={1} />
        <GradientKpiCard icon={CheckCircle} label="Concluídas" value={concluidas} gradientIdx={2} />
        <GradientKpiCard icon={XCircle} label="Reprovadas" value={reprovadas} gradientIdx={3} />
        <GradientKpiCard icon={Package} label="Itens" value={totalItens} gradientIdx={0} />
        <GradientKpiCard icon={AlertTriangle} label="Urgentes" value={urgentes} gradientIdx={3} subtitle="Urgente + Alta" />
        <GradientKpiCard icon={TrendingUp} label="Tempo Aprovação" value={timeMetrics.approvalCount > 0 ? formatHours(timeMetrics.avgApproval) : "N/A"} gradientIdx={4} subtitle="Média" />
        <GradientKpiCard icon={DollarSign} label="Tempo Conclusão" value={timeMetrics.completionCount > 0 ? formatHours(timeMetrics.avgCompletion) : "N/A"} gradientIdx={5} subtitle="Média" />
      </div>

      {/* Confirmação de valores pós-aprovação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GradientKpiCard icon={TrendingUp} label="Saving" value={savingMetrics.savingFmt} gradientIdx={2} subtitle="Economia real confirmada" />
        <GradientKpiCard icon={CheckCircle} label="Cost Avoidance" value={savingMetrics.avoidanceFmt} gradientIdx={0} subtitle="Preço mantido pós-vencimento" />
        <GradientKpiCard icon={AlertTriangle} label="Reajuste" value={savingMetrics.reajusteFmt} gradientIdx={1} subtitle="Aumento pós-aprovação" />
        <GradientKpiCard icon={DollarSign} label="Impacto Líquido" value={savingMetrics.liquidoFmt} gradientIdx={savingMetrics.liquido <= 0 ? 2 : 3} subtitle="Saving − Reajuste" />
        <GradientKpiCard icon={AlertTriangle} label="Impacto por Atraso de Aprovação" value={savingMetrics.impactoAtrasoFmt} gradientIdx={3} subtitle={`${savingMetrics.itensAtraso} item(ns) • ${savingMetrics.acimaAlcada} acima da alçada`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Confirmação de Valores por Categoria</CardTitle></CardHeader>
        <CardContent>
          {savingMetrics.chart.every(c => c.value === 0) ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma confirmação de valores registrada.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={savingMetrics.chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {savingMetrics.chart.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>


      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Processos por Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por Urgência</CardTitle></CardHeader>
          <CardContent>
            {urgenciaData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={urgenciaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Requisições" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Requisições por Centro de Custo</CardTitle></CardHeader>
          <CardContent>
            {centroCustoData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={centroCustoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="value" name="Requisições" fill="hsl(210, 70%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução Mensal de Solicitações</CardTitle></CardHeader>
          <CardContent>
            {timelineData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" name="Solicitações" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Categories & Solicitante */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top Categorias (por qtd. itens)</CardTitle></CardHeader>
          <CardContent>
            {categoriaData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoriaData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                    {categoriaData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Solicitantes</CardTitle></CardHeader>
          <CardContent>
            {solicitanteData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={solicitanteData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="value" name="Requisições" fill="hsl(260, 60%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Materiais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 10 Materiais (Volume)</CardTitle>
            <p className="text-xs text-muted-foreground">Quantidade total adquirida via Ordens de Compra</p>
          </CardHeader>
          <CardContent>
            {topMaterialVolume.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={topMaterialVolume} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={180} fontSize={10} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString("pt-BR")} un`, "Quantidade"]} />
                  <Bar dataKey="value" name="Quantidade" fill="hsl(190, 70%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 10 Materiais (Valor Financeiro)</CardTitle>
            <p className="text-xs text-muted-foreground">Maior gasto acumulado em Ordens de Compra</p>
          </CardHeader>
          <CardContent>
            {topMaterialValor.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={topMaterialValor} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={180} fontSize={10} />
                  <Tooltip formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Valor"]} />
                  <Bar dataKey="value" name="Valor (R$)" fill="hsl(145, 60%, 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Serviços */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 10 Serviços (Volume)</CardTitle>
            <p className="text-xs text-muted-foreground">Quantidade total contratada via Ordens de Compra</p>
          </CardHeader>
          <CardContent>
            {topServicoVolume.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={topServicoVolume} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={180} fontSize={10} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString("pt-BR")} un`, "Quantidade"]} />
                  <Bar dataKey="value" name="Quantidade" fill="hsl(260, 60%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 10 Serviços (Valor Financeiro)</CardTitle>
            <p className="text-xs text-muted-foreground">Maior gasto acumulado em Ordens de Compra</p>
          </CardHeader>
          <CardContent>
            {topServicoValor.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={topServicoValor} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={180} fontSize={10} />
                  <Tooltip formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Valor"]} />
                  <Bar dataKey="value" name="Valor (R$)" fill="hsl(30, 80%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs with tables */}
      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes de Entrega ({pendentesFiltradas.length})</TabsTrigger>
          <TabsTrigger value="reprovadas">Reprovadas ({reprovadasFiltradas.length})</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria Recente ({auditoriaEventos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9 h-9" placeholder="Buscar por nº, solicitante ou centro de custo..."
                    value={pendBusca} onChange={(e) => { setPendBusca(e.target.value); setPendPage(1); }} />
                </div>
                <Select value={pendStatus} onValueChange={(v) => { setPendStatus(v); setPendPage(1); }}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="Pedido Emitido">Pedido Emitido</SelectItem>
                    <SelectItem value="Em Entrega">Em Entrega</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={pendUrgencia} onValueChange={(v) => { setPendUrgencia(v); setPendPage(1); }}>
                  <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Urgência" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas urgências</SelectItem>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                {(pendBusca || pendStatus !== "todos" || pendUrgencia !== "todas") && (
                  <Button variant="ghost" size="sm" onClick={() => { setPendBusca(""); setPendStatus("todos"); setPendUrgencia("todas"); setPendPage(1); }}>Limpar</Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Urgência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentesFiltradas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum pedido pendente</TableCell></TableRow>
                  ) : paginate(pendentesFiltradas, pendPage, pendSize).paginated.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-bold">{r.numero}</TableCell>
                      <TableCell>{new Date(r.dataCriacao).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{r.solicitante}</TableCell>
                      <TableCell>{r.centroCustoNome}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell>{r.itens.length}</TableCell>
                      <TableCell><Badge variant={r.urgencia === "Urgente" ? "destructive" : "secondary"}>{r.urgencia}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls currentPage={pendPage} totalItems={pendentesFiltradas.length} onPageChange={setPendPage}
                pageSize={pendSize} onPageSizeChange={(s) => { setPendSize(s); setPendPage(1); }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reprovadas">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 h-9" placeholder="Buscar por nº, solicitante, centro de custo ou motivo..."
                  value={repBusca} onChange={(e) => { setRepBusca(e.target.value); setRepPage(1); }} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reprovadasFiltradas.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum processo reprovado</TableCell></TableRow>
                  ) : paginate(reprovadasFiltradas, repPage, repSize).paginated.map(r => {
                    const motivo = r.historicoStatus.find(h => h.status === "Reprovada")?.observacao || "-";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono font-bold">{r.numero}</TableCell>
                        <TableCell>{new Date(r.dataCriacao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{r.solicitante}</TableCell>
                        <TableCell>{r.centroCustoNome}</TableCell>
                        <TableCell className="text-destructive">{motivo}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationControls currentPage={repPage} totalItems={reprovadasFiltradas.length} onPageChange={setRepPage}
                pageSize={repSize} onPageSizeChange={(s) => { setRepSize(s); setRepPage(1); }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9 h-9" placeholder="Buscar por requisição, usuário ou observação..."
                    value={audBusca} onChange={(e) => { setAudBusca(e.target.value); setAudPage(1); }} />
                </div>
                <Select value={audStatus} onValueChange={(v) => { setAudStatus(v); setAudPage(1); }}>
                  <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Ação (Status)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as ações</SelectItem>
                    {auditoriaStatusOpcoes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(audBusca || audStatus !== "todos") && (
                  <Button variant="ghost" size="sm" onClick={() => { setAudBusca(""); setAudStatus("todos"); setAudPage(1); }}>Limpar</Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Requisição</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação (Status)</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoriaEventos.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>
                  ) : paginate(auditoriaEventos, audPage, audSize).paginated.map((ev, i) => (
                    <TableRow key={`${ev.reqNumero}-${ev.dataHora}-${i}`}>
                      <TableCell className="text-xs">{format(new Date(ev.dataHora), "dd-MM-yyyy HH:mm")}</TableCell>
                      <TableCell className="font-mono font-bold">{ev.reqNumero}</TableCell>
                      <TableCell>{ev.usuario}</TableCell>
                      <TableCell><Badge variant="outline">{ev.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{ev.observacao || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls currentPage={audPage} totalItems={auditoriaEventos.length} onPageChange={setAudPage}
                pageSize={audSize} onPageSizeChange={(s) => { setAudSize(s); setAudPage(1); }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      <RelatoriosComprasDialog open={relatoriosOpen} onOpenChange={setRelatoriosOpen} />
    </div>
  );
}
