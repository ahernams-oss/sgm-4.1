import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, FileDown, Pencil, Send, Layers, FileSpreadsheet } from "lucide-react";
import { useBoletinsMedicao, type BoletimMedicao, type BoletimMedicaoFrente } from "@/contexts/BoletinsMedicaoContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useObras } from "@/contexts/ObrasContext";
import { useCronogramas } from "@/contexts/CronogramasContext";
import { gerarPdfBoletimMedicao } from "@/lib/gerarPdfBoletimMedicao";
import { downloadExcelBoletimMedicao } from "@/lib/gerarExcelBoletimMedicao";
import { AssinaturaEletronicaBoletim } from "@/components/AssinaturaEletronicaBoletim";
import { useBoletimAssinaturas } from "@/contexts/BoletimAssinaturasContext";

import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";

const STATUS = ["Em elaboração", "Aprovado", "Enviado ao Cliente", "Faturado", "Cancelado"];

const fmtMoney = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s?: string) => {
  if (!s) return "-";
  const [y, m, d] = String(s).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(s);
};

const statusColor: Record<string, string> = {
  "Em elaboração": "bg-slate-200 text-slate-800",
  "Aprovado": "bg-blue-200 text-blue-900",
  "Enviado ao Cliente": "bg-amber-200 text-amber-900",
  "Faturado": "bg-green-200 text-green-900",
  "Cancelado": "bg-red-200 text-red-900",
};

function novaFrente(): BoletimMedicaoFrente {
  return { id: crypto.randomUUID(), nome: "", valor_contrato: 0, medicoes: [] };
}

