import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Wrench, ListChecks, Activity, Calendar, ChevronDown, ChevronUp, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePlanosManutencao, type PlanoManutencao, type PlanoAtividade, type ChecklistItem } from "@/contexts/PlanosManutencaoContext";
import RelatorioPlanosManutencaoDialog from "@/components/RelatorioPlanosManutencaoDialog";
import { useClientes } from "@/contexts/ClientesContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { useResponsaveisTecnicos } from "@/contexts/ResponsaveisTecnicosContext";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { OrdensServicoProvider } from "@/contexts/OrdensServicoContext";
import { OrcamentosProvider } from "@/contexts/OrcamentosContext";
import { usePermissao } from "@/hooks/usePermissao";

const PERIODICIDADES = ["Diária", "Semanal", "Quinzenal", "Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"];
const PRIORIDADES = ["Baixa", "Média", "Alta", "Crítica"];
const TIPOS_ATIVIDADE = ["Preventiva", "Preditiva", "Inspeção", "Lubrificação", "Limpeza", "Calibração"];
const STATUS_PLANO = ["Ativo", "Suspenso", "Encerrado"];
const STATUS_ATIVIDADE = ["Pendente", "Em Dia", "Atrasada", "Concluída"];

function calcularProximaData(ultima: string, periodicidade: string): string {
  if (!ultima) return "";
  const data = new Date(ultima);
  if (isNaN(data.getTime())) return "";
  const dias: Record<string, number> = {
    "Diária": 1, "Semanal": 7, "Quinzenal": 15, "Mensal": 30,
    "Bimestral": 60, "Trimestral": 90, "Semestral": 180, "Anual": 365,
  };
  data.setDate(data.getDate() + (dias[periodicidade] || 30));
  return data.toISOString().slice(0, 10);
}

