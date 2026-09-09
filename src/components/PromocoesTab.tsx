import React, { useState, useEffect } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, AlertTriangle, TrendingUp, CheckCircle2, XCircle, ShieldCheck, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useCargos } from "@/contexts/CargosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useUsuarios } from "@/contexts/UsuariosContext";
import { usePerfisAcesso } from "@/contexts/PerfisAcessoContext";
import { usePermissao } from "@/hooks/usePermissao";

interface Promocao {
  id: string;
  funcionario_id: string;
  data_promocao: string;
  cargo_anterior_id: string;
  cargo_anterior_nome: string;
  cargo_novo_id: string;
  cargo_novo_nome: string;
  salario_anterior: string;
  salario_novo: string;
  cliente_anterior_id: string;
  cliente_anterior_nome: string;
  cliente_novo_id: string;
  cliente_novo_nome: string;
  motivo: string;
  observacoes: string;
  status: "pendente" | "aprovada" | "rejeitada";
  aprovador_id?: string | null;
  aprovador_nome?: string | null;
  aprovado_em?: string | null;
  created_at: string;
}

interface Props {
  funcionarioId: string;
  cargoAtualId: string;
  salarioAtual: string;
  clienteAtualId: string;
  onPromover: (dados: { cargoId: string; salario: string; clienteId: string }) => void;
}

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-foreground/80">{label}{required && " *"}</Label>
    {children}
  </div>
);

