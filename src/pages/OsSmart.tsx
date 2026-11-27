import { useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, Clock, Loader2, MapPin, Phone, RefreshCw, Search, Smartphone, Trash2, Wrench } from "lucide-react";
import { useOrdensServico, type OrdemServico } from "@/contexts/OrdensServicoContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { setLoadGate } from "@/lib/providerGate";
import { supabase } from "@/integrations/supabase/client";
import TomadorSelect from "@/components/financeiro/TomadorSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Aba = "Aberta" | "Retrabalho" | "Executada" | "Todas";
const ABAS: { id: Aba; label: string }[] = [
  { id: "Aberta", label: "A executar" },
  { id: "Retrabalho", label: "Retrabalho" },
  { id: "Executada", label: "Executadas" },
  { id: "Todas", label: "Todas" },
];
const naAba = (o: OrdemServico, a: Aba) =>
  a === "Todas" ? o.situacao !== "Cancelada"
  : a === "Aberta" ? o.situacao === "Aberta"
  : a === "Retrabalho" ? o.situacao === "Serviço Não Aprovado pela Fiscalização"
  : o.situacao === "Executada" || o.situacao === "Serviço Re-executado";
const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dataBr = (d: string) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "");

export default function OsSmart() {
  const { ordens, updateOrdem, refresh, loading } = useOrdensServico();
  const { clientes } = useClientes();
  const { usuarioLogado } = useAuth();
  const { tem } = usePermissao();
  const podeExecutar = tem("ordem_servico.gerenciar_historico") && tem("ordem_servico.status.em_execucao");
  const podeEditar = tem("ordem_servico.editar") || podeExecutar;
  const [cliente, setCliente] = useState("");
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("Aberta");
  const [alvoId, setAlvoId] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLoadGate("OrdensServico", !!cliente); }, [cliente]);

  const doCliente = useMemo(() => ordens.filter((o) => !cliente || o.clienteId === cliente), [ordens, cliente]);
  const lista = useMemo(() => doCliente
    .filter((o) => naAba(o, aba))
    .filter((o) => normal([o.numero, o.servico, o.categoria, o.localDescricao, o.pavimentoDescricao, o.setorDescricao, o.descricaoServicos, o.solicitante].join(" ")).includes(normal(busca)))
    .sort((a, b) => a.prioridade.localeCompare(b.prioridade) || b.numero - a.numero), [doCliente, aba, busca]);
  const alvo = ordens.find((o) => o.id === alvoId) || null;

  const abrir = (o: OrdemServico) => { setAlvoId(o.id); setConclusao(o.descricaoConclusao || ""); };
  const hist = (o: OrdemServico, situacao: string) => [...(o.historico || []), { situacao, data: new Date().toISOString(), usuario: usuarioLogado?.nome || "Sistema" }];

  const enviarFoto = async (file: File | undefined) => {
    if (!alvo || !file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Envie apenas imagens.");
    if (alvo.fotos.length >= 6) return void toast.error("Máximo de 6 fotos permitidas.");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `os-fotos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("evidencias-anexos").upload(path, file);
      if (error) throw new Error("Erro ao enviar imagem.");
      const { data } = supabase.storage.from("evidencias-anexos").getPublicUrl(path);
      await updateOrdem(alvo.id, { fotos: [...alvo.fotos, { id: crypto.randomUUID(), url: data.publicUrl }] });
      toast.success("Foto adicionada.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao enviar imagem."); }
    finally { setBusy(false); }
  };
  const removerFoto = async (id: string) => {
    if (!alvo) return;
    setBusy(true);
    try { await updateOrdem(alvo.id, { fotos: alvo.fotos.filter((f) => f.id !== id) }); }
    catch { toast.error("Não foi possível remover a foto."); } finally { setBusy(false); }
  };
  const salvarConclusao = async () => {
    if (!alvo) return;
    setBusy(true);
    try { await updateOrdem(alvo.id, { descricao_conclusao: conclusao }); toast.success("Descrição salva."); }
    catch { toast.error("Não foi possível salvar."); } finally { setBusy(false); }
  };
  const executar = async () => {
    if (!alvo) return;
    if (!podeExecutar) return void toast.error('Você não possui permissão para alterar a OS para "Executada".');
    if (!conclusao.trim()) return void toast.error("Descreva o serviço executado antes de concluir.");
    const destino = alvo.situacao === "Serviço Não Aprovado pela Fiscalização" ? "Serviço Re-executado" : "Executada";
    const agora = new Date();
    const data = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
    const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(agora);
    setBusy(true);
    try {
      await updateOrdem(alvo.id, {
        situacao: destino, descricao_conclusao: conclusao, historico: hist(alvo, destino),
        ...(alvo.dataTermino ? {} : { data_termino: data, hora_termino: hora }),
      });
      toast.success(`OS ${alvo.numero} marcada como "${destino}".`);
      setAlvoId("");
    } catch { toast.error("Não foi possível concluir a OS."); } finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-5">
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Smartphone className="h-6 w-6 text-primary" />
        <div><h1 className="text-xl font-bold">OS SMART</h1><p className="text-xs text-muted-foreground">Execução de Ordens de Serviço em campo</p></div>
      </div>
      <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Atualizar" onClick={() => refresh()} disabled={!cliente}><RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} /></Button>
    </header>

    <section className="space-y-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
      <TomadorSelect value={cliente} onValueChange={setCliente} options={clientes.filter((c) => c.tipo === "Cliente")} label="Cliente" />
      <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="h-11 pl-9" placeholder="Nº, serviço, local, setor..." value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
    </section>

    <nav className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
      {ABAS.map((a) => <button key={a.id} onClick={() => setAba(a.id)} className={cn("rounded-lg px-1 py-2.5 text-xs font-semibold sm:text-sm", aba === a.id ? "bg-background text-primary shadow" : "text-muted-foreground")}>
        {a.label}<span className="ml-1 opacity-70">({doCliente.filter((o) => naAba(o, a.id)).length})</span>
      </button>)}
    </nav>

    {!cliente ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Selecione o cliente para ver as Ordens de Serviço.</p>
      : loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      : lista.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma OS nesta etapa.</p>
      : <ul className="space-y-3">{lista.map((o) => <li key={o.id}>
        <button onClick={() => abrir(o)} className="w-full rounded-xl border bg-card p-4 text-left shadow-sm active:scale-[0.99]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-lg font-bold text-primary">OS {o.numero}</span>
            <Badge variant={o.prioridade.startsWith("A") ? "destructive" : "secondary"}>{o.prioridade}</Badge>
          </div>
          <p className="mt-1 font-medium">{o.servico || o.categoria || "Serviço não classificado"}</p>
          <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{[o.localDescricao, o.pavimentoDescricao, o.setorDescricao].filter(Boolean).join(" · ") || "Sem local"}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{dataBr(o.dataInicio || o.createdAt)}</span>
            <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" />{o.fotos.length}/6 · {o.situacao}</span>
          </div>
        </button>
      </li>)}</ul>}

    <Sheet open={!!alvo} onOpenChange={(v) => !v && setAlvoId("")}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        {alvo && <div className="space-y-4 pb-4">
          <SheetHeader><SheetTitle className="text-left">OS {alvo.numero} · {alvo.situacao}</SheetTitle></SheetHeader>
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{alvo.servico || alvo.categoria}</p>
            <p className="text-muted-foreground">{[alvo.localDescricao, alvo.pavimentoDescricao, alvo.setorDescricao].filter(Boolean).join(" · ")}</p>
            {alvo.descricaoServicos && <p className="whitespace-pre-wrap rounded-lg bg-muted p-3">{alvo.descricaoServicos}</p>}
            {alvo.solicitante && <p>Solicitante: <b>{alvo.solicitante}</b></p>}
            {alvo.telefone && <a href={`tel:${alvo.telefone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1 font-semibold text-primary"><Phone className="h-4 w-4" />{alvo.telefone}</a>}
            {alvo.profissionais.length > 0 && <p>Profissionais: {alvo.profissionais.map((p) => p.nome).join(", ")}</p>}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Fotos ({alvo.fotos.length}/6)</p>
            <div className="grid grid-cols-3 gap-2">
              {alvo.fotos.map((f) => <div key={f.id} className="relative aspect-square overflow-hidden rounded-lg border">
                <img src={f.url} alt="Foto da OS" className="h-full w-full object-cover" />
                {podeEditar && <button aria-label="Remover foto" disabled={busy} onClick={() => removerFoto(f.id)} className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>)}
              {podeEditar && alvo.fotos.length < 6 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted-foreground">
                {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}Tirar foto
                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy} onChange={(e) => { void enviarFoto(e.target.files?.[0]); e.target.value = ""; }} />
              </label>}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Descrição do serviço executado</p>
            <Textarea rows={4} value={conclusao} onChange={(e) => setConclusao(e.target.value)} disabled={!podeEditar} placeholder="O que foi feito..." />
            {podeEditar && <Button variant="outline" className="h-11 w-full" disabled={busy} onClick={salvarConclusao}>Salvar descrição</Button>}
          </div>

          {(alvo.situacao === "Aberta" || alvo.situacao === "Serviço Não Aprovado pela Fiscalização") && podeExecutar &&
            <Button className="h-14 w-full text-base" disabled={busy} onClick={executar}>
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : alvo.situacao === "Aberta" ? <CheckCircle2 className="mr-2 h-5 w-5" /> : <Wrench className="mr-2 h-5 w-5" />}
              {alvo.situacao === "Aberta" ? "Concluir execução" : "Concluir re-execução"}
            </Button>}
        </div>}
      </SheetContent>
    </Sheet>
  </div>;
}
