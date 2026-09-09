import { useEffect, useMemo, useRef, useState } from "react";
import { usePmoc } from "@/contexts/PmocContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Wrench, CheckCircle2, ArrowLeft, CalendarClock, X,
  Clock, ShieldCheck, XCircle, FileText, FileSpreadsheet, Camera, ImagePlus, Trash2,
} from "lucide-react";
import {
  gerarPdfPmocInformacoes,
  gerarPdfPmocManutencoesFotos,
  gerarPdfPmocHistoricoAtividades,
  drawHeader,
  rodape,
  getLogo,
} from "@/lib/gerarPdfPmocEquipamento";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");


const PERIODICIDADE_ORDEM = ["Diária", "Semanal", "Quinzenal", "Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"];

function addPeriodicidade(date: Date, periodicidade: string): Date {
  const d = new Date(date);
  switch ((periodicidade || "").trim()) {
    case "Diária": d.setDate(d.getDate() + 1); break;
    case "Semanal": d.setDate(d.getDate() + 7); break;
    case "Quinzenal": d.setDate(d.getDate() + 15); break;
    case "Mensal": d.setMonth(d.getMonth() + 1); break;
    case "Bimestral": d.setMonth(d.getMonth() + 2); break;
    case "Trimestral": d.setMonth(d.getMonth() + 3); break;
    case "Semestral": d.setMonth(d.getMonth() + 6); break;
    case "Anual": d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function podeRegistrarManutencao(proximaExecucao: string | null | undefined): boolean {
  if (!proximaExecucao) return true;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prox = new Date(proximaExecucao);
  prox.setHours(0, 0, 0, 0);
  const limite = new Date(prox);
  limite.setDate(limite.getDate() - 2);
  return hoje >= limite;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}


const ALL = "__all__";

interface Execucao {
  id: string;
  atividade_id: string;
  plano_id: string | null;
  equipamento_id: string | null;
  equipamento_nome: string | null;
  cliente_nome: string | null;
  atividade_descricao: string | null;
  periodicidade: string | null;
  data_execucao: string;
  proxima_execucao: string | null;
  status: string;
  registrado_por: string | null;
  confirmado_por: string | null;
  data_confirmacao: string | null;
  observacoes: string | null;
  fotos: string[] | null;
  created_at: string;
}

export default function PmocGerenciarOperacao() {
  const { atividades, planos, updateAtividade } = usePmoc();
  const { equipamentos } = useEquipamentos();
  const { usuarioLogado } = useAuth();
  const { tem } = usePermissao();
  const podeConfirmar = tem("pmoc.confirmar_execucao");
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filtroCliente, setFiltroCliente] = useState(ALL);
  const [filtroSetor, setFiltroSetor] = useState(ALL);
  const [filtroPeriodicidade, setFiltroPeriodicidade] = useState(ALL);
  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [pendSelecionadas, setPendSelecionadas] = useState<Set<string>>(new Set());

  // Dialog "Registrar Manutenção" com fotos
  const [regAtividade, setRegAtividade] = useState<any | null>(null);
  const [regFotos, setRegFotos] = useState<{ file: File; preview: string }[]>([]);
  const [regObservacoes, setRegObservacoes] = useState("");
  const [regUploading, setRegUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const MAX_FOTOS = 6;
  const MAX_FOTO_MB = 8;

  const abrirRegistro = (atividade: any) => {
    setRegAtividade(atividade);
    setRegFotos([]);
    setRegObservacoes("");
  };
  const fecharRegistro = () => {
    regFotos.forEach((f) => URL.revokeObjectURL(f.preview));
    setRegAtividade(null);
    setRegFotos([]);
    setRegObservacoes("");
  };

  const addFotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const restantes = MAX_FOTOS - regFotos.length;
    if (restantes <= 0) {
      toast({ title: `Máximo de ${MAX_FOTOS} fotos`, variant: "destructive" });
      return;
    }
    const novos: { file: File; preview: string }[] = [];
    Array.from(files).slice(0, restantes).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > MAX_FOTO_MB * 1024 * 1024) {
        toast({ title: `Foto acima de ${MAX_FOTO_MB}MB ignorada`, description: file.name, variant: "destructive" });
        return;
      }
      novos.push({ file, preview: URL.createObjectURL(file) });
    });
    setRegFotos((prev) => [...prev, ...novos]);
  };

  const removerFoto = (idx: number) => {
    setRegFotos((prev) => {
      const out = [...prev];
      const [removed] = out.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return out;
    });
  };


  const carregarExecucoes = async () => {
    const { data, error } = await supabase
      .from("pmoc_atividades_execucoes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar execuções", description: error.message, variant: "destructive" });
      return;
    }
    const rows = (data || []).map((e: any) => {
      const equip = equipamentos.find((eq) => eq.id === e.equipamento_id);
      return { ...e, cliente_nome: equip?.clienteNome || null } as Execucao;
    });
    setExecucoes(rows);
  };
  useEffect(() => { carregarExecucoes(); }, [equipamentos]);

  const pendentes = useMemo(() => execucoes.filter((e) => e.status === "Pendente"), [execucoes]);
  const pendentesPorAtividade = useMemo(() => {
    const map = new Map<string, Execucao>();
    pendentes.forEach((p) => { if (!map.has(p.atividade_id)) map.set(p.atividade_id, p); });
    return map;
  }, [pendentes]);

  const equipamentosComPlano = useMemo(() => {
    const map = new Map<string, {
      id: string; nome: string; clienteNome: string; setorDescricao: string;
      periodicidades: Set<string>; atividades: typeof atividades;
    }>();
    atividades.forEach((a) => {
      if (!a.equipamentoId) return;
      const equip = equipamentos.find((e) => e.id === a.equipamentoId);
      const nome = equip
        ? `${equip.tag || ""} ${equip.equipamento || ""}`.trim() || a.equipamentoNome || "Equipamento"
        : a.equipamentoNome || "Equipamento";
      if (!map.has(a.equipamentoId)) {
        map.set(a.equipamentoId, {
          id: a.equipamentoId, nome,
          clienteNome: equip?.clienteNome || "",
          setorDescricao: equip?.setorDescricao || "",
          periodicidades: new Set<string>(),
          atividades: [],
        });
      }
      const entry = map.get(a.equipamentoId)!;
      entry.atividades.push(a);
      if (a.periodicidade) entry.periodicidades.add(a.periodicidade);
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [atividades, equipamentos]);

  const clientesDisponiveis = useMemo(
    () => [...new Set(equipamentosComPlano.map((e) => e.clienteNome).filter(Boolean))].sort(),
    [equipamentosComPlano]
  );
  const setoresDisponiveis = useMemo(
    () => [...new Set(equipamentosComPlano.map((e) => e.setorDescricao).filter(Boolean))].sort(),
    [equipamentosComPlano]
  );

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return equipamentosComPlano.filter((e) => {
      if (s && !e.nome.toLowerCase().includes(s) &&
          !e.clienteNome.toLowerCase().includes(s) &&
          !e.setorDescricao.toLowerCase().includes(s)) return false;
      if (filtroCliente !== ALL && e.clienteNome !== filtroCliente) return false;
      if (filtroSetor !== ALL && e.setorDescricao !== filtroSetor) return false;
      if (filtroPeriodicidade !== ALL && !e.periodicidades.has(filtroPeriodicidade)) return false;
      return true;
    });
  }, [equipamentosComPlano, search, filtroCliente, filtroSetor, filtroPeriodicidade]);

  const limparFiltros = () => {
    setSearch(""); setFiltroCliente(ALL); setFiltroSetor(ALL); setFiltroPeriodicidade(ALL);
  };

  const selected = selectedEquipId ? equipamentosComPlano.find((e) => e.id === selectedEquipId) : null;
  const atividadesOrdenadas = useMemo(() => {
    if (!selected) return [];
    return [...selected.atividades].sort((a, b) => {
      const ia = PERIODICIDADE_ORDEM.indexOf(a.periodicidade);
      const ib = PERIODICIDADE_ORDEM.indexOf(b.periodicidade);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [selected]);

  const uploadFotos = async (atividadeId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const f of regFotos) {
      const ext = (f.file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `pmoc/fotos/${atividadeId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("documentos").upload(path, f.file, {
        cacheControl: "3600", upsert: false, contentType: f.file.type,
      });
      if (error) {
        console.error("upload foto", error);
        toast({ title: "Erro ao enviar foto", description: error.message, variant: "destructive" });
        continue;
      }
      const { data } = supabase.storage.from("documentos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const confirmarRegistro = async () => {
    if (!regAtividade) return;
    setRegUploading(true);
    setBusy(true);
    try {
      const agora = new Date();
      const proxima = addPeriodicidade(agora, regAtividade.periodicidade);
      const equip = equipamentos.find((e) => e.id === regAtividade.equipamentoId);
      const equipNome = equip
        ? `${equip.tag || ""} ${equip.equipamento || ""}`.trim() || regAtividade.equipamentoNome
        : regAtividade.equipamentoNome;
      const fotosUrls = regFotos.length > 0 ? await uploadFotos(regAtividade.id) : [];
      const { error } = await supabase.from("pmoc_atividades_execucoes").insert({
        atividade_id: regAtividade.id,
        plano_id: regAtividade.planoId || null,
        equipamento_id: regAtividade.equipamentoId || null,
        equipamento_nome: equipNome,
        atividade_descricao: regAtividade.descricao,
        periodicidade: regAtividade.periodicidade,
        data_execucao: agora.toISOString(),
        proxima_execucao: proxima.toISOString(),
        status: "Pendente",
        registrado_por: usuarioLogado?.nome || "",
        observacoes: regObservacoes.trim() || null,
        fotos: fotosUrls,
      });
      if (error) throw error;
      toast({
        title: "Registro enviado",
        description: `Manutenção registrada${fotosUrls.length ? ` com ${fotosUrls.length} foto(s)` : ""}. Aguarda confirmação.`,
      });
      fecharRegistro();
      await carregarExecucoes();
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      setRegUploading(false);
    }
  };


  const confirmarExecucoes = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!podeConfirmar) {
      toast({ title: "Sem permissão", description: "Você não pode confirmar execuções.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const agoraIso = new Date().toISOString();
      const alvo = execucoes.filter((e) => ids.includes(e.id) && e.status === "Pendente");
      // 1) Marca execuções como Confirmada
      const { error: errUp } = await supabase
        .from("pmoc_atividades_execucoes")
        .update({
          status: "Confirmada",
          confirmado_por: usuarioLogado?.nome || "",
          data_confirmacao: agoraIso,
        })
        .in("id", ids);
      if (errUp) throw errUp;
      // 2) Atualiza atividades (última/próxima) — só após confirmação
      await Promise.all(alvo.map((e) =>
        updateAtividade(e.atividade_id, {
          ultima_execucao: e.data_execucao,
          proxima_execucao: e.proxima_execucao,
        })
      ));
      toast({ title: "Manutenção concluída", description: `${alvo.length} execução(ões) confirmada(s).` });
      setPendSelecionadas(new Set());
      await carregarExecucoes();
    } catch (e: any) {
      toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const rejeitarExecucao = async (id: string) => {
    if (!podeConfirmar) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("pmoc_atividades_execucoes")
        .update({
          status: "Rejeitada",
          confirmado_por: usuarioLogado?.nome || "",
          data_confirmacao: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Registro rejeitado" });
      await carregarExecucoes();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const togglePend = (id: string) => {
    setPendSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleTodos = () => {
    if (pendSelecionadas.size === pendentes.length) setPendSelecionadas(new Set());
    else setPendSelecionadas(new Set(pendentes.map((p) => p.id)));
  };

  // ===================== DETALHE DO EQUIPAMENTO =====================
  if (selected) {
    const plano = planos.find((p) => p.id === selected.atividades[0]?.planoId);
    const equipObj = equipamentos.find((e) => e.id === selected.id) || null;
    const execsEquip = execucoes.filter((e) => e.equipamento_id === selected.id);

    const relInformacoes = () =>
      gerarPdfPmocInformacoes({
        equip: equipObj,
        equipNome: selected.nome,
        planoTitulo: plano?.titulo,
        atividades: atividadesOrdenadas as any,
      });
    const relManutencoesFotos = () =>
      gerarPdfPmocManutencoesFotos({
        equip: equipObj,
        equipNome: selected.nome,
        planoTitulo: plano?.titulo,
        execucoes: execsEquip,
      });
    const relHistorico = () =>
      gerarPdfPmocHistoricoAtividades({
        equip: equipObj,
        equipNome: selected.nome,
        planoTitulo: plano?.titulo,
        execucoes: execsEquip,
      });

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setSelectedEquipId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-2xl font-serif font-semibold flex-1">{selected.nome}</h1>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={relInformacoes}>
              <FileText className="h-4 w-4 mr-1" /> Informações
            </Button>
            <Button variant="outline" size="sm" onClick={relManutencoesFotos}>
              <Camera className="h-4 w-4 mr-1" /> Manutenções + Fotos
            </Button>
            <Button variant="outline" size="sm" onClick={relHistorico}>
              <Clock className="h-4 w-4 mr-1" /> Histórico
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Manutenções do Equipamento
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selected.clienteNome && <>Cliente: {selected.clienteNome} · </>}
              {selected.setorDescricao && <>Setor: {selected.setorDescricao}</>}
              {plano && <> · Plano: {plano.titulo}</>}
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Última Execução</TableHead>
                  <TableHead>Próxima Execução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividadesOrdenadas.map((a) => {
                  const pend = pendentesPorAtividade.get(a.id);
                  const liberado = podeRegistrarManutencao(a.proximaExecucao);
                  const liberadoEm = a.proximaExecucao
                    ? fmtDate(new Date(new Date(a.proximaExecucao).setDate(new Date(a.proximaExecucao).getDate() - 2)).toISOString())
                    : "";
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.descricao || "—"}</TableCell>
                      <TableCell>{a.tipo}</TableCell>
                      <TableCell><Badge variant="secondary">{a.periodicidade}</Badge></TableCell>
                      <TableCell>{fmtDateTime(a.ultimaExecucao)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <CalendarClock className="h-4 w-4 text-muted-foreground" />
                          {fmtDateTime(a.proximaExecucao)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {pend ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-700">
                            <Clock className="h-3 w-3 mr-1" /> Aguardando confirmação
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-700">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => abrirRegistro(a)}
                          disabled={busy || !!pend || !liberado}
                          title={
                            pend
                              ? "Já existe um registro pendente para esta atividade"
                              : !liberado
                              ? `Disponível a partir de ${liberadoEm}`
                              : ""
                          }
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {pend ? "Pendente" : "Registrar Manutenção"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {atividadesOrdenadas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Nenhuma atividade cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog Registrar Manutenção com fotos */}
        <Dialog open={!!regAtividade} onOpenChange={(o) => !o && fecharRegistro()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" /> Registrar Manutenção
              </DialogTitle>
              <DialogDescription>
                {regAtividade?.descricao} — {regAtividade?.periodicidade}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    Fotos da atividade ({regFotos.length}/{MAX_FOTOS})
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => { addFotos(e.target.files); if (e.target) e.target.value = ""; }}
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => { addFotos(e.target.files); if (e.target) e.target.value = ""; }}
                    />
                    <Button
                      type="button" size="sm" variant="outline"
                      disabled={regFotos.length >= MAX_FOTOS || regUploading}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-1" /> Tirar foto
                    </Button>
                    <Button
                      type="button" size="sm" variant="outline"
                      disabled={regFotos.length >= MAX_FOTOS || regUploading}
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4 mr-1" /> Galeria
                    </Button>
                  </div>
                </div>
                {regFotos.length === 0 ? (
                  <div className="border-2 border-dashed rounded-md p-6 text-center text-sm text-muted-foreground">
                    Adicione até {MAX_FOTOS} fotos da atividade executada. No celular, "Tirar foto" abre a câmera.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {regFotos.map((f, idx) => (
                      <div key={idx} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                        <img src={f.preview} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removerFoto(idx)}
                          disabled={regUploading}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remover foto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Observações (opcional)</label>
                <Textarea
                  value={regObservacoes}
                  onChange={(e) => setRegObservacoes(e.target.value)}
                  placeholder="Detalhes da execução, ocorrências, etc."
                  rows={3}
                  disabled={regUploading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={fecharRegistro} disabled={regUploading}>Cancelar</Button>
              <Button onClick={confirmarRegistro} disabled={regUploading || busy}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {regUploading ? "Enviando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const algumFiltro = search || filtroCliente !== ALL || filtroSetor !== ALL || filtroPeriodicidade !== ALL;

  // ===================== LISTA + ABAS =====================
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-serif font-semibold">Gerenciar Operação</h1>

      <Tabs defaultValue="equipamentos">
        <TabsList>
          <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
          <TabsTrigger value="pendentes">
            Confirmações Pendentes
            {pendentes.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendentes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ============== EQUIPAMENTOS ============== */}
        <TabsContent value="equipamentos">
          <Card>
            <CardHeader>
              <CardTitle>Equipamentos com Plano PMOC</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_200px_200px_200px_auto]">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar equipamento, cliente ou setor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                  <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os clientes</SelectItem>
                    {clientesDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                  <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os setores</SelectItem>
                    {setoresDisponiveis.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtroPeriodicidade} onValueChange={setFiltroPeriodicidade}>
                  <SelectTrigger><SelectValue placeholder="Periodicidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas periodicidades</SelectItem>
                    {PERIODICIDADE_ORDEM.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {algumFiltro && (
                  <Button variant="ghost" onClick={limparFiltros}>
                    <X className="h-4 w-4 mr-1" /> Limpar
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-center">Atividades</TableHead>
                    <TableHead className="text-center">Pendentes</TableHead>
                    <TableHead>Próxima Manutenção</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const proximas = e.atividades.map((a) => a.proximaExecucao).filter(Boolean).sort();
                    const proxima = proximas[0] || "";
                    const pendCount = e.atividades.filter((a) => pendentesPorAtividade.has(a.id)).length;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell>{e.clienteNome || "—"}</TableCell>
                        <TableCell>{e.setorDescricao || "—"}</TableCell>
                        <TableCell className="text-center">{e.atividades.length}</TableCell>
                        <TableCell className="text-center">
                          {pendCount > 0 ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-700">{pendCount}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{fmtDateTime(proxima)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedEquipId(e.id)}>
                            <Wrench className="h-4 w-4 mr-1" /> Operar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        Nenhum equipamento com plano PMOC encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== PENDENTES ============== */}
        <TabsContent value="pendentes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Aguardando Confirmação
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Apenas usuários com permissão "Confirmar execução de manutenção" podem concluir.
                </p>
              </div>
              {podeConfirmar && pendSelecionadas.size > 0 && (
                <Button
                  onClick={() => confirmarExecucoes(Array.from(pendSelecionadas))}
                  disabled={busy}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  Confirmar selecionadas ({pendSelecionadas.size})
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {podeConfirmar && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={pendentes.length > 0 && pendSelecionadas.size === pendentes.length}
                          onCheckedChange={toggleTodos}
                        />
                      </TableHead>
                    )}
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Executada em</TableHead>
                    <TableHead>Próxima</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((p) => (
                    <TableRow key={p.id}>
                      {podeConfirmar && (
                        <TableCell>
                          <Checkbox
                            checked={pendSelecionadas.has(p.id)}
                            onCheckedChange={() => togglePend(p.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{p.equipamento_nome || "—"}</TableCell>
                      <TableCell>{p.atividade_descricao || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{p.periodicidade}</Badge></TableCell>
                      <TableCell>{fmtDateTime(p.data_execucao)}</TableCell>
                      <TableCell>{fmtDateTime(p.proxima_execucao || "")}</TableCell>
                      <TableCell>{p.registrado_por || "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {podeConfirmar ? (
                          <>
                            <Button size="sm" onClick={() => confirmarExecucoes([p.id])} disabled={busy}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => rejeitarExecucao(p.id)} disabled={busy}>
                              <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem permissão</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendentes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={podeConfirmar ? 8 : 7} className="text-center text-muted-foreground py-6">
                        Nenhum registro pendente.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== HISTÓRICO ============== */}
        <TabsContent value="historico">
          <HistoricoExecucoes execucoes={execucoes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoricoExecucoes({ execucoes }: { execucoes: Execucao[] }) {
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(ALL);
  const [equipFiltro, setEquipFiltro] = useState<string>(ALL);
  const [clienteFiltro, setClienteFiltro] = useState<string>(ALL);
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  const equipamentosUnicos = useMemo(() => {
    const set = new Set<string>();
    execucoes.forEach((e) => { if (e.equipamento_nome) set.add(e.equipamento_nome); });
    return Array.from(set).sort();
  }, [execucoes]);

  const clientesUnicos = useMemo(() => {
    const set = new Set<string>();
    execucoes.forEach((e) => { if (e.cliente_nome) set.add(e.cliente_nome); });
    return Array.from(set).sort();
  }, [execucoes]);

  const filtradas = useMemo(() => {
    const ini = dataIni ? new Date(dataIni + "T00:00:00").getTime() : null;
    const fim = dataFim ? new Date(dataFim + "T23:59:59").getTime() : null;
    const term = search.trim().toLowerCase();
    return execucoes.filter((e) => {
      if (statusFiltro !== ALL && e.status !== statusFiltro) return false;
      if (equipFiltro !== ALL && e.equipamento_nome !== equipFiltro) return false;
      if (clienteFiltro !== ALL && e.cliente_nome !== clienteFiltro) return false;
      const t = new Date(e.data_execucao).getTime();
      if (ini !== null && t < ini) return false;
      if (fim !== null && t > fim) return false;
      if (term) {
        const blob = `${e.equipamento_nome || ""} ${e.atividade_descricao || ""} ${e.registrado_por || ""} ${e.confirmado_por || ""} ${e.cliente_nome || ""}`.toLowerCase();
        if (!blob.includes(term)) return false;
      }
      return true;
    });
  }, [execucoes, statusFiltro, equipFiltro, clienteFiltro, dataIni, dataFim, search]);

  const limpar = () => {
    setSearch(""); setStatusFiltro(ALL); setEquipFiltro(ALL); setClienteFiltro(ALL); setDataIni(""); setDataFim("");
  };

  const columns = ["Cliente", "Equipamento", "Atividade", "Executada em", "Status", "Registrado por", "Confirmado por"];
  const buildRows = () => filtradas.map((p) => [
    p.cliente_nome || "-",
    p.equipamento_nome || "-",
    p.atividade_descricao || "-",
    fmtDateTime(p.data_execucao),
    p.status,
    p.registrado_por || "-",
    p.confirmado_por || "-",
  ]);

  const filtrosLabel = [
    statusFiltro !== ALL ? `Status: ${statusFiltro}` : null,
    equipFiltro !== ALL ? `Equip.: ${equipFiltro}` : null,
    clienteFiltro !== ALL ? `Cliente: ${clienteFiltro}` : null,
    dataIni ? `De: ${dataIni}` : null,
    dataFim ? `Até: ${dataFim}` : null,
    search ? `Busca: ${search}` : null,
  ].filter(Boolean).join(" | ");

  const exportarPDF = async () => {
    const rows = buildRows();
    if (rows.length === 0) return;
    const logo = await getLogo();
    const doc = new (await getJsPDF())({ compress: true, orientation: "l" });
    const pw = doc.internal.pageSize.getWidth();
    await drawHeader(doc, pw, logo, "PMOC — Histórico de Execuções", `Total: ${rows.length} registro(s)${filtrosLabel ? " | " + filtrosLabel : ""}`);

    (await getAutoTable())(doc, {
      startY: 34,
      head: [columns],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    rodape(doc);
    doc.save(`historico_execucoes_pmoc_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportarExcel = async () => {
    const rows = buildRows();
    if (rows.length === 0) return;
    const data = rows.map((r) => {
      const o: Record<string, string> = {};
      columns.forEach((c, i) => { o[c] = r[i] || ""; });
      return o;
    });
    const ws = (await getXLSX()).utils.json_to_sheet(data);
    ws["!cols"] = columns.map(() => ({ wch: 22 }));
    const wb = (await getXLSX()).utils.book_new();
    (await getXLSX()).utils.book_append_sheet(wb, ws, "Histórico");
    (await getXLSX()).writeFile(wb, `historico_execucoes_pmoc_${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle>Histórico de Execuções ({filtradas.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarPDF} disabled={filtradas.length === 0}>
              <FileText className="h-4 w-4 mr-1" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportarExcel} disabled={filtradas.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos clientes</SelectItem>
              {clientesUnicos.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos status</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Confirmada">Confirmada</SelectItem>
              <SelectItem value="Rejeitada">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={equipFiltro} onValueChange={setEquipFiltro}>
            <SelectTrigger><SelectValue placeholder="Equipamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos equipamentos</SelectItem>
              {equipamentosUnicos.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
            </SelectContent>
          </Select>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} title="Data inicial" />
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Data final" />
        </div>
        {(search || statusFiltro !== ALL || equipFiltro !== ALL || clienteFiltro !== ALL || dataIni || dataFim) && (
          <Button variant="ghost" size="sm" onClick={limpar}>
            <X className="h-4 w-4 mr-1" />Limpar filtros
          </Button>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Atividade</TableHead>
              <TableHead>Executada em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Confirmado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.cliente_nome || "—"}</TableCell>
                <TableCell>{p.equipamento_nome || "—"}</TableCell>
                <TableCell>{p.atividade_descricao || "—"}</TableCell>
                <TableCell>{fmtDateTime(p.data_execucao)}</TableCell>
                <TableCell>
                  <Badge variant={
                    p.status === "Confirmada" ? "default"
                      : p.status === "Rejeitada" ? "destructive" : "outline"
                  }>{p.status}</Badge>
                </TableCell>
                <TableCell>{p.registrado_por || "—"}</TableCell>
                <TableCell>{p.confirmado_por || "—"}</TableCell>
              </TableRow>
            ))}
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Nenhum registro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
