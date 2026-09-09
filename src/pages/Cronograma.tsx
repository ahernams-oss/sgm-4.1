import React, { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileDown, FileSpreadsheet, Pencil, RefreshCw, CalendarRange, FileText, Activity, DollarSign, ListChecks, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CronogramasProvider, useCronogramas, gerarPeriodos, type Cronograma, type CronogramaAtividade } from "@/contexts/CronogramasContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useRdos } from "@/contexts/RdosContext";
import { gerarPdfCronograma } from "@/lib/gerarPdfCronograma";
import { gerarExcelCronograma } from "@/lib/gerarExcelCronograma";
import { baixarModeloAtividades, exportarAtividadesExcel, importarAtividadesExcel } from "@/lib/atividadesCronogramaExcel";

import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

const fmtMoney = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function novaAtividade(ordem: number): CronogramaAtividade {
  return {
    id: crypto.randomUUID(),
    ordem,
    descricao: "",
    unidade: "",
    quantidade: 0,
    peso: 0,
    valor_total: 0,
    modo_financeiro: "distribuido",
    valores: {},
    vincular_rdo: true,
  };
}

function CronogramaInner() {
  const { cronogramas, loading, addCronograma, updateCronograma, deleteCronograma } = useCronogramas();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();
  const { rdos } = useRdos();
  const { tem } = usePermissao();
  const podeExcluir = tem("cronograma.excluir");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cronograma | null>(null);
  const [form, setForm] = useState<Partial<Cronograma>>({});
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const apenasClientes = useMemo(() => clientes.filter((c) => c.tipo === "Cliente"), [clientes]);

  const obrasDoCliente = useMemo(() => {
    if (!form.cliente_id) return [] as string[];
    const set = new Set<string>();
    rdos.forEach((r) => {
      if (r.cliente_id === form.cliente_id && (r.obra || "").trim()) {
        set.add((r.obra || "").trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rdos, form.cliente_id]);

  const resetForm = () => {
    setForm({
      cliente_id: "",
      cliente_nome: "",
      obra: "",
      descricao: "",
      responsavel: "",
      data_inicio: "",
      data_fim: "",
      granularidade: "mensal",
      valor_total: 0,
      atividades: [],
      periodos: [],
      status: "Em Andamento",
      observacoes: "",
    });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = (c: Cronograma) => {
    setForm({ ...c });
    setEditing(c);
    setOpen(true);
  };

  const recalcPeriodos = () => {
    const p = gerarPeriodos(form.data_inicio || "", form.data_fim || "", (form.granularidade as any) || "mensal");
    setForm((f) => ({ ...f, periodos: p }));
    toast.success(`${p.length} períodos gerados`);
  };

  const addAtv = () => {
    setForm((f) => ({ ...f, atividades: [...(f.atividades || []), novaAtividade((f.atividades?.length || 0) + 1)] }));
  };

  const updAtv = (idx: number, patch: Partial<CronogramaAtividade>) => {
    setForm((f) => {
      const atvs = [...(f.atividades || [])];
      atvs[idx] = { ...atvs[idx], ...patch };
      return { ...f, atividades: atvs };
    });
  };

  const delAtv = (idx: number) => {
    setForm((f) => ({ ...f, atividades: (f.atividades || []).filter((_, i) => i !== idx) }));
  };

  const fileAtvRef = useRef<HTMLInputElement>(null);

  const handleExportAtvs = () => {
    const atvs = form.atividades || [];
    if (atvs.length === 0) { toast.error("Nenhuma atividade para exportar."); return; }
    exportarAtividadesExcel(atvs, `Atividades_${form.numero || "Cronograma"}`);
  };

  const handleImportAtvs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const atuais = form.atividades || [];
      const novas = await importarAtividadesExcel(file, atuais.length + 1);
      if (novas.length === 0) { toast.error("Nenhuma atividade válida encontrada na planilha."); return; }
      setForm((f) => ({ ...f, atividades: [...(f.atividades || []), ...novas] }));
      toast.success(`${novas.length} atividade(s) importada(s)`);
    } catch {
      toast.error("Erro ao ler a planilha. Use o modelo de importação.");
    }
  };



  const updValor = (idx: number, periodo: string, campo: "previsto_fisico" | "previsto_financeiro" | "realizado_fisico" | "realizado_financeiro", val: number) => {
    setForm((f) => {
      const atvs = [...(f.atividades || [])];
      const a = { ...atvs[idx] };
      const valores = { ...(a.valores || {}) };
      const cur = valores[periodo] || { previsto_fisico: 0, previsto_financeiro: 0, realizado_fisico: 0, realizado_financeiro: 0 };
      const next = { ...cur, [campo]: val };
      // Realizado R$ calculado pelo Realizado % sobre o Previsto do período
      if (campo === "realizado_fisico" || campo === "previsto_financeiro" || campo === "previsto_fisico") {
        const prevPct = Number(next.previsto_fisico) || 0;
        const prevFin = Number(next.previsto_financeiro) || 0;
        const realPct = Number(next.realizado_fisico) || 0;
        next.realizado_financeiro = prevPct > 0 ? (realPct / prevPct) * prevFin : 0;
      }
      valores[periodo] = next;
      a.valores = valores;
      atvs[idx] = a;
      return { ...f, atividades: atvs };
    });
  };


  // Distribui valor_total proporcional ao previsto físico (modo distribuido)
  const distribuirFinanceiro = (idx: number) => {
    setForm((f) => {
      const atvs = [...(f.atividades || [])];
      const a = { ...atvs[idx] };
      const periodos = f.periodos || [];
      const totalPct = periodos.reduce((s, p) => s + (Number(a.valores?.[p.rotulo]?.previsto_fisico) || 0), 0);
      const valores = { ...(a.valores || {}) };
      periodos.forEach((p) => {
        const cur = valores[p.rotulo] || { previsto_fisico: 0, previsto_financeiro: 0, realizado_fisico: 0, realizado_financeiro: 0 };
        const pct = Number(cur.previsto_fisico) || 0;
        const fin = totalPct > 0 ? (pct / totalPct) * (Number(a.valor_total) || 0) : 0;
        const realFin = pct > 0 ? ((Number(cur.realizado_fisico) || 0) / pct) * fin : 0;
        valores[p.rotulo] = { ...cur, previsto_financeiro: fin, realizado_financeiro: realFin };
      });
      a.valores = valores;
      atvs[idx] = a;
      return { ...f, atividades: atvs };
    });
  };

  // Atualiza realizado físico/financeiro a partir dos RDOs do cliente/obra
  const atualizarPelosRdos = () => {
    if (!form.cliente_id || !form.obra) {
      toast.error("Preencha Cliente e Obra primeiro.");
      return;
    }
    const rdosObra = rdos.filter(
      (r) => r.cliente_id === form.cliente_id && (r.obra || "").trim().toLowerCase() === (form.obra || "").trim().toLowerCase()
    );
    if (rdosObra.length === 0) {
      toast.warning("Nenhum RDO encontrado para essa obra.");
      return;
    }
    const periodos = form.periodos || [];
    setForm((f) => {
      const atvs = (f.atividades || []).map((a) => {
        if (!a.vincular_rdo) return a;
        const valores = { ...(a.valores || {}) };
        periodos.forEach((p) => {
          const dIni = new Date(p.inicio + "T00:00:00").getTime();
          const dFim = new Date(p.fim + "T23:59:59").getTime();
          const rdosPeriodo = rdosObra.filter((r) => {
            const t = new Date((r.data_rdo || r.created_at) + (((r.data_rdo || "").length === 10) ? "T00:00:00" : "")).getTime();
            return t >= dIni && t <= dFim;
          });
          if (rdosPeriodo.length === 0) return;
          // Avanço real = média dos avanços físicos do RDO no período
          const media = rdosPeriodo.reduce((s, r) => s + (Number(r.avanco_fisico_geral) || 0), 0) / rdosPeriodo.length;
          const cur = valores[p.rotulo] || { previsto_fisico: 0, previsto_financeiro: 0, realizado_fisico: 0, realizado_financeiro: 0 };
          // Fração do avanço total atribuída a essa atividade segundo seu peso previsto
          const totalPctPrev = periodos.reduce((s, x) => s + (Number(a.valores?.[x.rotulo]?.previsto_fisico) || 0), 0);
          const pctAtv = totalPctPrev > 0 ? (Number(cur.previsto_fisico) || 0) / totalPctPrev : 0;
          const realFis = media * pctAtv;
          const prevPctPeriodo = Number(cur.previsto_fisico) || 0;
          const realFin = prevPctPeriodo > 0
            ? (realFis / prevPctPeriodo) * (Number(cur.previsto_financeiro) || 0)
            : 0;
          valores[p.rotulo] = { ...cur, realizado_fisico: realFis, realizado_financeiro: realFin };
        });
        return { ...a, valores };
      });
      return { ...f, atividades: atvs };
    });
    toast.success(`Atualizado a partir de ${rdosObra.length} RDO(s).`);
  };

  const salvar = async () => {
    if (!form.cliente_id || !form.obra) {
      toast.error("Cliente e Obra são obrigatórios.");
      return;
    }
    const valorTotal = (form.atividades || []).reduce((s, a) => s + (Number(a.valor_total) || 0), 0);
    const payload = { ...form, valor_total: valorTotal };
    if (editing) await updateCronograma(editing.id, payload);
    else await addCronograma(payload);
    setOpen(false);
    resetForm();
  };

  const periodos = form.periodos || [];
  const atividades = form.atividades || [];

  // KPIs
  const kpiValorTotal = atividades.reduce((s, a) => s + (Number(a.valor_total) || 0), 0);
  const kpiRealFin = atividades.reduce((s, a) =>
    s + Object.values(a.valores || {}).reduce((ss, v) => ss + (Number(v.realizado_financeiro) || 0), 0), 0);
  const kpiAvancoMedio = atividades.length > 0
    ? atividades.reduce((s, a) => {
        const totalReal = Object.values(a.valores || {}).reduce((ss, v) => ss + (Number(v.realizado_fisico) || 0), 0);
        return s + totalReal;
      }, 0) / atividades.length
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Cronograma Físico-Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Planejamento e acompanhamento por obra, integrado aos RDOs.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Cronograma
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Cronogramas Cadastrados</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : cronogramas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cronograma cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {cronogramas.map((c) => {
                const totalReal = (c.atividades || []).reduce((s, a) =>
                  s + Object.values(a.valores || {}).reduce((ss, v) => ss + (Number(v.realizado_financeiro) || 0), 0), 0);
                const pctFin = c.valor_total > 0 ? (totalReal / c.valor_total) * 100 : 0;
                return (
                  <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Nº {c.numero}</Badge>
                        <span className="font-semibold">{c.cliente_nome}</span>
                        <span className="text-muted-foreground">— {c.obra}</span>
                        <Badge>{c.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex gap-4">
                        <span>Valor: {fmtMoney(c.valor_total)}</span>
                        <span>Realizado: {fmtMoney(totalReal)} ({pctFin.toFixed(1)}%)</span>
                        <span>Períodos: {c.periodos?.length || 0}</span>
                        <span>Atividades: {c.atividades?.length || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" title="Exportar PDF">
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => gerarPdfCronograma(c, empresa, "completo")}>
                            <FileText className="h-4 w-4 mr-2" /> Completo (Físico + Financeiro)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => gerarPdfCronograma(c, empresa, "fisico")}>
                            <Activity className="h-4 w-4 mr-2" /> Somente Físico (%)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => gerarPdfCronograma(c, empresa, "financeiro")}>
                            <DollarSign className="h-4 w-4 mr-2" /> Somente Financeiro (R$)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => gerarPdfCronograma(c, empresa, "resumo")}>
                            <ListChecks className="h-4 w-4 mr-2" /> Resumo Executivo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="sm" variant="outline" onClick={() => gerarExcelCronograma(c)} title="Exportar Excel">
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => requestDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cronograma" : "Novo Cronograma"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="dados" className="mt-2">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="periodos">Períodos</TabsTrigger>
              <TabsTrigger value="atividades">Atividades</TabsTrigger>
              <TabsTrigger value="grade">Grade Físico-Financeira</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cliente *</Label>
                  <Select
                    value={form.cliente_id || ""}
                    onValueChange={(v) => {
                      const c = apenasClientes.find((x) => x.id === v);
                      setForm((f) => ({ ...f, cliente_id: v, cliente_nome: c?.nome || "" }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {apenasClientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Obra *</Label>
                  {obrasDoCliente.length > 0 ? (
                    <Select
                      value={form.obra || ""}
                      onValueChange={(v) => setForm((f) => ({ ...f, obra: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a obra do RDO" />
                      </SelectTrigger>
                      <SelectContent>
                        {obrasDoCliente.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.obra || ""}
                      onChange={(e) => setForm((f) => ({ ...f, obra: e.target.value }))}
                      placeholder={form.cliente_id ? "Nenhuma obra em RDO — digite manualmente" : "Selecione o cliente primeiro"}
                    />
                  )}
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input value={form.responsavel || ""} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status || "Em Andamento"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planejado">Planejado</SelectItem>
                      <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                      <SelectItem value="Pausado">Pausado</SelectItem>
                      <SelectItem value="Concluído">Concluído</SelectItem>
                      <SelectItem value="Cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={form.descricao || ""} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes || ""} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="periodos" className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Início *</Label>
                  <Input type="date" value={form.data_inicio || ""} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} />
                </div>
                <div>
                  <Label>Fim *</Label>
                  <Input type="date" value={form.data_fim || ""} onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))} />
                </div>
                <div>
                  <Label>Granularidade</Label>
                  <Select value={form.granularidade || "mensal"} onValueChange={(v: any) => setForm((f) => ({ ...f, granularidade: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={recalcPeriodos} variant="outline" className="gap-2">
                <CalendarRange className="h-4 w-4" /> Gerar/Atualizar Períodos
              </Button>
              {periodos.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {periodos.length} período(s): {periodos.map((p) => p.rotulo).join(" • ")}
                </div>
              )}
            </TabsContent>

            <TabsContent value="atividades" className="space-y-3 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={addAtv} variant="outline" className="gap-2"><Plus className="h-4 w-4" /> Nova Atividade</Button>
                <Button onClick={baixarModeloAtividades} variant="outline" className="gap-2"><FileDown className="h-4 w-4" /> Modelo Excel</Button>
                <Button onClick={() => fileAtvRef.current?.click()} variant="outline" className="gap-2"><Upload className="h-4 w-4" /> Importar Excel</Button>
                <Button onClick={handleExportAtvs} variant="outline" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Exportar Excel</Button>
                <input ref={fileAtvRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportAtvs} />
              </div>
              {atividades.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma atividade.</p>
              )}

              {atividades.map((a, i) => (
                <Card key={a.id}>
                  <CardContent className="pt-4 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-1">
                      <Label className="text-xs">#</Label>
                      <Input value={i + 1} disabled />
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={a.descricao} onChange={(e) => updAtv(i, { descricao: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">Unid.</Label>
                      <Input value={a.unidade} onChange={(e) => updAtv(i, { unidade: e.target.value })} />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-xs">Qtd.</Label>
                      <Input type="number" value={a.quantidade} onChange={(e) => updAtv(i, { quantidade: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Valor Total</Label>
                      <Input type="number" step="0.01" value={a.valor_total} onChange={(e) => updAtv(i, { valor_total: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Modo Financeiro</Label>
                      <Select value={a.modo_financeiro} onValueChange={(v: any) => updAtv(i, { modo_financeiro: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="distribuido">Distribuído</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => delAtv(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="grade" className="pt-4">
              {periodos.length === 0 || atividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Defina períodos e atividades primeiro.</p>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <Button size="sm" variant="outline" onClick={atualizarPelosRdos} className="gap-2">
                      <RefreshCw className="h-4 w-4" /> Atualizar Realizado pelos RDOs
                    </Button>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="text-xs w-full">
                      <thead className="bg-primary text-primary-foreground sticky top-0">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left min-w-[200px]">Atividade</th>
                          <th className="p-2 text-left">Tipo</th>
                          {periodos.map((p) => <th key={p.rotulo} className="p-2 text-center min-w-[90px]">{p.rotulo}</th>)}
                          <th className="p-2 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atividades.map((a, i) => (
                          <React.Fragment key={a.id}>
                            <tr key={`${a.id}-pf`} className="border-t bg-muted/30">
                              <td className="p-1 text-center font-bold" rowSpan={4}>{i + 1}</td>
                              <td className="p-1 font-medium" rowSpan={4}>{a.descricao || "(sem nome)"}</td>
                              <td className="p-1 text-xs font-semibold">Prev. %</td>
                              {periodos.map((p) => (
                                <td key={p.rotulo} className="p-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 text-xs"
                                    value={a.valores?.[p.rotulo]?.previsto_fisico ?? 0}
                                    onChange={(e) => updValor(i, p.rotulo, "previsto_fisico", Number(e.target.value))}
                                  />
                                </td>
                              ))}
                              <td className="p-1 text-center" rowSpan={4}>
                                {a.modo_financeiro === "distribuido" && (
                                  <Button size="sm" variant="ghost" onClick={() => distribuirFinanceiro(i)} title="Distribuir financeiro proporcional">
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                            <tr key={`${a.id}-pfin`} className="bg-muted/30">
                              <td className="p-1 text-xs font-semibold">Prev. R$</td>
                              {periodos.map((p) => (
                                <td key={p.rotulo} className="p-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 text-xs"
                                    value={a.valores?.[p.rotulo]?.previsto_financeiro ?? 0}
                                    onChange={(e) => updValor(i, p.rotulo, "previsto_financeiro", Number(e.target.value))}
                                    disabled={a.modo_financeiro === "distribuido"}
                                  />
                                </td>
                              ))}
                            </tr>
                            <tr key={`${a.id}-rf`}>
                              <td className="p-1 text-xs font-semibold text-green-700">Real. %</td>
                              {periodos.map((p) => (
                                <td key={p.rotulo} className="p-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 text-xs"
                                    value={a.valores?.[p.rotulo]?.realizado_fisico ?? 0}
                                    onChange={(e) => updValor(i, p.rotulo, "realizado_fisico", Number(e.target.value))}
                                  />
                                </td>
                              ))}
                            </tr>
                            <tr key={`${a.id}-rfin`} className="border-b">
                              <td className="p-1 text-xs font-semibold text-green-700">Real. R$</td>
                              {periodos.map((p) => (
                                <td key={p.rotulo} className="p-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 text-xs bg-muted"
                                    readOnly
                                    title="Calculado a partir do Realizado %"
                                    value={Number(a.valores?.[p.rotulo]?.realizado_financeiro ?? 0).toFixed(2)}
                                    onChange={() => {}}
                                  />
                                </td>
                              ))}
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <Card><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="text-lg font-bold text-primary">{fmtMoney(kpiValorTotal)}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Realizado Financeiro</p>
                      <p className="text-lg font-bold text-green-700">{fmtMoney(kpiRealFin)}</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Avanço Médio Físico</p>
                      <p className="text-lg font-bold">{kpiAvancoMedio.toFixed(2)}%</p>
                    </CardContent></Card>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) cancelDelete(); }}
        onConfirm={() => {
          if (!podeExcluir) {
            toast.error("Você não possui permissão para excluir cronogramas.");
            cancelDelete();
            return;
          }
          if (deleteId) deleteCronograma(deleteId);
          cancelDelete();
        }}
      />
    </div>
  );
}

export default function CronogramaPage() {
  return (
    <CronogramasProvider>
      <CronogramaInner />
    </CronogramasProvider>
  );
}
