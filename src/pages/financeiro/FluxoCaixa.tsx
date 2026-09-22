import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinanceiro, formatBRL, formatDate, type FluxoAjuste } from "@/contexts/FinanceiroContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Agrupamento = "dia" | "semana" | "mes";

const iso = (d: Date) => d.toISOString().slice(0, 10);

const inicioSemana = (dataIso: string) => {
  const d = new Date(dataIso + "T00:00:00");
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
};

const rotuloPeriodo = (chave: string, agrup: Agrupamento) => {
  if (agrup === "mes") {
    const [a, m] = chave.split("-");
    return `${m}/${a}`;
  }
  if (agrup === "semana") return `Semana de ${formatDate(chave)}`;
  return formatDate(chave);
};

interface Buckets {
  entradas: number;
  saidas: number;
  entradasReal: number;
  saidasReal: number;
  ajustes: number;
}

const vazio = (): Buckets => ({ entradas: 0, saidas: 0, entradasReal: 0, saidasReal: 0, ajustes: 0 });

export default function FluxoCaixa() {
  const {
    contasPagar, contasReceber, lancamentos, contasBancarias, saldoConta,
    fluxoAjustes, addFluxoAjuste, updateFluxoAjuste, deleteFluxoAjuste,
  } = useFinanceiro();

  const [conta, setConta] = useState("todas");
  const hoje = iso(new Date());
  const [ini, setIni] = useState(hoje);
  const [fim, setFim] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 60); return iso(d); });
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("dia");
  const [somenteComMovimento, setSomenteComMovimento] = useState(true);

  // saldo inicial ajustável (por conta)
  const saldoCalculado = conta === "todas"
    ? contasBancarias.reduce((s, c) => s + saldoConta(c.id), 0)
    : saldoConta(conta);
  const chaveSaldo = `fluxo_caixa_saldo_inicial_${conta}`;
  const [saldoOverride, setSaldoOverride] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSaldoOverride(window.localStorage.getItem(chaveSaldo) ?? "");
  }, [chaveSaldo]);

  const salvarOverride = (v: string) => {
    setSaldoOverride(v);
    if (typeof window === "undefined") return;
    if (v === "") window.localStorage.removeItem(chaveSaldo);
    else window.localStorage.setItem(chaveSaldo, v);
  };

  const saldoInicial = saldoOverride !== "" && !Number.isNaN(Number(saldoOverride))
    ? Number(saldoOverride)
    : saldoCalculado;

  const aplicarPeriodo = (dias: number) => {
    setIni(hoje);
    const d = new Date(); d.setDate(d.getDate() + dias); setFim(iso(d));
  };
  const aplicarMesAtual = () => {
    const d = new Date();
    setIni(iso(new Date(d.getFullYear(), d.getMonth(), 1)));
    setFim(iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)));
  };

  const chaveDe = (data: string) =>
    agrupamento === "mes" ? data.slice(0, 7) : agrupamento === "semana" ? inicioSemana(data) : data;

  const periodos = useMemo(() => {
    const map = new Map<string, Buckets>();
    const add = (data: string, k: keyof Buckets, v: number) => {
      const chave = chaveDe(data);
      if (!map.has(chave)) map.set(chave, vazio());
      map.get(chave)![k] += v;
    };

    contasPagar.forEach(c => {
      if (c.status === "cancelada" || c.status === "paga") return;
      if (c.data_vencimento >= ini && c.data_vencimento <= fim) {
        const restante = Number(c.valor_total) - Number(c.valor_pago);
        if (restante > 0) add(c.data_vencimento, "saidas", restante);
      }
    });
    contasReceber.forEach(c => {
      if (c.status === "cancelada" || c.status === "recebida") return;
      if (c.data_vencimento >= ini && c.data_vencimento <= fim) {
        const restante = Number(c.valor_total) - Number(c.valor_recebido);
        if (restante > 0) add(c.data_vencimento, "entradas", restante);
      }
    });
    lancamentos.forEach(l => {
      if (l.data < ini || l.data > fim) return;
      if (conta !== "todas" && l.conta_bancaria_id !== conta && l.conta_destino_id !== conta) return;
      if (l.tipo === "entrada") add(l.data, "entradasReal", Number(l.valor));
      else if (l.tipo === "saida") add(l.data, "saidasReal", Number(l.valor));
    });
    fluxoAjustes.forEach(a => {
      if (a.data < ini || a.data > fim) return;
      if (conta !== "todas" && a.conta_bancaria_id && a.conta_bancaria_id !== conta) return;
      add(a.data, "ajustes", a.tipo === "saida" ? -Number(a.valor) : Number(a.valor));
    });

    let lista = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (!somenteComMovimento) return lista;
    lista = lista.filter(([, v]) => v.entradas || v.saidas || v.entradasReal || v.saidasReal || v.ajustes);
    return lista;
  }, [contasPagar, contasReceber, lancamentos, fluxoAjustes, ini, fim, conta, agrupamento, somenteComMovimento]);

  let saldoCorrente = saldoInicial;

  const ajustesPeriodo = useMemo(
    () => fluxoAjustes
      .filter(a => a.data >= ini && a.data <= fim)
      .filter(a => conta === "todas" || !a.conta_bancaria_id || a.conta_bancaria_id === conta)
      .sort((a, b) => a.data.localeCompare(b.data)),
    [fluxoAjustes, ini, fim, conta],
  );

  // diálogo de ajustes
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<FluxoAjuste | null>(null);
  const [fData, setFData] = useState(hoje);
  const [fTipo, setFTipo] = useState<"entrada" | "saida">("entrada");
  const [fDescricao, setFDescricao] = useState("");
  const [fValor, setFValor] = useState("");
  const [fConta, setFConta] = useState("nenhuma");
  const [fObs, setFObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const abrirNovo = () => {
    setEditando(null);
    setFData(hoje); setFTipo("entrada"); setFDescricao(""); setFValor("");
    setFConta(conta === "todas" ? "nenhuma" : conta); setFObs("");
    setDialogAberto(true);
  };

  const abrirEdicao = (a: FluxoAjuste) => {
    setEditando(a);
    setFData(a.data); setFTipo(a.tipo); setFDescricao(a.descricao);
    setFValor(String(a.valor)); setFConta(a.conta_bancaria_id || "nenhuma"); setFObs(a.observacao || "");
    setDialogAberto(true);
  };

  const salvar = async () => {
    if (!fDescricao.trim()) { toast.error("Informe a descrição do ajuste."); return; }
    const valor = Number(fValor);
    if (!valor || Number.isNaN(valor)) { toast.error("Informe um valor válido."); return; }
    setSalvando(true);
    try {
      const payload = {
        data: fData,
        tipo: fTipo,
        descricao: fDescricao.trim(),
        valor: Math.abs(valor),
        conta_bancaria_id: fConta === "nenhuma" ? null : fConta,
        observacao: fObs.trim() || null,
      };
      if (editando) await updateFluxoAjuste(editando.id, payload);
      else await addFluxoAjuste(payload);
      toast.success(editando ? "Ajuste atualizado." : "Ajuste lançado.");
      setDialogAberto(false);
    } catch {
      toast.error("Não foi possível salvar o ajuste.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (a: FluxoAjuste) => {
    if (!window.confirm("Excluir este ajuste?")) return;
    try {
      await deleteFluxoAjuste(a.id);
      toast.success("Ajuste excluído.");
    } catch {
      toast.error("Não foi possível excluir o ajuste.");
    }
  };

  const nomeConta = (id?: string | null) => contasBancarias.find(c => c.id === id)?.nome || "Todas";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-serif font-semibold">Fluxo de Caixa</h1>
        <Button onClick={abrirNovo} size="sm"><Plus className="h-4 w-4 mr-1" /> Novo ajuste</Button>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Conta</Label>
              <Select value={conta} onValueChange={setConta}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as contas</SelectItem>
                  {contasBancarias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={ini} onChange={e => setIni(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Agrupar por</Label>
              <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Dia</SelectItem>
                  <SelectItem value="semana">Semana</SelectItem>
                  <SelectItem value="mes">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Saldo inicial</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  className="w-40"
                  placeholder={String(saldoCalculado.toFixed(2))}
                  value={saldoOverride}
                  onChange={e => salvarOverride(e.target.value)}
                />
                <Button variant="ghost" size="icon" title="Voltar ao saldo calculado" onClick={() => salvarOverride("")}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => aplicarPeriodo(30)}>Próx. 30 dias</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarPeriodo(60)}>Próx. 60 dias</Button>
            <Button variant="outline" size="sm" onClick={() => aplicarPeriodo(90)}>Próx. 90 dias</Button>
            <Button variant="outline" size="sm" onClick={aplicarMesAtual}>Mês atual</Button>
            <Button variant="outline" size="sm" onClick={() => setSomenteComMovimento(v => !v)}>
              {somenteComMovimento ? "Mostrar todos os períodos" : "Somente com movimento"}
            </Button>
            <CardTitle className="text-base ml-auto">
              Saldo inicial da projeção: {formatBRL(saldoInicial)}
              {saldoOverride !== "" && <span className="ml-2 text-xs font-normal text-muted-foreground">(ajustado manualmente)</span>}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Entradas Previstas</TableHead>
                <TableHead className="text-right">Saídas Previstas</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Ajustes</TableHead>
                <TableHead className="text-right">Saldo Projetado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodos.map(([chave, v]) => {
                saldoCorrente += v.entradas + v.entradasReal - v.saidas - v.saidasReal + v.ajustes;
                return (
                  <TableRow key={chave}>
                    <TableCell className="tabular-nums">{rotuloPeriodo(chave, agrupamento)}</TableCell>
                    <TableCell className="text-right text-emerald-600 tabular-nums">{v.entradas ? formatBRL(v.entradas) : "—"}</TableCell>
                    <TableCell className="text-right text-red-600 tabular-nums">{v.saidas ? formatBRL(v.saidas) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{(v.entradasReal - v.saidasReal) ? formatBRL(v.entradasReal - v.saidasReal) : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums ${v.ajustes < 0 ? "text-red-600" : v.ajustes > 0 ? "text-emerald-600" : ""}`}>{v.ajustes ? formatBRL(v.ajustes) : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${saldoCorrente < 0 ? "text-red-600" : ""}`}>{formatBRL(saldoCorrente)}</TableCell>
                  </TableRow>
                );
              })}
              {periodos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem movimento previsto no período.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Ajustes manuais do período</CardTitle>
          <Button variant="outline" size="sm" onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" /> Novo ajuste</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ajustesPeriodo.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="tabular-nums">{formatDate(a.data)}</TableCell>
                  <TableCell>{a.descricao}{a.observacao && <span className="block text-xs text-muted-foreground">{a.observacao}</span>}</TableCell>
                  <TableCell>{nomeConta(a.conta_bancaria_id)}</TableCell>
                  <TableCell>{a.tipo === "saida" ? "Saída" : "Entrada"}</TableCell>
                  <TableCell className={`text-right tabular-nums ${a.tipo === "saida" ? "text-red-600" : "text-emerald-600"}`}>{formatBRL(Number(a.valor))}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => excluir(a)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {ajustesPeriodo.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum ajuste lançado no período.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editando ? "Editar ajuste" : "Novo ajuste"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={fData} onChange={e => setFData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={fTipo} onValueChange={(v) => setFTipo(v as "entrada" | "saida")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={fDescricao} onChange={e => setFDescricao(e.target.value)} placeholder="Ex.: Previsão de aporte" />
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={fValor} onChange={e => setFValor(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Conta</Label>
              <Select value={fConta} onValueChange={setFConta}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Todas as contas</SelectItem>
                  {contasBancarias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={fObs} onChange={e => setFObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
