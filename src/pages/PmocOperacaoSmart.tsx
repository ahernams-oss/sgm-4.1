import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fan, MapPin, Clock, Camera, Play, ArrowRight, RefreshCw, Search, CheckCircle2, User, Loader2 } from "lucide-react";
import { usePmoc } from "@/contexts/PmocContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { supabase } from "@/integrations/supabase/client";
import { gravarPmocSmart } from "@/lib/pmocSmart.functions";
import { SMART_ETAPAS, etapaSmart, podeIniciarSmart, type SmartEtapa, type SmartExecucao } from "@/lib/pmocSmart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TomadorSelect from "@/components/financeiro/TomadorSelect";
import SmartManutencao from "@/components/pmoc/SmartManutencao";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tomEtapa: Record<SmartEtapa, string> = { Disponível: "border-t-muted-foreground", "Em execução": "border-t-primary", "Aguardando Confirmação": "border-t-accent", Concluída: "border-t-success" };
export default function PmocOperacaoSmart() {
  const { atividades, loading } = usePmoc();
  const { equipamentos } = useEquipamentos();
  const { clientes } = useClientes();
  const { clientesPermitidosIds } = useAuth();
  const { tem } = usePermissao();
  const podeOperar = tem("pmoc.editar") || tem("pmoc.criar");
  const gravar = useServerFn(gravarPmocSmart);
  const [busca, setBusca] = useState(""), [cliente, setCliente] = useState(""), [local, setLocal] = useState("todos"), [periodo, setPeriodo] = useState("todos");
  const [etapa, setEtapa] = useState<SmartEtapa>("Disponível");
  const [busy, setBusy] = useState("");
  const [alvo, setAlvo] = useState<{ execucao: SmartExecucao; titulo: string; local: string; periodicidade: string } | null>(null);
  const { data: execucoes = [], refetch, isFetching, error } = useQuery({
    queryKey: ["pmoc_smart_execucoes", [...clientesPermitidosIds].sort().join(",")],
    queryFn: async () => {
      const linhas: SmartExecucao[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase.from("pmoc_atividades_execucoes").select("*").order("created_at", { ascending: false }).order("id").range(inicio, inicio + 999);
        if (error) throw new Error("Não foi possível carregar as manutenções.");
        const pagina = (data || []) as unknown as SmartExecucao[];
        linhas.push(...pagina);
        if (pagina.length < 1000) return linhas;
      }
    },
    refetchInterval: alvo ? false : 30_000,
  });
  const cartoes = useMemo(() => atividades.filter((a) => a.ativa).flatMap((atividade) => {
    const eqs = equipamentos.filter((e) => clientesPermitidosIds.includes(e.clienteId) && (atividade.equipamentoId ? e.id === atividade.equipamentoId : e.planoManutencao === atividade.planoId));
    return eqs.map((equipamento) => {
      const historico = execucoes.filter((x) => x.atividade_id === atividade.id && x.equipamento_id === equipamento.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const execucao = historico.find((x) => ["Em execução", "Pendente"].includes(x.status)) || historico[0];
      const liberada = podeIniciarSmart(atividade.proximaExecucao);
      const estado = execucao?.status === "Confirmada" && liberada ? "Disponível" : etapaSmart(execucao?.status);
      return { atividade, equipamento, execucao, estado, liberada };
    });
  }), [atividades, equipamentos, execucoes, clientesPermitidosIds]);
  const locais = [...new Set(cartoes.filter((c) => !cliente || c.equipamento.clienteId === cliente).map((c) => c.equipamento.localDescricao).filter(Boolean))].sort();
  const periodos = [...new Set(cartoes.map((c) => c.atividade.periodicidade))].sort();
  const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtrados = cartoes.filter((c) => (!cliente || c.equipamento.clienteId === cliente) && (local === "todos" || c.equipamento.localDescricao === local) && (periodo === "todos" || c.atividade.periodicidade === periodo) && normal([c.atividade.descricao, c.equipamento.equipamento, c.equipamento.tag, c.equipamento.clienteNome, c.equipamento.setorDescricao].join(" ")).includes(normal(busca)));
  useEffect(() => {
    if (!alvo) return;
    const eq = equipamentos.find((e) => e.id === alvo.execucao.equipamento_id);
    if (!eq || !clientesPermitidosIds.includes(eq.clienteId)) setAlvo(null);
  }, [clientesPermitidosIds, equipamentos, alvo]);
  const abrir = async (c: typeof cartoes[number]) => {
    if (busy) return;
    const chave = `${c.atividade.id}-${c.equipamento.id}`; setBusy(chave);
    try {
      const execucao = c.estado === "Disponível" ? await gravar({ data: { acao: "iniciar", atividadeId: c.atividade.id, equipamentoId: c.equipamento.id } }) : c.execucao;
      if (!execucao) return;
      setAlvo({ execucao, titulo: c.atividade.descricao, local: [c.equipamento.tag, c.equipamento.equipamento, c.equipamento.clienteNome, c.equipamento.localDescricao, c.equipamento.setorDescricao].filter(Boolean).join(" · "), periodicidade: c.atividade.periodicidade });
      await refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível iniciar."); }
    finally { setBusy(""); }
  };
  return <div className="space-y-5 p-3 sm:p-5 lg:p-6">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-medium text-primary"><Fan className="size-4 shrink-0" />PMOC</div><h1 className="mt-1 text-2xl font-semibold">Operação SMART</h1></div>
      <Button variant="outline" size="icon" className="size-11 shrink-0" aria-label="Atualizar manutenções" title="Atualizar manutenções" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={cn("size-5", isFetching && "animate-spin")} /></Button>
    </header>
    <section className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar manutenção" placeholder="Equipamento, serviço, tag ou setor" className="h-11 pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      <TomadorSelect value={cliente} onValueChange={(v) => { setCliente(v); setLocal("todos"); }} options={clientes.filter((c) => c.tipo === "Cliente")} todosLabel="Todos os clientes" label="Filtrar cliente" />
      <Select value={local} onValueChange={setLocal}><SelectTrigger className="h-11" aria-label="Filtrar local"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os locais</SelectItem>{locais.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
      <Select value={periodo} onValueChange={setPeriodo}><SelectTrigger className="h-11" aria-label="Filtrar periodicidade"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as periodicidades</SelectItem>{periodos.filter(Boolean).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
    </section>
    <nav className="grid grid-cols-2 gap-2 md:hidden" aria-label="Etapas da manutenção">{SMART_ETAPAS.map((s) => <Button key={s} variant={etapa === s ? "default" : "outline"} className="min-h-12 h-auto whitespace-normal px-2" onClick={() => setEtapa(s)}>{s}<span className="ml-1">({filtrados.filter((c) => c.estado === s).length})</span></Button>)}</nav>
    {error && <p role="alert" className="text-destructive">Não foi possível carregar as manutenções.</p>}
    {loading ? <div className="flex items-center gap-2 py-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Carregando manutenções…</div> : <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
      {SMART_ETAPAS.map((s) => <section key={s} className={cn("min-w-0 space-y-3", etapa !== s && "hidden md:block")}>
        <div className={cn("flex items-center justify-between border-t-2 pt-3", tomEtapa[s])}><h2 className="text-sm font-semibold">{s}</h2><Badge variant="secondary">{filtrados.filter((c) => c.estado === s).length}</Badge></div>
        {filtrados.filter((c) => c.estado === s).map((c) => <article key={`${c.atividade.id}-${c.equipamento.id}`} className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium text-muted-foreground">{c.equipamento.tag || c.equipamento.codLasant}</span><Badge variant={c.atividade.prioridade === "Urgente" ? "destructive" : "secondary"}>{c.atividade.prioridade}</Badge></div>
          <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Fan className="size-6" /></div><div className="min-w-0"><h3 className="break-words text-base font-semibold leading-snug">{c.atividade.descricao}</h3><p className="mt-1 break-words text-sm text-muted-foreground">{c.equipamento.equipamento}</p></div></div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" /><div className="min-w-0 break-words"><p className="font-medium text-foreground">{c.equipamento.clienteNome}</p><p>{[c.equipamento.localDescricao, c.equipamento.setorDescricao].filter(Boolean).join(" · ") || "—"}</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{c.atividade.tipo}</Badge><span className="text-xs text-muted-foreground">{c.atividade.periodicidade}</span></div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><span className="flex min-w-0 items-center gap-1"><User className="size-4 shrink-0" /><span className="truncate">{c.execucao?.registrado_por || "Não iniciada"}</span></span><span className="flex items-center gap-1"><Camera className="size-4" />{c.execucao?.fotos?.length || 0}</span></div>
          {c.atividade.proximaExecucao && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-4" />{new Date(`${c.atividade.proximaExecucao.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}</p>}
          <Button variant={s === "Disponível" ? "default" : "outline"} className="min-h-11 w-full" disabled={!!busy || (s === "Disponível" && (!podeOperar || !c.liberada)) || (s === "Em execução" && !podeOperar)} onClick={() => void abrir(c)}>{busy === `${c.atividade.id}-${c.equipamento.id}` ? <Loader2 className="size-4 animate-spin" /> : s === "Disponível" ? <Play className="size-4" /> : s === "Concluída" ? <CheckCircle2 className="size-4" /> : <ArrowRight className="size-4" />}{s === "Disponível" ? c.liberada ? "Iniciar manutenção" : "Agendada" : s === "Em execução" ? "Continuar manutenção" : "Ver manutenção"}</Button>
        </article>)}
        {!filtrados.some((c) => c.estado === s) && <div className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4 shrink-0" />Nenhuma manutenção nesta etapa</div>}
      </section>)}
    </div>}
    {alvo && <SmartManutencao key={alvo.execucao.id} {...alvo} onClose={() => { setAlvo(null); void refetch(); }} onSaved={() => { void refetch(); }} />}
  </div>;
}