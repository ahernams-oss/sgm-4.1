import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClientes } from "@/contexts/ClientesContext";
import { useSolicitacoesServicos } from "@/contexts/SolicitacoesServicosContext";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicoes } from "@/contexts/RequisicaoContext";
import { useLicitacoes } from "@/contexts/LicitacoesContext";
import {
  Settings,
  Maximize2,
  Minimize2,
  LogOut,
  ClipboardList,
  ShoppingCart,
  Users,
  Gavel,
  Clock,
  Activity,
  TrendingUp,
} from "lucide-react";

const STORAGE_KEY = "monitor-tv-clientes";
const ROTATION_MS = 3 * 60 * 1000;
const Q4_TOGGLE_MS = 30 * 1000;

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const countBy = <T,>(arr: T[], key: (i: T) => string) => {
  const map: Record<string, number> = {};
  arr.forEach((i) => {
    const k = key(i) || "—";
    map[k] = (map[k] || 0) + 1;
  });
  return map;
};

const isMesAtual = (iso: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const hoje = new Date();
  return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
};

const STATUS_FINAIS_OS = ["Concluída", "Encerrada", "Cancelada", "Faturada"];
const STATUS_FINAIS_SS = ["Concluída", "Cancelada", "Reprovada"];
const STATUS_FINAIS_RC = ["Concluída", "Cancelada", "Recebida", "Reprovada"];
const STATUS_FINAIS_PED = ["Recebido Total", "Cancelado", "Concluído"];
const STATUS_FINAIS_REQ = ["Concluída", "Reprovada"];

// Mapa de cor semântica por status (texto/borda)
const statusColor = (label: string): { dot: string; text: string; bar: string } => {
  const l = label.toLowerCase();
  if (/(conclu|encerr|fatur|venc|recebid)/.test(l))
    return { dot: "bg-emerald-400", text: "text-emerald-300", bar: "from-emerald-500/40 to-emerald-500/0" };
  if (/(cancel|reprov|perd)/.test(l))
    return { dot: "bg-rose-400", text: "text-rose-300", bar: "from-rose-500/40 to-rose-500/0" };
  if (/(aprov|andamento|particip|execu)/.test(l))
    return { dot: "bg-sky-400", text: "text-sky-300", bar: "from-sky-500/40 to-sky-500/0" };
  if (/(aguard|pend|análise|analise|novo)/.test(l))
    return { dot: "bg-amber-400", text: "text-amber-300", bar: "from-amber-500/40 to-amber-500/0" };
  return { dot: "bg-violet-400", text: "text-violet-300", bar: "from-violet-500/40 to-violet-500/0" };
};

const StatusPill = ({ label, count }: { label: string; count: number }) => {
  const c = statusColor(label);
  return (
    <div className="group relative flex items-center justify-between overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/[0.08]">
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r ${c.bar} opacity-60`}
      />
      <div className="relative flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${c.dot} shadow-[0_0_8px_currentColor]`} />
        <span className="text-sm font-medium text-white/90">{label}</span>
      </div>
      <span className={`relative text-xl font-extrabold tabular-nums ${c.text}`}>{count}</span>
    </div>
  );
};