export default function BoletimMedicaoPage() {
  const { boletins, loading, addBoletim, updateBoletim, deleteBoletim } = useBoletinsMedicao();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();
  const { obras } = useObras();
  const { cronogramas = [] } = useCronogramas() || {};
  const { porBoletim } = useBoletimAssinaturas();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoletimMedicao | null>(null);
  const [form, setForm] = useState<Partial<BoletimMedicao>>({});
  const [filtro, setFiltro] = useState("");
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const apenasClientes = useMemo(() => clientes.filter((c: any) => c.tipo === "Cliente"), [clientes]);
  const obrasDoCliente = useMemo(
    () => obras.filter((o) => o.cliente_id === form.cliente_id),
    [obras, form.cliente_id],
  );

  const resetForm = () => {
    setForm({
      cliente_id: "", cliente_nome: "", contrato_numero: "", processo_numero: "",
      objeto: "", obra: "", responsavel_tecnico: "", valor_total_contrato: 0,
      data_emissao: new Date().toISOString().slice(0, 10),
      frentes: [], status: "Em elaboração", observacoes: "",
    });
    setEditing(null);
  };

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (b: BoletimMedicao) => { setForm({ ...b, frentes: b.frentes || [] }); setEditing(b); setOpen(true); };

  // Ao selecionar a obra, recupera os dados já cadastrados (obra + cronograma físico-financeiro)
  const aplicarObra = (nomeObra: string) => {
    const obra = obrasDoCliente.find((o) => o.nome === nomeObra);
    const crono = cronogramas.find(
      (c) => c.cliente_id === form.cliente_id && (c.obra || "") === nomeObra,
    );
    setForm((f) => {
      const next: Partial<BoletimMedicao> = { ...f, obra: nomeObra };
      const objeto = obra?.descricao || crono?.descricao || "";
      if (objeto && !f.objeto) next.objeto = objeto;
      const resp = obra?.responsavel || crono?.responsavel || "";
      if (resp && !f.responsavel_tecnico) next.responsavel_tecnico = resp;
      if ((obra as any)?.contrato_numero && !f.contrato_numero) next.contrato_numero = (obra as any).contrato_numero;
      if ((obra as any)?.processo_numero && !f.processo_numero) next.processo_numero = (obra as any).processo_numero;
      if (Number((obra as any)?.valor_total_contrato) && !Number(f.valor_total_contrato))
        next.valor_total_contrato = Number((obra as any).valor_total_contrato);

      const atividades = crono?.atividades || [];
      if (atividades.length && !(f.frentes || []).length) {
        next.frentes = atividades
          .slice()
          .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
          .map((a) => ({
            id: crypto.randomUUID(),
            nome: a.descricao,
            valor_contrato: Number(a.valor_total) || 0,
            medicoes: [],
          }));
      }
      const totalCrono =
        Number(crono?.valor_total) ||
        atividades.reduce((s, a) => s + (Number(a.valor_total) || 0), 0);
      if (totalCrono && !Number(next.valor_total_contrato)) next.valor_total_contrato = totalCrono;
      return next;
    });
    if (obra || crono) toast.success("Dados da obra recuperados");
  };

  const cronogramaAtual = cronogramas.find(
    (c) => c.cliente_id === form.cliente_id && (c.obra || "") === (form.obra || ""),
  );
  const atividadesCronograma = (cronogramaAtual?.atividades || [])
    .slice()
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const setFrentes = (fn: (fs: BoletimMedicaoFrente[]) => BoletimMedicaoFrente[]) =>
    setForm((f) => ({ ...f, frentes: fn(f.frentes || []) }));

  const importarFrentesCronograma = () => {
    if (!atividadesCronograma.length) { toast.error("Nenhuma atividade no cronograma desta obra"); return; }
    setFrentes((fs) => {
      const existentes = new Set(fs.map((f) => f.nome.trim().toLowerCase()));
      const novas = atividadesCronograma
        .filter((a) => !existentes.has((a.descricao || "").trim().toLowerCase()))
        .map((a) => ({
          id: crypto.randomUUID(),
          nome: a.descricao,
          valor_contrato: Number(a.valor_total) || 0,
          medicoes: [],
        }));
      if (!novas.length) toast.info("Todas as atividades já estão nas frentes");
      else toast.success(`${novas.length} frente(s) importada(s) do cronograma`);
      return [...fs.filter((f) => f.nome.trim() || f.medicoes.length), ...novas];
    });
  };

  const addFrente = () => setFrentes((fs) => [...fs, novaFrente()]);

  const updFrente = (idx: number, patch: Partial<BoletimMedicaoFrente>) =>
    setFrentes((fs) => fs.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const delFrente = (idx: number) => setFrentes((fs) => fs.filter((_, i) => i !== idx));

  const addMedicao = (fi: number) =>
    setFrentes((fs) =>
      fs.map((f, i) =>
        i === fi
          ? {
              ...f,
              medicoes: [
                ...f.medicoes,
                { id: crypto.randomUUID(), numero: f.medicoes.length + 1, periodo_inicio: "", periodo_fim: "", valor: 0 },
              ],
            }
          : f,
      ),
    );
  const updMedicao = (fi: number, mi: number, patch: any) =>
    setFrentes((fs) =>
      fs.map((f, i) =>
        i === fi ? { ...f, medicoes: f.medicoes.map((m, j) => (j === mi ? { ...m, ...patch } : m)) } : f,
      ),
    );
  const delMedicao = (fi: number, mi: number) =>
    setFrentes((fs) => fs.map((f, i) => (i === fi ? { ...f, medicoes: f.medicoes.filter((_, j) => j !== mi) } : f)));

  const totalFrentes = (form.frentes || []).reduce((s, f) => s + (Number(f.valor_contrato) || 0), 0);
  const totalMedido = (form.frentes || []).reduce(
    (s, f) => s + f.medicoes.reduce((t, m) => t + (Number(m.valor) || 0), 0),
    0,
  );

  const salvar = async () => {
    if (!form.cliente_id) { toast.error("Selecione o cliente"); return; }
    if (!(form.frentes || []).length) { toast.error("Adicione pelo menos uma frente de obra"); return; }
    const payload = {
      ...form,
      valor_total_contrato: Number(form.valor_total_contrato) || totalFrentes,
    };
    if (editing) await updateBoletim(editing.id, payload);
    else await addBoletim(payload);
    setOpen(false);
    resetForm();
  };

  const marcarEnviado = async (b: BoletimMedicao) => {
    await updateBoletim(b.id, {
      enviado_cliente: true,
      data_envio: new Date().toISOString(),
      status: b.status === "Faturado" ? b.status : "Enviado ao Cliente",
    });
  };

  const baixarPdf = async (b: BoletimMedicao) => {
    try {
      await gerarPdfBoletimMedicao(b, empresa, porBoletim(b.id) as any);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar o PDF do boletim");
    }
  };

  const baixarExcel = (b: BoletimMedicao) => {
    try {
      downloadExcelBoletimMedicao(b, empresa);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar o Excel do boletim");
    }
  };


  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return boletins;
    return boletins.filter((b) =>
      [b.cliente_nome, b.obra, b.objeto, b.contrato_numero, b.processo_numero, String(b.numero)].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
  }, [boletins, filtro]);

  const valorFaturado = (b: BoletimMedicao) =>
    (b.frentes || []).reduce((s, f) => s + (f.medicoes || []).reduce((t, m) => t + (Number(m.valor) || 0), 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-serif font-bold">Boletim de Medições</h1>
          <p className="text-muted-foreground">Resumo consolidado das medições enviado ao cliente para emissão da Nota Fiscal</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-64" />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Boletim</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Boletins emitidos ({lista.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead className="text-right">Vlr. Contrato</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!loading && lista.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum boletim cadastrado</TableCell></TableRow>
              )}
              {lista.map((b) => {
                const fat = valorFaturado(b);
                const contrato = Number(b.valor_total_contrato) || 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{String(b.numero || "").padStart(2, "0")}-{b.ano}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{b.cliente_nome}</TableCell>
                    <TableCell>{b.contrato_numero || "-"}</TableCell>
                    <TableCell>{fmtDate(b.data_emissao)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(contrato)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(fat)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(contrato - fat)}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[b.status] || ""}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button size="icon" variant="ghost" title="Baixar PDF" onClick={() => baixarPdf(b)}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Exportar Excel" onClick={() => baixarExcel(b)}>
                        <FileSpreadsheet className="h-4 w-4 text-green-700" />
                      </Button>

                      <Button size="icon" variant="ghost" title="Marcar como enviado ao cliente" onClick={() => marcarEnviado(b)}>
                        <Send className={`h-4 w-4 ${b.enviado_cliente ? "text-green-600" : ""}`} />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => requestDelete(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Boletim de Medição ${String(editing.numero).padStart(2, "0")}-${editing.ano}` : "Novo Boletim de Medição"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Cliente *</Label>
              <Select
                value={form.cliente_id || ""}
                onValueChange={(v) => {
                  const c = apenasClientes.find((x: any) => x.id === v);
                  setForm((f) => ({ ...f, cliente_id: v, cliente_nome: c?.nome || "" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {apenasClientes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Obra</Label>
              <Select value={form.obra || ""} onValueChange={(v) => aplicarObra(v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                <SelectContent>
                  {obrasDoCliente.map((o) => (
                    <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Objeto do Contrato</Label>
              <Textarea
                rows={3}
                value={form.objeto || ""}
                onChange={(e) => setForm((f) => ({ ...f, objeto: e.target.value }))}
                placeholder="Descrição do objeto contratado"
              />
            </div>
            <div>
              <Label>Contrato Nº</Label>
              <Input value={form.contrato_numero || ""} onChange={(e) => setForm((f) => ({ ...f, contrato_numero: e.target.value }))} />
            </div>
            <div>
              <Label>Processo Nº</Label>
              <Input value={form.processo_numero || ""} onChange={(e) => setForm((f) => ({ ...f, processo_numero: e.target.value }))} />
            </div>
            <div>
              <Label>Responsável Técnico</Label>
              <Input value={form.responsavel_tecnico || ""} onChange={(e) => setForm((f) => ({ ...f, responsavel_tecnico: e.target.value }))} />
            </div>
            <div>
              <Label>Data de Emissão</Label>
              <Input type="date" value={form.data_emissao || ""} onChange={(e) => setForm((f) => ({ ...f, data_emissao: e.target.value }))} />
            </div>
            <div>
              <Label>Valor Total do Contrato (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_total_contrato ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, valor_total_contrato: Number(e.target.value.replace(",", ".")) }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Soma das frentes: {fmtMoney(totalFrentes)}</p>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || "Em elaboração"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4" />Frentes de Obra e Medições</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={importarFrentesCronograma} disabled={!atividadesCronograma.length}>
                  <Layers className="h-4 w-4 mr-1" />Importar do Cronograma
                </Button>
                <Button size="sm" variant="outline" onClick={addFrente}><Plus className="h-4 w-4 mr-1" />Adicionar Frente</Button>
              </div>

            </div>

            {(form.frentes || []).map((fr, fi) => {
              const totFrente = fr.medicoes.reduce((s, m) => s + (Number(m.valor) || 0), 0);
              const pct = fr.valor_contrato > 0 ? (totFrente / Number(fr.valor_contrato)) * 100 : 0;
              return (
                <Card key={fr.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
                      <div>
                        <Label>Frente / Obra</Label>
                        <Input
                          list="atividades-cronograma"
                          value={fr.nome}
                          onChange={(e) => {
                            const nome = e.target.value;
                            const at = atividadesCronograma.find((a) => a.descricao === nome);
                            updFrente(fi, at && !Number(fr.valor_contrato)
                              ? { nome, valor_contrato: Number(at.valor_total) || 0 }
                              : { nome });
                          }}
                          placeholder="Ex.: Impermeabilização Cobertura"
                        />
                        <datalist id="atividades-cronograma">
                          {atividadesCronograma.map((a) => <option key={a.id} value={a.descricao} />)}
                        </datalist>
                      </div>

                      <div>
                        <Label>Valor do Contrato (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={fr.valor_contrato}
                          onChange={(e) => updFrente(fi, { valor_contrato: Number(e.target.value.replace(",", ".")) })}
                        />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => delFrente(fi)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Medição</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead>Fim</TableHead>
                          <TableHead>Valor (R$)</TableHead>
                          <TableHead className="w-20">%</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fr.medicoes.map((m, mi) => (
                          <TableRow key={m.id}>
                            <TableCell>
                              <Input
                                type="number"
                                className="w-20"
                                value={m.numero}
                                onChange={(e) => updMedicao(fi, mi, { numero: Number(e.target.value) })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input type="date" value={m.periodo_inicio || ""} onChange={(e) => updMedicao(fi, mi, { periodo_inicio: e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <Input type="date" value={m.periodo_fim || ""} onChange={(e) => updMedicao(fi, mi, { periodo_fim: e.target.value })} />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                value={m.valor}
                                onChange={(e) => updMedicao(fi, mi, { valor: Number(e.target.value.replace(",", ".")) })}
                              />
                            </TableCell>
                            <TableCell className="text-sm">
                              {fr.valor_contrato > 0
                                ? `${(((Number(m.valor) || 0) / Number(fr.valor_contrato)) * 100).toFixed(2)}%`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => delMedicao(fi, mi)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {fr.medicoes.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm">Nenhuma medição lançada</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between">
                      <Button size="sm" variant="outline" onClick={() => addMedicao(fi)}>
                        <Plus className="h-4 w-4 mr-1" />Adicionar Medição
                      </Button>
                      <div className="text-sm">
                        <span className="text-muted-foreground mr-2">Faturado:</span>
                        <span className="font-semibold">{fmtMoney(totFrente)} ({pct.toFixed(2)}%)</span>
                        <span className="text-muted-foreground mx-2">|</span>
                        <span className="text-muted-foreground mr-2">Saldo:</span>
                        <span className="font-semibold">{fmtMoney((Number(fr.valor_contrato) || 0) - totFrente)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {(form.frentes || []).length === 0 && (
              <p className="text-sm text-muted-foreground">Adicione ao menos uma frente de obra para lançar as medições.</p>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes || ""} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm flex flex-wrap gap-6">
            <span>Total Contrato: <strong>{fmtMoney(Number(form.valor_total_contrato) || totalFrentes)}</strong></span>
            <span>Total Faturado: <strong>{fmtMoney(totalMedido)}</strong></span>
            <span>Saldo a Faturar: <strong>{fmtMoney((Number(form.valor_total_contrato) || totalFrentes) - totalMedido)}</strong></span>
          </div>

          {editing?.id && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Assinaturas Eletrônicas (Lei nº 14.063/2020)</h3>
              <p className="text-xs text-muted-foreground">
                Assinatura avançada: exige confirmação de senha e token de 6 dígitos enviado ao e-mail do signatário.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {(["responsavel", "fiscalizacao", "gestor"] as const).map((p) => (
                  <AssinaturaEletronicaBoletim
                    key={p}
                    boletim={{ ...(form as BoletimMedicao), id: editing.id, numero: editing.numero, ano: editing.ano }}
                    papel={p}
                    assinaturaExistente={porBoletim(editing.id).find((a) => a.papel === p)}
                  />
                ))}
              </div>
            </div>
          )}


          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>{editing ? "Salvar Alterações" : "Criar Boletim"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) cancelDelete(); }}
        onConfirm={async () => { if (deleteId) { await deleteBoletim(deleteId); cancelDelete(); } }}
        title="Excluir Boletim de Medição"
      />
    </div>
  );
}
