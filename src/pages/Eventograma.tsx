import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, FileDown, FileSpreadsheet, Pencil, CalendarRange, ListChecks, GanttChartSquare } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEventogramas, type Eventograma, type EventogramaEvento } from "@/contexts/EventogramasContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useRdos } from "@/contexts/RdosContext";
import { useObras } from "@/contexts/ObrasContext";
import { gerarPdfEventograma } from "@/lib/gerarPdfEventograma";
import { gerarExcelEventograma } from "@/lib/gerarExcelEventograma";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

const fmtMoney = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s?: string) => {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

const STATUS_EVENTO = ["Planejado", "Em andamento", "Concluído", "Cancelado"] as const;
const STATUS_EV = ["Em elaboração", "Aprovado", "Em execução", "Concluído", "Cancelado"];

const statusColor: Record<string, string> = {
  "Planejado": "bg-slate-200 text-slate-800",
  "Em andamento": "bg-blue-200 text-blue-900",
  "Concluído": "bg-green-200 text-green-900",
  "Cancelado": "bg-red-200 text-red-900",
};

function novoEvento(ordem: number): EventogramaEvento {
  return {
    id: crypto.randomUUID(),
    ordem,
    marco: "",
    descricao: "",
    prazo: "",
    data_prevista: "",
    data_realizada: "",
    percentual: 0,
    valor: 0,
    criterio_medicao: "",
    status: "Planejado",
    observacao: "",
  };
}

export default function EventogramaPage() {
  const { eventogramas, loading, addEventograma, updateEventograma, deleteEventograma } = useEventogramas();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();
  const { rdos } = useRdos();
  const { obras = [] } = (useObras() as any) || {};
  const { tem } = usePermissao();
  const podeExcluir = tem("eventograma.excluir");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Eventograma | null>(null);
  const [form, setForm] = useState<Partial<Eventograma>>({});
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const [filtro, setFiltro] = useState("");

  const apenasClientes = useMemo(() => clientes.filter((c: any) => c.tipo === "Cliente"), [clientes]);

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
      cliente_id: "", cliente_nome: "", obra: "", descricao: "", responsavel: "",
      contrato_numero: "", data_assinatura: "", valor_total: 0, eventos: [],
      status: "Em elaboração", observacoes: "",
    });
    setEditing(null);
  };

  // Ao escolher a obra, recupera os dados já cadastrados (RDO + cadastro da obra)
  const aplicarObra = (nomeObra: string) => {
    const rdosObra = rdos.filter(
      (r) => r.cliente_id === form.cliente_id && (r.obra || "").trim() === nomeObra,
    );
    const rdo = rdosObra[0];
    const obra = obras.find(
      (o: any) =>
        (rdo?.obra_id && o.id === rdo.obra_id) ||
        (o.cliente_id === form.cliente_id && (o.nome || "").trim() === nomeObra),
    ) as any;

    setForm((f) => {
      const next: Partial<Eventograma> = { ...f, obra: nomeObra };
      const resp = rdo?.responsavel || obra?.responsavel || "";
      if (resp && !f.responsavel) next.responsavel = resp;
      const desc = obra?.descricao || "";
      if (desc && !f.descricao) next.descricao = desc;
      if (obra?.contrato_numero && !f.contrato_numero) next.contrato_numero = obra.contrato_numero;
      if (Number(obra?.valor_total_contrato) && !Number(f.valor_total))
        next.valor_total = Number(obra.valor_total_contrato);
      return next;
    });
    if (rdo || obra) toast.success("Dados da obra recuperados");
  };

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (e: Eventograma) => { setForm({ ...e }); setEditing(e); setOpen(true); };

  const addEvento = () => {
    setForm((f) => ({ ...f, eventos: [...(f.eventos || []), novoEvento((f.eventos?.length || 0) + 1)] }));
  };
  const updEvento = (idx: number, patch: Partial<EventogramaEvento>) => {
    setForm((f) => {
      const ev = [...(f.eventos || [])];
      ev[idx] = { ...ev[idx], ...patch };
      return { ...f, eventos: ev };
    });
  };
  const delEvento = (idx: number) => {
    setForm((f) => ({ ...f, eventos: (f.eventos || []).filter((_, i) => i !== idx) }));
  };

  const distribuirValor = () => {
    const total = Number(form.valor_total) || 0;
    const evs = form.eventos || [];
    if (!total || !evs.length) return;
    const novos = evs.map((e) => ({
      ...e,
      valor: total * ((Number(e.percentual) || 0) / 100),
    }));
    setForm((f) => ({ ...f, eventos: novos }));
    toast.success("Valores distribuídos conforme percentuais");
  };

  const salvar = async () => {
    if (!form.cliente_id || !form.obra) { toast.error("Selecione cliente e obra"); return; }
    if (editing) await updateEventograma(editing.id, form);
    else await addEventograma(form);
    setOpen(false); resetForm();
  };

  const confirmarExcluir = async () => {
    if (deleteId) { await deleteEventograma(deleteId); cancelDelete(); }
  };

  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return eventogramas;
    return eventogramas.filter((e) =>
      [e.cliente_nome, e.obra, e.descricao, String(e.numero), e.contrato_numero].some((v) =>
        (v || "").toLowerCase().includes(q)
      )
    );
  }, [eventogramas, filtro]);

  const totalPct = (form.eventos || []).reduce((s, e) => s + (Number(e.percentual) || 0), 0);
  const totalValor = (form.eventos || []).reduce((s, e) => s + (Number(e.valor) || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">Eventograma</h1>
          <p className="text-muted-foreground">Marcos de execução e medição por obra</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-64" />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Eventograma</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Eventos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loading && lista.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum eventograma cadastrado.</TableCell></TableRow>}
              {lista.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.numero}</TableCell>
                  <TableCell>{e.cliente_nome}</TableCell>
                  <TableCell>{e.obra}</TableCell>
                  <TableCell>{e.contrato_numero || "-"}</TableCell>
                  <TableCell>{fmtMoney(e.valor_total)}</TableCell>
                  <TableCell>{(e.eventos || []).length}</TableCell>
                  <TableCell><Badge variant="outline">{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">Ações</Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(e)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => gerarPdfEventograma(e, empresa)}><FileDown className="h-4 w-4 mr-2" />Exportar PDF</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => gerarExcelEventograma(e)}><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel</DropdownMenuItem>
                        {podeExcluir && <DropdownMenuItem className="text-destructive" onClick={() => requestDelete(e.id)}><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Eventograma Nº ${editing.numero}` : "Novo Eventograma"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <Label>Cliente *</Label>
              <Select
                value={form.cliente_id || ""}
                onValueChange={(v) => {
                  const c = apenasClientes.find((x: any) => x.id === v);
                  setForm((f) => ({ ...f, cliente_id: v, cliente_nome: (c as any)?.razaoSocial || (c as any)?.nome || "", obra: "" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {apenasClientes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.razaoSocial || c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Obra * (do RDO)</Label>
              <Select value={form.obra || ""} onValueChange={aplicarObra} disabled={!form.cliente_id}>
                <SelectTrigger><SelectValue placeholder={form.cliente_id ? (obrasDoCliente.length ? "Selecione a obra" : "Nenhuma obra cadastrada no RDO") : "Selecione o cliente primeiro"} /></SelectTrigger>
                <SelectContent>
                  {obrasDoCliente.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Descrição</Label>
              <Input value={form.descricao || ""} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsavel || ""} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || "Em elaboração"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_EV.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nº Contrato</Label>
              <Input value={form.contrato_numero || ""} onChange={(e) => setForm((f) => ({ ...f, contrato_numero: e.target.value }))} />
            </div>
            <div>
              <Label>Data de assinatura</Label>
              <Input type="date" value={form.data_assinatura || ""} onChange={(e) => setForm((f) => ({ ...f, data_assinatura: e.target.value }))} />
            </div>
            <div>
              <Label>Valor total do contrato (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_total ?? 0} onChange={(e) => setForm((f) => ({ ...f, valor_total: Number(e.target.value.replace(",", ".")) || 0 }))} />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={distribuirValor}>
                Calcular valores pelos %
              </Button>
            </div>
          </div>

          <Tabs defaultValue="tabela" className="mt-4">
            <TabsList>
              <TabsTrigger value="tabela"><ListChecks className="h-4 w-4 mr-1" />Eventos</TabsTrigger>
              <TabsTrigger value="timeline"><GanttChartSquare className="h-4 w-4 mr-1" />Linha do tempo</TabsTrigger>
              <TabsTrigger value="calendario"><CalendarRange className="h-4 w-4 mr-1" />Calendário</TabsTrigger>
            </TabsList>

            <TabsContent value="tabela" className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">Total: <b>{totalPct.toFixed(2)}%</b> — <b>{fmtMoney(totalValor)}</b></div>
                <Button type="button" size="sm" onClick={addEvento}><Plus className="h-4 w-4 mr-1" />Adicionar evento</Button>
              </div>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead className="min-w-[160px]">Marco</TableHead>
                      <TableHead className="min-w-[220px]">Descrição</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Data prevista</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="min-w-[200px]">Critério de medição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data realizada</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(form.eventos || []).map((ev, idx) => (
                      <TableRow key={ev.id}>
                        <TableCell>{ev.ordem}</TableCell>
                        <TableCell><Input value={ev.marco} onChange={(e) => updEvento(idx, { marco: e.target.value })} /></TableCell>
                        <TableCell><Input value={ev.descricao} onChange={(e) => updEvento(idx, { descricao: e.target.value })} /></TableCell>
                        <TableCell><Input value={ev.prazo} placeholder="Mês 1" onChange={(e) => updEvento(idx, { prazo: e.target.value })} /></TableCell>
                        <TableCell><Input type="date" value={ev.data_prevista} onChange={(e) => updEvento(idx, { data_prevista: e.target.value })} /></TableCell>
                        <TableCell className="w-24"><Input type="number" step="0.01" value={ev.percentual} onChange={(e) => updEvento(idx, { percentual: Number(e.target.value.replace(",", ".")) || 0 })} /></TableCell>
                        <TableCell className="w-32"><Input type="number" step="0.01" value={ev.valor} onChange={(e) => updEvento(idx, { valor: Number(e.target.value.replace(",", ".")) || 0 })} /></TableCell>
                        <TableCell><Input value={ev.criterio_medicao} onChange={(e) => updEvento(idx, { criterio_medicao: e.target.value })} /></TableCell>
                        <TableCell>
                          <Select value={ev.status} onValueChange={(v) => updEvento(idx, { status: v as any })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUS_EVENTO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="date" value={ev.data_realizada} onChange={(e) => updEvento(idx, { data_realizada: e.target.value })} /></TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="icon" onClick={() => delEvento(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(form.eventos || []).length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">Adicione os marcos do contrato.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="timeline">
              <div className="relative pl-6 border-l-2 border-primary/30 space-y-4 mt-2">
                {(form.eventos || []).slice().sort((a, b) => (a.data_prevista || "").localeCompare(b.data_prevista || "")).map((ev) => (
                  <div key={ev.id} className="relative">
                    <span className="absolute -left-[29px] top-1.5 h-4 w-4 rounded-full bg-primary border-2 border-background" />
                    <div className="bg-card border rounded-lg p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-semibold">{ev.ordem}. {ev.marco || "(sem marco)"}</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColor[ev.status] || ""}`}>{ev.status}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(ev.data_prevista)}</span>
                        </div>
                      </div>
                      {ev.descricao && <div className="text-sm text-muted-foreground mt-1">{ev.descricao}</div>}
                      <div className="text-xs mt-2 flex flex-wrap gap-3">
                        <span>Prazo: <b>{ev.prazo || "-"}</b></span>
                        <span>%: <b>{(Number(ev.percentual) || 0).toFixed(2)}%</b></span>
                        <span>Valor: <b>{fmtMoney(ev.valor)}</b></span>
                        {ev.criterio_medicao && <span>Medição: <b>{ev.criterio_medicao}</b></span>}
                      </div>
                    </div>
                  </div>
                ))}
                {(form.eventos || []).length === 0 && <div className="text-muted-foreground text-sm">Sem eventos.</div>}
              </div>
            </TabsContent>

            <TabsContent value="calendario">
              <CalendarioEventos eventos={form.eventos || []} />
            </TabsContent>
          </Tabs>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes || ""} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={2} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>{editing ? "Salvar alterações" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(o) => { if (!o) cancelDelete(); }}
        onConfirm={confirmarExcluir}
      />
    </div>
  );
}

function CalendarioEventos({ eventos }: { eventos: EventogramaEvento[] }) {
  const [cursor, setCursor] = useState(() => {
    const d = eventos.find((e) => e.data_prevista)?.data_prevista;
    return d ? new Date(d + "T00:00:00") : new Date();
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));

  const eventosNoDia = (d: Date) => {
    const iso = d.toISOString().slice(0, 10);
    return eventos.filter((e) => e.data_prevista === iso || e.data_realizada === iso);
  };

  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹ Anterior</Button>
        <div className="font-semibold">{meses[month]} / {year}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>Próximo ›</Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-center font-medium text-muted-foreground">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={i} className="min-h-[80px] border rounded-md p-1 text-xs bg-card">
            {d && (
              <>
                <div className="font-medium">{d.getDate()}</div>
                <div className="space-y-1 mt-1">
                  {eventosNoDia(d).map((ev) => (
                    <div key={ev.id} className={`truncate rounded px-1 py-0.5 ${statusColor[ev.status] || "bg-primary/20"}`} title={ev.marco}>
                      {ev.ordem}. {ev.marco}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
