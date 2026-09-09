import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Gavel, Play, Square, Plus, Send, Timer, Trophy, MessageSquare, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { usePregao } from "@/contexts/PregaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { formatNumeroAno } from "@/lib/formatNumero";

function formatarDataHora(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!target) return { ms: 0, label: "—", expired: true };
  const ms = Math.max(0, new Date(target).getTime() - now);
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { ms, label: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired: ms === 0 };
}

export default function PregaoSala() {
  const { id } = useParams();
  const nav = useNavigate();
  const auth = useAuth();
  const { tem, acessoTotal } = usePermissao();
  const {
    pregoes, itens, participantes, lances, mensagens,
    loadDisputa, iniciarItem, encerrarItem, prorrogarItem,
    enviarLance, cancelarLance, enviarMensagem,
    abrirDisputa, encerrarDisputa, publicarResultado,
    setChatParticipante,
  } = usePregao();

  const pregao = pregoes.find(p => p.id === id)!;
  const itensPregao = useMemo(() => itens.filter(i => i.pregaoId === id).sort((a, b) => a.ordem - b.ordem), [itens, id]);
  const participantesPregao = useMemo(() => participantes.filter(p => p.pregaoId === id).sort((a, b) => a.apelidoSeq - b.apelidoSeq), [participantes, id]);

  const [itemSelId, setItemSelId] = useState<string>("");
  const [participanteSelId, setParticipanteSelId] = useState<string>("");
  const [valorLance, setValorLance] = useState<string>("");
  const [novaMsg, setNovaMsg] = useState<string>("");
  const [revelarNomes, setRevelarNomes] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // É pregoeiro? (usuário logado conduz)
  const ehPregoeiro = !!auth?.usuarioLogado && (
    acessoTotal || tem("pregao.pregoeiro") || (!!pregao?.pregoeiroId && pregao.pregoeiroId === auth.usuarioLogado.id)
  );

  useEffect(() => {
    if (id) loadDisputa(id);
  }, [id, loadDisputa]);

  useEffect(() => {
    if (!itemSelId && itensPregao.length) {
      const emDisp = itensPregao.find(i => i.status === "EmDisputa") ?? itensPregao[0];
      setItemSelId(emDisp.id);
    }
  }, [itensPregao, itemSelId]);

  const itemSel = itensPregao.find(i => i.id === itemSelId);
  const lancesItem = useMemo(
    () => lances.filter(l => l.itemId === itemSelId && !l.cancelado).sort((a, b) => a.valor - b.valor || new Date(a.ts).getTime() - new Date(b.ts).getTime()),
    [lances, itemSelId]
  );
  const msgsItem = useMemo(
    () => mensagens.filter(m => m.pregaoId === id).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()),
    [mensagens, id]
  );

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgsItem.length]);

  const countdown = useCountdown(itemSel?.status === "EmDisputa" ? itemSel.encerraEm || null : null);

  // Auto-encerrar quando o timer zerar (apenas pregoeiro)
  useEffect(() => {
    if (ehPregoeiro && itemSel?.status === "EmDisputa" && countdown.expired && itemSel.encerraEm) {
      encerrarItem(itemSel.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown.expired]);

  if (!pregao) {
    return (
      <div className="p-4 sm:p-6">
        <Button variant="ghost" size="sm" onClick={() => nav("/compras/pregao")}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        <p className="text-muted-foreground mt-4">Pregão não encontrado.</p>
      </div>
    );
  }

  const apelidoPorPart = (pid: string) => {
    const p = participantesPregao.find(x => x.id === pid);
    if (!p) return "—";
    if (revelarNomes && ehPregoeiro) return `${p.apelido} · ${p.fornecedorNome}`;
    return p.apelido;
  };

  const melhorValor = lancesItem[0]?.valor;

  async function handleEnviarLance() {
    if (!itemSel || !participanteSelId) {
      toast.error("Selecione o licitante.");
      return;
    }
    const v = parseFloat(valorLance.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (melhorValor !== undefined && v >= melhorValor) {
      toast.error(`Lance deve ser menor que ${moeda(melhorValor)}.`);
      return;
    }
    const ok = await enviarLance(pregao.id, itemSel.id, participanteSelId, v);
    if (ok) {
      setValorLance("");
      toast.success("Lance registrado.");
    } else {
      toast.error("Não foi possível registrar o lance.");
    }
  }

  async function handleEnviarMsg() {
    if (!novaMsg.trim()) return;
    const autorNome = ehPregoeiro ? `Pregoeiro · ${auth?.usuarioLogado?.nome ?? ""}` : "Licitante";
    const ok = await enviarMensagem(pregao.id, ehPregoeiro ? "pregoeiro" : "participante", autorNome, novaMsg.trim(), itemSel?.id);
    if (ok) setNovaMsg("");
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => nav(`/compras/pregao/${pregao.id}`)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="p-2 rounded-xl bg-primary/10 text-primary"><Gavel className="h-6 w-6" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-serif font-semibold truncate">
            Sala de Disputa — Pregão {formatNumeroAno(pregao.numero, pregao.createdAt)}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{pregao.status}</Badge>
            <Badge variant="secondary">{pregao.modalidade}</Badge>
            <Badge variant="secondary">{pregao.tipoDisputa}</Badge>
            <span className="text-xs text-muted-foreground truncate">{pregao.objeto}</span>
          </div>
        </div>
        {ehPregoeiro && (
          <div className="flex items-center gap-2">
            {pregao.status === "Publicado" || pregao.status === "Credenciamento" || pregao.status === "Propostas" ? (
              <Button size="sm" onClick={async () => { (await abrirDisputa(pregao.id)) && toast.success("Disputa aberta."); }}>
                <Play className="h-4 w-4 mr-1" /> Abrir Disputa
              </Button>
            ) : null}
            {(pregao.status === "Disputa" || pregao.status === "Publicado" || pregao.status === "Credenciamento" || pregao.status === "Propostas") && (
              <Button size="sm" variant="destructive" onClick={async () => {
                if (!window.confirm("Encerrar a disputa e avançar para a Habilitação?")) return;
                const ok = await encerrarDisputa(pregao.id);
                if (ok) {
                  toast.success("Disputa encerrada. Iniciando Habilitação.");
                  nav(`/compras/pregao/${pregao.id}/habilitacao`);
                }
              }}>
                <Square className="h-4 w-4 mr-1" /> Encerrar Disputa
              </Button>
            )}
            {(pregao.status === "Habilitacao" || pregao.status === "Adjudicado" || pregao.status === "Homologado" || pregao.status === "Encerrado") && (
              <Button size="sm" variant="outline" onClick={() => nav(`/compras/pregao/${pregao.id}/habilitacao`)}>
                <Trophy className="h-4 w-4 mr-1" /> Habilitação / Adjudicação
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setRevelarNomes(v => !v)}>
              {revelarNomes ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {revelarNomes ? "Anonimizar" : "Ver Nomes"}
            </Button>
          </div>
        )}
      </div>

      {/* Layout 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4">
        {/* Coluna 1 — Itens */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Itens / Lotes ({itensPregao.length})</CardTitle></CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-1">
                {itensPregao.map(it => {
                  const isSel = itemSelId === it.id;
                  const cor = it.status === "EmDisputa" ? "bg-amber-100 text-amber-900 border-amber-300"
                    : it.status === "Encerrado" ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : it.status === "Deserto" || it.status === "Fracassado" ? "bg-rose-100 text-rose-900 border-rose-300"
                    : "bg-muted text-muted-foreground border-border";
                  return (
                    <button
                      key={it.id}
                      onClick={() => setItemSelId(it.id)}
                      className={`w-full text-left p-2 rounded-lg border transition ${isSel ? "ring-2 ring-primary" : "hover:bg-muted/60"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono">{String(it.ordem).padStart(3, "0")}</span>
                        <Badge variant="outline" className={`text-[10px] ${cor}`}>{it.status}</Badge>
                      </div>
                      <div className="text-sm font-medium line-clamp-2">{it.descricao || "(sem descrição)"}</div>
                      <div className="text-[11px] text-muted-foreground">{it.quantidade} {it.unidade}</div>
                    </button>
                  );
                })}
                {!itensPregao.length && <div className="text-sm text-muted-foreground p-3">Nenhum item.</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Coluna 2 — Disputa do item */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-base truncate">
                  {itemSel ? `Item ${String(itemSel.ordem).padStart(3, "0")} — ${itemSel.descricao}` : "Selecione um item"}
                </CardTitle>
                {itemSel && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {itemSel.quantidade} {itemSel.unidade}
                    {!itemSel.precoReferenciaSigiloso && itemSel.precoReferencia > 0 && (
                      <> · Ref. {moeda(itemSel.precoReferencia)}</>
                    )}
                  </div>
                )}
              </div>
              {itemSel?.status === "EmDisputa" && (
                <div className="flex items-center gap-2 text-xl sm:text-2xl font-mono bg-primary/10 text-primary px-3 py-1 rounded-lg">
                  <Timer className="h-5 w-5" /> {countdown.label}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Controles pregoeiro */}
            {ehPregoeiro && itemSel && (
              <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/50 rounded-lg">
                {itemSel.status === "Aguardando" && (
                  <Button size="sm" onClick={async () => { (await iniciarItem(itemSel.id)) && toast.success("Item em disputa."); }}>
                    <Play className="h-4 w-4 mr-1" /> Iniciar Disputa
                  </Button>
                )}
                {itemSel.status === "EmDisputa" && (
                  <>
                    <Button size="sm" variant="outline" onClick={async () => { (await prorrogarItem(itemSel.id, 2)) && toast.success("+2 min."); }}>+2 min</Button>
                    <Button size="sm" variant="destructive" onClick={async () => { (await encerrarItem(itemSel.id)) && toast.success("Item encerrado."); }}>
                      <Square className="h-4 w-4 mr-1" /> Encerrar Item
                    </Button>
                  </>
                )}
                {(itemSel.status === "Encerrado" || itemSel.status === "Deserto") && itemSel.vencedorParticipanteId && (
                  <div className="text-sm">
                    🏆 Vencedor: <strong>{apelidoPorPart(itemSel.vencedorParticipanteId)}</strong> · {moeda(itemSel.vencedorValor)}
                  </div>
                )}
              </div>
            )}

            {/* Formulário de lance */}
            {itemSel?.status === "EmDisputa" && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Licitante</label>
                  <Select value={participanteSelId} onValueChange={setParticipanteSelId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {participantesPregao.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {revelarNomes && ehPregoeiro ? `${p.apelido} · ${p.fornecedorNome}` : p.apelido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Valor (R$)</label>
                  <Input
                    type="text" inputMode="decimal" placeholder="0,00"
                    value={valorLance}
                    onChange={e => setValorLance(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleEnviarLance()}
                  />
                </div>
                <Button onClick={handleEnviarLance}><Plus className="h-4 w-4 mr-1" /> Lance</Button>
              </div>
            )}

            <Separator />

            {/* Ranking */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">Ranking ({lancesItem.length} lances)</h3>
                {melhorValor !== undefined && (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Melhor: {moeda(melhorValor)}</Badge>
                )}
              </div>
              <ScrollArea className="h-[35vh]">
                <div className="space-y-1">
                  {lancesItem.map((l, idx) => (
                    <div
                      key={l.id}
                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${idx === 0 ? "bg-emerald-50 border-emerald-300" : "bg-card"}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-mono text-sm w-6 ${idx === 0 ? "text-emerald-700 font-bold" : "text-muted-foreground"}`}>
                          {idx + 1}º
                        </span>
                        <span className="text-sm truncate">{apelidoPorPart(l.participanteId)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{formatarDataHora(l.ts)}</span>
                        <span className={`text-sm font-mono ${idx === 0 ? "font-bold text-emerald-700" : ""}`}>{moeda(l.valor)}</span>
                        {ehPregoeiro && (
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs text-rose-600"
                            onClick={async () => { (await cancelarLance(l.id, "Cancelado pelo pregoeiro")) && toast.success("Lance cancelado."); }}
                          >Cancelar</Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!lancesItem.length && <div className="text-sm text-muted-foreground p-3">Sem lances ainda.</div>}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        {/* Coluna 3 — Chat oficial */}
        <Card className="rounded-xl flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat Oficial</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-3 gap-2">
            {/* Controle de chat por participante (somente pregoeiro) */}
            {ehPregoeiro && participantesPregao.length > 0 && (
              <div className="border rounded-lg p-2 bg-muted/30 space-y-1 max-h-[140px] overflow-y-auto">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Permissão de fala
                </div>
                {participantesPregao.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {revelarNomes ? `${p.apelido} · ${p.fornecedorNome}` : p.apelido}
                    </span>
                    <Button
                      size="sm"
                      variant={p.chatAberto ? "default" : "outline"}
                      className="h-6 px-2 text-[11px]"
                      onClick={async () => {
                        const ok = await setChatParticipante(p.id, !p.chatAberto);
                        if (ok) toast.success(p.chatAberto ? "Chat fechado para o licitante." : "Chat aberto para o licitante.");
                      }}
                    >
                      {p.chatAberto ? <><Unlock className="h-3 w-3 mr-1" /> Aberto</> : <><Lock className="h-3 w-3 mr-1" /> Fechado</>}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-2 h-[45vh] pr-1">
              {msgsItem.map(m => (
                <div key={m.id} className={`p-2 rounded-lg text-sm ${m.autorTipo === "pregoeiro" ? "bg-primary/10 border-l-2 border-primary" : "bg-muted"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold">{m.autorNomeExibicao}</span>
                    <span className="text-[10px] text-muted-foreground">{formatarDataHora(m.ts)}</span>
                  </div>
                  <div>{m.mensagem}</div>
                </div>
              ))}
              {!msgsItem.length && <div className="text-xs text-muted-foreground text-center mt-4">Sem mensagens.</div>}
            </div>
            {ehPregoeiro ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Mensagem do pregoeiro..."
                  value={novaMsg}
                  onChange={e => setNovaMsg(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleEnviarMsg()}
                />
                <Button size="icon" onClick={handleEnviarMsg}><Send className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground text-center py-2 border rounded-lg bg-muted/30">
                Apenas o pregoeiro envia mensagens neste chat.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
