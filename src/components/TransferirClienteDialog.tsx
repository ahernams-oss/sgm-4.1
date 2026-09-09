import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, ArrowRightLeft, History, Clock, ThumbsUp, ThumbsDown, FileClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/contexts/AuthContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useCargos } from "@/contexts/CargosContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface HistoricoRow {
  id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  data_inicio: string;
  data_fim: string | null;
  justificativa: string | null;
  autorizado_por_email: string | null;
  alterado_por: string | null;
}

interface PendenteRow {
  id: string;
  funcionario_id: string;
  funcionario_nome: string | null;
  cliente_atual_id: string | null;
  cliente_atual_nome: string | null;
  novo_cliente_id: string;
  novo_cliente_nome: string | null;
  justificativa: string | null;
  status: string;
  solicitado_por: string | null;
  solicitado_em: string;
  decidido_por: string | null;
  decidido_em: string | null;
  decisao_observacao: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  funcionarioId: string;
  funcionarioNome: string;
  clienteAtualId: string;
  podeAutorizar: boolean;
}

const fmt = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

async function getWhatsappRH(): Promise<string> {
  const { data } = await (supabase as any).from("empresa").select("whatsapp_rh").limit(1).maybeSingle();
  return (data?.whatsapp_rh || "").trim();
}

