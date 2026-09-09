import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  LogOut, Send, Gavel, Timer, TrendingDown, MessageSquare,
  ChevronLeft, Eye, EyeOff, AlertCircle
} from "lucide-react";
import logoLasant from "@/assets/Logo_Lasant.png";
import { Download, FileText, Upload, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";

function EditalDownloads({ pregaoId }: { pregaoId: string }) {
  const [anexos, setAnexos] = useState<Array<{ id: string; nome: string; descricao: string | null; url: string; tamanho_bytes: number | null }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pregao_anexos_edital" as any)
        .select("id,nome,descricao,url,tamanho_bytes")
        .eq("pregao_id", pregaoId)
        .order("created_at", { ascending: false });
      setAnexos((data as any) || []);
    })();
  }, [pregaoId]);
  const baixar = async (url: string, nome: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(u);
    } catch {
      window.open(url, "_blank");
    }
  };
  if (anexos.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Anexos do Edital
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {anexos.map(a => (
          <button
            key={a.id}
            onClick={() => baixar(a.url, a.nome)}
            className="w-full text-left p-2 rounded-lg border text-xs hover:bg-accent flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{a.nome}</div>
              {a.descricao && <div className="text-muted-foreground truncate">{a.descricao}</div>}
            </div>
            <Download className="h-4 w-4 shrink-0 text-primary" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ============ Habilitação do Fornecedor (upload de documentos) ============
function HabilitacaoFornecedorSection({ pregaoId, participanteId }: { pregaoId: string; participanteId: string }) {
  const [docsExigidos, setDocsExigidos] = useState<Array<{ id: string; nome: string; descricao: string | null; obrigatorio: boolean }>>([]);
  const [enviados, setEnviados] = useState<Array<{ id: string; documento_exigido_id: string | null; documento_nome: string; arquivo_url: string | null; arquivo_nome: string | null; status: string; observacao: string }>>([]);
  const [uploadingId, setUploadingId] = useState<string>("");
  const [novoDocNome, setNovoDocNome] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const novoFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [{ data: dd }, { data: ee }] = await Promise.all([
      supabase.from("pregao_documentos_exigidos" as any).select("id,nome,descricao,obrigatorio").eq("pregao_id", pregaoId).order("ordem", { ascending: true }),
      supabase.from("pregao_habilitacao" as any).select("id,documento_exigido_id,documento_nome,arquivo_url,arquivo_nome,status,observacao").eq("pregao_id", pregaoId).eq("participante_id", participanteId).order("created_at", { ascending: true }),
    ]);
    setDocsExigidos((dd as any) || []);
    setEnviados((ee as any) || []);
  }, [pregaoId, participanteId]);

  useEffect(() => { load(); }, [load]);

  // Realtime para receber pareceres do pregoeiro
  useEffect(() => {
    const ch = supabase
      .channel("hab-fornecedor-" + participanteId)
      .on("postgres_changes", { event: "*", schema: "public", table: "pregao_habilitacao" }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.participante_id === participanteId) load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [participanteId, load]);

  const uploadArquivo = async (file: File, docExigidoId: string | null, nomeDoc: string) => {
    try {
      const path = `${pregaoId}/${participanteId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("pregao-documentos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("pregao-documentos").getPublicUrl(path);
      // Se existir registro Pendente/Reprovado para este documento exigido, atualiza; senão insere
      const existente = docExigidoId
        ? enviados.find(e => e.documento_exigido_id === docExigidoId)
        : null;
      if (existente) {
        const { error } = await supabase.from("pregao_habilitacao" as any).update({
          arquivo_url: pub.publicUrl,
          arquivo_nome: file.name,
          status: "Pendente",
          observacao: "",
          analisado_em: null,
          analisado_por: null,
        }).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pregao_habilitacao" as any).insert({
          pregao_id: pregaoId,
          participante_id: participanteId,
          documento_exigido_id: docExigidoId,
          documento_nome: nomeDoc,
          arquivo_url: pub.publicUrl,
          arquivo_nome: file.name,
          status: "Pendente",
        });
        if (error) throw error;
      }
      toast.success("Documento enviado ao pregoeiro.");
      await load();
    } catch (e: any) {
      toast.error("Erro ao enviar documento: " + (e?.message ?? ""));
    } finally {
      setUploadingId("");
    }
  };

  const removerEnvio = async (id: string) => {
    if (!confirm("Remover este documento enviado?")) return;
    await supabase.from("pregao_habilitacao" as any).delete().eq("id", id);
    load();
  };

  const statusBadge = (s: string) => {
    if (s === "Aprovado") return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
    if (s === "Reprovado") return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Reprovado</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
  };

  return (
    <Card className="border-amber-300 bg-amber-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-amber-700" /> Habilitação — Envio de Documentos
        </CardTitle>
        <CardDescription>
          Você foi convocado. Envie os documentos abaixo para análise do pregoeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {docsExigidos.length === 0 && enviados.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum documento exigido pelo edital. Você pode anexar documentos adicionais abaixo.</p>
        )}

        {/* Documentos exigidos pelo edital */}
        {docsExigidos.map(doc => {
          const env = enviados.find(e => e.documento_exigido_id === doc.id);
          return (
            <div key={doc.id} className="border rounded-lg p-3 bg-background space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{doc.nome}</span>
                    {doc.obrigatorio && <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>}
                    {env && statusBadge(env.status)}
                  </div>
                  {doc.descricao && <p className="text-xs text-muted-foreground mt-0.5">{doc.descricao}</p>}
                  {env?.arquivo_nome && (
                    <a href={env.arquivo_url ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      <FileText className="h-3 w-3" /> {env.arquivo_nome}
                    </a>
                  )}
                  {env?.observacao && (
                    <p className="text-xs mt-1 p-2 rounded bg-muted">
                      <strong>Parecer:</strong> {env.observacao}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id={`file-${doc.id}`}
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setUploadingId(doc.id); uploadArquivo(f, doc.id, doc.nome); }
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant={env?.status === "Aprovado" ? "outline" : "default"}
                    disabled={uploadingId === doc.id || env?.status === "Aprovado"}
                    onClick={() => document.getElementById(`file-${doc.id}`)?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    {uploadingId === doc.id ? "Enviando..." : env ? "Reenviar" : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Documentos adicionais (sem documento_exigido_id) */}
        {enviados.filter(e => !e.documento_exigido_id).map(env => (
          <div key={env.id} className="border rounded-lg p-3 bg-background flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{env.documento_nome}</span>
                <Badge variant="secondary" className="text-[10px]">Adicional</Badge>
                {statusBadge(env.status)}
              </div>
              {env.arquivo_nome && (
                <a href={env.arquivo_url ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                  <FileText className="h-3 w-3" /> {env.arquivo_nome}
                </a>
              )}
              {env.observacao && (
                <p className="text-xs mt-1 p-2 rounded bg-muted"><strong>Parecer:</strong> {env.observacao}</p>
              )}
            </div>
            {env.status !== "Aprovado" && (
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removerEnvio(env.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}

        {/* Adicionar documento extra */}
        <div className="border-2 border-dashed rounded-lg p-3 bg-background">
          <p className="text-xs font-medium mb-2">Anexar documento adicional</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome/descrição do documento"
              value={novoDocNome}
              onChange={e => setNovoDocNome(e.target.value)}
              className="h-8 text-sm"
            />
            <input
              ref={novoFileRef}
              type="file"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!novoDocNome.trim()) { toast.error("Informe o nome do documento."); e.target.value = ""; return; }
                setUploadingId("novo");
                uploadArquivo(f, null, novoDocNome.trim()).then(() => setNovoDocNome(""));
                e.target.value = "";
              }}
            />
            <Button size="sm" disabled={uploadingId === "novo" || !novoDocNome.trim()} onClick={() => novoFileRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" />{uploadingId === "novo" ? "Enviando..." : "Anexar"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FornecedorSession {
  id: string;
  nome: string;
  nomeFantasia?: string;
  email: string;
  cnpj?: string;
}

interface PregaoData {
  id: string;
  numero: number;
  objeto: string;
  modalidade: string;
  status: string;
  termo_participacao: string;
  tempo_disputa_min: number;
  tempo_prorrogacao_min: number;
  decremento_minimo: number;
  decremento_tipo: string;
  data_inicio_disputa: string;
  data_encerramento_disputa: string;
  created_at: string;
}

interface PregaoItem {
  id: string;
  pregao_id: string;
  ordem: number;
  agrupamento: string;
  lote_codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  status: string;
  iniciado_em: string;
  encerra_em: string;
  encerrado_em: string;
  preco_referencia: number;
  preco_referencia_sigiloso: boolean;
  vencedor_participante_id?: string | null;
}

interface Participante {
  id: string;
  fornecedor_id: string;
  apelido: string;
  status: string;
  chat_aberto: boolean;
}

interface Lance {
  id: string;
  item_id: string;
  participante_id: string;
  valor: number;
  ts: string;
  cancelado: boolean;
}

interface Mensagem {
  id: string;
  autor_tipo: string;
  autor_nome_exibicao: string;
  mensagem: string;
  ts: string;
}

const STORAGE_KEY = "fornecedorPortalLogado";

const moeda = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s: string) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR");
};

const formatNumeroAno = (numero: number, createdAt: string) => {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `${String(numero).padStart(2, "0")}-${year}`;
};

function useCountdown(target: string | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!target) { setLeft(0); return; }
    const t = setInterval(() => {
      const diff = new Date(target).getTime() - Date.now();
      setLeft(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(t);
  }, [target]);
  return left;
}

function fmtCountdown(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PregaoSalaFornecedorPage() {
  const { id: pregaoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<FornecedorSession | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const [pregao, setPregao] = useState<PregaoData | null>(null);
  const [itens, setItens] = useState<PregaoItem[]>([]);
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [lances, setLances] = useState<Lance[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemAtivo, setItemAtivo] = useState<string>("");
  const [valorLance, setValorLance] = useState("");
  const [msgTexto, setMsgTexto] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [melhorLanceInfo, setMelhorLanceInfo] = useState<{ valor: number; apelido: string } | null>(null);
  const [meuMelhorLance, setMeuMelhorLance] = useState<number | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const activeItem = useMemo(() => itens.find(i => i.id === itemAtivo), [itens, itemAtivo]);
  const countdown = useCountdown(activeItem?.encerra_em || null);

  // Carrega dados
  useEffect(() => {
    if (!pregaoId || !session) return;
    (async () => {
      setLoading(true);
      const [{ data: pData }, { data: iData }, { data: partData }] = await Promise.all([
        supabase.from("pregoes").select("*").eq("id", pregaoId).single(),
        supabase.from("pregao_itens").select("*").eq("pregao_id", pregaoId).order("ordem", { ascending: true }),
        supabase.from("pregao_participantes").select("*").eq("pregao_id", pregaoId).eq("fornecedor_id", session.id).maybeSingle(),
      ]);
      setPregao(pData as PregaoData);
      setItens((iData as PregaoItem[]) || []);
      setParticipante(partData as Participante);
      if ((iData as PregaoItem[])?.length) setItemAtivo((iData as PregaoItem[])[0].id);
      setLoading(false);
    })();
  }, [pregaoId, session]);

  // Carrega lances e mensagens do item ativo
  const loadDisputa = useCallback(async () => {
    if (!pregaoId) return;
    const [{ data: lData }, { data: mData }] = await Promise.all([
      supabase.from("pregao_lances").select("*").eq("pregao_id", pregaoId).order("ts", { ascending: true }),
      supabase.from("pregao_mensagens").select("*").eq("pregao_id", pregaoId).order("ts", { ascending: true }),
    ]);
    setLances((lData as Lance[]) || []);
    setMensagens((mData as Mensagem[]) || []);
  }, [pregaoId]);

  useEffect(() => {
    loadDisputa();
  }, [loadDisputa]);

  // Realtime
  useEffect(() => {
    if (!pregaoId) return;
    const ch = supabase
      .channel("pregao-fornecedor-" + pregaoId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pregao_lances" }, (payload: any) => {
        if (payload.new.pregao_id === pregaoId) {
          setLances(prev => [...prev, payload.new as Lance]);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pregao_lances" }, (payload: any) => {
        setLances(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lance : l));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pregao_mensagens" }, (payload: any) => {
        if (payload.new.pregao_id === pregaoId) {
          setMensagens(prev => [...prev, payload.new as Mensagem]);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pregao_itens" }, (payload: any) => {
        setItens(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pregao_participantes" }, (payload: any) => {
        setParticipante(prev => (prev && prev.id === payload.new.id) ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pregaoId]);

  // Scroll chat
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Computa ranking anônimo e melhor lance
  useEffect(() => {
    if (!activeItem) { setMelhorLanceInfo(null); setMeuMelhorLance(null); return; }
    const lancesItem = lances.filter(l => l.item_id === activeItem.id && !l.cancelado);
    if (!lancesItem.length) { setMelhorLanceInfo(null); setMeuMelhorLance(null); return; }
    const meus = lancesItem.filter(l => l.participante_id === participante?.id);
    if (meus.length) setMeuMelhorLance(Math.min(...meus.map(l => l.valor)));
    else setMeuMelhorLance(null);

    const menor = [...lancesItem].sort((a, b) => a.valor - b.valor)[0];
    setMelhorLanceInfo({ valor: menor.valor, apelido: "Licitante" });
  }, [lances, activeItem, participante]);

  const ranking = useMemo(() => {
    if (!activeItem) return [];
    const lancesItem = lances.filter(l => l.item_id === activeItem.id && !l.cancelado);
    const map = new Map<string, { valor: number; seq: number }>();
    lancesItem.forEach(l => {
      const cur = map.get(l.participante_id);
      if (!cur || l.valor < cur.valor) map.set(l.participante_id, { valor: l.valor, seq: 0 });
    });
    const arr = Array.from(map.entries()).map(([pid, v]) => ({ participanteId: pid, valor: v.valor }));
    arr.sort((a, b) => a.valor - b.valor);
    return arr.map((x, idx) => ({ ...x, pos: idx + 1 }));
  }, [lances, activeItem]);

  const meuRanking = useMemo(() => {
    if (!participante) return null;
    return ranking.find(r => r.participanteId === participante.id)?.pos ?? null;
  }, [ranking, participante]);

  const enviarLance = async () => {
    if (!pregaoId || !participante || !activeItem || !valorLance) return;
    const valor = Number(valorLance.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor <= 0) { toast.error("Informe um valor válido."); return; }

    // Validação: deve ser menor que o melhor lance
    const lancesItem = lances.filter(l => l.item_id === activeItem.id && !l.cancelado);
    const melhor = lancesItem.length ? Math.min(...lancesItem.map(l => l.valor)) : Infinity;
    if (valor >= melhor && melhor !== Infinity) {
      toast.error(`O lance deve ser menor que ${moeda(melhor)}.`);
      return;
    }

    // Validação decremento mínimo
    if (melhor !== Infinity && pregao) {
      const dif = melhor - valor;
      if (pregao.decremento_tipo === "reais") {
        if (dif < pregao.decremento_minimo) {
          toast.error(`Decremento mínimo de ${moeda(pregao.decremento_minimo)}.`);
          return;
        }
      } else {
        const pct = (dif / melhor) * 100;
        if (pct < pregao.decremento_minimo) {
          toast.error(`Decremento mínimo de ${pregao.decremento_minimo}%.`);
          return;
        }
      }
    }

    const { error } = await supabase.from("pregao_lances").insert({
      pregao_id: pregaoId,
      item_id: activeItem.id,
      participante_id: participante.id,
      valor,
    });
    if (error) { toast.error("Erro ao enviar lance."); return; }
    toast.success("Lance enviado!");
    setValorLance("");
  };

  const enviarMensagem = async () => {
    if (!pregaoId || !participante || !msgTexto.trim()) return;
    if (!participante.chat_aberto) {
      toast.error("O chat está fechado pelo pregoeiro. Aguarde a liberação.");
      return;
    }
    await supabase.from("pregao_mensagens").insert({
      pregao_id: pregaoId,
      autor_tipo: "participante",
      autor_id: participante.id,
      autor_nome_exibicao: participante.apelido,
      mensagem: msgTexto.trim(),
    });
    setMsgTexto("");
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full text-center p-4 sm:p-6">
          <p className="text-muted-foreground">Sessão expirada. Faça login no portal.</p>
          <Button className="mt-4" onClick={() => navigate("/portal-fornecedor")}>Voltar ao Portal</Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Carregando sala de disputa...</p>
      </div>
    );
  }

  if (!pregao) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full text-center p-4 sm:p-6">
          <p className="text-muted-foreground">Pregão não encontrado.</p>
          <Button className="mt-4" onClick={() => navigate("/portal-fornecedor")}>Voltar</Button>
        </Card>
      </div>
    );
  }

  if (!participante || ["Inabilitado", "Desclassificado", "Desistente"].includes(participante.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="max-w-md w-full text-center p-4 sm:p-6">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Acesso não autorizado</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Seu acesso a este pregão foi revogado ou você não está mais participando.
          </p>
          <Button onClick={() => navigate("/portal-fornecedor")}>Voltar ao Portal</Button>
        </Card>
      </div>
    );
  }

  const pregaoEncerrado = ["Encerrado", "Habilitacao", "Adjudicado", "Homologado", "Cancelado"].includes(pregao.status);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <img src={logoLasant} alt="Lasant" className="h-8 object-contain" />
            <div>
              <h1 className="font-semibold text-sm leading-tight">
                Pregão {formatNumeroAno(pregao.numero, pregao.created_at)} — Sala de Disputa
              </h1>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{pregao.objeto}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={pregao.status === "Disputa" ? "default" : "secondary"}>{pregao.status}</Badge>
            <Button variant="outline" size="sm" onClick={() => navigate("/portal-fornecedor")}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem(STORAGE_KEY); navigate("/portal-fornecedor"); }}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Apelido */}
      <div className="bg-primary/5 border-b py-2">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          Você está participando como <strong>{participante.apelido}</strong>
          {meuRanking !== null && (
            <span className="ml-2 text-muted-foreground">— Sua posição: {meuRanking}º</span>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Esquerda: Itens */}
        <div className="lg:col-span-3 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gavel className="h-4 w-4" /> Itens / Lotes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {itens.map(item => {
                const isActive = item.id === itemAtivo;
                const emDisputa = item.status === "EmDisputa";
                const encerrado = item.status === "Encerrado";
                return (
                  <button
                    key={item.id}
                    onClick={() => setItemAtivo(item.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                      isActive ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {item.agrupamento === "Lote" ? `Lote ${item.lote_codigo}` : `Item ${item.ordem}`}
                      </span>
                      {emDisputa ? (
                        <Badge variant="default" className="text-[10px]">Em disputa</Badge>
                      ) : encerrado ? (
                        <Badge variant="secondary" className="text-[10px]">Encerrado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{item.descricao}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
          <EditalDownloads pregaoId={pregao.id} />
        </div>

        {/* Centro: Disputa */}
        <div className="lg:col-span-6 space-y-4">
          {/* Painel de Habilitação — visível apenas ao(s) vencedor(es) na fase de Habilitação */}
          {(pregao.status === "Habilitacao" || pregao.status === "Adjudicado") &&
            itens.some(i => i.vencedor_participante_id === participante.id) && (
            <HabilitacaoFornecedorSection pregaoId={pregao.id} participanteId={participante.id} />
          )}
          {activeItem ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {activeItem.agrupamento === "Lote" ? `Lote ${activeItem.lote_codigo}` : `Item ${activeItem.ordem}`}
                  </CardTitle>
                  {activeItem.status === "EmDisputa" ? (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Timer className="h-3 w-3" /> {fmtCountdown(countdown)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{activeItem.status}</Badge>
                  )}
                </div>
                <CardDescription>{activeItem.descricao}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Melhor lance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-green-700">Melhor lance</p>
                    <p className="text-xl font-bold text-green-700">
                      {melhorLanceInfo ? moeda(melhorLanceInfo.valor) : "—"}
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-blue-700">Seu melhor lance</p>
                    <p className="text-xl font-bold text-blue-700">
                      {meuMelhorLance !== null ? moeda(meuMelhorLance) : "—"}
                    </p>
                  </div>
                </div>

                {/* Ranking anônimo */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Ranking (anônimo)
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs">Pos</th>
                          <th className="px-3 py-2 text-left text-xs">Participante</th>
                          <th className="px-3 py-2 text-right text-xs">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.slice(0, 10).map(r => {
                          const isMe = r.participanteId === participante.id;
                          return (
                            <tr key={r.participanteId} className={isMe ? "bg-primary/5" : ""}>
                              <td className="px-3 py-2 text-xs">{r.pos}º</td>
                              <td className="px-3 py-2 text-xs">
                                {isMe ? <strong>{participante.apelido} (Você)</strong> : `Licitante ${String(r.pos).padStart(2, "0")}`}
                              </td>
                              <td className="px-3 py-2 text-xs text-right font-medium">{moeda(r.valor)}</td>
                            </tr>
                          );
                        })}
                        {ranking.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground text-xs">
                              Nenhum lance registrado ainda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Form lance */}
                {activeItem.status === "EmDisputa" && !pregaoEncerrado ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Valor do lance (R$)"
                      value={valorLance}
                      onChange={e => setValorLance(e.target.value)}
                      disabled={countdown === 0}
                      onKeyDown={e => e.key === "Enter" && enviarLance()}
                    />
                    <Button onClick={enviarLance} disabled={countdown === 0 || !valorLance}>
                      <Send className="h-4 w-4 mr-1" /> Dar lance
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-2 bg-muted/50 rounded-lg">
                    {activeItem.status === "Encerrado" ? "Disputa encerrada para este item." : "Aguardando abertura da disputa."}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Selecione um item ao lado.</CardContent></Card>
          )}
        </div>

        {/* Direita: Chat */}
        <div className="lg:col-span-3">
          <Card className="h-[calc(100vh-180px)] flex flex-col">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Chat Oficial
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setChatOpen(!chatOpen)}>
                {chatOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </CardHeader>
            {chatOpen && (
              <>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full px-3">
                    <div className="space-y-3 py-3">
                      {mensagens.map(m => {
                        const isMe = m.autor_tipo === "participante" && m.autor_nome_exibicao === participante.apelido;
                        const isPregoeiro = m.autor_tipo === "pregoeiro";
                        return (
                          <div key={m.id} className={`text-sm ${isMe ? "text-right" : "text-left"}`}>
                            <div className={`inline-block px-3 py-2 rounded-lg max-w-full ${
                              isPregoeiro ? "bg-amber-50 border border-amber-200 text-amber-900" :
                              isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}>
                              <p className="text-xs font-medium opacity-80 mb-0.5">
                                {isPregoeiro ? "📢 Pregoeiro" : isMe ? "Você" : m.autor_nome_exibicao}
                              </p>
                              <p className="text-sm">{m.mensagem}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(m.ts)}</p>
                          </div>
                        );
                      })}
                      {mensagens.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-4">Nenhuma mensagem ainda.</p>
                      )}
                      <div ref={msgEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
                <CardContent className="pt-0 pb-3">
                  {participante.chat_aberto ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Mensagem..."
                        value={msgTexto}
                        onChange={e => setMsgTexto(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && enviarMensagem()}
                      />
                      <Button size="sm" onClick={enviarMensagem} disabled={!msgTexto.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-center text-muted-foreground py-2 border rounded-lg bg-muted/40">
                      🔒 Chat fechado pelo pregoeiro. Aguarde liberação para enviar mensagens.
                    </div>
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
