import React, { useState, useEffect, useMemo } from "react";
import { Calendar, Search, FileDown, Filter, AlertTriangle, FileText, UserPlus, Users, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useCargos } from "@/contexts/CargosContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { gerarPdfFerias, gerarPdfEscalaFerias, gerarExcelFerias } from "@/lib/gerarRelatoriosFerias";
import { enviarRelatorioFeriasAgora } from "@/lib/enviarRelatorioFerias";
import { Mail } from "lucide-react";

const ANTECEDENCIAS_ALERTA = [60, 50, 40, 30, 20, 10];

interface FeriasRow {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_limite_concessao: string;
  dias_direito: number;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  dias_gozados: number;
  dias_abonados: number;
  status: string;
  observacoes: string;
  anexo_url: string | null;
}

const MapaFerias = () => {
  const { funcionarios } = useFuncionarios();
  const { clientes } = useClientes();
  const { cargos } = useCargos();

  const [ferias, setFerias] = useState<FeriasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroVencimento, setFiltroVencimento] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [escalaOpen, setEscalaOpen] = useState(false);
  const [enviandoRh, setEnviandoRh] = useState(false);

  const enviarAoRh = async () => {
    setEnviandoRh(true);
    try {
      const r = await enviarRelatorioFeriasAgora("Envio manual pelo Mapa de Férias", { ignorarIntervalo: true });
      if (r.enviado) toast.success("Relatórios (PDF e Excel) enviados ao e-mail do RH.");
      else toast.error(r.motivoSkip || "Não foi possível enviar.");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar relatórios ao RH.");
    } finally {
      setEnviandoRh(false);
    }
  };

  const fetchFerias = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('ferias')
      .select('*')
      .order('data_limite_concessao', { ascending: true });
    if (error) { console.error(error); toast.error('Erro ao carregar férias.'); }
    else setFerias((data as FeriasRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFerias(); }, []);

  // Funcionários indisponíveis para cobertura (de férias, em gozo ou já em período crítico)
  const indisponiveis = useMemo(() => {
    const hoje = new Date();
    const set = new Set<string>();
    ferias.forEach((f) => {
      const st = (f.status || "").toLowerCase();
      if (["em gozo", "aprovada", "gozada"].includes(st)) set.add(f.funcionario_id);
      if (f.data_limite_concessao) {
        const d = Math.ceil((new Date(f.data_limite_concessao + 'T00:00:00').getTime() - hoje.getTime()) / 86400000);
        if (d <= 60 && !["concluída", "concluida", "gozada", "paga"].includes(st)) set.add(f.funcionario_id);
      }
    });
    return set;
  }, [ferias]);

  const enriched = useMemo(() => {
    return ferias.map((f) => {
      const func = funcionarios.find((x) => x.id === f.funcionario_id);
      const cliente = clientes.find((c) => c.id === func?.clienteId);
      const cargo = cargos.find((c) => c.id === func?.cargoId);
      const hoje = new Date();
      const lim = new Date(f.data_limite_concessao + 'T00:00:00');
      const diff = Math.ceil((lim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      const substitutos = func
        ? funcionarios
            .filter((x) =>
              x.id !== func.id &&
              x.cargoId && x.cargoId === func.cargoId &&
              (x.status || "Ativo") === "Ativo" &&
              !indisponiveis.has(x.id))
            .sort((a, b) => Number(b.clienteId === func.clienteId) - Number(a.clienteId === func.clienteId))
            .slice(0, 3)
            .map((x) => ({
              id: x.id,
              nome: x.nome,
              mesmoPosto: x.clienteId === func.clienteId,
              clienteNome: clientes.find((c) => c.id === x.clienteId)?.nome || "—",
            }))
        : [];
      const critico = f.status !== 'Concluída' && diff <= 60;
      return {
        ...f,
        clienteId: func?.clienteId || "",
        clienteNome: cliente?.nome || "—",
        cargoNome: cargo?.nome || "—",
        cargoId: func?.cargoId || "",
        diasParaVencer: diff,
        substitutos,
        precisaTemporario: critico && substitutos.length === 0,
        critico,
      };
    });
  }, [ferias, funcionarios, clientes, cargos, indisponiveis]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (filtroCliente !== "todos") r = r.filter((f) => f.clienteNome === filtroCliente);
    if (filtroStatus !== "todos") r = r.filter((f) => f.status === filtroStatus);
    if (filtroVencimento === "vencidas") r = r.filter((f) => f.diasParaVencer < 0 && f.status !== 'Concluída');
    else if (filtroVencimento === "30d") r = r.filter((f) => f.diasParaVencer >= 0 && f.diasParaVencer <= 30 && f.status !== 'Concluída');
    else if (filtroVencimento === "60d") r = r.filter((f) => f.diasParaVencer >= 0 && f.diasParaVencer <= 60 && f.status !== 'Concluída');
    else if (filtroVencimento === "criticas") r = r.filter((f) => f.critico);
    else if (filtroVencimento === "semcobertura") r = r.filter((f) => f.precisaTemporario);
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter((f) =>
        (f.funcionario_nome || "").toLowerCase().includes(s) ||
        f.clienteNome.toLowerCase().includes(s) ||
        f.cargoNome.toLowerCase().includes(s)
      );
    }
    return r;
  }, [enriched, filtroCliente, filtroStatus, filtroVencimento, search]);

  const { paginated, totalPages, safePage } = paginate(filtered, page, pageSize);

  const clientesUnicos = useMemo(() => {
    const set = new Set(enriched.map((f) => f.clienteNome).filter((n) => n !== "—"));
    return Array.from(set).sort();
  }, [enriched]);

  const stats = useMemo(() => {
    const vencidas = enriched.filter((f) => f.diasParaVencer < 0 && f.status !== 'Concluída').length;
    const proximas = enriched.filter((f) => f.diasParaVencer >= 0 && f.diasParaVencer <= 30 && f.status !== 'Concluída').length;
    const emGozo = enriched.filter((f) => f.status === 'Em gozo').length;
    const programadas = enriched.filter((f) => f.status === 'Programada').length;
    const semCobertura = enriched.filter((f) => f.precisaTemporario).length;
    return { vencidas, proximas, emGozo, programadas, semCobertura };
  }, [enriched]);

  // Escala sugerida: prioriza limite mais próximo e evita alocar o mesmo substituto duas vezes
  const escala = useMemo(() => {
    const usados = new Set<string>();
    return enriched
      .filter((f) => f.critico)
      .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
      .map((f) => {
        const livre = f.substitutos.find((s) => !usados.has(s.id));
        if (livre) usados.add(livre.id);
        const base = new Date(f.data_limite_concessao + 'T00:00:00');
        const dias = f.dias_direito || 30;
        const fim = new Date(base.getTime() - 5 * 86400000);
        const inicio = new Date(fim.getTime() - (dias - 1) * 86400000);
        const fmt = (d: Date) => d.toLocaleDateString('pt-BR');
        return {
          ...f,
          precisaTemporario: !livre,
          substitutoEscolhido: livre ? `${livre.nome}${livre.mesmoPosto ? ' (mesmo posto)' : ` (remanejar de ${livre.clienteNome})`}` : '',
          inicioSugerido: fmt(inicio),
          fimSugerido: fmt(fim),
        };
      });
  }, [enriched]);

  const getBadge = (dias: number, status: string) => {
    if (status === 'Concluída') return { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
    if (status === 'Em gozo') return { label: 'Em gozo', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    if (dias < 0) return { label: 'Vencida', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (dias <= 30) return { label: `${dias}d`, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (dias <= 60) return { label: `${dias}d`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: `${dias}d`, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  };

  const exportCSV = () => {
    const headers = ['Funcionário', 'Cliente', 'Cargo', 'Período Aquisitivo', 'Limite Concessão', 'Status', 'Dias Direito', 'Início Gozo', 'Fim Gozo', 'Dias Gozados', 'Dias Abonados', 'Dias p/ Limite', 'Cobertura Sugerida'];
    const rows = filtered.map((f) => [
      f.funcionario_nome,
      f.clienteNome,
      f.cargoNome,
      `${f.periodo_aquisitivo_inicio.split('-').reverse().join('/')} a ${f.periodo_aquisitivo_fim.split('-').reverse().join('/')}`,
      f.data_limite_concessao.split('-').reverse().join('/'),
      f.status,
      String(f.dias_direito),
      f.data_inicio_gozo ? f.data_inicio_gozo.split('-').reverse().join('/') : '',
      f.data_fim_gozo ? f.data_fim_gozo.split('-').reverse().join('/') : '',
      String(f.dias_gozados || 0),
      String(f.dias_abonados || 0),
      String(f.diasParaVencer),
      f.precisaTemporario ? 'Contratar temporário' : f.substitutos.map((s) => s.nome).join(' | '),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapa-ferias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa de Férias</h1>
            <p className="text-sm text-muted-foreground">Acompanhe os períodos aquisitivos e a concessão de férias dos funcionários.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={enviarAoRh} disabled={enviandoRh}>
            <Mail className="h-4 w-4 mr-2" /> {enviandoRh ? "Enviando..." : "Enviar ao RH"}
          </Button>
          <Button variant="outline" onClick={() => setEscalaOpen(true)}>
            <CalendarClock className="h-4 w-4 mr-2" /> Escala Sugerida
          </Button>
          <Button variant="outline" onClick={() => {
            const vencLabels: Record<string, string> = {
              vencidas: "Vencidas", "30d": "Críticas (≤ 30 dias)", "60d": "Atenção (≤ 60 dias)",
              criticas: "Período crítico", semcobertura: "Sem cobertura interna",
            };
            gerarPdfFerias(filtered as any, {
              filtros: {
                cliente: filtroCliente !== "todos" ? filtroCliente : undefined,
                status: filtroStatus !== "todos" ? filtroStatus : undefined,
                vencimento: filtroVencimento !== "todos" ? (vencLabels[filtroVencimento] || filtroVencimento) : undefined,
                busca: search.trim() || undefined,
              },
            });
            toast.success("PDF gerado.");
          }}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" onClick={() => { gerarExcelFerias(filtered as any, escala as any); toast.success("Excel gerado."); }}>
            <FileDown className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <FileDown className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-xs text-muted-foreground">Vencidas</p>
          <p className="text-2xl font-bold text-red-600">{stats.vencidas}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-xs text-muted-foreground">Vencem em 30 dias</p>
          <p className="text-2xl font-bold text-amber-600">{stats.proximas}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-xs text-muted-foreground">Em gozo</p>
          <p className="text-2xl font-bold text-blue-600">{stats.emGozo}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card">
          <p className="text-xs text-muted-foreground">Programadas</p>
          <p className="text-2xl font-bold text-primary">{stats.programadas}</p>
        </div>
        <div className={`rounded-lg border p-4 bg-card ${stats.semCobertura > 0 ? "border-red-500/60 animate-blink-row" : "border-border"}`}>
          <p className="text-xs text-muted-foreground">Sem cobertura</p>
          <p className="text-2xl font-bold text-red-600">{stats.semCobertura}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por funcionário, cliente ou cargo..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={filtroCliente} onValueChange={(v) => { setFiltroCliente(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Clientes</SelectItem>
            {clientesUnicos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="A vencer">A vencer</SelectItem>
            <SelectItem value="Programada">Programada</SelectItem>
            <SelectItem value="Em gozo">Em gozo</SelectItem>
            <SelectItem value="Concluída">Concluída</SelectItem>
            <SelectItem value="Vencida">Vencida</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroVencimento} onValueChange={(v) => { setFiltroVencimento(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Vencimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Vencimentos</SelectItem>
            <SelectItem value="vencidas">Apenas Vencidas</SelectItem>
            <SelectItem value="30d">Vencem em 30 dias</SelectItem>
            <SelectItem value="60d">Vencem em 60 dias</SelectItem>
            <SelectItem value="criticas">Período crítico (≤ 60 dias)</SelectItem>
            <SelectItem value="semcobertura">Sem cobertura (contratar temporário)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
      ) : paginated.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum período de férias encontrado.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Período Aquisitivo</TableHead>
                <TableHead className="text-center">Limite</TableHead>
                <TableHead className="text-center">Vencimento</TableHead>
                <TableHead>Gozo</TableHead>
                <TableHead className="text-center">Dias</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cobertura do posto</TableHead>
                <TableHead className="text-center">Anexo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((f) => {
                const badge = getBadge(f.diasParaVencer, f.status);
                const gozo = f.data_inicio_gozo
                  ? `${f.data_inicio_gozo.split('-').reverse().join('/')}${f.data_fim_gozo ? ' a ' + f.data_fim_gozo.split('-').reverse().join('/') : ''}`
                  : '—';
                return (
                  <TableRow
                    key={f.id}
                    className={
                      f.critico
                        ? f.diasParaVencer <= 30
                          ? "animate-blink-row"
                          : "animate-blink-row-warn"
                        : undefined
                    }
                  >
                    <TableCell className="font-medium">{f.funcionario_nome}</TableCell>
                    <TableCell>{f.clienteNome}</TableCell>
                    <TableCell>{f.cargoNome}</TableCell>
                    <TableCell className="text-sm">
                      {f.periodo_aquisitivo_inicio.split('-').reverse().join('/')} a {f.periodo_aquisitivo_fim.split('-').reverse().join('/')}
                    </TableCell>
                    <TableCell className="text-center">{f.data_limite_concessao.split('-').reverse().join('/')}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${badge.cls} text-xs font-medium`}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{gozo}</TableCell>
                    <TableCell className="text-center text-sm">
                      {f.dias_gozados || 0}/{f.dias_direito}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{f.status}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {!f.critico ? (
                        <span className="text-muted-foreground">—</span>
                      ) : f.precisaTemporario ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                          <UserPlus className="h-3.5 w-3.5" /> Contratar temporário
                        </span>
                      ) : (
                        <span className="inline-flex items-start gap-1 text-emerald-700 dark:text-emerald-400">
                          <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>
                            {f.substitutos.map((s) => `${s.nome}${s.mesmoPosto ? "" : ` (${s.clienteNome})`}`).join(", ")}
                          </span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {f.anexo_url ? (
                        <a href={f.anexo_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex">
                          <FileText className="h-4 w-4" />
                        </a>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationControls
        currentPage={safePage}
        totalItems={filtered.length}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />

      <Dialog open={escalaOpen} onOpenChange={setEscalaOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" /> Escala Sugerida de Férias
            </DialogTitle>
          </DialogHeader>
          {escala.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => gerarPdfEscalaFerias(escala as any)}>
                <FileText className="h-4 w-4 mr-2" /> Exportar PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => gerarExcelFerias(filtered as any, escala as any)}>
                <FileDown className="h-4 w-4 mr-2" /> Exportar Excel
              </Button>
            </div>
          )}
          {escala.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum período em fase crítica (≤ 60 dias) para escalonar.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Sugestão gerada priorizando o limite de concessão mais próximo e garantindo que nenhum posto fique descoberto.
                Quando não há colaborador do mesmo cargo disponível, o sistema indica contratação temporária.
              </p>
              {escala.map((e) => (
                <div key={e.id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{e.funcionario_nome}</span>
                    <Badge className={e.precisaTemporario ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                      {e.precisaTemporario ? "Contratação temporária" : "Cobertura interna"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {e.cargoNome} · {e.clienteNome} · Limite {e.data_limite_concessao.split('-').reverse().join('/')} ({e.diasParaVencer} dias)
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Janela sugerida de gozo: </span>
                    <span className="font-medium">{e.inicioSugerido} a {e.fimSugerido}</span> ({e.dias_direito} dias)
                  </p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Substituto: </span>
                    {e.precisaTemporario
                      ? <span className="text-red-600 font-medium">Sem colaborador de mesmo cargo disponível — abrir RP temporária</span>
                      : <span className="font-medium">{e.substitutoEscolhido}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> CLT - Art. 134</p>
        <p>O período de concessão das férias é de até 12 meses após o término do período aquisitivo.</p>
        <p>
          Envio automático: a cada atualização do mapa de férias (inclusão, exclusão ou anexo), o sistema gera os
          relatórios em PDF e Excel e envia por e-mail ao RH (endereço de RH em Dados da Empresa). Alterações em
          sequência são agrupadas em um único envio, com intervalo mínimo de 15 minutos entre disparos automáticos.
        </p>
      </div>
    </div>
  );
};

export default MapaFerias;