export function PromocoesTab({ funcionarioId, cargoAtualId, salarioAtual, clienteAtualId, onPromover }: Props) {
  const { cargos } = useCargos();
  const { clientes } = useClientes();
  const { usuarios } = useUsuarios();
  const { perfis } = usePerfisAcesso();
  const { tem, usuarioLogado } = usePermissao();
  const podeAprovar = tem("funcionarios.aprovar_promocoes");

  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const [form, setForm] = useState({
    data_promocao: new Date().toISOString().split("T")[0],
    cargo_novo_id: "",
    salario_novo: "",
    cliente_novo_id: "",
    motivo: "",
    observacoes: "",
  });

  // Approval dialog state
  const [aprovacao, setAprovacao] = useState<{ promocao: Promocao | null; senha: string; acao: "aprovar" | "rejeitar" }>({
    promocao: null, senha: "", acao: "aprovar",
  });

  const cargoAtual = cargos.find((c) => c.id === cargoAtualId);
  const clienteAtual = clientes.find((c) => c.id === clienteAtualId);

  const fetchPromocoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promocoes")
      .select("*")
      .eq("funcionario_id", funcionarioId)
      .order("data_promocao", { ascending: false });

    if (error) {
      console.error("Erro ao buscar promoções:", error);
      toast.error("Erro ao carregar histórico de promoções.");
    } else {
      setPromocoes((data as unknown as Promocao[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (funcionarioId) fetchPromocoes();
  }, [funcionarioId]);

  // Auto-fill salary when cargo changes
  useEffect(() => {
    if (form.cargo_novo_id) {
      const cargo = cargos.find((c) => c.id === form.cargo_novo_id);
      if (cargo?.salario) {
        setForm((prev) => ({ ...prev, salario_novo: cargo.salario }));
      }
    }
  }, [form.cargo_novo_id, cargos]);

  const handleSolicitar = async () => {
    if (!form.cargo_novo_id || !form.data_promocao) {
      toast.error("Informe o novo cargo e a data da promoção.");
      return;
    }

    const cargoNovo = cargos.find((c) => c.id === form.cargo_novo_id);
    const clienteNovo = form.cliente_novo_id ? clientes.find((c) => c.id === form.cliente_novo_id) : null;

    const { error } = await supabase.from("promocoes").insert({
      funcionario_id: funcionarioId,
      data_promocao: form.data_promocao,
      cargo_anterior_id: cargoAtualId,
      cargo_anterior_nome: cargoAtual?.nome || "",
      cargo_novo_id: form.cargo_novo_id,
      cargo_novo_nome: cargoNovo?.nome || "",
      salario_anterior: salarioAtual,
      salario_novo: form.salario_novo,
      cliente_anterior_id: clienteAtualId,
      cliente_anterior_nome: clienteAtual?.nome || "",
      cliente_novo_id: form.cliente_novo_id || clienteAtualId,
      cliente_novo_nome: clienteNovo?.nome || clienteAtual?.nome || "",
      motivo: form.motivo,
      observacoes: form.observacoes,
      status: "pendente",
    } as any);

    if (error) {
      console.error("Erro ao solicitar promoção:", error);
      toast.error("Erro ao solicitar promoção.");
      return;
    }

    toast.success("Solicitação de promoção registrada. Aguardando aprovação por usuário com privilégio.");
    setForm({
      data_promocao: new Date().toISOString().split("T")[0],
      cargo_novo_id: "",
      salario_novo: "",
      cliente_novo_id: "",
      motivo: "",
      observacoes: "",
    });
    fetchPromocoes();
  };

  const confirmarAprovacao = async () => {
    const { promocao, senha, acao } = aprovacao;
    if (!promocao) return;
    if (!senha) { toast.error("Informe sua senha."); return; }
    if (!usuarioLogado) { toast.error("Sessão inválida."); return; }

    // Valida senha via edge function (a senha não fica mais no client)
    const { verificarSenhaUsuario } = await import("@/lib/verifySenha");
    const senhaOk = await verificarSenhaUsuario(usuarioLogado.email, senha);
    const u = usuarios.find((x) => x.id === usuarioLogado.id);
    if (!u || !senhaOk) {
      toast.error("Senha incorreta.");
      return;
    }
    // Re-check privilege using current user's perfil
    const perfil = perfis.find((p) => p.id === u.perfilAcessoId);
    const autorizado = podeAprovar || !!perfil?.permissoes?.["funcionarios.aprovar_promocoes"];
    if (!autorizado) {
      toast.error("Seu perfil não possui privilégio para aprovar promoções.");
      return;
    }

    const novoStatus = acao === "aprovar" ? "aprovada" : "rejeitada";
    const { error } = await supabase.from("promocoes").update({
      status: novoStatus,
      aprovador_id: u.id,
      aprovador_nome: u.nome,
      aprovado_em: new Date().toISOString(),
    } as any).eq("id", promocao.id);

    if (error) {
      console.error(error);
      toast.error("Erro ao registrar decisão.");
      return;
    }

    if (acao === "aprovar") {
      // Apply changes to employee record
      onPromover({
        cargoId: promocao.cargo_novo_id,
        salario: promocao.salario_novo || promocao.salario_anterior,
        clienteId: promocao.cliente_novo_id || promocao.cliente_anterior_id,
      });
      toast.success("Promoção aprovada e aplicada ao funcionário.");
    } else {
      toast.success("Promoção rejeitada.");
    }

    setAprovacao({ promocao: null, senha: "", acao: "aprovar" });
    fetchPromocoes();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("promocoes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover registro.");
    } else {
      toast.success("Registro removido.");
      fetchPromocoes();
    }
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  if (!funcionarioId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
        <p className="text-sm">Salve o funcionário primeiro para gerenciar promoções.</p>
      </div>
    );
  }

  const statusBadge = (s: Promocao["status"]) => {
    if (s === "aprovada") return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Aprovada</Badge>;
    if (s === "rejeitada") return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">Rejeitada</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Current info */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Situação Atual</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span><strong>Cargo:</strong> {cargoAtual?.nome || "—"}</span>
          <span><strong>Salário:</strong> {salarioAtual ? `R$ ${salarioAtual}` : "—"}</span>
          <span><strong>Cliente:</strong> {clienteAtual?.nome || "—"}</span>
        </div>
      </div>

      {/* Promotion form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Data da Promoção" required>
          <Input type="date" value={form.data_promocao} onChange={(e) => setForm({ ...form, data_promocao: e.target.value })} />
        </Field>
        <Field label="Novo Cargo" required>
          <Select value={form.cargo_novo_id} onValueChange={(v) => setForm({ ...form, cargo_novo_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione o novo cargo..." /></SelectTrigger>
            <SelectContent>
              {cargos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} {c.id === cargoAtualId ? "(atual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Novo Salário">
          <Input value={form.salario_novo} onChange={(e) => setForm({ ...form, salario_novo: e.target.value })} placeholder="R$ 0,00" />
        </Field>
        <Field label="Novo Cliente/Local">
          <Select value={form.cliente_novo_id} onValueChange={(v) => setForm({ ...form, cliente_novo_id: v })}>
            <SelectTrigger><SelectValue placeholder="Manter atual..." /></SelectTrigger>
            <SelectContent>
              {clientes
                .filter((c: any) => (c.tipo || "Cliente") === "Cliente")
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} {c.id === clienteAtualId ? "(atual)" : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Motivo">
          <Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex: Mérito, tempo de serviço..." />
        </Field>
        <Field label="Observações">
          <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações adicionais" />
        </Field>
      </div>
      <Button type="button" onClick={handleSolicitar} className="shadow-md">
        <TrendingUp className="h-4 w-4 mr-1" /> Solicitar Promoção
      </Button>
      <p className="text-xs text-muted-foreground -mt-3">
        A promoção será aplicada ao funcionário somente após aprovação por usuário com privilégio (validação por senha).
      </p>

      {/* History table */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">Histórico de Promoções</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : promocoes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma promoção registrada.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cargo Anterior</TableHead>
                  <TableHead>Novo Cargo</TableHead>
                  <TableHead>Sal. Anterior</TableHead>
                  <TableHead>Novo Salário</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aprovador</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promocoes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.data_promocao.split("-").reverse().join("/")}</TableCell>
                    <TableCell>{p.cargo_anterior_nome || "—"}</TableCell>
                    <TableCell className="font-medium">{p.cargo_novo_nome}</TableCell>
                    <TableCell>{p.salario_anterior ? `R$ ${p.salario_anterior}` : "—"}</TableCell>
                    <TableCell className="font-medium">{p.salario_novo ? `R$ ${p.salario_novo}` : "—"}</TableCell>
                    <TableCell>
                      {p.motivo ? (
                        <span className="block max-w-[220px] truncate" title={p.motivo}>
                          {p.motivo}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-xs">
                      {p.aprovador_nome ? (
                        <>
                          {p.aprovador_nome}
                          {p.aprovado_em && <div className="text-muted-foreground">{new Date(p.aprovado_em).toLocaleString("pt-BR")}</div>}
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" type="button" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {p.status === "pendente" && podeAprovar && (
                            <>
                              <DropdownMenuItem onClick={() => setAprovacao({ promocao: p, senha: "", acao: "aprovar" })}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAprovacao({ promocao: p, senha: "", acao: "rejeitar" })}>
                                <XCircle className="h-4 w-4 mr-2 text-rose-600" /> Rejeitar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onClick={() => requestDelete(p.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Approval dialog */}
      <Dialog open={!!aprovacao.promocao} onOpenChange={(o) => !o && setAprovacao({ promocao: null, senha: "", acao: "aprovar" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {aprovacao.acao === "aprovar" ? "Aprovar Promoção" : "Rejeitar Promoção"}
            </DialogTitle>
            <DialogDescription>
              Confirme sua identidade digitando sua senha. Apenas usuários com privilégio podem {aprovacao.acao === "aprovar" ? "aprovar" : "rejeitar"} promoções.
            </DialogDescription>
          </DialogHeader>
          {aprovacao.promocao && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-2">
              <div><strong>Novo cargo:</strong> {aprovacao.promocao.cargo_novo_nome}</div>
              <div><strong>Novo salário:</strong> {aprovacao.promocao.salario_novo ? `R$ ${aprovacao.promocao.salario_novo}` : "—"}</div>
              <div><strong>Data:</strong> {aprovacao.promocao.data_promocao.split("-").reverse().join("/")}</div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-semibold text-foreground/80 mb-1">Justificativa do solicitante</p>
                {aprovacao.promocao.motivo ? (
                  <p className="text-sm whitespace-pre-wrap">{aprovacao.promocao.motivo}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma justificativa informada.</p>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Sua senha *</Label>
            <Input type="password" value={aprovacao.senha} autoFocus
              onChange={(e) => setAprovacao((p) => ({ ...p, senha: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") confirmarAprovacao(); }}
              placeholder="Digite sua senha" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAprovacao({ promocao: null, senha: "", acao: "aprovar" })}>Cancelar</Button>
            <Button type="button" onClick={confirmarAprovacao}
              className={aprovacao.acao === "aprovar" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}>
              {aprovacao.acao === "aprovar" ? "Aprovar" : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
}