/** Modalidades = jornadas de trabalho cadastradas no funcionário */
const MODALIDADES = ["Diarista", "Plantão Diurno - PAR", "Plantão Diurno - ÍMPAR", "Plantão Noturno - PAR", "Plantão Noturno - ÍMPAR"];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const fmtDataExtenso = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("pt-BR")} (${d.toLocaleDateString("pt-BR", { weekday: "long" })})`;
};

export default function TransferirClienteDialog({ open, onOpenChange, funcionarioId, funcionarioNome, clienteAtualId, podeAutorizar }: Props) {
  const { clientes } = useClientes();
  const { updateFuncionario, funcionarios } = useFuncionarios();
  const { cargos } = useCargos();
  const { usuarioLogado } = useAuth();

  const [novoClienteId, setNovoClienteId] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);
  const [pendentes, setPendentes] = useState<PendenteRow[]>([]);

  // Dados do remanejamento
  const [coberturaId, setCoberturaId] = useState("");
  const [coberturaOpen, setCoberturaOpen] = useState(false);
  const [funcaoOrigem, setFuncaoOrigem] = useState("");
  const [modalidadeOrigem, setModalidadeOrigem] = useState("");
  const [funcaoDestino, setFuncaoDestino] = useState("");
  const [modalidadeDestino, setModalidadeDestino] = useState("");
  const [dataVigencia, setDataVigencia] = useState("");

  const clientesAtivos = clientes.filter((c) => c.tipo === "Cliente");
  const clienteAtualNome = clientes.find((c) => c.id === clienteAtualId)?.nome ?? "—";
  const novoClienteNome = clientes.find((c) => c.id === novoClienteId)?.nome ?? "";
  const quemSou = usuarioLogado?.nome || usuarioLogado?.email || "Usuário";

  const funcionario = funcionarios.find((f) => f.id === funcionarioId);
  const cargoNome = cargos.find((c) => c.id === funcionario?.cargoId)?.nome ?? "";
  const jornadaFuncionario = funcionario?.jornadaTrabalho ?? "";

  const coberturaFunc = funcionarios.find((f) => f.id === coberturaId);
  const coberturaNome = coberturaFunc?.nome ?? "";
  const coberturaCargo = cargos.find((c) => c.id === coberturaFunc?.cargoId)?.nome ?? "";
  const coberturaCliente = clientes.find((c) => c.id === coberturaFunc?.clienteId)?.nome ?? "";
  const coberturaJornada = coberturaFunc?.jornadaTrabalho ?? "";

  const detalhes = {
    colaborador_cobertura: coberturaNome,
    cobertura_id: coberturaId || null,
    cobertura_funcao: coberturaCargo,
    cobertura_contrato: coberturaCliente,
    cobertura_modalidade: coberturaJornada,
    contrato_origem: clienteAtualNome,
    funcao_origem: funcaoOrigem.trim(),
    modalidade_origem: modalidadeOrigem,
    contrato_destino: novoClienteNome,
    funcao_destino: funcaoDestino.trim(),
    modalidade_destino: modalidadeDestino,
    data_vigencia: dataVigencia || null,
  };

  const loadHistorico = async () => {
    const [{ data: hist }, { data: pend }] = await Promise.all([
      (supabase as any).from("funcionario_cliente_historico").select("*").eq("funcionario_id", funcionarioId).order("data_inicio", { ascending: false }),
      (supabase as any).from("funcionario_transferencia_solicitacoes").select("*").eq("funcionario_id", funcionarioId).eq("status", "pendente").order("solicitado_em", { ascending: false }),
    ]);
    setHistorico((hist as HistoricoRow[]) || []);
    setPendentes((pend as PendenteRow[]) || []);
  };

  useEffect(() => {
    if (open) {
      setNovoClienteId(""); setJustificativa(""); setEmail(""); setSenha("");
      setCoberturaId(""); setDataVigencia("");
      setFuncaoOrigem(cargoNome); setFuncaoDestino(cargoNome);
      setModalidadeOrigem(jornadaFuncionario); setModalidadeDestino(jornadaFuncionario);
      loadHistorico();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, funcionarioId, cargoNome, jornadaFuncionario]);


  const executarTransferencia = async (opts: {
    novoId: string; novoNome: string; just: string; autorizadoPorEmail: string; detalhes?: any;
  }) => {
    const agora = new Date().toISOString();
    await (supabase as any).from("funcionario_cliente_historico").update({ data_fim: agora })
      .eq("funcionario_id", funcionarioId).is("data_fim", null);

    const { data: abertos } = await (supabase as any).from("funcionario_cliente_historico")
      .select("id").eq("funcionario_id", funcionarioId).limit(1);
    if ((!abertos || abertos.length === 0) && clienteAtualId) {
      await (supabase as any).from("funcionario_cliente_historico").insert({
        funcionario_id: funcionarioId, cliente_id: clienteAtualId, cliente_nome: clienteAtualNome,
        data_inicio: agora, data_fim: agora,
        justificativa: "Registro inicial (anterior à transferência)",
        autorizado_por_email: opts.autorizadoPorEmail, alterado_por: quemSou,
      });
    }
    const { error: insErr } = await (supabase as any).from("funcionario_cliente_historico").insert({
      funcionario_id: funcionarioId, cliente_id: opts.novoId, cliente_nome: opts.novoNome,
      data_inicio: agora, data_fim: null, detalhes: opts.detalhes ?? {},
      justificativa: opts.just, autorizado_por_email: opts.autorizadoPorEmail, alterado_por: quemSou,
    });
    if (insErr) throw insErr;

    await updateFuncionario(funcionarioId, { clienteId: opts.novoId });
  };

  const validarBase = () => {
    if (!novoClienteId) { toast.error("Selecione o novo Cliente/Unidade."); return false; }
    if (novoClienteId === clienteAtualId) { toast.error("Selecione um Cliente/Unidade diferente do atual."); return false; }
    if (!dataVigencia) { toast.error("Informe a data de início da vigência do remanejamento."); return false; }
    if (justificativa.trim().length < 5) { toast.error("Informe a justificativa (mín. 5 caracteres)."); return false; }
    return true;
  };

  const enviarSolicitacaoPendente = async () => {
    if (!validarBase()) return;
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from("funcionario_transferencia_solicitacoes").insert({
        funcionario_id: funcionarioId, funcionario_nome: funcionarioNome,
        cliente_atual_id: clienteAtualId || null, cliente_atual_nome: clienteAtualNome,
        novo_cliente_id: novoClienteId, novo_cliente_nome: novoClienteNome,
        justificativa: justificativa.trim(), status: "pendente",
        solicitado_por: quemSou, detalhes,
      });
      if (error) {
        console.error("Erro insert solicitação:", error);
        toast.error("Erro ao registrar solicitação: " + (error.message || ""));
        return;
      }
      try {
        const rh = await getWhatsappRH();
        if (rh) {
          const msg = `🔄 *Solicitação de Remanejamento*\n\n` +
            `*Colaborador a ser remanejado:* ${funcionarioNome}${cargoNome ? " - " + cargoNome : ""}${modalidadeOrigem ? " - " + modalidadeOrigem : ""}\n` +
            (coberturaNome ? `*Colaborador cobertura:* ${coberturaNome}${coberturaCargo ? " - " + coberturaCargo : ""}${coberturaJornada ? " (" + coberturaJornada + ")" : ""}\n` : "") +
            `\n*Contrato de Origem:* ${clienteAtualNome}\n` +
            `*Função:* ${funcaoOrigem || "—"}\n*Modalidade:* ${modalidadeOrigem || "—"}\n` +
            `\n*Contrato de Destino:* ${novoClienteNome}\n` +
            `*Função:* ${funcaoDestino || "—"}\n*Modalidade:* ${modalidadeDestino || "—"}\n` +
            `\n*Início da vigência:* ${fmtDataExtenso(dataVigencia)}\n` +
            `*Solicitante:* ${quemSou}\n` +
            `*Justificativa:* ${justificativa.trim()}\n\n` +
            `Aguardando autorização do RH no sistema.`;
          await enviarWhatsApp(rh, msg);
        }
      } catch (e) { console.error("WA RH falhou", e); }

      toast.success("Solicitação enviada ao RH para autorização.");
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirm = async () => {
    if (!validarBase()) return;
    if (!podeAutorizar) { await enviarSolicitacaoPendente(); return; }

    setSalvando(true);
    try {
      if (!email.trim() || !senha) { toast.error("Informe e-mail e senha do supervisor."); return; }
      const ok = await verificarSenhaUsuario(email, senha);
      if (!ok) { toast.error("Credenciais de supervisor inválidas."); return; }
      await executarTransferencia({
        novoId: novoClienteId, novoNome: novoClienteNome, just: justificativa.trim(),
        autorizadoPorEmail: email.trim().toLowerCase(), detalhes,
      });
      toast.success("Cliente/Unidade transferido com sucesso.");
      onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  const aprovarPendente = async (p: PendenteRow) => {
    if (!email.trim() || !senha) { toast.error("Informe e-mail e senha do supervisor para aprovar."); return; }
    setSalvando(true);
    try {
      const ok = await verificarSenhaUsuario(email, senha);
      if (!ok) { toast.error("Credenciais de supervisor inválidas."); return; }
      await executarTransferencia({
        novoId: p.novo_cliente_id, novoNome: p.novo_cliente_nome || "",
        just: p.justificativa || "", autorizadoPorEmail: email.trim().toLowerCase(),
        detalhes: (p as any).detalhes ?? {},
      });
      await (supabase as any).from("funcionario_transferencia_solicitacoes").update({
        status: "aprovada", decidido_por: quemSou, decidido_em: new Date().toISOString(),
      }).eq("id", p.id);
      toast.success("Transferência aprovada e aplicada.");
      onOpenChange(false);
    } finally { setSalvando(false); }
  };

  const rejeitarPendente = async (p: PendenteRow) => {
    if (!email.trim() || !senha) { toast.error("Informe e-mail e senha do supervisor para rejeitar."); return; }
    setSalvando(true);
    try {
      const ok = await verificarSenhaUsuario(email, senha);
      if (!ok) { toast.error("Credenciais de supervisor inválidas."); return; }
      await (supabase as any).from("funcionario_transferencia_solicitacoes").update({
        status: "rejeitada", decidido_por: quemSou, decidido_em: new Date().toISOString(),
      }).eq("id", p.id);
      toast.success("Solicitação rejeitada.");
      loadHistorico();
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {podeAutorizar ? "Transferir Cliente/Unidade" : "Solicitar Transferência de Cliente/Unidade"}
          </DialogTitle>
          <DialogDescription>
            {funcionarioNome} — atualmente em <strong>{clienteAtualNome}</strong>.
            {podeAutorizar
              ? " Esta ação exige autorização de supervisor."
              : " Sua solicitação ficará pendente e o RH será notificado por WhatsApp."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Colaborador a ser remanejado</div>
            <div className="font-medium">
              {funcionarioNome}{cargoNome ? ` — ${cargoNome}` : ""}{modalidadeOrigem ? ` — ${modalidadeOrigem}` : ""}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Colaborador cobertura</Label>
            <Popover open={coberturaOpen} onOpenChange={setCoberturaOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal mt-1.5">
                  <span className={cn("truncate", !coberturaId && "text-muted-foreground")}>
                    {coberturaId ? `${coberturaNome}${coberturaCargo ? " — " + coberturaCargo : ""}` : "Selecione o colaborador que fará a cobertura"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(v, search) => {
                    const terms = norm(search).split(/\s+/).filter(Boolean);
                    const target = norm(v);
                    return terms.every((t) => target.includes(t)) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="Buscar funcionário..." />
                  <CommandList className="max-h-64">
                    <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                    {coberturaId && (
                      <CommandGroup>
                        <CommandItem value="__limpar__" onSelect={() => { setCoberturaId(""); setCoberturaOpen(false); }}>
                          Limpar seleção
                        </CommandItem>
                      </CommandGroup>
                    )}
                    <CommandGroup>
                      {funcionarios
                        .filter((f) => f.id !== funcionarioId && f.status === "Ativo")
                        .map((f) => {
                          const cg = cargos.find((c) => c.id === f.cargoId)?.nome ?? "";
                          const cl = clientes.find((c) => c.id === f.clienteId)?.nome ?? "";
                          return (
                            <CommandItem
                              key={f.id}
                              value={`${f.nome} ${cg} ${cl} ${f.jornadaTrabalho ?? ""}`}
                              onSelect={() => { setCoberturaId(f.id); setCoberturaOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", coberturaId === f.id ? "opacity-100" : "opacity-0")} />
                              <div className="min-w-0">
                                <div className="truncate text-sm">{f.nome}</div>
                                <div className="truncate text-[11px] text-muted-foreground">
                                  {[cg, cl, f.jornadaTrabalho].filter(Boolean).join(" • ")}
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {coberturaId && (
              <div className="mt-2 rounded-md border bg-muted/30 p-2 text-xs space-y-0.5">
                <div><strong>Função:</strong> {coberturaCargo || "—"}</div>
                <div><strong>Contrato atual:</strong> {coberturaCliente || "—"}</div>
                <div><strong>Modalidade:</strong> {coberturaJornada || "—"}</div>
              </div>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {/* ORIGEM */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato de origem</div>
              <div className="text-sm font-medium">{clienteAtualNome}</div>
              <div>
                <Label className="text-xs">Função</Label>
                <Input value={funcaoOrigem} onChange={(e) => setFuncaoOrigem(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Modalidade</Label>
                <Select value={modalidadeOrigem} onValueChange={setModalidadeOrigem}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{MODALIDADES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* DESTINO */}
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato de destino *</div>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">{novoClienteId ? novoClienteNome : "Selecione..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar cliente..." />
                    <CommandList>
                      <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clientesAtivos.map((c) => (
                          <CommandItem key={c.id} value={c.nome} onSelect={() => { setNovoClienteId(c.id); setComboOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", novoClienteId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div>
                <Label className="text-xs">Função</Label>
                <Input value={funcaoDestino} onChange={(e) => setFuncaoDestino(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Modalidade</Label>
                <Select value={modalidadeDestino} onValueChange={setModalidadeDestino}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{MODALIDADES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 items-end">
            <div>
              <Label className="text-xs font-semibold">Início da vigência do remanejamento definitivo *</Label>
              <Input type="date" value={dataVigencia} onChange={(e) => setDataVigencia(e.target.value)} className="mt-1.5" />
            </div>
            <div className="text-sm text-muted-foreground pb-2 capitalize">{dataVigencia ? fmtDataExtenso(dataVigencia) : ""}</div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Justificativa *</Label>
            <Textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Motivo da transferência..." className="mt-1.5" />
          </div>


          {podeAutorizar && (
            <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-amber-50 dark:bg-amber-900/10">
              <div className="col-span-2 text-xs font-semibold text-amber-700 dark:text-amber-400">🛡️ Autorização do supervisor</div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="supervisor@empresa.com" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Senha</Label>
                <Input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}

          {!podeAutorizar && (
            <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-800 dark:text-blue-300">
              ℹ️ Você não possui permissão para autorizar transferências. Sua solicitação será encaminhada ao RH e ficará pendente até aprovação.
            </div>
          )}

          {pendentes.length > 0 && (
            <div className="border rounded-lg">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-amber-50 dark:bg-amber-900/10 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Clock className="h-4 w-4" />
                Solicitações pendentes ({pendentes.length})
              </div>
              <div className="divide-y">
                {pendentes.map((p) => {
                  const horas = (Date.now() - new Date(p.solicitado_em).getTime()) / 3600000;
                  const atrasada = horas > 12;
                  return (
                  <div key={p.id} className="p-3 text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div><strong>Para:</strong> {p.novo_cliente_nome}</div>
                        <div><strong>Solicitante:</strong> {p.solicitado_por} • {fmt(p.solicitado_em)}</div>
                        {p.justificativa && <div className="text-muted-foreground">"{p.justificativa}"</div>}
                        {(() => {
                          const d = ((p as any).detalhes ?? {}) as any;
                          if (!d || Object.keys(d).length === 0) return null;
                          return (
                            <div className="mt-1 rounded-md border bg-muted/30 p-2 space-y-0.5">
                              {d.colaborador_cobertura && (
                                <div><strong>Cobertura:</strong> {d.colaborador_cobertura}
                                  {d.cobertura_funcao ? ` — ${d.cobertura_funcao}` : ""}
                                  {d.cobertura_contrato ? ` — ${d.cobertura_contrato}` : ""}
                                  {d.cobertura_modalidade ? ` — ${d.cobertura_modalidade}` : ""}
                                </div>
                              )}
                              <div><strong>Origem:</strong> {d.contrato_origem || "—"}{d.funcao_origem ? ` — ${d.funcao_origem}` : ""}{d.modalidade_origem ? ` — ${d.modalidade_origem}` : ""}</div>
                              <div><strong>Destino:</strong> {d.contrato_destino || "—"}{d.funcao_destino ? ` — ${d.funcao_destino}` : ""}{d.modalidade_destino ? ` — ${d.modalidade_destino}` : ""}</div>
                              {d.data_vigencia && <div className="capitalize"><strong>Vigência:</strong> {fmtDataExtenso(d.data_vigencia)}</div>}
                            </div>
                          );
                        })()}
                      </div>
                      <Badge variant="outline" className={cn("border-amber-400 text-amber-700 flex items-center gap-1", atrasada && "animate-pulse border-red-500 text-red-700 bg-red-50")}>
                        {atrasada && <FileClock className="h-3 w-3" />}
                        Pendente{atrasada && " > 12h"}
                      </Badge>
                    </div>
                    {podeAutorizar && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-300" onClick={() => aprovarPendente(p)} disabled={salvando}>
                          <ThumbsUp className="h-3 w-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => rejeitarPendente(p)} disabled={salvando}>
                          <ThumbsDown className="h-3 w-3 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 text-xs font-semibold">
              <History className="h-4 w-4" />
              Histórico de Cliente/Unidade ({historico.length})
            </div>
            <div className="max-h-56 overflow-auto">
              {historico.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">Nenhuma transferência registrada.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Cliente/Unidade</th>
                      <th className="px-3 py-2 font-medium">Início</th>
                      <th className="px-3 py-2 font-medium">Fim</th>
                      <th className="px-3 py-2 font-medium">Autorizado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h) => (
                      <tr key={h.id} className="border-t">
                        <td className="px-3 py-2">{h.cliente_nome || "—"}</td>
                        <td className="px-3 py-2">{fmt(h.data_inicio)}</td>
                        <td className="px-3 py-2">{h.data_fim ? fmt(h.data_fim) : <span className="text-emerald-600 font-medium">Em vigor</span>}</td>
                        <td className="px-3 py-2">{h.autorizado_por_email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          {podeAutorizar && (
            <Button variant="outline" onClick={enviarSolicitacaoPendente} disabled={salvando}>
              Enviar ao RH (pendente)
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={salvando}>
            {salvando ? "Processando..." : (podeAutorizar ? "Confirmar transferência" : "Enviar solicitação ao RH")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