function PlanoManutencaoContent() {
  const { planos, atividades, execucoes, addPlano, updatePlano, deletePlano,
    addAtividade, updateAtividade, deleteAtividade, addExecucao } = usePlanosManutencao();
  const { clientes } = useClientes();
  const { equipamentos } = useEquipamentos();
  const { responsaveis } = useResponsaveisTecnicos();
  const { addOrdem } = useOrdensServico();
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("plano_manutencao.excluir");

  const clientesList = useMemo(() => clientes.filter(c => c.tipo === "Cliente"), [clientes]);
  const [search, setSearch] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<PlanoManutencao>>({
    titulo: "", cliente_id: "", cliente_nome: "", contrato: "",
    vigencia_inicio: "", vigencia_fim: "", responsavel_tecnico_id: "",
    responsavel_tecnico_nome: "", status: "Ativo", escopo: "", observacoes: "",
    equipamentos_cobertos: [], anexos: [],
  });

  const [detailPlano, setDetailPlano] = useState<PlanoManutencao | null>(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);

  const planosFiltrados = useMemo(() => {
    return planos.filter(p => {
      if (search && !p.titulo.toLowerCase().includes(search.toLowerCase()) &&
          !p.cliente_nome.toLowerCase().includes(search.toLowerCase()) &&
          !p.contrato.toLowerCase().includes(search.toLowerCase())) return false;
      if (filtroCliente !== "todos" && p.cliente_id !== filtroCliente) return false;
      if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
      return true;
    });
  }, [planos, search, filtroCliente, filtroStatus]);

  const { paginated } = paginate(planosFiltrados, page, pageSize);

  const resetForm = () => {
    setForm({
      titulo: "", cliente_id: "", cliente_nome: "", contrato: "",
      vigencia_inicio: "", vigencia_fim: "", responsavel_tecnico_id: "",
      responsavel_tecnico_nome: "", status: "Ativo", escopo: "", observacoes: "",
      equipamentos_cobertos: [], anexos: [],
    });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.titulo || !form.cliente_id) {
      toast.error("Preencha título e cliente.");
      return;
    }
    if (editingId) {
      await updatePlano(editingId, form);
    } else {
      await addPlano(form);
    }
    resetForm();
  };

  const handleEdit = (p: PlanoManutencao) => {
    setForm(p);
    setEditingId(p.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (!podeExcluir) {
      toast.error("Você não possui permissão para excluir planos de manutenção.");
      cancelDelete();
      return;
    }
    if (deleteId) {
      await deletePlano(deleteId);
      cancelDelete();
    }
  };

  const handleClienteChange = (id: string) => {
    const c = clientesList.find(cl => cl.id === id);
    setForm(prev => ({ ...prev, cliente_id: id, cliente_nome: c?.nome || "" }));
  };

  const handleResponsavelChange = (id: string) => {
    const r = responsaveis.find(rt => rt.id === id);
    setForm(prev => ({
      ...prev,
      responsavel_tecnico_id: id,
      responsavel_tecnico_nome: r?.nome || "",
    }));
  };

  const conformidadePlano = (planoId: string): number => {
    const ats = atividades.filter(a => a.plano_id === planoId);
    if (ats.length === 0) return 0;
    const exec = ats.filter(a => a.ultima_execucao).length;
    return Math.round((exec / ats.length) * 100);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Wrench className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Plano de Manutenção Preventiva</h1>
        </div>
        <Button variant="outline" onClick={() => setRelatorioOpen(true)} className="gap-2">
          <FileBarChart className="h-4 w-4" /> Relatórios
        </Button>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader className="cursor-pointer flex flex-row items-center justify-between" onClick={() => setFormOpen(o => !o)}>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {editingId ? "Editar Plano" : "Novo Plano de Manutenção"}
          </CardTitle>
          {formOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </CardHeader>
        {formOpen && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo || ""} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Manutenção predial — Sede Central" />
              </div>
              <div>
                <Label>Contrato</Label>
                <Input value={form.contrato || ""} onChange={e => setForm(p => ({ ...p, contrato: e.target.value }))}
                  placeholder="Nº do contrato" />
              </div>
              <div>
                <Label>Cliente *</Label>
                <Select value={form.cliente_id || ""} onValueChange={handleClienteChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clientesList.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável Técnico</Label>
                <Select value={form.responsavel_tecnico_id || ""} onValueChange={handleResponsavelChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {responsaveis.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vigência Início</Label>
                <Input type="date" value={form.vigencia_inicio || ""} onChange={e => setForm(p => ({ ...p, vigencia_inicio: e.target.value }))} />
              </div>
              <div>
                <Label>Vigência Fim</Label>
                <Input type="date" value={form.vigencia_fim || ""} onChange={e => setForm(p => ({ ...p, vigencia_fim: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status || "Ativo"} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_PLANO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Escopo</Label>
              <Textarea rows={2} value={form.escopo || ""} onChange={e => setForm(p => ({ ...p, escopo: e.target.value }))}
                placeholder="Descreva o escopo do plano (ex: manutenção predial, elétrica, hidráulica...)" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes || ""} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>{editingId ? "Atualizar" : "Cadastrar"} Plano</Button>
              {editingId && <Button variant="outline" onClick={resetForm}>Cancelar</Button>}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" /> Planos Cadastrados</CardTitle>
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por título, cliente, contrato..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filtroCliente} onValueChange={setFiltroCliente}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientesList.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {STATUS_PLANO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Atividades</TableHead>
                <TableHead>Conformidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum plano cadastrado.</TableCell></TableRow>
              ) : paginated.map(p => {
                const ats = atividades.filter(a => a.plano_id === p.id);
                const conf = conformidadePlano(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.titulo}</TableCell>
                    <TableCell>{p.cliente_nome}</TableCell>
                    <TableCell>{p.contrato || "-"}</TableCell>
                    <TableCell className="text-xs">
                      {p.vigencia_inicio ? new Date(p.vigencia_inicio).toLocaleDateString("pt-BR") : "-"} a{" "}
                      {p.vigencia_fim ? new Date(p.vigencia_fim).toLocaleDateString("pt-BR") : "-"}
                    </TableCell>
                    <TableCell>{ats.length}</TableCell>
                    <TableCell>
                      <Badge variant={conf >= 80 ? "default" : conf >= 50 ? "secondary" : "destructive"}>{conf}%</Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetailPlano(p)} title="Atividades & Execuções">
                          <Activity className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(p)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => requestDelete(p.id)} title="Excluir">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationControls
            currentPage={page} pageSize={pageSize} totalItems={planosFiltrados.length}
            onPageChange={setPage} onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>

      {/* Detalhes (atividades + execuções) */}
      <PlanoDetailDialog
        plano={detailPlano}
        onClose={() => setDetailPlano(null)}
        atividades={atividades.filter(a => a.plano_id === detailPlano?.id)}
        execucoes={execucoes.filter(e => e.plano_id === detailPlano?.id)}
        equipamentos={equipamentos}
        onAddAtividade={addAtividade}
        onUpdateAtividade={updateAtividade}
        onDeleteAtividade={async (id: string) => {
          if (!podeExcluir) {
            toast.error("Você não possui permissão para excluir atividades.");
            return;
          }
          return deleteAtividade(id);
        }}
        onAddExecucao={addExecucao}
        addOrdemServico={addOrdem}
      />

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => !o && cancelDelete()}
        onConfirm={confirmDelete}
      />

      <RelatorioPlanosManutencaoDialog
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        planos={planos}
        atividades={atividades}
        execucoes={execucoes}
      />
    </div>
  );
}

// ====================== Detail Dialog ======================
function PlanoDetailDialog({
  plano, onClose, atividades, execucoes, equipamentos,
  onAddAtividade, onUpdateAtividade, onDeleteAtividade, onAddExecucao, addOrdemServico,
}: {
  plano: PlanoManutencao | null;
  onClose: () => void;
  atividades: PlanoAtividade[];
  execucoes: any[];
  equipamentos: any[];
  onAddAtividade: (a: Partial<PlanoAtividade>) => Promise<any>;
  onUpdateAtividade: (id: string, a: Partial<PlanoAtividade>) => Promise<any>;
  onDeleteAtividade: (id: string) => Promise<any>;
  onAddExecucao: (e: any) => Promise<any>;
  addOrdemServico: any;
}) {
  const [tab, setTab] = useState("atividades");
  const [atvForm, setAtvForm] = useState<Partial<PlanoAtividade>>({
    descricao: "", equipamento_id: "", equipamento_nome: "", tipo: "Preventiva",
    periodicidade: "Mensal", prioridade: "Média", responsavel: "",
    checklist: [], proxima_execucao: "", status: "Pendente", observacoes: "",
  });
  const [editAtvId, setEditAtvId] = useState<string | null>(null);
  const [novoCheckItem, setNovoCheckItem] = useState("");

  const [execAtividade, setExecAtividade] = useState<PlanoAtividade | null>(null);
  const [execForm, setExecForm] = useState({
    data_execucao: new Date().toISOString().slice(0, 10),
    responsavel: "", observacoes: "", percentual_conformidade: 100, gerar_os: false,
  });

  if (!plano) return null;

  const equipamentosCliente = equipamentos.filter(e => e.cliente_id === plano.cliente_id);

  const resetAtv = () => {
    setAtvForm({
      descricao: "", equipamento_id: "", equipamento_nome: "", tipo: "Preventiva",
      periodicidade: "Mensal", prioridade: "Média", responsavel: "",
      checklist: [], proxima_execucao: "", status: "Pendente", observacoes: "",
    });
    setEditAtvId(null);
  };

  const salvarAtividade = async () => {
    if (!atvForm.descricao) { toast.error("Informe a descrição."); return; }
    const payload = { ...atvForm, plano_id: plano.id };
    if (editAtvId) await onUpdateAtividade(editAtvId, payload);
    else await onAddAtividade(payload);
    resetAtv();
  };

  const addChecklistItem = () => {
    if (!novoCheckItem.trim()) return;
    const item: ChecklistItem = { id: crypto.randomUUID(), descricao: novoCheckItem.trim() };
    setAtvForm(prev => ({ ...prev, checklist: [...(prev.checklist || []), item] }));
    setNovoCheckItem("");
  };

  const removeChecklistItem = (id: string) => {
    setAtvForm(prev => ({ ...prev, checklist: (prev.checklist || []).filter(i => i.id !== id) }));
  };

  const editarAtividade = (a: PlanoAtividade) => {
    setAtvForm(a);
    setEditAtvId(a.id);
  };

  const registrarExecucao = async () => {
    if (!execAtividade) return;
    let osNumero = 0;
    let osId = "";
    if (execForm.gerar_os && addOrdemServico) {
      try {
        const os = await addOrdemServico({
          clienteId: plano.cliente_id,
          clienteNome: plano.cliente_nome,
          tipo: "Preventiva",
          descricao: `[Plano: ${plano.titulo}] ${execAtividade.descricao}`,
          status: "Concluída",
          dataAbertura: execForm.data_execucao,
          dataConclusao: execForm.data_execucao,
          tecnicoResponsavel: execForm.responsavel,
        });
        if (os) { osNumero = os.numero || 0; osId = os.id || ""; }
      } catch (e) { console.warn("OS não gerada:", e); }
    }
    await onAddExecucao({
      plano_id: plano.id,
      atividade_id: execAtividade.id,
      data_execucao: execForm.data_execucao,
      responsavel: execForm.responsavel,
      observacoes: execForm.observacoes,
      percentual_conformidade: execForm.percentual_conformidade,
      checklist_resultado: execAtividade.checklist || [],
      os_id: osId,
      os_numero: osNumero,
      evidencias: [],
    });
    // atualiza próxima execução
    const proxima = calcularProximaData(execForm.data_execucao, execAtividade.periodicidade);
    if (proxima) {
      await onUpdateAtividade(execAtividade.id, { proxima_execucao: proxima, status: "Em Dia" });
    }
    setExecAtividade(null);
    setExecForm({ data_execucao: new Date().toISOString().slice(0, 10), responsavel: "", observacoes: "", percentual_conformidade: 100, gerar_os: false });
  };

  return (
    <>
      <Dialog open={!!plano} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> {plano.titulo}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{plano.cliente_nome} {plano.contrato && `• Contrato ${plano.contrato}`}</p>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="atividades">Atividades ({atividades.length})</TabsTrigger>
              <TabsTrigger value="execucoes">Execuções ({execucoes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="atividades" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">{editAtvId ? "Editar Atividade" : "Nova Atividade"}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label>Descrição *</Label>
                      <Input value={atvForm.descricao || ""} onChange={e => setAtvForm(p => ({ ...p, descricao: e.target.value }))}
                        placeholder="Ex: Inspeção mensal do quadro elétrico geral" />
                    </div>
                    <div>
                      <Label>Equipamento</Label>
                      <Select value={atvForm.equipamento_id || "nenhum"} onValueChange={(v) => {
                        const eq = equipamentosCliente.find(e => e.id === v);
                        setAtvForm(p => ({ ...p, equipamento_id: v === "nenhum" ? "" : v, equipamento_nome: eq?.equipamento || eq?.tag || "" }));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhum">— Nenhum —</SelectItem>
                          {equipamentosCliente.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.tag} — {e.equipamento}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={atvForm.tipo} onValueChange={v => setAtvForm(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Periodicidade</Label>
                      <Select value={atvForm.periodicidade} onValueChange={v => setAtvForm(p => ({ ...p, periodicidade: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PERIODICIDADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Select value={atvForm.prioridade} onValueChange={v => setAtvForm(p => ({ ...p, prioridade: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PRIORIDADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Responsável</Label>
                      <Input value={atvForm.responsavel || ""} onChange={e => setAtvForm(p => ({ ...p, responsavel: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Próxima Execução</Label>
                      <Input type="date" value={atvForm.proxima_execucao || ""} onChange={e => setAtvForm(p => ({ ...p, proxima_execucao: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <Label>Checklist de Tarefas</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={novoCheckItem} onChange={e => setNovoCheckItem(e.target.value)}
                        placeholder="Item do checklist" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addChecklistItem())} />
                      <Button type="button" variant="outline" onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="space-y-1 mt-2">
                      {(atvForm.checklist || []).map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-muted/50 px-3 py-1.5 rounded">
                          <span className="text-sm">{item.descricao}</span>
                          <Button size="sm" variant="ghost" onClick={() => removeChecklistItem(item.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={salvarAtividade}>{editAtvId ? "Atualizar" : "Adicionar"} Atividade</Button>
                    {editAtvId && <Button variant="outline" onClick={resetAtv}>Cancelar</Button>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Atividades Cadastradas</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Periodicidade</TableHead>
                        <TableHead>Próx. Exec.</TableHead>
                        <TableHead>Última</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atividades.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Nenhuma atividade.</TableCell></TableRow>
                      ) : atividades.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.descricao}</TableCell>
                          <TableCell className="text-xs">{a.equipamento_nome || "-"}</TableCell>
                          <TableCell>{a.periodicidade}</TableCell>
                          <TableCell className="text-xs">{a.proxima_execucao ? new Date(a.proxima_execucao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell className="text-xs">{a.ultima_execucao ? new Date(a.ultima_execucao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setExecAtividade(a)} title="Registrar execução">
                                <Calendar className="h-4 w-4 text-primary" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => editarAtividade(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => onDeleteAtividade(a.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="execucoes">
              <Card>
                <CardHeader><CardTitle className="text-base">Histórico de Execuções</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Conformidade</TableHead>
                        <TableHead>OS</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {execucoes.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nenhuma execução registrada.</TableCell></TableRow>
                      ) : execucoes.map(e => {
                        const at = atividades.find(a => a.id === e.atividade_id);
                        return (
                          <TableRow key={e.id}>
                            <TableCell>{e.data_execucao ? new Date(e.data_execucao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                            <TableCell>{at?.descricao || "-"}</TableCell>
                            <TableCell>{e.responsavel || "-"}</TableCell>
                            <TableCell><Badge>{e.percentual_conformidade}%</Badge></TableCell>
                            <TableCell>{e.os_numero ? `OS ${e.os_numero}` : "-"}</TableCell>
                            <TableCell className="text-xs max-w-xs truncate">{e.observacoes || "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de execução */}
      <Dialog open={!!execAtividade} onOpenChange={(o) => !o && setExecAtividade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Execução</DialogTitle>
          </DialogHeader>
          {execAtividade && (
            <div className="space-y-3">
              <p className="text-sm"><strong>Atividade:</strong> {execAtividade.descricao}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Execução</Label>
                  <Input type="date" value={execForm.data_execucao} onChange={e => setExecForm(p => ({ ...p, data_execucao: e.target.value }))} />
                </div>
                <div>
                  <Label>Conformidade (%)</Label>
                  <Input type="number" min={0} max={100} value={execForm.percentual_conformidade}
                    onChange={e => setExecForm(p => ({ ...p, percentual_conformidade: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <Label>Responsável pela execução</Label>
                <Input value={execForm.responsavel} onChange={e => setExecForm(p => ({ ...p, responsavel: e.target.value }))} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={execForm.observacoes} onChange={e => setExecForm(p => ({ ...p, observacoes: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={execForm.gerar_os}
                  onChange={e => setExecForm(p => ({ ...p, gerar_os: e.target.checked }))} />
                Gerar Ordem de Serviço vinculada
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecAtividade(null)}>Cancelar</Button>
            <Button onClick={registrarExecucao}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PlanoManutencaoPage() {
  return (
    <OrdensServicoProvider>
      <OrcamentosProvider>
        <PlanoManutencaoContent />
      </OrcamentosProvider>
    </OrdensServicoProvider>
  );
}
