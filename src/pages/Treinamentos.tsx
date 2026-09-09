import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GraduationCap, Plus, MoreHorizontal, Loader2, Check, ChevronsUpDown, CheckCircle2, Clock, PlayCircle, FileSpreadsheet, FileDown, Award, ShieldCheck, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { exportarTreinamentosCsv, exportarTreinamentosPdf, type TreinamentoExportRow } from "@/lib/exportTreinamentos";
import { imprimirCertificadoTreinamento, baixarCertificadoTreinamento } from "@/lib/gerarPdfCertificadoTreinamento";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCargos } from "@/contexts/CargosContext";
import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { Checkbox } from "@/components/ui/checkbox";

interface Treinamento {
  id: string;
  cpf: string;
  tipo: string;
  titulo: string;
  status: string;
  nota: number | null;
  concluido_em: string | null;
  created_at: string;
  assinado_em: string | null;
  assinatura_hash: string | null;
  assinatura_ip: string | null;
  resp_assinado_em: string | null;
  resp_assinante_nome: string | null;
  resp_assinante_cargo: string | null;
  resp_assinatura_hash: string | null;
}

const TIPOS = [
  { v: "integracao", l: "Integração" },
  { v: "seguranca", l: "Segurança do Trabalho" },
  { v: "tecnico", l: "Técnico" },
  { v: "reciclagem", l: "Reciclagem" },
  { v: "outros", l: "Outros" },
];

const STATUS = [
  { v: "pendente", l: "Pendente" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "concluido", l: "Concluído" },
];

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const statusBadge = (s: string) => {
  if (s === "concluido") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" />Concluído</Badge>;
  if (s === "em_andamento") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><PlayCircle className="w-3 h-3 mr-1" />Em andamento</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
};

interface FormState {
  id?: string;
  cpf: string;
  tipo: string;
  titulo: string;
  status: string;
  nota: string;
  concluido_em: string;
}

const emptyForm: FormState = { cpf: "", tipo: "integracao", titulo: "", status: "pendente", nota: "", concluido_em: "" };