const KpiBox = ({
  label,
  value,
  sub,
  accent = "primary",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "primary" | "emerald" | "amber" | "sky";
}) => {
  const accents: Record<string, string> = {
    primary: "from-violet-500/30 to-fuchsia-500/10 border-violet-400/30",
    emerald: "from-emerald-500/30 to-teal-500/10 border-emerald-400/30",
    amber: "from-amber-500/30 to-orange-500/10 border-amber-400/30",
    sky: "from-sky-500/30 to-cyan-500/10 border-sky-400/30",
  };
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${accents[accent]} px-4 py-3 backdrop-blur`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/70">{label}</div>
      <div className="mt-1 text-2xl font-black tracking-tight text-white drop-shadow">{value}</div>
      {sub && <div className="mt-0.5 text-xs font-medium text-white/60">{sub}</div>}
    </div>
  );
};

interface QuadrantProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badge?: string;
  accent: "violet" | "emerald" | "amber" | "sky";
}

const accentStyles: Record<string, { glow: string; ring: string; chip: string; iconBg: string }> = {
  violet: {
    glow: "before:bg-gradient-to-br before:from-violet-500/20 before:to-fuchsia-500/0",
    ring: "border-violet-400/20",
    chip: "bg-violet-500/20 text-violet-200 border-violet-400/30",
    iconBg: "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/40",
  },
  emerald: {
    glow: "before:bg-gradient-to-br before:from-emerald-500/20 before:to-teal-500/0",
    ring: "border-emerald-400/20",
    chip: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/40",
  },
  amber: {
    glow: "before:bg-gradient-to-br before:from-amber-500/20 before:to-orange-500/0",
    ring: "border-amber-400/20",
    chip: "bg-amber-500/20 text-amber-200 border-amber-400/30",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/40",
  },
  sky: {
    glow: "before:bg-gradient-to-br before:from-sky-500/20 before:to-cyan-500/0",
    ring: "border-sky-400/20",
    chip: "bg-sky-500/20 text-sky-200 border-sky-400/30",
    iconBg: "bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/40",
  },
};

const Quadrant = ({ title, icon, children, badge, accent }: QuadrantProps) => {
  const a = accentStyles[accent];
  return (
    <Card
      className={`relative flex h-full flex-col overflow-hidden border ${a.ring} bg-[#0d0820]/70 text-white shadow-2xl backdrop-blur-xl before:pointer-events-none before:absolute before:inset-0 before:opacity-60 ${a.glow} after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-[2px] after:bg-gradient-to-r after:from-transparent after:via-white/40 after:to-transparent`}
    >
      <CardHeader className="relative z-10 flex flex-row items-center justify-between border-b border-white/5 bg-black/20 px-5 py-3">
        <CardTitle className="flex items-center gap-3 text-base font-bold uppercase tracking-wider text-white">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.iconBg}`}>
            {icon}
          </span>
          {title}
        </CardTitle>
        {badge && (
          <Badge variant="outline" className={`${a.chip} px-2.5 py-1 text-xs font-semibold backdrop-blur`}>
            {badge}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="relative z-10 flex-1 overflow-hidden p-4">{children}</CardContent>
    </Card>
  );
};

const MonitorTV = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const { clientes } = useClientes();
  const { solicitacoes } = useSolicitacoesServicos();
  const { ordens } = useOrdensServico();
  const { requisicoes: rcs } = useRequisicaoCompras();
  const { pedidos } = usePedidoCompra();
  const { requisicoes: rps } = useRequisicoes();
  const { licitacoes } = useLicitacoes();

  const [clientesSelecionados, setClientesSelecionados] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clientesSelecionados));
  }, [clientesSelecionados]);

  // Apenas registros do tipo "Cliente" (exclui Fornecedores)
  const apenasClientes = useMemo(() => clientes.filter((c) => c.tipo === "Cliente"), [clientes]);

  const clientesAtivos = useMemo(() => {
    const ativos = apenasClientes.filter((c) => clientesSelecionados.length === 0 || clientesSelecionados.includes(c.id));
    return ativos.length > 0 ? ativos : apenasClientes;
  }, [apenasClientes, clientesSelecionados]);

  const [idxCliente, setIdxCliente] = useState(0);
  const [tickRestante, setTickRestante] = useState(ROTATION_MS / 1000);

  useEffect(() => {
    if (clientesAtivos.length === 0) return;
    setIdxCliente((i) => i % clientesAtivos.length);
  }, [clientesAtivos.length]);

  useEffect(() => {
    if (clientesAtivos.length <= 1) return;
    const i = setInterval(() => setIdxCliente((v) => (v + 1) % clientesAtivos.length), ROTATION_MS);
    return () => clearInterval(i);
  }, [clientesAtivos.length]);

  useEffect(() => {
    setTickRestante(ROTATION_MS / 1000);
    const i = setInterval(() => setTickRestante((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(i);
  }, [idxCliente]);

  const clienteAtual = clientesAtivos[idxCliente];

  const [q4View, setQ4View] = useState<"sessoes" | "kpis">("sessoes");
  useEffect(() => {
    const i = setInterval(() => setQ4View((v) => (v === "sessoes" ? "kpis" : "sessoes")), Q4_TOGGLE_MS);
    return () => clearInterval(i);
  }, []);

  const filtraEmAbertoMaisMes = <T extends { situacao?: string; status?: string; createdAt?: string; created_at?: string; dataCriacao?: string }>(
    arr: T[],
    statusFinais: string[],
  ) => {
    return arr.filter((it) => {
      const st = (it.situacao || it.status || "") as string;
      const finalizado = statusFinais.some((f) => st.toLowerCase().includes(f.toLowerCase()));
      if (!finalizado) return true;
      const dt = (it as any).createdAt || (it as any).created_at || (it as any).dataCriacao;
      return isMesAtual(dt);
    });
  };

  const ssCliente = useMemo(() => {
    if (!clienteAtual) return [];
    return filtraEmAbertoMaisMes(
      solicitacoes.filter((s) => s.clienteId === clienteAtual.id),
      STATUS_FINAIS_SS,
    );
  }, [solicitacoes, clienteAtual]);

  const osCliente = useMemo(() => {
    if (!clienteAtual) return [];
    return filtraEmAbertoMaisMes(
      ordens.filter((o) => o.clienteId === clienteAtual.id),
      STATUS_FINAIS_OS,
    );
  }, [ordens, clienteAtual]);

  const valorOsCliente = useMemo(() => {
    return osCliente.reduce((sum, o) => {
      const subtotal =
        (o.materiais || []).reduce((s, m) => s + (Number(m.valorTotal) || 0), 0) +
        (o.materiaisEstoque || []).reduce((s, m) => s + (Number(m.valorTotal) || 0), 0);
      const bdi = Number(o.bdi) || 0;
      return sum + subtotal * (1 + bdi / 100);
    }, 0);
  }, [osCliente]);

  const ssStatus = useMemo(() => countBy(ssCliente, (s: any) => s.situacao), [ssCliente]);
  const osStatus = useMemo(() => countBy(osCliente, (o: any) => o.situacao), [osCliente]);

  const rcsCliente = useMemo(() => {
    if (!clienteAtual) return [];
    return filtraEmAbertoMaisMes(
      rcs.filter((r) => (r.centroCustoNome || "").toLowerCase().includes(clienteAtual.nome.toLowerCase())),
      STATUS_FINAIS_RC,
    );
  }, [rcs, clienteAtual]);

  const rcsConsolidado = useMemo(() => filtraEmAbertoMaisMes(rcs, STATUS_FINAIS_RC), [rcs]);
  const pedidosConsolidado = useMemo(() => filtraEmAbertoMaisMes(pedidos, STATUS_FINAIS_PED), [pedidos]);

  const rcsStatus = useMemo(() => countBy(rcsCliente, (r: any) => r.status), [rcsCliente]);
  const pedidosStatus = useMemo(() => countBy(pedidosConsolidado, (p: any) => p.status), [pedidosConsolidado]);
  const valorPedidosConsolidado = useMemo(
    () => pedidosConsolidado.reduce((s, p) => s + (Number(p.valorTotal) || 0), 0),
    [pedidosConsolidado],
  );

  const rpsCliente = useMemo(() => {
    if (!clienteAtual) return [];
    return rps.filter(
      (r) =>
        !STATUS_FINAIS_REQ.includes(r.status) &&
        (r.unidade || "").toLowerCase().includes(clienteAtual.nome.toLowerCase()),
    );
  }, [rps, clienteAtual]);

  const rpsConsolidado = useMemo(() => rps.filter((r) => !STATUS_FINAIS_REQ.includes(r.status)), [rps]);
  const rpsStatus = useMemo(() => countBy(rpsCliente, (r: any) => r.status), [rpsCliente]);
  const rpsConsolStatus = useMemo(() => countBy(rpsConsolidado, (r: any) => r.status), [rpsConsolidado]);

  const proxSessoes = useMemo(() => {
    const hoje = new Date();
    const lim = new Date();
    lim.setDate(lim.getDate() + 30);
    return licitacoes
      .filter((l) => {
        if (!l.dataSessao) return false;
        const d = new Date(l.dataSessao);
        return d >= hoje && d <= lim;
      })
      .sort((a, b) => new Date(a.dataSessao).getTime() - new Date(b.dataSessao).getTime())
      .slice(0, 8);
  }, [licitacoes]);

  const licStatus = useMemo(() => countBy(licitacoes, (l: any) => l.status), [licitacoes]);
  const valorEstimadoTotal = useMemo(
    () => licitacoes.filter((l) => !["Perdida", "Cancelada"].includes(l.status))
      .reduce((s, l) => s + (Number(l.valorEstimado) || 0), 0),
    [licitacoes],
  );
  const taxaExito = useMemo(() => {
    const julgadas = licitacoes.filter((l) => ["Vencida", "Perdida"].includes(l.status)).length;
    const ganhas = licitacoes.filter((l) => l.status === "Vencida").length;
    return julgadas > 0 ? Math.round((ganhas / julgadas) * 100) : 0;
  }, [licitacoes]);
  const topOportunidades = useMemo(
    () =>
      licitacoes
        .filter((l) => ["Novo", "Em Análise", "Participando"].includes(l.status))
        .sort((a, b) => (b.valorEstimado || 0) - (a.valorEstimado || 0))
        .slice(0, 6),
    [licitacoes],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const toggleFs = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFs(true);
    } else {
      await document.exitFullscreen();
      setIsFs(false);
    }
  };
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Progresso da rotação (0-100)
  const progresso = clientesAtivos.length > 1 ? 100 - (tickRestante / (ROTATION_MS / 1000)) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden p-4 text-white"
      style={{
        background:
          "radial-gradient(1200px 600px at 10% -10%, rgba(139,92,246,0.25), transparent 60%), radial-gradient(1000px 600px at 100% 100%, rgba(34,211,238,0.15), transparent 60%), linear-gradient(135deg, #060212 0%, #0a0420 50%, #0d0628 100%)",
      }}
    >
      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Header */}
      <div className="relative z-10 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/50">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-black leading-tight tracking-tight">
                Painel de Indicadores{" "}
                <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Lasant
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Tempo real
              </div>
            </div>
          </div>

          {clienteAtual && (
            <div className="ml-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Cliente em foco
                </span>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                  {idxCliente + 1}/{clientesAtivos.length}
                </span>
              </div>
              <div className="text-lg font-bold text-white">{clienteAtual.nome}</div>
              {clientesAtivos.length > 1 && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-white/50" />
                  <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all duration-1000 ease-linear"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold tabular-nums text-white/60">
                    {Math.floor(tickRestante / 60)}:{String(tickRestante % 60).padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-right">
            <div className="text-2xl font-black tabular-nums leading-none text-white">
              {now.toLocaleTimeString("pt-BR")}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
              {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-white/15 bg-white/5 text-white hover:bg-white/15"
              >
                <Settings className="mr-1 h-4 w-4" /> Clientes
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="mb-2 text-sm font-semibold">Clientes a exibir no painel</div>
              <div className="mb-2 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setClientesSelecionados([])}>
                  Todos
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setClientesSelecionados(apenasClientes.map((c) => c.id))}>
                  Marcar todos
                </Button>
              </div>
              <ScrollArea className="h-72">
                <div className="space-y-1.5 pr-2">
                  {apenasClientes.map((c) => {
                    const checked = clientesSelecionados.includes(c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-muted">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setClientesSelecionados((prev) =>
                              v ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                            );
                          }}
                        />
                        <span className="text-sm">{c.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFs}
            className="border-white/15 bg-white/5 text-white hover:bg-white/15"
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              navigate("/");
            }}
            className="border-white/15 bg-white/5 text-white hover:bg-white/15"
          >
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>

      {/* Grid 2x2 */}
      <div className="relative z-10 grid h-[calc(100vh-110px)] grid-cols-2 grid-rows-2 gap-4">
        {/* Q1 - SS + OS */}
        <Quadrant
          title="Solicitações & Ordens de Serviço"
          icon={<ClipboardList className="h-5 w-5" />}
          badge={clienteAtual ? clienteAtual.nome : "—"}
          accent="violet"
        >
          <div className="grid h-full grid-cols-2 gap-4">
            <div className="flex flex-col">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                  Solicitações
                </span>
                <span className="text-3xl font-black tabular-nums text-white">{ssCliente.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-1">
                {Object.keys(ssStatus).length === 0 ? (
                  <p className="py-8 text-center text-sm italic text-white/30">Sem registros</p>
                ) : (
                  Object.entries(ssStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => <StatusPill key={k} label={k} count={v} />)
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                  Ordens · {osCliente.length}
                </span>
                <span className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-lg font-black tabular-nums text-transparent">
                  {fmtMoney(valorOsCliente)}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-1">
                {Object.keys(osStatus).length === 0 ? (
                  <p className="py-8 text-center text-sm italic text-white/30">Sem registros</p>
                ) : (
                  Object.entries(osStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => <StatusPill key={k} label={k} count={v} />)
                )}
              </div>
            </div>
          </div>
        </Quadrant>

        {/* Q2 - Compras */}
        <Quadrant
          title="Compras (RCS & Pedidos)"
          icon={<ShoppingCart className="h-5 w-5" />}
          badge={`${clienteAtual?.nome ?? "—"} + Geral`}
          accent="emerald"
        >
          <div className="grid h-full grid-cols-2 gap-4">
            <div className="flex flex-col">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                  RCS deste cliente
                </span>
                <span className="text-3xl font-black tabular-nums text-white">{rcsCliente.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-1">
                {Object.keys(rcsStatus).length === 0 ? (
                  <p className="py-8 text-center text-sm italic text-white/30">Sem registros</p>
                ) : (
                  Object.entries(rcsStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => <StatusPill key={k} label={k} count={v} />)
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/60">
                Consolidado Geral
              </div>
              <div className="grid grid-cols-2 gap-2">
                <KpiBox label="RCS abertas" value={rcsConsolidado.length} accent="emerald" />
                <KpiBox
                  label="Pedidos"
                  value={pedidosConsolidado.length}
                  sub={fmtMoney(valorPedidosConsolidado)}
                  accent="primary"
                />
              </div>
              <div className="mt-3 flex-1 space-y-2 overflow-auto pr-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Pedidos por status
                </div>
                {Object.entries(pedidosStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <StatusPill key={k} label={k} count={v} />
                  ))}
              </div>
            </div>
          </div>
        </Quadrant>

        {/* Q3 - Requisições de Pessoal */}
        <Quadrant
          title="Requisições de Pessoal"
          icon={<Users className="h-5 w-5" />}
          badge={`${clienteAtual?.nome ?? "—"} + Geral`}
          accent="amber"
        >
          <div className="grid h-full grid-cols-2 gap-4">
            <div className="flex flex-col">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                  Por unidade/cliente
                </span>
                <span className="text-3xl font-black tabular-nums text-white">{rpsCliente.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-1">
                {Object.keys(rpsStatus).length === 0 ? (
                  <p className="py-8 text-center text-sm italic text-white/30">Sem registros</p>
                ) : (
                  Object.entries(rpsStatus)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => <StatusPill key={k} label={k} count={v} />)
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                  Consolidado
                </span>
                <span className="text-3xl font-black tabular-nums text-amber-300">{rpsConsolidado.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-1">
                {Object.entries(rpsConsolStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <StatusPill key={k} label={k} count={v} />
                  ))}
              </div>
            </div>
          </div>
        </Quadrant>

        {/* Q4 - Licitações */}
        <Quadrant
          title="Licitações"
          icon={<Gavel className="h-5 w-5" />}
          badge={q4View === "sessoes" ? "Próximas Sessões" : "KPIs & Ranking"}
          accent="sky"
        >
          {q4View === "sessoes" ? (
            <div className="flex h-full flex-col">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/60">
                Sessões nos próximos 30 dias
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-1">
                {proxSessoes.length === 0 ? (
                  <p className="py-8 text-center text-sm italic text-white/30">Nenhuma sessão agendada</p>
                ) : (
                  proxSessoes.map((l) => {
                    const dias = Math.ceil(
                      (new Date(l.dataSessao).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                    );
                    const urgente = dias <= 7;
                    return (
                      <div
                        key={l.id}
                        className={`group relative flex items-center justify-between overflow-hidden rounded-lg border ${urgente ? "border-rose-400/30 bg-rose-500/5" : "border-white/10 bg-white/[0.04]"} px-3 py-2.5 backdrop-blur-sm transition-all hover:border-white/30`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-white">
                            {l.numeroEdital || l.numeroProcesso || "—"}{" "}
                            <span className="text-white/50">·</span>{" "}
                            <span className="font-medium text-white/80">{l.orgaoLicitante}</span>
                          </div>
                          <div className="truncate text-xs text-white/50">{l.objetoResumido}</div>
                        </div>
                        <div className="ml-3 text-right">
                          <div className={`text-sm font-black tabular-nums ${urgente ? "text-rose-300" : "text-sky-300"}`}>
                            {new Date(l.dataSessao).toLocaleDateString("pt-BR")}
                          </div>
                          <div className="text-[10px] font-semibold uppercase text-white/50">
                            em {dias}d · {fmtMoney(l.valorEstimado || 0)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                {Object.entries(licStatus)
                  .slice(0, 6)
                  .map(([k, v]) => {
                    const c = statusColor(k);
                    return (
                      <div
                        key={k}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-widest text-white/50">
                          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} /> {k}
                        </div>
                        <div className={`text-lg font-black tabular-nums ${c.text}`}>{v}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="mb-3 grid grid-cols-3 gap-2">
                <KpiBox label="Total" value={licitacoes.length} accent="sky" />
                <KpiBox label="Valor estimado" value={fmtMoney(valorEstimadoTotal)} accent="emerald" />
                <KpiBox label="Taxa de êxito" value={`${taxaExito}%`} accent="amber" />
              </div>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/60">
                <TrendingUp className="h-3.5 w-3.5 text-sky-300" /> Maiores oportunidades em aberto
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-1">
                {topOportunidades.length === 0 ? (
                  <p className="py-8 text-center text-sm italic text-white/30">Sem oportunidades em aberto</p>
                ) : (
                  topOportunidades.map((l, i) => (
                    <div
                      key={l.id}
                      className="group flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm transition-all hover:border-sky-400/30"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/30 to-cyan-500/10 text-sm font-black text-sky-200">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">{l.orgaoLicitante}</div>
                        <div className="truncate text-xs text-white/50">{l.objetoResumido}</div>
                      </div>
                      <div className="ml-2 text-right">
                        <div className="bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-sm font-black tabular-nums text-transparent">
                          {fmtMoney(l.valorEstimado || 0)}
                        </div>
                        <div className="text-[10px] font-semibold uppercase text-white/50">{l.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </Quadrant>
      </div>
    </div>
  );
};

export default MonitorTV;
