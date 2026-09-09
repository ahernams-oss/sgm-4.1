import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, FileCheck2, Upload, CheckCircle2, XCircle, Trophy, Gavel, ExternalLink, MessageSquare, Send, Lock, Unlock, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { usePregao } from "@/contexts/PregaoContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { formatNumeroAno } from "@/lib/formatNumero";
import { downloadAtaPregao } from "@/lib/gerarPdfAtaPregao";
import { notificarHabilitacao, notificarResultadoHomologado } from "@/lib/notificacoesPregao";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PregaoHabilitacao() {
  const { id } = useParams();
  const nav = useNavigate();
  const { usuarioLogado } = useAuth();
  const { tem, acessoTotal } = usePermissao();
  const {
    pregoes, itens, participantes, lances, mensagens, documentos, habilitacoes,
    loadHabilitacao, loadDisputa,
    addHabilitacao, uploadDocumentoHabilitacao, avaliarHabilitacao, deleteHabilitacao,
    setParticipanteStatus, adjudicarPregao, homologarPregao,
    enviarMensagem, setChatParticipante,
  } = usePregao();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();

  const pregao = pregoes.find(p => p.id === id)!;
  const itensPregao = useMemo(() => itens.filter(i => i.pregaoId === id).sort((a, b) => a.ordem - b.ordem), [itens, id]);
  const partsPregao = useMemo(() => participantes.filter(p => p.pregaoId === id), [participantes, id]);
  const docsPregao = useMemo(() => documentos.filter(d => d.pregaoId === id).sort((a, b) => a.ordem - b.ordem), [documentos, id]);
  const habs = useMemo(() => habilitacoes.filter(h => h.pregaoId === id), [habilitacoes, id]);

  const ehPregoeiro = !!usuarioLogado && (acessoTotal || tem("pregao.pregoeiro"));
  const podeHomologar = !!usuarioLogado && (acessoTotal || tem("pregao.homologar"));

  const [partSelId, setPartSelId] = useState<string>("");
  const [openAdd, setOpenAdd] = useState(false);
  const [novoDocNome, setNovoDocNome] = useState("");
  const [novoDocFile, setNovoDocFile] = useState<File | null>(null);
  const [novoDocExigidoId, setNovoDocExigidoId] = useState<string>("");
  const [novaMsg, setNovaMsg] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  const msgsPregao = useMemo(() => mensagens.filter(m => m.pregaoId === id).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()), [mensagens, id]);

  useEffect(() => {
    if (id) { loadHabilitacao(id); loadDisputa(id); }
  }, [id, loadHabilitacao, loadDisputa]);

  // Sugestão: 1º colocado por valor total vencedor
  const ranking = useMemo(() => {
    const totais = new Map<string, number>();
    itensPregao.forEach(it => {
      if (it.vencedorParticipanteId) {
        totais.set(it.vencedorParticipanteId, (totais.get(it.vencedorParticipanteId) ?? 0) + (it.vencedorValor || 0));
      }
    });
    return Array.from(totais.entries())
      .map(([pid, total]) => ({ pid, total, part: partsPregao.find(p => p.id === pid) }))
      .filter(x => x.part)
      .sort((a, b) => b.total - a.total);
  }, [itensPregao, partsPregao]);

  useEffect(() => {
    if (!partSelId && ranking[0]) setPartSelId(ranking[0].pid);
  }, [ranking, partSelId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgsPregao.length]);


  if (!pregao) {
    return (
      <div className="p-4 sm:p-6">
        <Button variant="ghost" size="sm" onClick={() => nav("/compras/pregao")}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        <p className="text-muted-foreground mt-4">Pregão não encontrado.</p>
      </div>
    );
  }

  const partSel = partsPregao.find(p => p.id === partSelId);
  const habsPart = habs.filter(h => h.participanteId === partSelId);
  const fornecedorPart = clientes.find(c => c.id === partSel?.fornecedorId);

  const totalDocs = docsPregao.length || habsPart.length;
  const aprovados = habsPart.filter(h => h.status === "Aprovado").length;
  const reprovados = habsPart.filter(h => h.status === "Reprovado").length;
  const pendentes = habsPart.filter(h => h.status === "Pendente").length;
  const todosObrigatoriosAprovados = docsPregao.filter(d => d.obrigatorio).every(d =>
    habsPart.some(h => h.documentoExigidoId === d.id && h.status === "Aprovado")
  );

  async function handleAddDoc() {
    if (!partSel || !novoDocNome.trim()) {
      toast.error("Informe o nome do documento.");
      return;
    }
    let arquivoUrl = "";
    let arquivoNome = "";
    if (novoDocFile) {
      const up = await uploadDocumentoHabilitacao(pregao.id, partSel.id, novoDocFile);
      if (!up) { toast.error("Falha ao enviar arquivo."); return; }
      arquivoUrl = up.url; arquivoNome = up.nome;
    }
    await addHabilitacao({
      pregaoId: pregao.id,
      participanteId: partSel.id,
      documentoExigidoId: novoDocExigidoId || null,
      documentoNome: novoDocNome.trim(),
      arquivoUrl, arquivoNome,
    });
    setNovoDocNome(""); setNovoDocFile(null); setNovoDocExigidoId("");
    setOpenAdd(false);
    toast.success("Documento registrado.");
  }

  async function handleHabilitar() {
    if (!partSel) return;
    await setParticipanteStatus(partSel.id, "Habilitado");
    await notificarHabilitacao(pregao, partSel, fornecedorPart);
    toast.success(`${partSel.apelido} habilitado.`);
  }

  async function handleInabilitar() {
    if (!partSel) return;
    const motivo = window.prompt("Motivo da inabilitação:");
    if (!motivo) return;
    await setParticipanteStatus(partSel.id, "Inabilitado", motivo);
    toast.success(`${partSel.apelido} inabilitado.`);
  }

  async function handleAdjudicar() {
    const ok = await adjudicarPregao(pregao.id);
    if (ok) toast.success("Pregão adjudicado.");
  }

  async function handleHomologar() {
    const ok = await homologarPregao(pregao.id);
    if (!ok) return;
    toast.success("Pregão homologado.");
    // notifica vencedores
    const vencedoresMap = new Map<string, number>();
    itensPregao.forEach(it => {
      if (it.vencedorParticipanteId) {
        vencedoresMap.set(it.vencedorParticipanteId, (vencedoresMap.get(it.vencedorParticipanteId) ?? 0) + (it.vencedorValor || 0));
      }
    });
    const venc = Array.from(vencedoresMap.entries()).map(([pid, valor]) => {
      const p = partsPregao.find(x => x.id === pid)!;
      return { participante: p, fornecedor: clientes.find(c => c.id === p.fornecedorId), valor };
    });
    if (venc.length) await notificarResultadoHomologado(pregao, venc);
  }

  async function handleBaixarAta() {
    try {
      await downloadAtaPregao({ pregao, itens: itensPregao, participantes: partsPregao, lances, empresa });
    } catch (e) {
      toast.error("Falha ao gerar ata.");
    }
  }

  async function handleEnviarMsg() {
    if (!novaMsg.trim()) return;
    const autorNome = `Pregoeiro · ${usuarioLogado?.nome ?? ""}`;
    const ok = await enviarMensagem(pregao!.id, "pregoeiro", autorNome, novaMsg.trim());
    if (ok) setNovaMsg("");
  }


  function formatarDataHora(iso: string) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => nav(`/compras/pregao/${pregao.id}`)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="p-2 rounded-xl bg-primary/10 text-primary"><FileCheck2 className="h-6 w-6" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-serif font-semibold truncate">
            Habilitação — Pregão {formatNumeroAno(pregao.numero, pregao.createdAt)}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{pregao.status}</Badge>
            <span className="text-xs text-muted-foreground truncate">{pregao.objeto}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleBaixarAta}>
            <Gavel className="h-4 w-4 mr-1" /> Baixar Ata
          </Button>
          {ehPregoeiro && pregao.status === "Habilitacao" && (
            <Button size="sm" onClick={handleAdjudicar}>
              <Trophy className="h-4 w-4 mr-1" /> Adjudicar
            </Button>
          )}
          {podeHomologar && pregao.status === "Adjudicado" && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleHomologar}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Homologar
            </Button>
          )}
          {(pregao.status === "Homologado" || pregao.resultadoPublico) && (
            <Button size="sm" variant="outline" onClick={() => nav(`/compras/pregao/${pregao.id}/resultado`)}>
              <ExternalLink className="h-4 w-4 mr-1" /> Resultado Público
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-4">
        {/* Lista de participantes (ranking) */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Classificação Provisória</CardTitle></CardHeader>
          <CardContent className="p-2 space-y-1">
            {!ranking.length && <div className="text-sm text-muted-foreground p-3">Nenhum vencedor de item ainda.</div>}
            {ranking.map((r, idx) => (
              <button
                key={r.pid}
                onClick={() => setPartSelId(r.pid)}
                className={`w-full text-left p-2 rounded-lg border transition ${partSelId === r.pid ? "ring-2 ring-primary" : "hover:bg-muted/60"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{idx + 1}º · {r.part?.apelido}</span>
                  <Badge variant="outline" className="text-[10px]">{r.part?.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.part?.fornecedorNome}</div>
                <div className="text-xs font-mono">{moeda(r.total)}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Análise documental */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">
                  {partSel ? `${partSel.apelido} — ${partSel.fornecedorNome}` : "Selecione um licitante"}
                </CardTitle>
                {partSel && (
                  <div className="text-xs text-muted-foreground mt-1">
                    CNPJ: {partSel.fornecedorCnpj} · Status: <strong>{partSel.status}</strong>
                  </div>
                )}
              </div>
              {ehPregoeiro && partSel && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpenAdd(true)}>
                    <Upload className="h-4 w-4 mr-1" /> Anexar documento
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={!todosObrigatoriosAprovados} onClick={handleHabilitar}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Habilitar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleInabilitar}>
                    <XCircle className="h-4 w-4 mr-1" /> Inabilitar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap text-xs">
              <Badge variant="outline">Total: {totalDocs}</Badge>
              <Badge className="bg-emerald-100 text-emerald-800" variant="outline">Aprovados: {aprovados}</Badge>
              <Badge className="bg-rose-100 text-rose-800" variant="outline">Reprovados: {reprovados}</Badge>
              <Badge className="bg-amber-100 text-amber-800" variant="outline">Pendentes: {pendentes}</Badge>
              {!todosObrigatoriosAprovados && docsPregao.some(d => d.obrigatorio) && (
                <Badge variant="outline" className="bg-amber-50 text-amber-900">Documentos obrigatórios pendentes</Badge>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="w-[200px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!habsPart.length && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum documento enviado.</TableCell></TableRow>
                )}
                {habsPart.map(h => (
                  <LinhaHabilitacao
                    key={h.id} hab={h}
                    podeAnalisar={ehPregoeiro}
                    onAprovar={async (obs) => { await avaliarHabilitacao(h.id, "Aprovado", obs, usuarioLogado?.nome ?? "Pregoeiro"); toast.success("Documento aprovado."); }}
                    onReprovar={async (obs) => { await avaliarHabilitacao(h.id, "Reprovado", obs, usuarioLogado?.nome ?? "Pregoeiro"); toast.success("Documento reprovado."); }}
                    onExcluir={async () => { await deleteHabilitacao(h.id); }}
                  />
                ))}
              </TableBody>
            </Table>

            {docsPregao.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <strong>Documentos exigidos no edital:</strong>{" "}
                {docsPregao.map(d => `${d.nome}${d.obrigatorio ? "*" : ""}`).join(" · ")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna 3 — Chat oficial */}
        <Card className="rounded-xl flex flex-col h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat Oficial</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-3 gap-2">
            {/* Controle de chat por participante (somente pregoeiro) */}
            {ehPregoeiro && partsPregao.length > 0 && (
              <div className="border rounded-lg p-2 bg-muted/30 space-y-1 max-h-[140px] overflow-y-auto">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Permissão de fala
                </div>
                {partsPregao.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{p.apelido} · {p.fornecedorNome}</span>
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
              {msgsPregao.map(m => (
                <div key={m.id} className={`p-2 rounded-lg text-sm ${m.autorTipo === "pregoeiro" ? "bg-primary/10 border-l-2 border-primary" : "bg-muted"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold">{m.autorNomeExibicao}</span>
                    <span className="text-[10px] text-muted-foreground">{formatarDataHora(m.ts)}</span>
                  </div>
                  <div>{m.mensagem}</div>
                </div>
              ))}
              {!msgsPregao.length && <div className="text-xs text-muted-foreground text-center mt-4">Sem mensagens.</div>}
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

      {/* Dialog adicionar documento */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anexar documento de habilitação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Documento exigido (opcional)</label>
              <Select value={novoDocExigidoId} onValueChange={(v) => {
                setNovoDocExigidoId(v);
                const d = docsPregao.find(x => x.id === v);
                if (d) setNovoDocNome(d.nome);
              }}>
                <SelectTrigger><SelectValue placeholder="Documento avulso" /></SelectTrigger>
                <SelectContent>
                  {docsPregao.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}{d.obrigatorio ? " *" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Nome do documento</label>
              <Input value={novoDocNome} onChange={e => setNovoDocNome(e.target.value)} placeholder="Ex: CND Federal" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Arquivo (PDF/imagem)</label>
              <Input type="file" accept="application/pdf,image/*" onChange={e => setNovoDocFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
            <Button onClick={handleAddDoc}>Anexar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinhaHabilitacao({ hab, podeAnalisar, onAprovar, onReprovar, onExcluir }: {
  hab: any; podeAnalisar: boolean;
  onAprovar: (obs: string) => Promise<void>;
  onReprovar: (obs: string) => Promise<void>;
  onExcluir: () => Promise<void>;
}) {
  const [obs, setObs] = useState(hab.observacao || "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const cor = hab.status === "Aprovado" ? "bg-emerald-100 text-emerald-800"
    : hab.status === "Reprovado" ? "bg-rose-100 text-rose-800"
    : "bg-amber-100 text-amber-800";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function gerarUrlLocalArquivo() {
    const res = await fetch(hab.arquivoUrl);
    if (!res.ok) throw new Error("Falha ao carregar arquivo");
    return URL.createObjectURL(await res.blob());
  }

  async function handlePreview() {
    if (!hab.arquivoUrl) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const url = await gerarUrlLocalArquivo();
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    } catch {
      toast.error("Não foi possível pré-visualizar o arquivo.");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload() {
    if (!hab.arquivoUrl) return;
    try {
      const url = await gerarUrlLocalArquivo();
      const a = document.createElement("a");
      a.href = url;
      a.download = hab.arquivoNome || "documento";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error("Não foi possível baixar o arquivo.");
    }
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{hab.documentoNome}</TableCell>
        <TableCell>
          {hab.arquivoUrl ? (
            <div className="flex items-center gap-1 flex-wrap">
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handlePreview}>
                <Eye className="h-3 w-3 mr-1" /> Pré-visualizar
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} title="Baixar arquivo">
                <Download className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">{hab.arquivoNome || "arquivo"}</span>
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </TableCell>


        <TableCell><Badge variant="outline" className={cor}>{hab.status}</Badge></TableCell>
        <TableCell>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={1} className="text-xs min-h-[32px]" disabled={!podeAnalisar} />
        </TableCell>
        <TableCell>
          {podeAnalisar ? (
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700" onClick={() => onAprovar(obs)}>Aprovar</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-rose-700" onClick={() => onReprovar(obs)}>Reprovar</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onExcluir}>×</Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{hab.analisadoPor}</span>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{hab.arquivoNome || hab.documentoNome}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded-lg border bg-muted/20 overflow-hidden">
            {previewLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando pré-visualização...</div>
            ) : previewUrl ? (
              <iframe title={hab.arquivoNome || hab.documentoNome} src={previewUrl} className="w-full h-full" />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Arquivo indisponível para pré-visualização.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" /> Baixar
            </Button>
            <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