export default function Treinamentos() {
  const { funcionarios } = useFuncionarios();
  const { empresa } = useEmpresa();
  const [list, setList] = useState<Treinamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [comboOpen, setComboOpen] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const { usuarioLogado } = useAuth();
  const { cargos } = useCargos();
  const [assinarAlvo, setAssinarAlvo] = useState<Treinamento | null>(null);
  const [senhaAssinatura, setSenhaAssinatura] = useState("");
  const [aceiteAssinatura, setAceiteAssinatura] = useState(false);
  const [assinando, setAssinando] = useState(false);

  const nomePorCpf = useMemo(() => {
    const m = new Map<string, string>();
    funcionarios.forEach((f) => m.set(onlyDigits(f.cpf), f.nome));
    return m;
  }, [funcionarios]);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portal_treinamentos")
      .select("id, cpf, tipo, titulo, status, nota, concluido_em, created_at, assinado_em, assinatura_hash, assinatura_ip, resp_assinado_em, resp_assinante_nome, resp_assinante_cargo, resp_assinatura_hash")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data as Treinamento[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return list.filter((t) => {
      const nome = nomePorCpf.get(onlyDigits(t.cpf)) ?? "";
      const okBusca = !q || t.titulo.toLowerCase().includes(q) || nome.toLowerCase().includes(q) || onlyDigits(t.cpf).includes(onlyDigits(q));
      const okStatus = filtroStatus === "todos" || t.status === filtroStatus;
      const okTipo = filtroTipo === "todos" || t.tipo === filtroTipo;
      return okBusca && okStatus && okTipo;
    });
  }, [list, busca, filtroStatus, filtroTipo, nomePorCpf]);

  const kpis = useMemo(() => ({
    total: list.length,
    pendentes: list.filter((t) => t.status === "pendente").length,
    andamento: list.filter((t) => t.status === "em_andamento").length,
    concluidos: list.filter((t) => t.status === "concluido").length,
  }), [list]);

  const abrirNovo = () => { setForm(emptyForm); setOpen(true); };
  const abrirEdicao = (t: Treinamento) => {
    setForm({
      id: t.id,
      cpf: t.cpf,
      tipo: t.tipo,
      titulo: t.titulo,
      status: t.status,
      nota: t.nota != null ? String(t.nota) : "",
      concluido_em: t.concluido_em ? t.concluido_em.slice(0, 10) : "",
    });
    setOpen(true);
  };

  const salvar = async () => {
    if (!onlyDigits(form.cpf)) return toast.error("Selecione o funcionário.");
    if (!form.titulo.trim()) return toast.error("Informe o título do treinamento.");
    setSaving(true);
    const payload = {
      cpf: onlyDigits(form.cpf),
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      status: form.status,
      nota: form.nota ? Number(form.nota.replace(",", ".")) : null,
      concluido_em: form.status === "concluido"
        ? (form.concluido_em ? new Date(`${form.concluido_em}T12:00:00`).toISOString() : new Date().toISOString())
        : null,
    };
    const { error } = form.id
      ? await supabase.from("portal_treinamentos").update(payload).eq("id", form.id)
      : await supabase.from("portal_treinamentos").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Treinamento atualizado." : "Treinamento cadastrado.");
    setOpen(false);
    carregar();
  };

  const excluir = async (id: string) => {
    const { error } = await supabase.from("portal_treinamentos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Treinamento excluído.");
    carregar();
  };

  const marcarConcluido = async (t: Treinamento) => {
    const { error } = await supabase
      .from("portal_treinamentos")
      .update({ status: "concluido", concluido_em: new Date().toISOString() })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Treinamento concluído.");
    carregar();
  };

  const dadosCertificado = (t: Treinamento) => ({
    funcionario: nomePorCpf.get(onlyDigits(t.cpf)) ?? "—",
    cpf: t.cpf,
    titulo: t.titulo,
    tipo: TIPOS.find((x) => x.v === t.tipo)?.l ?? t.tipo,
    nota: t.nota != null ? String(t.nota) : null,
    concluidoEm: t.concluido_em,
    codigo: t.id.slice(0, 8).toUpperCase(),
    assinadoEm: t.assinado_em,
    assinaturaHash: t.assinatura_hash,
    assinaturaIp: t.assinatura_ip,
    respAssinadoEm: t.resp_assinado_em,
    respAssinanteNome: t.resp_assinante_nome,
    respAssinanteCargo: t.resp_assinante_cargo,
    respAssinaturaHash: t.resp_assinatura_hash,
  });

  const empresaCertificado = () => ({
    razaoSocial: empresa?.razaoSocial,
    nomeFantasia: empresa?.nomeFantasia,
    cnpj: empresa?.cnpj,
    cidade: empresa?.cidade,
    uf: empresa?.uf,
    logoUrl: empresa?.logoUrl,
  });

  const certificado = async (t: Treinamento, modo: "imprimir" | "baixar") => {
    if (t.status !== "concluido") return toast.error("Só é possível emitir certificado de treinamento concluído.");
    try {
      const fn = modo === "imprimir" ? imprimirCertificadoTreinamento : baixarCertificadoTreinamento;
      await fn(dadosCertificado(t), empresaCertificado());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar certificado.");
    }
  };

  const assinarCertificado = async () => {
    const t = assinarAlvo;
    if (!t) return;
    if (!usuarioLogado?.email) return toast.error("Usuário não autenticado.");
    if (!aceiteAssinatura) return toast.error("Marque o aceite para assinar eletronicamente.");
    if (senhaAssinatura.length < 4) return toast.error("Informe sua senha.");
    setAssinando(true);
    try {
      const ok = await verificarSenhaUsuario(usuarioLogado.email, senhaAssinatura);
      if (!ok) { toast.error("Senha incorreta."); return; }
      const assinadoEm = new Date().toISOString();
      const cargoNome = cargos.find((c) => c.id === usuarioLogado.cargoId)?.nome ?? "";
      const base = `${t.id}|${t.titulo}|${t.cpf}|${t.concluido_em ?? ""}|${usuarioLogado.id}|${usuarioLogado.email}|${assinadoEm}`;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
      const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      const { error } = await supabase.from("portal_treinamentos").update({
        resp_assinado_em: assinadoEm,
        resp_assinante_nome: usuarioLogado.nome,
        resp_assinante_cargo: cargoNome,
        resp_assinatura_hash: hash,
      }).eq("id", t.id);
      if (error) return toast.error(error.message);
      toast.success("Certificado assinado eletronicamente.");
      setAssinarAlvo(null);
      setSenhaAssinatura("");
      setAceiteAssinatura(false);
      carregar();
    } finally {
      setAssinando(false);
    }
  };

  const funcionarioSelecionado = funcionarios.find((f) => onlyDigits(f.cpf) === onlyDigits(form.cpf));

  const linhasExport = (): TreinamentoExportRow[] =>
    filtrados.map((t) => ({
      funcionario: nomePorCpf.get(onlyDigits(t.cpf)) ?? "—",
      cpf: t.cpf,
      titulo: t.titulo,
      tipo: TIPOS.find((x) => x.v === t.tipo)?.l ?? t.tipo,
      status: STATUS.find((x) => x.v === t.status)?.l ?? t.status,
      nota: t.nota != null ? String(t.nota) : "—",
      conclusao: fmt(t.concluido_em),
    }));

  const contextoExport = () =>
    [
      `Registros: ${filtrados.length}`,
      filtroStatus !== "todos" ? `Status: ${STATUS.find((s) => s.v === filtroStatus)?.l}` : null,
      filtroTipo !== "todos" ? `Tipo: ${TIPOS.find((s) => s.v === filtroTipo)?.l}` : null,
      busca.trim() ? `Busca: ${busca.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

  const exportar = (fn: (r: TreinamentoExportRow[], c?: string) => void, label: string) => {
    const rows = linhasExport();
    if (rows.length === 0) return toast.error("Nenhum treinamento para exportar.");
    fn(rows, contextoExport());
    toast.success(`${label} gerado com sucesso.`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <GraduationCap className="w-6 h-6" /> Treinamentos
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie os treinamentos exibidos no Portal do Funcionário.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => exportar(exportarTreinamentosCsv, "CSV")}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => exportar(exportarTreinamentosPdf, "PDF")}>
            <FileDown className="w-4 h-4 mr-2" />Exportar PDF
          </Button>
          <Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-2" />Novo treinamento</Button>
        </div>
      </div>


      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Total", v: kpis.total },
          { l: "Pendentes", v: kpis.pendentes },
          { l: "Em andamento", v: kpis.andamento },
          { l: "Concluídos", v: kpis.concluidos },
        ].map((k) => (
          <Card key={k.l}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-medium">{k.l}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{k.v}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Buscar por funcionário, CPF ou título..." value={busca} onChange={(e) => setBusca(e.target.value)} className="md:col-span-2" />
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {TIPOS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : filtrados.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum treinamento encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Conclusão</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{nomePorCpf.get(onlyDigits(t.cpf)) ?? "—"}</TableCell>
                    <TableCell>{t.cpf}</TableCell>
                    <TableCell>{t.titulo}</TableCell>
                    <TableCell>{TIPOS.find((x) => x.v === t.tipo)?.l ?? t.tipo}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {statusBadge(t.status)}
                        {t.resp_assinado_em && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            title={`Assinado por ${t.resp_assinante_nome ?? ""} em ${new Date(t.resp_assinado_em).toLocaleString("pt-BR")}${t.resp_assinatura_hash ? ` — SHA-256 ${t.resp_assinatura_hash}` : ""}`}
                          >
                            <FileSignature className="w-3 h-3 mr-1" />Assinado
                          </Badge>
                        )}
                        {t.assinado_em && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            title={`Validado em ${new Date(t.assinado_em).toLocaleString("pt-BR")}${t.assinatura_hash ? ` — SHA-256 ${t.assinatura_hash}` : ""}`}
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />Validado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{t.nota ?? "—"}</TableCell>
                    <TableCell>{fmt(t.concluido_em)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirEdicao(t)}>Editar</DropdownMenuItem>
                          {t.status !== "concluido" && (
                            <DropdownMenuItem onClick={() => marcarConcluido(t)}>Marcar como concluído</DropdownMenuItem>
                          )}
                          {t.status === "concluido" && !t.resp_assinado_em && (
                            <DropdownMenuItem onClick={() => setAssinarAlvo(t)}>
                              <FileSignature className="w-4 h-4 mr-2" />Assinar certificado
                            </DropdownMenuItem>
                          )}
                          {t.status === "concluido" && (
                            <>
                              <DropdownMenuItem onClick={() => certificado(t, "imprimir")}>
                                <Award className="w-4 h-4 mr-2" />Imprimir certificado
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => certificado(t, "baixar")}>
                                <FileDown className="w-4 h-4 mr-2" />Baixar certificado (PDF)
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => setExcluirId(t.id)}>
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DoubleConfirmDelete
        open={!!excluirId}
        onOpenChange={(v) => !v && setExcluirId(null)}
        onConfirm={() => { if (excluirId) excluir(excluirId); setExcluirId(null); }}
      />

      <Dialog open={!!assinarAlvo} onOpenChange={(v) => { if (!v) { setAssinarAlvo(null); setSenhaAssinatura(""); setAceiteAssinatura(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSignature className="w-4 h-4" /> Assinar certificado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {assinarAlvo?.titulo} — {nomePorCpf.get(onlyDigits(assinarAlvo?.cpf ?? "")) ?? ""}
            </p>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <Checkbox id="aceite-cert-rh" checked={aceiteAssinatura} onCheckedChange={(v) => setAceiteAssinatura(v === true)} />
              <Label htmlFor="aceite-cert-rh" className="text-sm font-normal leading-snug cursor-pointer">
                Declaro, como responsável pelo treinamento, a veracidade das informações e assino este certificado
                eletronicamente (MP 2.200-2/2001).
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha-cert-rh">Confirme sua senha</Label>
              <Input id="senha-cert-rh" type="password" value={senhaAssinatura} onChange={(e) => setSenhaAssinatura(e.target.value)} autoComplete="current-password" />
            </div>
            <p className="text-xs text-muted-foreground">Serão registrados nome, cargo, data/hora e um código de verificação SHA-256.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssinarAlvo(null)}>Cancelar</Button>
            <Button onClick={assinarCertificado} disabled={assinando || !aceiteAssinatura}>
              {assinando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Assinar eletronicamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? "Editar treinamento" : "Novo treinamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {funcionarioSelecionado ? `${funcionarioSelecionado.nome} — ${funcionarioSelecionado.cpf}` : "Selecione o funcionário"}
                    <ChevronsUpDown className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar funcionário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {funcionarios.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={`${f.nome} ${f.cpf}`}
                            onSelect={() => { setForm((p) => ({ ...p, cpf: onlyDigits(f.cpf) })); setComboOpen(false); }}
                          >
                            <Check className={`w-4 h-4 mr-2 ${onlyDigits(f.cpf) === onlyDigits(form.cpf) ? "opacity-100" : "opacity-0"}`} />
                            {f.nome} — {f.cpf}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Textarea rows={2} value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} placeholder="Ex.: NR-35 Trabalho em Altura" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nota</Label>
                <Input value={form.nota} onChange={(e) => setForm((p) => ({ ...p, nota: e.target.value }))} placeholder="0 a 100" />
              </div>
              <div className="space-y-2">
                <Label>Data de conclusão</Label>
                <Input type="date" value={form.concluido_em} disabled={form.status !== "concluido"} onChange={(e) => setForm((p) => ({ ...p, concluido_em: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
