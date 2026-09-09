import { useState, useMemo } from "react";
import { usePmoc } from "@/contexts/PmocContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";

import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadPdfPmoc, downloadPdfPmocPlanos, downloadPdfPmocOS,
  downloadPdfPmocQualidadeAr, downloadPdfPmocInconformidades, downloadPdfPmocBiblioteca,
} from "@/lib/gerarPdfPmoc";
import { downloadExcelPmoc } from "@/lib/gerarExcelPmoc";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissao } from "@/hooks/usePermissao";
import {
  Plus, Pencil, Trash2, Search, FileText, ClipboardList, Settings, Users,
  Wind, AlertTriangle, BookOpen, BarChart3, CalendarClock, Wrench, ShieldCheck,
  ThermometerSun, Activity, Download, FileSpreadsheet, Upload, X
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PERIODICIDADES = ["Diária", "Semanal", "Quinzenal", "Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"];
const TIPOS_ATIVIDADE = ["Preventiva", "Corretiva", "Inspeção", "Preditiva"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"];
const STATUS_OS = ["Aberta", "Em Execução", "Concluída", "Cancelada", "Aguardando Aprovação"];
const STATUS_PLANO = ["Ativo", "Inativo", "Em Revisão", "Vencido"];
const GRAVIDADES = ["Leve", "Moderada", "Grave", "Crítica"];
const TIPOS_REGISTRO = ["CREA", "CRQ", "CRECI", "CFT", "Outro"];

// ====================== PLANOS TAB ======================
function PlanosTab() {
  const {
    planos, atividades, biblioteca, responsaveisTecnicos: responsaveisTec,
    addPlano, updatePlano, deletePlano,
    addAtividade, updateAtividade, deleteAtividade,
  } = usePmoc();
  const { clientes } = useClientes();
  const { equipamentos, updateEquipamento } = useEquipamentos();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("pmoc.excluir");
  const [form, setForm] = useState({
    titulo: "", descricao: "", cliente_id: "", cliente_nome: "", unidade: "",
    contrato: "", edificio: "", ambiente_critico: "", vigencia_inicio: "",
    vigencia_fim: "", status: "Ativo", responsavel_tecnico_nome: "",
    observacoes: "", procedimentos_falha: "", contingencia: "",
  });

  // Gestão de atividades/equipamentos dentro do plano
  const [managePlano, setManagePlano] = useState<any | null>(null);
  const [equipSel, setEquipSel] = useState<Set<string>>(new Set());
  const [equipLote, setEquipLote] = useState(false);
  const [manageTab, setManageTab] = useState<"atividades" | "equipamentos">("atividades");
  const [ativEditing, setAtivEditing] = useState<string | null>(null);
  const [ativForm, setAtivForm] = useState({
    equipamento_id: "", equipamento_nome: "", descricao: "",
    tipo: "Preventiva", periodicidade: "Mensal", prioridade: "Normal",
    duracao_estimada: "", proxima_execucao: "",
    parametros_tecnicos: "", procedimento_falha: "",
  });
  const [bibliotecaPicker, setBibliotecaPicker] = useState(false);
  const [filtroTitulo, setFiltroTitulo] = useState("");
  const [filtroTipoEquip, setFiltroTipoEquip] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");

  const bibliotecaFiltrada = useMemo(() => {
    return biblioteca.filter(b => {
      if (filtroTitulo && !b.titulo.toLowerCase().includes(filtroTitulo.toLowerCase())) return false;
      if (filtroTipoEquip && b.tipoEquipamento !== filtroTipoEquip) return false;
      if (filtroTipo && b.tipoAtividade !== filtroTipo) return false;
      if (filtroPeriodo && b.periodicidadeSugerida !== filtroPeriodo) return false;
      return true;
    });
  }, [biblioteca, filtroTitulo, filtroTipoEquip, filtroTipo, filtroPeriodo]);

  const tiposEquipamento = useMemo(() => [...new Set(biblioteca.map(b => b.tipoEquipamento).filter(Boolean))].sort(), [biblioteca]);
  const tiposAtividade = useMemo(() => [...new Set(biblioteca.map(b => b.tipoAtividade).filter(Boolean))].sort(), [biblioteca]);
  const periodicidades = useMemo(() => [...new Set(biblioteca.map(b => b.periodicidadeSugerida).filter(Boolean))].sort(), [biblioteca]);

  const filtered = useMemo(() => {
    if (!search) return planos;
    const s = search.toLowerCase();
    return planos.filter(p => p.titulo.toLowerCase().includes(s) || p.clienteNome.toLowerCase().includes(s));
  }, [planos, search]);

  const countAtiv = (planoId: string) => atividades.filter(a => a.planoId === planoId).length;
  const countEquip = (planoId: string) => equipamentos.filter(e => e.planoManutencao === planoId).length;

  const openNew = () => {
    setForm({ titulo: "", descricao: "", cliente_id: "", cliente_nome: "", unidade: "",
      contrato: "", edificio: "", ambiente_critico: "", vigencia_inicio: "",
      vigencia_fim: "", status: "Ativo", responsavel_tecnico_nome: "",
      observacoes: "", procedimentos_falha: "", contingencia: "" });
    setEditingId(null); setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setForm({
      titulo: p.titulo, descricao: p.descricao, cliente_id: p.clienteId,
      cliente_nome: p.clienteNome, unidade: p.unidade, contrato: p.contrato,
      edificio: p.edificio, ambiente_critico: p.ambienteCritico,
      vigencia_inicio: p.vigenciaInicio, vigencia_fim: p.vigenciaFim,
      status: p.status, responsavel_tecnico_nome: p.responsavelTecnicoNome,
      observacoes: p.observacoes, procedimentos_falha: p.procedimentosFalha,
      contingencia: p.contingencia,
    });
    setEditingId(p.id); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { toast({ title: "Título é obrigatório", variant: "destructive" }); return; }
    if (editingId) {
      await updatePlano(editingId, form);
      toast({ title: "Plano atualizado" });
    } else {
      await addPlano(form);
      toast({ title: "Plano criado" });
    }
    setDialogOpen(false);
  };

  const statusColor = (s: string) => {
    if (s === "Ativo") return "default";
    if (s === "Inativo" || s === "Vencido") return "destructive";
    return "secondary";
  };

  // === Atividades dentro do plano ===
  const resetAtivForm = () => {
    setAtivForm({ equipamento_id: "", equipamento_nome: "", descricao: "",
      tipo: "Preventiva", periodicidade: "Mensal", prioridade: "Normal",
      duracao_estimada: "", proxima_execucao: "", parametros_tecnicos: "", procedimento_falha: "" });
    setAtivEditing(null);
  };

  const ativsDoPlano = managePlano ? atividades.filter(a => a.planoId === managePlano.id) : [];
  const ativsDoPlanoOrdenadas = useMemo(() => {
    const ordem = PERIODICIDADES;
    return [...ativsDoPlano].sort((a, b) => {
      const ia = ordem.indexOf(a.periodicidade);
      const ib = ordem.indexOf(b.periodicidade);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [ativsDoPlano]);

  const equipsDoCliente = managePlano ? equipamentos.filter(e => e.clienteId === managePlano.clienteId) : [];

  const startEditAtiv = (a: any) => {
    setAtivEditing(a.id);
    setAtivForm({
      equipamento_id: a.equipamentoId, equipamento_nome: a.equipamentoNome,
      descricao: a.descricao, tipo: a.tipo, periodicidade: a.periodicidade,
      prioridade: a.prioridade, duracao_estimada: a.duracaoEstimada,
      proxima_execucao: a.proximaExecucao,
      parametros_tecnicos: a.parametrosTecnicos, procedimento_falha: a.procedimentoFalha,
    });
  };

  const saveAtiv = async () => {
    if (!managePlano) return;
    if (!ativForm.descricao.trim()) { toast({ title: "Descrição obrigatória", variant: "destructive" }); return; }
    const payload = { ...ativForm, plano_id: managePlano.id };
    if (ativEditing) { await updateAtividade(ativEditing, payload); toast({ title: "Atividade atualizada" }); }
    else { await addAtividade(payload); toast({ title: "Atividade adicionada" }); }
    resetAtivForm();
  };

  const addFromBiblioteca = async (rotina: any) => {
    if (!managePlano) return;
    await addAtividade({
      plano_id: managePlano.id, equipamento_id: "", equipamento_nome: "",
      descricao: rotina.titulo + (rotina.descricao ? ` — ${rotina.descricao}` : ""),
      tipo: rotina.tipoAtividade, periodicidade: rotina.periodicidadeSugerida,
      prioridade: "Normal", duracao_estimada: rotina.duracaoEstimada,
      proxima_execucao: "", parametros_tecnicos: "", procedimento_falha: "",
    });
    setBibliotecaPicker(false);
    toast({ title: "Atividade adicionada da biblioteca" });
  };

  const toggleEquipNoPlano = async (equipId: string, vincular: boolean) => {
    if (!managePlano) return;
    await updateEquipamento(equipId, { planoManutencao: vincular ? managePlano.id : "" } as any);
  };

  const toggleEquipSel = (equipId: string) =>
    setEquipSel(prev => {
      const next = new Set(prev);
      next.has(equipId) ? next.delete(equipId) : next.add(equipId);
      return next;
    });

  const toggleEquipSelAll = () =>
    setEquipSel(prev =>
      prev.size === equipsDoCliente.length ? new Set<string>() : new Set(equipsDoCliente.map(e => e.id))
    );

  const aplicarVinculoLote = async (vincular: boolean) => {
    if (!managePlano || equipSel.size === 0) return;
    setEquipLote(true);
    for (const id of equipSel) {
      await toggleEquipNoPlano(id, vincular);
    }
    setEquipLote(false);
    setEquipSel(new Set());
    toast({ title: vincular ? "Equipamentos vinculados" : "Equipamentos desvinculados" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar plano..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadPdfPmocPlanos(filtered, atividades)}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Plano</Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead className="text-center">Atividades</TableHead>
              <TableHead className="text-center">Equipamentos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>RT</TableHead>
              <TableHead className="w-40">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginate(filtered, page, pageSize).paginated.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum plano cadastrado</TableCell></TableRow>
            ) : paginate(filtered, page, pageSize).paginated.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.titulo}</TableCell>
                <TableCell>{p.clienteNome || "-"}</TableCell>
                <TableCell className="text-xs">{p.vigenciaInicio && p.vigenciaFim ? `${p.vigenciaInicio} a ${p.vigenciaFim}` : "-"}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{countAtiv(p.id)}</Badge></TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{countEquip(p.id)}</Badge></TableCell>
                <TableCell><Badge variant={statusColor(p.status)}>{p.status}</Badge></TableCell>
                <TableCell className="text-xs">{p.responsavelTecnicoNome || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => { setManagePlano(p); setManageTab("atividades"); resetAtivForm(); }}>
                      <ClipboardList className="h-3.5 w-3.5 mr-1" />Gerir
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Editar dados do plano"><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      {/* Dialog: dados do plano */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Plano PMOC</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} /></div>
            <div><Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={v => { const c = clientes.find(c => c.id === v); setForm(f => ({ ...f, cliente_id: v, cliente_nome: c?.nome || "", contrato: "", vigencia_inicio: "", vigencia_fim: "" })); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{clientes.filter(c => c.tipo === "Cliente").map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Unidade</Label><Input value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} /></div>
            <div>
              <Label>Contrato</Label>
              {(() => {
                const cli = clientes.find(c => c.id === form.cliente_id);
                const hoje = new Date().toISOString().substring(0, 10);
                const contratosVigentes = (cli?.contratos || []).filter(ct => (!ct.dataFim || ct.dataFim >= hoje));
                if (form.cliente_id && contratosVigentes.length === 0) {
                  return (
                    <div className="space-y-1">
                      <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                        Cliente sem contratos em vigor
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cadastre um contrato em vigor para o cliente em <span className="font-medium text-foreground">Cadastros &gt; Contratos</span>.
                      </p>
                    </div>
                  );
                }
                return (
                  <Select
                    value={form.contrato || "__none"}
                    onValueChange={v => {
                      if (v === "__none") { setForm(f => ({ ...f, contrato: "", vigencia_inicio: "", vigencia_fim: "" })); return; }
                      const ct = contratosVigentes.find(c => c.numero === v);
                      setForm(f => ({ ...f, contrato: v, vigencia_inicio: ct?.dataInicio || "", vigencia_fim: ct?.dataFim || "" }));
                    }}
                    disabled={!form.cliente_id}
                  >
                    <SelectTrigger><SelectValue placeholder={form.cliente_id ? "Selecione..." : "Selecione cliente"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {contratosVigentes.map(ct => (
                        <SelectItem key={ct.id} value={ct.numero}>{ct.numero}{ct.descricao ? ` - ${ct.descricao}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div><Label>Edifício</Label><Input value={form.edificio} onChange={e => setForm(f => ({ ...f, edificio: e.target.value }))} /></div>
            <div><Label>Vigência Início</Label><Input type="date" value={form.vigencia_inicio} onChange={e => setForm(f => ({ ...f, vigencia_inicio: e.target.value }))} /></div>
            <div><Label>Vigência Fim</Label><Input type="date" value={form.vigencia_fim} onChange={e => setForm(f => ({ ...f, vigencia_fim: e.target.value }))} /></div>
            {(() => {
              const hoje = new Date().toISOString().substring(0, 10);
              const inicio = form.vigencia_inicio;
              const fim = form.vigencia_fim;
              let msg = "";
              if (inicio && fim && fim < inicio) msg = "A data de fim da vigência é anterior à data de início.";
              else if (fim && fim < hoje) msg = "O contrato está com a vigência vencida.";
              if (!msg) return null;
              return (
                <div className="col-span-2">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Vigência inválida</AlertTitle>
                    <AlertDescription>{msg}</AlertDescription>
                  </Alert>
                </div>
              );
            })()}
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_PLANO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Responsável Técnico</Label>
              <Select value={form.responsavel_tecnico_nome || "__none"} onValueChange={v => setForm(f => ({ ...f, responsavel_tecnico_nome: v === "__none" ? "" : v }))}>
                <SelectTrigger className="pl-1 pr-8 text-left"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {responsaveisTec.map(r => <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Procedimentos em Caso de Falha</Label><Textarea value={form.procedimentos_falha} onChange={e => setForm(f => ({ ...f, procedimentos_falha: e.target.value }))} rows={2} /></div>
            <div className="col-span-2"><Label>Contingência</Label><Textarea value={form.contingencia} onChange={e => setForm(f => ({ ...f, contingencia: e.target.value }))} rows={2} /></div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: gerir atividades e equipamentos do plano */}
      <Dialog open={!!managePlano} onOpenChange={o => { if (!o) { setManagePlano(null); resetAtivForm(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerir Plano: {managePlano?.titulo}</DialogTitle>
            <p className="text-xs text-muted-foreground">Cliente: {managePlano?.clienteNome || "—"}</p>
          </DialogHeader>

          <Tabs value={manageTab} onValueChange={v => setManageTab(v as any)}>
            <TabsList>
              <TabsTrigger value="atividades"><ClipboardList className="h-4 w-4 mr-1" />Atividades ({ativsDoPlano.length})</TabsTrigger>
              <TabsTrigger value="equipamentos"><Settings className="h-4 w-4 mr-1" />Equipamentos vinculados ({equipsDoCliente.filter(e => e.planoManutencao === managePlano?.id).length})</TabsTrigger>
            </TabsList>

            <TabsContent value="atividades" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={resetAtivForm}><Plus className="h-4 w-4 mr-1" />Nova atividade</Button>
                <Button size="sm" variant="outline" onClick={() => setBibliotecaPicker(true)} disabled={biblioteca.length === 0}>
                  <BookOpen className="h-4 w-4 mr-1" />Adicionar da biblioteca
                </Button>
              </div>

              {/* Form inline */}
              <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">{ativEditing ? "Editando atividade" : "Nova atividade"}</p>
                <div className="grid grid-cols-1 gap-3">
                  <div><Label className="text-xs">Descrição *</Label><Input value={ativForm.descricao} onChange={e => setAtivForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                  <p className="text-xs text-muted-foreground">Tipo, periodicidade e demais detalhes são definidos ao adicionar atividades da biblioteca.</p>
                </div>
                <div className="flex gap-2 justify-end">
                  {ativEditing && <Button size="sm" variant="ghost" onClick={resetAtivForm}>Cancelar</Button>}
                  <Button size="sm" onClick={saveAtiv}>{ativEditing ? "Atualizar" : "Adicionar"}</Button>
                </div>
              </div>

              {/* Lista de atividades */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Periodicidade</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ativsDoPlanoOrdenadas.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma atividade no plano</TableCell></TableRow>
                    ) : ativsDoPlanoOrdenadas.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.descricao}</TableCell>
                        <TableCell className="text-xs">{a.equipamentoNome || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.tipo}</Badge></TableCell>
                        <TableCell className="text-xs">{a.periodicidade}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEditAtiv(a)}><Pencil className="h-4 w-4" /></Button>
                            {podeExcluir && <Button variant="ghost" size="icon" onClick={async () => { await deleteAtividade(a.id); toast({ title: "Atividade removida" }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="equipamentos" className="space-y-3">
              {!managePlano?.clienteId ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Defina o cliente do plano para vincular equipamentos.</p>
              ) : equipsDoCliente.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Nenhum equipamento cadastrado para este cliente.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{equipSel.size} selecionado(s)</span>
                    <Button size="sm" disabled={equipLote || equipSel.size === 0} onClick={() => aplicarVinculoLote(true)}>
                      Vincular selecionados
                    </Button>
                    <Button size="sm" variant="outline" disabled={equipLote || equipSel.size === 0} onClick={() => aplicarVinculoLote(false)}>
                      Desvincular selecionados
                    </Button>
                    {equipSel.size > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setEquipSel(new Set())}>Limpar seleção</Button>
                    )}
                  </div>
                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            checked={equipSel.size > 0 && equipSel.size === equipsDoCliente.length}
                            onChange={toggleEquipSelAll}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead className="w-12">Vinc.</TableHead>
                        <TableHead>TAG</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Plano atual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipsDoCliente.map(e => {
                        const vinculadoAqui = e.planoManutencao === managePlano!.id;
                        const outroPlanoId = e.planoManutencao && !vinculadoAqui ? e.planoManutencao : "";
                        const outroPlano = outroPlanoId ? planos.find(pp => pp.id === outroPlanoId)?.titulo : "";
                        return (
                          <TableRow key={e.id} className={equipSel.has(e.id) ? "bg-accent/50" : undefined}>
                            <TableCell>
                              <input type="checkbox" checked={equipSel.has(e.id)} onChange={() => toggleEquipSel(e.id)} />
                            </TableCell>
                            <TableCell>
                              <input type="checkbox" checked={vinculadoAqui}
                                onChange={ev => toggleEquipNoPlano(e.id, ev.target.checked)} />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{e.tag || "—"}</TableCell>
                            <TableCell>{e.equipamento}</TableCell>
                            <TableCell className="text-xs">{e.setorDescricao || "—"}</TableCell>
                            <TableCell className="text-xs">{vinculadoAqui ? <Badge>Este plano</Badge> : outroPlano ? <Badge variant="outline">{outroPlano}</Badge> : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter><Button variant="outline" onClick={() => { setManagePlano(null); resetAtivForm(); }}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Picker da biblioteca */}
      <Dialog open={bibliotecaPicker} onOpenChange={o => { setBibliotecaPicker(o); if (!o) { setFiltroTitulo(""); setFiltroTipoEquip(""); setFiltroTipo(""); setFiltroPeriodo(""); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Selecionar rotina da biblioteca</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input placeholder="Buscar título..." value={filtroTitulo} onChange={e => setFiltroTitulo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tipo Equip.</Label>
              <Select value={filtroTipoEquip || "__all"} onValueChange={v => setFiltroTipoEquip(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {tiposEquipamento.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={filtroTipo || "__all"} onValueChange={v => setFiltroTipo(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {tiposAtividade.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Period.</Label>
              <Select value={filtroPeriodo || "__all"} onValueChange={v => setFiltroPeriodo(v === "__all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos</SelectItem>
                  {periodicidades.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Tipo Equip.</TableHead><TableHead>Tipo</TableHead><TableHead>Period.</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
              <TableBody>
                {bibliotecaFiltrada.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.titulo}</TableCell>
                    <TableCell className="text-xs">{b.tipoEquipamento || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{b.tipoAtividade}</Badge></TableCell>
                    <TableCell className="text-xs">{b.periodicidadeSugerida}</TableCell>
                    <TableCell><Button size="sm" onClick={() => addFromBiblioteca(b)}>Usar</Button></TableCell>
                  </TableRow>
                ))}
                {bibliotecaFiltrada.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma rotina encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={() => { if (deleteId && podeExcluir) { deletePlano(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}

// ====================== ATIVIDADES TAB ======================
function AtividadesTab() {
  const { planos, atividades, addAtividade, updateAtividade, deleteAtividade } = usePmoc();
  const { equipamentos } = useEquipamentos();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterPlano, setFilterPlano] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("pmoc.excluir");
  const [form, setForm] = useState({
    plano_id: "", equipamento_id: "", equipamento_nome: "", descricao: "",
    tipo: "Preventiva", periodicidade: "Mensal", parametros_tecnicos: "",
    procedimento_falha: "", prioridade: "Normal", duracao_estimada: "",
    proxima_execucao: "",
  });

  const filtered = useMemo(() => {
    let list = atividades;
    if (filterPlano) list = list.filter(a => a.planoId === filterPlano);
    if (search) { const s = search.toLowerCase(); list = list.filter(a => a.descricao.toLowerCase().includes(s) || a.equipamentoNome.toLowerCase().includes(s)); }
    return list;
  }, [atividades, search, filterPlano]);

  const openNew = () => {
    setForm({ plano_id: filterPlano || "", equipamento_id: "", equipamento_nome: "", descricao: "",
      tipo: "Preventiva", periodicidade: "Mensal", parametros_tecnicos: "",
      procedimento_falha: "", prioridade: "Normal", duracao_estimada: "", proxima_execucao: "" });
    setEditingId(null); setDialogOpen(true);
  };

  const openEdit = (a: any) => {
    setForm({
      plano_id: a.planoId, equipamento_id: a.equipamentoId, equipamento_nome: a.equipamentoNome,
      descricao: a.descricao, tipo: a.tipo, periodicidade: a.periodicidade,
      parametros_tecnicos: a.parametrosTecnicos, procedimento_falha: a.procedimentoFalha,
      prioridade: a.prioridade, duracao_estimada: a.duracaoEstimada,
      proxima_execucao: a.proximaExecucao,
    });
    setEditingId(a.id); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.descricao.trim()) { toast({ title: "Descrição obrigatória", variant: "destructive" }); return; }
    if (editingId) { await updateAtividade(editingId, form); toast({ title: "Atividade atualizada" }); }
    else { await addAtividade(form); toast({ title: "Atividade criada" }); }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar atividade..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterPlano} onValueChange={v => { setFilterPlano(v === "__all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Filtrar por plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os planos</SelectItem>
            {planos.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Atividade</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Periodicidade</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Próx. Execução</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginate(filtered, page, pageSize).paginated.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma atividade</TableCell></TableRow>
            ) : paginate(filtered, page, pageSize).paginated.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.descricao}</TableCell>
                <TableCell>{a.equipamentoNome || "-"}</TableCell>
                <TableCell><Badge variant="outline">{a.tipo}</Badge></TableCell>
                <TableCell>{a.periodicidade}</TableCell>
                <TableCell><Badge variant={a.prioridade === "Urgente" || a.prioridade === "Alta" ? "destructive" : "secondary"}>{a.prioridade}</Badge></TableCell>
                <TableCell>{a.proximaExecucao || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Nova"} Atividade</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div><Label>Plano PMOC</Label>
              <Select value={form.plano_id} onValueChange={v => setForm(f => ({ ...f, plano_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{planos.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Equipamento</Label>
              <Select value={form.equipamento_id} onValueChange={v => { const eq = equipamentos.find(e => e.id === v); setForm(f => ({ ...f, equipamento_id: v, equipamento_nome: eq?.equipamento || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{equipamentos.map(e => <SelectItem key={e.id} value={e.id}>{e.tag ? `${e.tag} - ` : ""}{e.equipamento}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Periodicidade</Label>
              <Select value={form.periodicidade} onValueChange={v => setForm(f => ({ ...f, periodicidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODICIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Duração Estimada</Label><Input value={form.duracao_estimada} onChange={e => setForm(f => ({ ...f, duracao_estimada: e.target.value }))} placeholder="Ex: 2h" /></div>
            <div><Label>Próxima Execução</Label><Input type="date" value={form.proxima_execucao} onChange={e => setForm(f => ({ ...f, proxima_execucao: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Parâmetros Técnicos</Label><Textarea value={form.parametros_tecnicos} onChange={e => setForm(f => ({ ...f, parametros_tecnicos: e.target.value }))} rows={2} /></div>
            <div className="col-span-2"><Label>Procedimento em Caso de Falha</Label><Textarea value={form.procedimento_falha} onChange={e => setForm(f => ({ ...f, procedimento_falha: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={() => { if (deleteId && podeExcluir) { deleteAtividade(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}

// ====================== ORDENS DE SERVIÇO TAB ======================
function OrdensServicoTab() {
  const { planos, ordensServico, responsaveisTecnicos: responsaveisTec, addOS, updateOS, deleteOS } = usePmoc();
  const { equipamentos } = useEquipamentos();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("pmoc.excluir");
  const [form, setForm] = useState({
    plano_id: "", equipamento_id: "", equipamento_nome: "", descricao: "",
    tipo: "Preventiva", prioridade: "Normal", status: "Aberta", origem: "PMOC",
    unidade: "", local_descricao: "", data_abertura: new Date().toISOString().slice(0, 10),
    data_prazo: "", tecnico_responsavel: "", equipe: "", observacoes: "",
  });

  const filtered = useMemo(() => {
    let list = ordensServico;
    if (filterStatus !== "Todos") list = list.filter(o => o.status === filterStatus);
    if (search) { const s = search.toLowerCase(); list = list.filter(o => o.descricao.toLowerCase().includes(s) || String(o.numero).includes(s)); }
    return list;
  }, [ordensServico, search, filterStatus]);

  const openNew = () => {
    setForm({ plano_id: "", equipamento_id: "", equipamento_nome: "", descricao: "",
      tipo: "Preventiva", prioridade: "Normal", status: "Aberta", origem: "Manual",
      unidade: "", local_descricao: "", data_abertura: new Date().toISOString().slice(0, 10),
      data_prazo: "", tecnico_responsavel: "", equipe: "", observacoes: "" });
    setEditingId(null); setDialogOpen(true);
  };

  const openEdit = (o: any) => {
    setForm({
      plano_id: o.planoId, equipamento_id: o.equipamentoId, equipamento_nome: o.equipamentoNome,
      descricao: o.descricao, tipo: o.tipo, prioridade: o.prioridade, status: o.status,
      origem: o.origem, unidade: o.unidade, local_descricao: o.localDescricao,
      data_abertura: o.dataAbertura, data_prazo: o.dataPrazo,
      tecnico_responsavel: o.tecnicoResponsavel, equipe: o.equipe, observacoes: o.observacoes,
    });
    setEditingId(o.id); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.descricao.trim()) { toast({ title: "Descrição obrigatória", variant: "destructive" }); return; }
    if (editingId) { await updateOS(editingId, form); toast({ title: "OS atualizada" }); }
    else { await addOS(form); toast({ title: "OS criada" }); }
    setDialogOpen(false);
  };

  const statusColor = (s: string) => {
    if (s === "Concluída") return "default";
    if (s === "Aberta") return "secondary";
    if (s === "Em Execução") return "outline";
    if (s === "Cancelada") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar OS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos Status</SelectItem>
            {STATUS_OS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => downloadPdfPmocOS(filtered, true)}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova OS</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginate(filtered, page, pageSize).paginated.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma OS</TableCell></TableRow>
            ) : paginate(filtered, page, pageSize).paginated.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono">{o.numero}</TableCell>
                <TableCell className="font-medium">{o.descricao}</TableCell>
                <TableCell>{o.equipamentoNome || "-"}</TableCell>
                <TableCell><Badge variant="outline">{o.tipo}</Badge></TableCell>
                <TableCell><Badge variant={o.prioridade === "Urgente" || o.prioridade === "Alta" ? "destructive" : "secondary"}>{o.prioridade}</Badge></TableCell>
                <TableCell><Badge variant={statusColor(o.status) as any}>{o.status}</Badge></TableCell>
                <TableCell>{o.dataPrazo || "-"}</TableCell>
                <TableCell>{o.tecnicoResponsavel || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Nova"} Ordem de Serviço</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div><Label>Plano PMOC</Label>
              <Select value={form.plano_id} onValueChange={v => setForm(f => ({ ...f, plano_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{planos.map(p => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Equipamento</Label>
              <Select value={form.equipamento_id} onValueChange={v => { const eq = equipamentos.find(e => e.id === v); setForm(f => ({ ...f, equipamento_id: v, equipamento_nome: eq?.equipamento || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{equipamentos.map(e => <SelectItem key={e.id} value={e.id}>{e.tag ? `${e.tag} - ` : ""}{e.equipamento}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Origem</Label><Input value={form.origem} onChange={e => setForm(f => ({ ...f, origem: e.target.value }))} /></div>
            <div><Label>Data Abertura</Label><Input type="date" value={form.data_abertura} onChange={e => setForm(f => ({ ...f, data_abertura: e.target.value }))} /></div>
            <div><Label>Data Prazo</Label><Input type="date" value={form.data_prazo} onChange={e => setForm(f => ({ ...f, data_prazo: e.target.value }))} /></div>
            <div><Label>Técnico Responsável</Label>
              <Select value={form.tecnico_responsavel || "__none"} onValueChange={v => setForm(f => ({ ...f, tecnico_responsavel: v === "__none" ? "" : v }))}>
                <SelectTrigger className="pl-1 pr-8 text-left"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {responsaveisTec.map(r => <SelectItem key={r.id} value={r.nome}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Equipe</Label><Input value={form.equipe} onChange={e => setForm(f => ({ ...f, equipe: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={() => { if (deleteId && podeExcluir) { deleteOS(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}

// ====================== RESPONSÁVEIS TÉCNICOS TAB ======================
function ResponsaveisTecnicosTab() {
  const { responsaveisTecnicos, addRT, updateRT, deleteRT } = usePmoc();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("pmoc.excluir");
  const [form, setForm] = useState({
    nome: "", registro_profissional: "", tipo_registro: "CREA",
    especialidade: "", telefone: "", email: "", documento_art_rrt: "",
    vigencia_inicio: "", vigencia_fim: "", status: "Ativo", observacoes: "",
  });

  const openNew = () => {
    setForm({ nome: "", registro_profissional: "", tipo_registro: "CREA",
      especialidade: "", telefone: "", email: "", documento_art_rrt: "",
      vigencia_inicio: "", vigencia_fim: "", status: "Ativo", observacoes: "" });
    setEditingId(null); setDialogOpen(true);
  };

  const openEdit = (rt: any) => {
    setForm({
      nome: rt.nome, registro_profissional: rt.registroProfissional,
      tipo_registro: rt.tipoRegistro, especialidade: rt.especialidade,
      telefone: rt.telefone, email: rt.email, documento_art_rrt: rt.documentoArtRrt,
      vigencia_inicio: rt.vigenciaInicio, vigencia_fim: rt.vigenciaFim,
      status: rt.status, observacoes: rt.observacoes,
    });
    setEditingId(rt.id); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (editingId) { await updateRT(editingId, form); toast({ title: "RT atualizado" }); }
    else { await addRT(form); toast({ title: "RT cadastrado" }); }
    setDialogOpen(false);
  };

  // Check for expiring ARTs
  const alertasVencimento = useMemo(() => {
    const hoje = new Date();
    return responsaveisTecnicos.filter(rt => {
      if (!rt.vigenciaFim) return false;
      const fim = new Date(rt.vigenciaFim);
      const diff = (fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 30 && diff >= 0;
    });
  }, [responsaveisTecnicos]);

  return (
    <div className="space-y-4">
      {alertasVencimento.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />Documentos próximos do vencimento
            </div>
            {alertasVencimento.map(rt => (
              <p key={rt.id} className="text-sm text-amber-600 dark:text-amber-500">• {rt.nome} - ART/RRT vence em {rt.vigenciaFim}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Responsáveis Técnicos</h3>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo RT</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Vigência ART</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginate(responsaveisTecnicos, page, pageSize).paginated.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum RT cadastrado</TableCell></TableRow>
            ) : paginate(responsaveisTecnicos, page, pageSize).paginated.map(rt => (
              <TableRow key={rt.id}>
                <TableCell className="font-medium">{rt.nome}</TableCell>
                <TableCell className="font-mono">{rt.registroProfissional || "-"}</TableCell>
                <TableCell>{rt.tipoRegistro}</TableCell>
                <TableCell>{rt.especialidade || "-"}</TableCell>
                <TableCell className="text-xs">{rt.vigenciaInicio && rt.vigenciaFim ? `${rt.vigenciaInicio} a ${rt.vigenciaFim}` : "-"}</TableCell>
                <TableCell><Badge variant={rt.status === "Ativo" ? "default" : "destructive"}>{rt.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(rt)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(rt.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls currentPage={page} totalItems={responsaveisTecnicos.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} Responsável Técnico</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div><Label>Registro Profissional</Label><Input value={form.registro_profissional} onChange={e => setForm(f => ({ ...f, registro_profissional: e.target.value }))} /></div>
            <div><Label>Tipo Registro</Label>
              <Select value={form.tipo_registro} onValueChange={v => setForm(f => ({ ...f, tipo_registro: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_REGISTRO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Especialidade</Label><Input value={form.especialidade} onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            <div className="col-span-2"><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Nº ART/RRT</Label><Input value={form.documento_art_rrt} onChange={e => setForm(f => ({ ...f, documento_art_rrt: e.target.value }))} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Vigência Início</Label><Input type="date" value={form.vigencia_inicio} onChange={e => setForm(f => ({ ...f, vigencia_inicio: e.target.value }))} /></div>
            <div><Label>Vigência Fim</Label><Input type="date" value={form.vigencia_fim} onChange={e => setForm(f => ({ ...f, vigencia_fim: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={() => { if (deleteId && podeExcluir) { deleteRT(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}

// ====================== QUALIDADE DO AR TAB ======================
function QualidadeArTab() {
  const { pontosQA, medicoesQA, addPontoQA, updatePontoQA, deletePontoQA, addMedicaoQA, updateMedicaoQA, deleteMedicaoQA } = usePmoc();
  const { clientes } = useClientes();
  const soClientes = useMemo(() => clientes.filter(c => c.tipo === "Cliente"), [clientes]);
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<"pontos" | "medicoes">("pontos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"ponto" | "medicao">("ponto");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("pmoc.excluir");

  const [pontoForm, setPontoForm] = useState({ descricao: "", cliente_id: "", local_id: "", pavimento_id: "", setor_id: "", tipo_ambiente: "", periodicidade_coleta: "Mensal" });

  // Cascading helpers
  const selectedClienteLocais = useMemo(() => {
    const c = soClientes.find(c => c.id === pontoForm.cliente_id);
    return c?.locais || [];
  }, [soClientes, pontoForm.cliente_id]);

  const selectedLocalPavimentos = useMemo(() => {
    const loc = selectedClienteLocais.find((l: any) => l.id === pontoForm.local_id);
    return loc?.pavimentos || [];
  }, [selectedClienteLocais, pontoForm.local_id]);

  const selectedPavimentoSetores = useMemo(() => {
    const pav = selectedLocalPavimentos.find((p: any) => p.id === pontoForm.pavimento_id);
    return pav?.setores || [];
  }, [selectedLocalPavimentos, pontoForm.pavimento_id]);
  const [medicaoForm, setMedicaoForm] = useState({
    ponto_id: "", ponto_descricao: "", data_medicao: new Date().toISOString().slice(0, 10),
    hora_medicao: "", temperatura: "", umidade: "", co2: "", renovacao_ar: "",
    pressao_diferencial: "", conforme: true, observacoes: "", responsavel: "", plano_acao: "",
    anexos: [] as { nome: string; path: string; url: string; tamanho: number }[],
  });
  const [uploadingAnexo, setUploadingAnexo] = useState(false);

  const openNewPonto = () => { setPontoForm({ descricao: "", cliente_id: "", local_id: "", pavimento_id: "", setor_id: "", tipo_ambiente: "", periodicidade_coleta: "Mensal" }); setEditingId(null); setDialogType("ponto"); setDialogOpen(true); };
  const openEditPonto = (p: any) => { setPontoForm({ descricao: p.descricao, cliente_id: p.clienteId || "", local_id: p.ambiente || "", pavimento_id: p.pavimento || "", setor_id: p.edificio || "", tipo_ambiente: p.tipoAmbiente, periodicidade_coleta: p.periodicidadeColeta }); setEditingId(p.id); setDialogType("ponto"); setDialogOpen(true); };
  const openNewMedicao = () => { setMedicaoForm({ ponto_id: "", ponto_descricao: "", data_medicao: new Date().toISOString().slice(0, 10), hora_medicao: "", temperatura: "", umidade: "", co2: "", renovacao_ar: "", pressao_diferencial: "", conforme: true, observacoes: "", responsavel: "", plano_acao: "", anexos: [] }); setEditingId(null); setDialogType("medicao"); setDialogOpen(true); };
  const openEditMedicao = (m: any) => { setMedicaoForm({ ponto_id: m.pontoId, ponto_descricao: m.pontoDescricao, data_medicao: m.dataMedicao, hora_medicao: m.horaMedicao, temperatura: m.temperatura?.toString() || "", umidade: m.umidade?.toString() || "", co2: m.co2?.toString() || "", renovacao_ar: m.renovacaoAr?.toString() || "", pressao_diferencial: m.pressaoDiferencial?.toString() || "", conforme: m.conforme, observacoes: m.observacoes, responsavel: m.responsavel, plano_acao: m.planoAcao, anexos: Array.isArray(m.anexos) ? m.anexos : [] }); setEditingId(m.id); setDialogType("medicao"); setDialogOpen(true); };

  const handleSave = async () => {
    if (dialogType === "ponto") {
      if (!pontoForm.descricao.trim()) { toast({ title: "Descrição obrigatória", variant: "destructive" }); return; }
      // Resolve names from IDs for storage
      const cliente = soClientes.find(c => c.id === pontoForm.cliente_id);
      const local = (cliente?.locais || []).find((l: any) => l.id === pontoForm.local_id);
      const pav = (local?.pavimentos || []).find((p: any) => p.id === pontoForm.pavimento_id);
      const setor = (pav?.setores || []).find((s: any) => s.id === pontoForm.setor_id);
      const payload = {
        descricao: pontoForm.descricao,
        cliente_id: pontoForm.cliente_id,
        ambiente: pontoForm.local_id, // store local_id in ambiente field
        edificio: pontoForm.setor_id, // store setor_id in edificio field
        pavimento: pontoForm.pavimento_id, // store pavimento_id
        tipo_ambiente: pontoForm.tipo_ambiente,
        periodicidade_coleta: pontoForm.periodicidade_coleta,
      };
      if (editingId) { await updatePontoQA(editingId, payload); toast({ title: "Ponto atualizado" }); }
      else { await addPontoQA(payload); toast({ title: "Ponto cadastrado" }); }
    } else {
      if (!medicaoForm.ponto_id) { toast({ title: "Selecione um ponto", variant: "destructive" }); return; }
      const data = { ...medicaoForm, temperatura: medicaoForm.temperatura ? Number(medicaoForm.temperatura) : null, umidade: medicaoForm.umidade ? Number(medicaoForm.umidade) : null, co2: medicaoForm.co2 ? Number(medicaoForm.co2) : null, renovacao_ar: medicaoForm.renovacao_ar ? Number(medicaoForm.renovacao_ar) : null, pressao_diferencial: medicaoForm.pressao_diferencial ? Number(medicaoForm.pressao_diferencial) : null };
      if (editingId) { await updateMedicaoQA(editingId, data); toast({ title: "Medição atualizada" }); }
      else { await addMedicaoQA(data); toast({ title: "Medição registrada" }); }
    }
    setDialogOpen(false);
  };

  const naoConformes = medicoesQA.filter(m => !m.conforme).length;

  return (
    <div className="space-y-4">
      {naoConformes > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-4 flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /><span className="font-medium">{naoConformes} medição(ões) não conforme(s)</span>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 items-center">
        <Button variant={subTab === "pontos" ? "default" : "outline"} onClick={() => { setSubTab("pontos"); setPage(1); }}>Pontos de Medição</Button>
        <Button variant={subTab === "medicoes" ? "default" : "outline"} onClick={() => { setSubTab("medicoes"); setPage(1); }}>Medições</Button>
        <Button variant="outline" className="ml-auto" onClick={() => downloadPdfPmocQualidadeAr(pontosQA, medicoesQA)}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
      </div>

      {subTab === "pontos" ? (
        <>
          <div className="flex justify-end"><Button onClick={openNewPonto}><Plus className="mr-2 h-4 w-4" />Novo Ponto</Button></div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead>Local</TableHead><TableHead>Pavimento</TableHead><TableHead>Setor</TableHead><TableHead>Periodicidade</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {paginate(pontosQA, page, pageSize).paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum ponto</TableCell></TableRow>
                ) : paginate(pontosQA, page, pageSize).paginated.map(p => {
                  const cli = soClientes.find(c => c.id === p.clienteId);
                  const loc = (cli?.locais || []).find((l: any) => l.id === p.ambiente);
                  const pav = (loc?.pavimentos || []).find((pv: any) => pv.id === p.pavimento);
                  const set = (pav?.setores || []).find((s: any) => s.id === p.edificio);
                  return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.descricao}</TableCell>
                    <TableCell>{cli?.nome || "-"}</TableCell>
                    <TableCell>{loc?.descricao || "-"}</TableCell>
                    <TableCell>{pav?.descricao || "-"}</TableCell>
                    <TableCell>{set?.descricao || "-"}</TableCell>
                    <TableCell>{p.periodicidadeColeta}</TableCell>
                    <TableCell><Badge variant={p.status === "Ativo" ? "default" : "destructive"}>{p.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditPonto(p)}><Pencil className="h-4 w-4" /></Button>
                        {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={page} totalItems={pontosQA.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </>
      ) : (
        <>
          <div className="flex justify-end"><Button onClick={openNewMedicao}><Plus className="mr-2 h-4 w-4" />Nova Medição</Button></div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Ponto</TableHead><TableHead>Temp °C</TableHead><TableHead>Umid %</TableHead><TableHead>CO₂ ppm</TableHead><TableHead>Conforme</TableHead><TableHead>Responsável</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
              <TableBody>
                {paginate(medicoesQA, page, pageSize).paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma medição</TableCell></TableRow>
                ) : paginate(medicoesQA, page, pageSize).paginated.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.dataMedicao}</TableCell>
                    <TableCell>{m.pontoDescricao || "-"}</TableCell>
                    <TableCell>{m.temperatura ?? "-"}</TableCell>
                    <TableCell>{m.umidade ?? "-"}</TableCell>
                    <TableCell>{m.co2 ?? "-"}</TableCell>
                    <TableCell><Badge variant={m.conforme ? "default" : "destructive"}>{m.conforme ? "Sim" : "Não"}</Badge></TableCell>
                    <TableCell>{m.responsavel || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditMedicao(m)}><Pencil className="h-4 w-4" /></Button>
                        {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={page} totalItems={medicoesQA.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} {dialogType === "ponto" ? "Ponto de Medição" : "Medição"}</DialogTitle></DialogHeader>
          {dialogType === "ponto" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Descrição *</Label><Input value={pontoForm.descricao} onChange={e => setPontoForm(f => ({ ...f, descricao: e.target.value }))} /></div>
              <div><Label>Cliente</Label>
                <Select value={pontoForm.cliente_id} onValueChange={v => setPontoForm(f => ({ ...f, cliente_id: v, local_id: "", pavimento_id: "", setor_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{soClientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Local</Label>
                <Select value={pontoForm.local_id} onValueChange={v => setPontoForm(f => ({ ...f, local_id: v, pavimento_id: "", setor_id: "" }))} disabled={!pontoForm.cliente_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{selectedClienteLocais.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Pavimento</Label>
                <Select value={pontoForm.pavimento_id} onValueChange={v => setPontoForm(f => ({ ...f, pavimento_id: v, setor_id: "" }))} disabled={!pontoForm.local_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{selectedLocalPavimentos.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Setor</Label>
                <Select value={pontoForm.setor_id} onValueChange={v => setPontoForm(f => ({ ...f, setor_id: v }))} disabled={!pontoForm.pavimento_id}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{selectedPavimentoSetores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo Ambiente</Label><Input value={pontoForm.tipo_ambiente} onChange={e => setPontoForm(f => ({ ...f, tipo_ambiente: e.target.value }))} /></div>
              <div><Label>Periodicidade</Label>
                <Select value={pontoForm.periodicidade_coleta} onValueChange={v => setPontoForm(f => ({ ...f, periodicidade_coleta: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODICIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Ponto de Medição *</Label>
                <Select value={medicaoForm.ponto_id} onValueChange={v => { const p = pontosQA.find(p => p.id === v); setMedicaoForm(f => ({ ...f, ponto_id: v, ponto_descricao: p?.descricao || "" })); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{pontosQA.map(p => <SelectItem key={p.id} value={p.id}>{p.descricao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data</Label><Input type="date" value={medicaoForm.data_medicao} onChange={e => setMedicaoForm(f => ({ ...f, data_medicao: e.target.value }))} /></div>
              <div><Label>Hora</Label><Input type="time" value={medicaoForm.hora_medicao} onChange={e => setMedicaoForm(f => ({ ...f, hora_medicao: e.target.value }))} /></div>
              <div><Label>Temperatura (°C)</Label><Input type="number" step="0.1" value={medicaoForm.temperatura} onChange={e => setMedicaoForm(f => ({ ...f, temperatura: e.target.value }))} /></div>
              <div><Label>Umidade (%)</Label><Input type="number" step="0.1" value={medicaoForm.umidade} onChange={e => setMedicaoForm(f => ({ ...f, umidade: e.target.value }))} /></div>
              <div><Label>CO₂ (ppm)</Label><Input type="number" value={medicaoForm.co2} onChange={e => setMedicaoForm(f => ({ ...f, co2: e.target.value }))} /></div>
              <div><Label>Renovação Ar</Label><Input type="number" step="0.1" value={medicaoForm.renovacao_ar} onChange={e => setMedicaoForm(f => ({ ...f, renovacao_ar: e.target.value }))} /></div>
              <div><Label>Pressão Diferencial</Label><Input type="number" step="0.1" value={medicaoForm.pressao_diferencial} onChange={e => setMedicaoForm(f => ({ ...f, pressao_diferencial: e.target.value }))} /></div>
              <div><Label>Conforme?</Label>
                <Select value={medicaoForm.conforme ? "true" : "false"} onValueChange={v => setMedicaoForm(f => ({ ...f, conforme: v === "true" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="true">Sim</SelectItem><SelectItem value="false">Não</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Responsável</Label><Input value={medicaoForm.responsavel} onChange={e => setMedicaoForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={medicaoForm.observacoes} onChange={e => setMedicaoForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
              {!medicaoForm.conforme && <div className="col-span-2"><Label>Plano de Ação Corretiva</Label><Textarea value={medicaoForm.plano_acao} onChange={e => setMedicaoForm(f => ({ ...f, plano_acao: e.target.value }))} rows={2} /></div>}
              <div className="col-span-2">
                <Label>Anexos (máx. 3)</Label>
                <div className="space-y-2 mt-1">
                  {medicaoForm.anexos.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm border rounded px-2 py-1">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline">{a.nome}</a>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        await supabase.storage.from("documentos").remove([a.path]);
                        setMedicaoForm(f => ({ ...f, anexos: f.anexos.filter((_, i) => i !== idx) }));
                      }}><X className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                  {medicaoForm.anexos.length < 3 && (
                    <label className={`inline-flex items-center gap-2 cursor-pointer ${uploadingAnexo ? "opacity-50 pointer-events-none" : ""}`}>
                      <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                        <span><Upload className="h-4 w-4" />{uploadingAnexo ? "Enviando..." : "Anexar arquivo"}</span>
                      </Button>
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]; e.target.value = "";
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) { toast({ title: "Arquivo muito grande (máx. 10MB)", variant: "destructive" }); return; }
                          setUploadingAnexo(true);
                          try {
                            const path = `pmoc-medicoes/${Date.now()}_${file.name}`;
                            const { error } = await supabase.storage.from("documentos").upload(path, file);
                            if (error) throw error;
                            const { data: pub } = supabase.storage.from("documentos").getPublicUrl(path);
                            setMedicaoForm(f => ({ ...f, anexos: [...f.anexos, { nome: file.name, path, url: pub.publicUrl, tamanho: file.size }] }));
                          } catch (err) {
                            console.error(err); toast({ title: "Erro ao enviar arquivo", variant: "destructive" });
                          } finally { setUploadingAnexo(false); }
                        }} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={() => { if (deleteId && podeExcluir) { if (subTab === "pontos") deletePontoQA(deleteId); else deleteMedicaoQA(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}

// ====================== INCONFORMIDADES TAB ======================
function InconformidadesTab() {
  const { inconformidades, addInconformidade, updateInconformidade, deleteInconformidade } = usePmoc();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("pmoc.excluir");
  const [form, setForm] = useState({
    descricao: "", gravidade: "Moderada", causa_provavel: "", plano_acao: "",
    prazo: "", responsavel: "", status: "Aberta", ambiente: "",
    equipamento_nome: "", reavaliacao: "",
  });

  const openNew = () => { setForm({ descricao: "", gravidade: "Moderada", causa_provavel: "", plano_acao: "", prazo: "", responsavel: "", status: "Aberta", ambiente: "", equipamento_nome: "", reavaliacao: "" }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (i: any) => { setForm({ descricao: i.descricao, gravidade: i.gravidade, causa_provavel: i.causaProvavel, plano_acao: i.planoAcao, prazo: i.prazo, responsavel: i.responsavel, status: i.status, ambiente: i.ambiente, equipamento_nome: i.equipamentoNome, reavaliacao: i.reavaliacao }); setEditingId(i.id); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.descricao.trim()) { toast({ title: "Descrição obrigatória", variant: "destructive" }); return; }
    if (editingId) { await updateInconformidade(editingId, form); toast({ title: "Inconformidade atualizada" }); }
    else { await addInconformidade(form); toast({ title: "Inconformidade registrada" }); }
    setDialogOpen(false);
  };

  const gravColor = (g: string) => { if (g === "Crítica" || g === "Grave") return "destructive"; return "secondary"; };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Inconformidades</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadPdfPmocInconformidades(inconformidades)}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Inconformidade</Button>
        </div>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Descrição</TableHead><TableHead>Gravidade</TableHead><TableHead>Ambiente</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {paginate(inconformidades, page, pageSize).paginated.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma inconformidade</TableCell></TableRow>
            ) : paginate(inconformidades, page, pageSize).paginated.map(i => (
              <TableRow key={i.id}>
                <TableCell className="font-mono">{i.numero}</TableCell>
                <TableCell className="font-medium">{i.descricao}</TableCell>
                <TableCell><Badge variant={gravColor(i.gravidade) as any}>{i.gravidade}</Badge></TableCell>
                <TableCell>{i.ambiente || "-"}</TableCell>
                <TableCell>{i.responsavel || "-"}</TableCell>
                <TableCell>{i.prazo || "-"}</TableCell>
                <TableCell><Badge variant={i.status === "Encerrada" ? "default" : "secondary"}>{i.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls currentPage={page} totalItems={inconformidades.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Nova"} Inconformidade</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Descrição *</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} /></div>
            <div><Label>Gravidade</Label>
              <Select value={form.gravidade} onValueChange={v => setForm(f => ({ ...f, gravidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GRAVIDADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Aberta">Aberta</SelectItem><SelectItem value="Em Tratamento">Em Tratamento</SelectItem><SelectItem value="Encerrada">Encerrada</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Ambiente</Label><Input value={form.ambiente} onChange={e => setForm(f => ({ ...f, ambiente: e.target.value }))} /></div>
            <div><Label>Equipamento</Label><Input value={form.equipamento_nome} onChange={e => setForm(f => ({ ...f, equipamento_nome: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Causa Provável</Label><Textarea value={form.causa_provavel} onChange={e => setForm(f => ({ ...f, causa_provavel: e.target.value }))} rows={2} /></div>
            <div className="col-span-2"><Label>Plano de Ação</Label><Textarea value={form.plano_acao} onChange={e => setForm(f => ({ ...f, plano_acao: e.target.value }))} rows={2} /></div>
            <div><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} /></div>
            <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Reavaliação</Label><Textarea value={form.reavaliacao} onChange={e => setForm(f => ({ ...f, reavaliacao: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={() => { if (deleteId && podeExcluir) { deleteInconformidade(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}

// ====================== BIBLIOTECA TAB ======================
function BibliotecaTab() {
  const { biblioteca, addRotina, updateRotina, deleteRotina } = usePmoc();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { tem } = usePermissao();
  const podeExcluir = tem("pmoc.excluir");
  const [form, setForm] = useState({
    titulo: "", tipo_equipamento: "", tipo_atividade: "Preventiva",
    descricao: "", periodicidade_sugerida: "Mensal", duracao_estimada: "",
  });

  const openNew = () => { setForm({ titulo: "", tipo_equipamento: "", tipo_atividade: "Preventiva", descricao: "", periodicidade_sugerida: "Mensal", duracao_estimada: "" }); setEditingId(null); setDialogOpen(true); };
  const openEdit = (b: any) => { setForm({ titulo: b.titulo, tipo_equipamento: b.tipoEquipamento, tipo_atividade: b.tipoAtividade, descricao: b.descricao, periodicidade_sugerida: b.periodicidadeSugerida, duracao_estimada: b.duracaoEstimada }); setEditingId(b.id); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.titulo.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    if (editingId) { await updateRotina(editingId, form); toast({ title: "Rotina atualizada" }); }
    else { await addRotina(form); toast({ title: "Rotina criada" }); }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Biblioteca de Rotinas e Modelos</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadPdfPmocBiblioteca(biblioteca)}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Rotina</Button>
        </div>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Tipo Equipamento</TableHead><TableHead>Tipo Atividade</TableHead><TableHead>Periodicidade</TableHead><TableHead>Duração</TableHead><TableHead>Versão</TableHead><TableHead className="w-24">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {paginate(biblioteca, page, pageSize).paginated.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma rotina</TableCell></TableRow>
            ) : paginate(biblioteca, page, pageSize).paginated.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.titulo}</TableCell>
                <TableCell>{b.tipoEquipamento || "-"}</TableCell>
                <TableCell><Badge variant="outline">{b.tipoAtividade}</Badge></TableCell>
                <TableCell>{b.periodicidadeSugerida}</TableCell>
                <TableCell>{b.duracaoEstimada || "-"}</TableCell>
                <TableCell>{b.versao}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    {podeExcluir && <Button variant="ghost" size="icon" onClick={() => requestDelete(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls currentPage={page} totalItems={biblioteca.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Nova"} Rotina</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div><Label>Tipo Equipamento</Label><Input value={form.tipo_equipamento} onChange={e => setForm(f => ({ ...f, tipo_equipamento: e.target.value }))} placeholder="Ex: Split, VRF..." /></div>
            <div><Label>Tipo Atividade</Label>
              <Select value={form.tipo_atividade} onValueChange={v => setForm(f => ({ ...f, tipo_atividade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_ATIVIDADE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Periodicidade Sugerida</Label>
              <Select value={form.periodicidade_sugerida} onValueChange={v => setForm(f => ({ ...f, periodicidade_sugerida: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODICIDADES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Duração Estimada</Label><Input value={form.duracao_estimada} onChange={e => setForm(f => ({ ...f, duracao_estimada: e.target.value }))} placeholder="Ex: 1h30" /></div>
            <div className="col-span-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={o => !o && cancelDelete()} onConfirm={() => { if (deleteId && podeExcluir) { deleteRotina(deleteId); toast({ title: "Excluído" }); cancelDelete(); } }} />
    </div>
  );
}

// ====================== DASHBOARD TAB ======================
function DashboardTab() {
  const { planos, atividades, ordensServico, inconformidades, medicoesQA, responsaveisTecnicos } = usePmoc();
  const { clientes } = useClientes();
  const [filtroCliente, setFiltroCliente] = useState("");

  const planosAtivos = planos.filter(p => p.status === "Ativo").length;
  const osAbertas = ordensServico.filter(o => o.status === "Aberta").length;
  const osExecucao = ordensServico.filter(o => o.status === "Em Execução").length;
  const osConcluidas = ordensServico.filter(o => o.status === "Concluída").length;
  const incAbertas = inconformidades.filter(i => i.status === "Aberta").length;
  const medNaoConformes = medicoesQA.filter(m => !m.conforme).length;

  const hoje = new Date();
  const osVencidas = ordensServico.filter(o => o.dataPrazo && new Date(o.dataPrazo) < hoje && o.status !== "Concluída" && o.status !== "Cancelada").length;

  const totalAtividades = atividades.length;
  const atividadesComExecucao = atividades.filter(a => a.ultimaExecucao).length;
  const percentualExec = totalAtividades > 0 ? Math.round((atividadesComExecucao / totalAtividades) * 100) : 0;

  // Chart data
  const osStatusData = [
    { name: "Abertas", value: osAbertas, color: "#3b82f6" },
    { name: "Em Execução", value: osExecucao, color: "#f59e0b" },
    { name: "Concluídas", value: osConcluidas, color: "#22c55e" },
    { name: "Vencidas", value: osVencidas, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const tipoAtivData = useMemo(() => {
    const counts: Record<string, number> = {};
    atividades.forEach(a => { counts[a.tipo] = (counts[a.tipo] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [atividades]);

  const clientesUnicos = useMemo(() => {
    const names = new Set(planos.map(p => p.clienteNome).filter(Boolean));
    return Array.from(names).sort();
  }, [planos]);

  const reportData = {
    planos, atividades, ordensServico, inconformidades,
    filtroCliente: filtroCliente || undefined,
  };

  return (
    <div className="space-y-6">
      {/* Export controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filtroCliente} onValueChange={v => setFiltroCliente(v === "__all" ? "" : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os clientes</SelectItem>
            {clientesUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => downloadPdfPmoc({ ...reportData, tipo: "geral" })}>
            <Download className="mr-2 h-4 w-4" />PDF Geral
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadExcelPmoc({ ...reportData, tipo: "geral" })}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />Excel Geral
          </Button>
          {filtroCliente && (
            <>
              <Button variant="outline" size="sm" onClick={() => downloadPdfPmoc({ ...reportData, tipo: "cliente" })}>
                <Download className="mr-2 h-4 w-4" />PDF Cliente
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadExcelPmoc({ ...reportData, tipo: "cliente" })}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Excel Cliente
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => downloadPdfPmoc({ ...reportData, tipo: "conformidade" })}>
            <Download className="mr-2 h-4 w-4" />PDF Conformidade
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadExcelPmoc({ ...reportData, tipo: "conformidade" })}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />Excel Conformidade
          </Button>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Planos Ativos</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{planosAtivos}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Atividades Programadas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalAtividades}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">PMOC Executado</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{percentualExec}%</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">RTs Cadastrados</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{responsaveisTecnicos.length}</p></CardContent></Card>
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 dark:border-blue-800"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Wrench className="h-4 w-4" />OS Abertas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">{osAbertas}</p></CardContent></Card>
        <Card className="border-amber-200 dark:border-amber-800"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Activity className="h-4 w-4" />OS em Execução</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{osExecucao}</p></CardContent></Card>
        <Card className="border-green-200 dark:border-green-800"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-4 w-4" />OS Concluídas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{osConcluidas}</p></CardContent></Card>
        <Card className={osVencidas > 0 ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-4 w-4" />OS Vencidas</CardTitle></CardHeader><CardContent><p className={`text-2xl font-bold ${osVencidas > 0 ? "text-red-600" : ""}`}>{osVencidas}</p></CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Ordens de Serviço por Status</CardTitle></CardHeader>
          <CardContent>
            {osStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={osStatusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {osStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Nenhuma OS cadastrada</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Atividades por Tipo</CardTitle></CardHeader>
          <CardContent>
            {tipoAtivData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tipoAtivData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Nenhuma atividade cadastrada</p>}
          </CardContent>
        </Card>
      </div>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={incAbertas > 0 ? "border-amber-500" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Inconformidades Abertas</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{incAbertas}</p></CardContent>
        </Card>
        <Card className={medNaoConformes > 0 ? "border-red-500" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ThermometerSun className="h-4 w-4" />Medições Não Conformes (QAI)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{medNaoConformes}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}

type TabKey = "dashboard" | "planos" | "os" | "inconformidades" | "qa" | "rt" | "biblioteca";

const TAB_GROUPS: { label: string; items: { value: TabKey; label: string; icon: any; hint: string }[] }[] = [
  {
    label: "Visão Geral",
    items: [
      { value: "dashboard", label: "Painel", icon: BarChart3, hint: "Indicadores, OS por status e alertas consolidados" },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { value: "biblioteca", label: "1. Biblioteca de Rotinas", icon: BookOpen, hint: "Modelos reutilizáveis de atividades (opcional, agiliza criação)" },
      { value: "planos", label: "2. Planos de Manutenção", icon: FileText, hint: "Crie o plano, adicione atividades (do zero ou da biblioteca) e vincule equipamentos — tudo em um só lugar" },
    ],
  },
  {
    label: "Execução",
    items: [
      
      { value: "inconformidades", label: "Inconformidades", icon: AlertTriangle, hint: "Não conformidades identificadas nas execuções" },
    ],
  },
  {
    label: "Qualidade & Equipe",
    items: [
      { value: "qa", label: "Qualidade do Ar", icon: Wind, hint: "Pontos de coleta e medições de QAI" },
      { value: "rt", label: "Resp. Técnicos", icon: Users, hint: "Responsáveis técnicos cadastrados (ART/RRT)" },
    ],
  },
];

const TAB_HINTS: Record<TabKey, string> = Object.fromEntries(
  TAB_GROUPS.flatMap(g => g.items.map(i => [i.value, i.hint]))
) as Record<TabKey, string>;

// ====================== MAIN PAGE ======================
export default function PmocPage() {
  const [tab, setTab] = useState<TabKey>("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">PMOC</h1>
        <p className="text-sm text-muted-foreground">Plano de Manutenção, Operação e Controle — gestão completa por cliente e contrato.</p>
      </div>

      {/* Fluxo guiado */}
      <div className="rounded-lg border bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Fluxo recomendado:</span>{" "}
        <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" />Biblioteca de Rotinas</span>
        {" → "}
        <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />Plano de Manutenção (adicionar atividades + vincular equipamentos)</span>
        {" → "}
        <span className="inline-flex items-center gap-1"><Settings className="h-3 w-3" />Plano aparece no cadastro de Equipamentos</span>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabKey)} className="w-full">
        <div className="rounded-lg border bg-card p-3 space-y-2">
          {TAB_GROUPS.map(group => (
            <div key={group.label} className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-full sm:w-32 shrink-0">{group.label}</span>
              <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      title={item.hint}
                    >
                      <Icon className="h-4 w-4" />{item.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3 mb-1 px-1">{TAB_HINTS[tab]}</p>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="planos"><PlanosTab /></TabsContent>
        <TabsContent value="os"><OrdensServicoTab /></TabsContent>
        <TabsContent value="rt"><ResponsaveisTecnicosTab /></TabsContent>
        <TabsContent value="qa"><QualidadeArTab /></TabsContent>
        <TabsContent value="inconformidades"><InconformidadesTab /></TabsContent>
        <TabsContent value="biblioteca"><BibliotecaTab /></TabsContent>
      </Tabs>
    </div>
  );
}
