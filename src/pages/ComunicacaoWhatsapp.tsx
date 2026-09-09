import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls from "@/components/PaginationControls";
import { Plus, Edit, Trash2, Send, MessageCircle, Eye, Power } from "lucide-react";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";
import { useFuncionarios } from "@/contexts/FuncionariosContext";

interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  modo: "imediato" | "agendado" | "recorrente";
  agendado_para: string | null;
  recorrencia: "diaria" | "semanal" | null;
  dias_semana: number[];
  hora_envio: string | null;
  ativo: boolean;
  proximo_envio: string | null;
  ultimo_envio_em: string | null;
  total_destinatarios: number;
  total_sucesso: number;
  total_erro: number;
  created_at: string;
}

interface Envio {
  id: string;
  funcionario_nome: string;
  telefone: string;
  sucesso: boolean;
  erro: string | null;
  enviado_em: string;
}

const DIAS = [
  { v: 0, l: "Dom" }, { v: 1, l: "Seg" }, { v: 2, l: "Ter" },
  { v: 3, l: "Qua" }, { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" },
];

const emptyForm = (): Partial<Campanha> => ({
  nome: "", mensagem: "", modo: "imediato",
  agendado_para: null, recorrencia: "diaria", dias_semana: [], hora_envio: "08:00",
  ativo: true,
});

function fmtData(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ComunicacaoWhatsappPage() {
  const { funcionarios } = useFuncionarios();
  const { tem } = usePermissao();
  const podeCriar = tem("comunicacao_whatsapp.criar");
  const podeEditar = tem("comunicacao_whatsapp.editar");
  const podeExcluir = tem("comunicacao_whatsapp.excluir");
  const podeEnviar = tem("comunicacao_whatsapp.enviar");
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [form, setForm] = useState<Partial<Campanha>>(emptyForm());
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [historicoCampanha, setHistoricoCampanha] = useState<Campanha | null>(null);

  const totalDestinatarios = useMemo(
    () => funcionarios.filter(f => (f.telefoneWhatsapp || "").replace(/\D/g, "").length >= 10 && f.status !== "Inativo").length,
    [funcionarios]
  );

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from("whatsapp_campanhas").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar campanhas"); console.error(error); }
    setCampanhas((data || []) as Campanha[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => campanhas.filter(c =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.mensagem.toLowerCase().includes(search.toLowerCase())
  ), [campanhas, search]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c: Campanha) => {
    setEditing(c);
    setForm({ ...c, dias_semana: c.dias_semana || [], hora_envio: c.hora_envio || "08:00", recorrencia: c.recorrencia || "diaria" });
    setOpen(true);
  };

  function calcularProximoEnvio(): string | null {
    if (form.modo === "agendado" && form.agendado_para) return new Date(form.agendado_para).toISOString();
    if (form.modo === "recorrente" && form.hora_envio) {
      const [h, m] = form.hora_envio.split(":").map(Number);
      const now = new Date();
      for (let i = 0; i <= 14; i++) {
        const cand = new Date(now);
        cand.setDate(now.getDate() + i);
        cand.setHours(h, m, 0, 0);
        if (cand <= now) continue;
        if (form.recorrencia === "diaria") return cand.toISOString();
        if (form.recorrencia === "semanal" && (form.dias_semana || []).includes(cand.getDay())) return cand.toISOString();
      }
    }
    return null;
  }

  const onSave = async () => {
    if (editing ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome?.trim()) { toast.error("Informe o nome da campanha"); return; }
    if (!form.mensagem?.trim()) { toast.error("Informe a mensagem"); return; }
    if (form.modo === "agendado" && !form.agendado_para) { toast.error("Informe data/hora do agendamento"); return; }
    if (form.modo === "recorrente") {
      if (!form.hora_envio) { toast.error("Informe a hora de envio"); return; }
      if (form.recorrencia === "semanal" && (!form.dias_semana || form.dias_semana.length === 0)) {
        toast.error("Selecione ao menos um dia da semana"); return;
      }
    }

    setSaving(true);
    const payload: any = {
      nome: form.nome,
      mensagem: form.mensagem,
      modo: form.modo,
      agendado_para: form.modo === "agendado" ? form.agendado_para : null,
      recorrencia: form.modo === "recorrente" ? form.recorrencia : null,
      dias_semana: form.modo === "recorrente" && form.recorrencia === "semanal" ? form.dias_semana : [],
      hora_envio: form.modo === "recorrente" ? form.hora_envio : null,
      ativo: form.ativo ?? true,
      proximo_envio: form.modo === "imediato" ? null : calcularProximoEnvio(),
    };

    const { error } = editing
      ? await (supabase as any).from("whatsapp_campanhas").update(payload).eq("id", editing.id)
      : await (supabase as any).from("whatsapp_campanhas").insert(payload);

    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); console.error(error); return; }
    toast.success(editing ? "Campanha atualizada" : "Campanha criada");
    setOpen(false);
    setForm(emptyForm());
    setEditing(null);
    await load();
  };

  const onDelete = async () => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!delId) return;
    const { error } = await (supabase as any).from("whatsapp_campanhas").delete().eq("id", delId);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Campanha excluída");
    setDelId(null);
    await load();
  };

  const enviarAgora = async (c: Campanha) => {
    if (!podeEnviar) { toast.error("Você não possui permissão para esta ação."); return; }
    toast.loading(`Enviando "${c.nome}"...`, { id: `send-${c.id}` });
    const { data, error } = await supabase.functions.invoke("process-whatsapp-campanhas", {
      body: { campanha_id: c.id },
    });
    if (error || !data?.success) {
      toast.error(`Falha ao enviar: ${error?.message || data?.error || "erro desconhecido"}`, { id: `send-${c.id}` });
      return;
    }
    toast.success(`Enviado: ${data.sucesso} sucesso, ${data.erro} erro (de ${data.destinatarios})`, { id: `send-${c.id}` });
    await load();
  };

  const toggleAtivo = async (c: Campanha) => {
    const { error } = await (supabase as any).from("whatsapp_campanhas").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) { toast.error("Erro"); return; }
    await load();
  };

  const verHistorico = async (c: Campanha) => {
    setHistoricoCampanha(c);
    setHistoricoOpen(true);
    const { data } = await (supabase as any)
      .from("whatsapp_envios")
      .select("*")
      .eq("campanha_id", c.id)
      .order("enviado_em", { ascending: false })
      .limit(500);
    setEnvios((data || []) as Envio[]);
  };

  const labelModo = (c: Campanha) => {
    if (c.modo === "imediato") return <Badge variant="secondary">Imediato</Badge>;
    if (c.modo === "agendado") return <Badge variant="outline">Agendado</Badge>;
    return <Badge className="bg-primary/10 text-primary border-primary/20">Recorrente</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" /> Notificação WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure mensagens e agende envios para todos os funcionários com WhatsApp cadastrado.
          </p>
        </div>
        {podeCriar && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova Campanha</Button>}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><div className="text-xs text-muted-foreground">Funcionários elegíveis</div><div className="text-2xl font-semibold">{totalDestinatarios}</div></div>
          <div><div className="text-xs text-muted-foreground">Campanhas cadastradas</div><div className="text-2xl font-semibold">{campanhas.length}</div></div>
          <div><div className="text-xs text-muted-foreground">Recorrentes ativas</div><div className="text-2xl font-semibold">{campanhas.filter(c => c.modo === "recorrente" && c.ativo).length}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Campanhas</CardTitle>
            <Input placeholder="Buscar..." className="max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Próximo envio</TableHead>
                <TableHead>Último envio</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Carregando...</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma campanha cadastrada</TableCell></TableRow>
              ) : paged.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{labelModo(c)}</TableCell>
                  <TableCell className="text-sm">{fmtData(c.proximo_envio)}</TableCell>
                  <TableCell className="text-sm">{fmtData(c.ultimo_envio_em)}</TableCell>
                  <TableCell className="text-sm">
                    {c.ultimo_envio_em ? (
                      <span><span className="text-emerald-600 font-medium">{c.total_sucesso}</span> / <span className="text-destructive font-medium">{c.total_erro}</span> de {c.total_destinatarios}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {podeEditar && <Button size="icon" variant="ghost" onClick={() => toggleAtivo(c)} title={c.ativo ? "Desativar" : "Ativar"}>
                      <Power className={`h-4 w-4 ${c.ativo ? "text-emerald-600" : "text-muted-foreground"}`} />
                    </Button>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {podeEnviar && <Button size="icon" variant="ghost" onClick={() => enviarAgora(c)} title="Enviar agora"><Send className="h-4 w-4 text-primary" /></Button>}
                    <Button size="icon" variant="ghost" onClick={() => verHistorico(c)} title="Histórico"><Eye className="h-4 w-4" /></Button>
                    {podeEditar && <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>}
                    {podeExcluir && <Button size="icon" variant="ghost" onClick={() => setDelId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls currentPage={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Editar Campanha" : "Nova Campanha"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome || ""} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aviso semanal de segurança" />
            </div>
            <div>
              <Label>Mensagem *</Label>
              <Textarea rows={5} value={form.mensagem || ""} onChange={e => setForm({ ...form, mensagem: e.target.value })} placeholder="Digite a mensagem que será enviada..." />
              <p className="text-xs text-muted-foreground mt-1">Será enviada via WhatsApp para todos os funcionários ativos com "Telefone WhatsApp" cadastrado ({totalDestinatarios} destinatários).</p>
            </div>

            <div>
              <Label>Tipo de envio *</Label>
              <Select value={form.modo} onValueChange={(v: any) => setForm({ ...form, modo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="imediato">Imediato (manual via "Enviar agora")</SelectItem>
                  <SelectItem value="agendado">Agendado (data e hora específica)</SelectItem>
                  <SelectItem value="recorrente">Recorrente (diário ou semanal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.modo === "agendado" && (
              <div>
                <Label>Data e hora do envio *</Label>
                <Input type="datetime-local" value={form.agendado_para ? new Date(form.agendado_para).toISOString().slice(0, 16) : ""}
                  onChange={e => setForm({ ...form, agendado_para: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            )}

            {form.modo === "recorrente" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Recorrência *</Label>
                    <Select value={form.recorrencia || "diaria"} onValueChange={(v: any) => setForm({ ...form, recorrencia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diaria">Todos os dias</SelectItem>
                        <SelectItem value="semanal">Dias específicos da semana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Hora do envio *</Label>
                    <Input type="time" value={form.hora_envio || ""} onChange={e => setForm({ ...form, hora_envio: e.target.value })} />
                  </div>
                </div>
                {form.recorrencia === "semanal" && (
                  <div>
                    <Label>Dias da semana *</Label>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {DIAS.map(d => (
                        <label key={d.v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox
                            checked={(form.dias_semana || []).includes(d.v)}
                            onCheckedChange={(v) => {
                              const cur = new Set(form.dias_semana || []);
                              if (v) cur.add(d.v); else cur.delete(d.v);
                              setForm({ ...form, dias_semana: Array.from(cur).sort() });
                            }}
                          />
                          {d.l}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Checkbox checked={form.ativo ?? true} onCheckedChange={v => setForm({ ...form, ativo: !!v })} />
              <Label className="cursor-pointer">Campanha ativa (executa nos horários agendados)</Label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : editing ? "Atualizar" : "Cadastrar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historicoOpen} onOpenChange={setHistoricoOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de envios — {historicoCampanha?.nome}</DialogTitle></DialogHeader>
          {envios.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhum envio registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envios.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{e.funcionario_nome}</TableCell>
                    <TableCell className="font-mono text-xs">{e.telefone}</TableCell>
                    <TableCell>{e.sucesso ? <Badge className="bg-emerald-100 text-emerald-700">Enviado</Badge> : <Badge variant="destructive" title={e.erro || ""}>Falha</Badge>}</TableCell>
                    <TableCell className="text-sm">{fmtData(e.enviado_em)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete open={!!delId} onOpenChange={v => { if (!v) setDelId(null); }} onConfirm={onDelete} />
    </div>
  );
}
