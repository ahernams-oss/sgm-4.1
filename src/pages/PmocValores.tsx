import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableFilter } from "@/components/SearchableFilter";
import { useClientes } from "@/contexts/ClientesContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { gerarPdfFinanceiro, gerarExcelFinanceiro } from "@/lib/gerarRelatoriosFinanceiros";
import { DollarSign, Plus, Trash2, FileSpreadsheet, FileDown, Save } from "lucide-react";

interface Faixa { id?: string; btu_min: number; btu_max: number; valor: number; descricao: string | null; cliente_id?: string | null }
interface Item {
  id: string; equipamento_id: string; data_execucao: string; equipamento_nome: string | null;
  cliente_nome: string | null; local_descricao: string | null; capacidade_btu: number | null;
  valor: number; confirmado_por: string | null;
}

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => d ? d.split("-").reverse().join("/") : "-";
const sb = supabase as any;

export default function PmocValores() {
  const [faixas, setFaixas] = useState<Faixa[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [salvando, setSalvando] = useState(false);
  const hoje = new Date();
  const [dataIni, setDataIni] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState(hoje.toISOString().slice(0, 10));
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [localFiltro, setLocalFiltro] = useState("todos");
  const { clientes } = useClientes();
  const { equipamentos } = useEquipamentos();
  const [clienteTabela, setClienteTabela] = useState("");
  const clientesOrdenados = useMemo(() => [...clientes].filter((c) => c.tipo !== "Fornecedor").sort((a, b) => a.nome.localeCompare(b.nome)), [clientes]);

  const carregarFaixas = async () => {
    const { data, error } = await sb.from("pmoc_precos_btu").select("*").order("btu_min");
    const lista = (data || []).filter((f: Faixa) => (f.cliente_id || "") === clienteTabela);
    if (error) { toast.error("Erro ao carregar a tabela de preços."); return; }
    setFaixas(lista);
  };
  const carregarItens = async () => {
    const { data, error } = await sb.from("pmoc_faturamento_itens").select("*")
      .gte("data_execucao", dataIni).lte("data_execucao", dataFim)
      .order("data_execucao", { ascending: false }).limit(5000);
    if (error) { toast.error("Erro ao carregar as manutenções."); return; }
    setItens(data || []);
  };
  useEffect(() => { carregarFaixas(); }, [clienteTabela]);
  useEffect(() => { carregarItens(); }, [dataIni, dataFim]);
  useEffect(() => { setLocalFiltro("todos"); }, [clienteFiltro]);

  const setFaixa = (i: number, patch: Partial<Faixa>) =>
    setFaixas((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const salvarFaixas = async () => {
    for (const f of faixas) {
      if (!(f.btu_max >= f.btu_min)) { toast.error("O BTU máximo deve ser maior ou igual ao mínimo."); return; }
    }
    setSalvando(true);
    try {
      for (const f of faixas) {
        const row = { btu_min: Number(f.btu_min) || 0, btu_max: Number(f.btu_max) || 0, valor: Number(f.valor) || 0, descricao: f.descricao || null, cliente_id: clienteTabela || null };
        const { error } = f.id
          ? await sb.from("pmoc_precos_btu").update(row).eq("id", f.id)
          : await sb.from("pmoc_precos_btu").insert(row);
        if (error) throw error;
      }
      toast.success("Tabela de preços salva. Vale para as próximas confirmações.");
      await carregarFaixas();
    } catch { toast.error("Erro ao salvar a tabela de preços."); }
    finally { setSalvando(false); }
  };

  const excluirFaixa = async (i: number) => {
    const f = faixas[i];
    if (f.id) {
      const { error } = await sb.from("pmoc_precos_btu").delete().eq("id", f.id);
      if (error) { toast.error("Erro ao excluir a faixa."); return; }
    }
    setFaixas((x) => x.filter((_, idx) => idx !== i));
  };

  const exportarPrecos = async (formato: "pdf" | "excel") => {
    if (!faixas.length) { toast.error("Nenhuma faixa cadastrada para exportar."); return; }
    const nomeCliente = clienteTabela
      ? (clientesOrdenados.find((c) => c.id === clienteTabela)?.nome || "Cliente")
      : "Padrão geral";
    const relatorio = {
      titulo: "PMOC Tabela de Preços (BTUs)",
      subtitulo: `Tabela: ${nomeCliente}`,
      filtros: `Cliente (contrato): ${nomeCliente}`,
      colunas: ["BTU mínimo", "BTU máximo", "Valor (R$)", "Descrição"],
      linhas: faixas.map((f) => [Number(f.btu_min) || 0, Number(f.btu_max) || 0, Number(f.valor) || 0, f.descricao || ""]),
      totais: [{ label: "Faixas cadastradas", valor: String(faixas.length) }],
    };
    try {
      if (formato === "pdf") await gerarPdfFinanceiro(relatorio);
      else await gerarExcelFinanceiro(relatorio);
      toast.success(formato === "pdf" ? "PDF gerado com sucesso." : "Excel gerado com sucesso.");
    } catch {
      toast.error(`Erro ao gerar o ${formato === "pdf" ? "PDF" : "Excel"}.`);
    }
  };

  // Cliente e local: prioriza o cadastro do equipamento; cai para o que foi gravado na manutenção.
  const clienteDoItem = (i: Item) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id);
    return (eq?.clienteNome || i.cliente_nome || "").trim();
  };
  const localDoItem = (i: Item) => {
    const eq = equipamentos.find((e) => e.id === i.equipamento_id);
    return (eq?.localDescricao || i.local_descricao || "").trim();
  };

  const clientesOptions = useMemo(
    () => Array.from(new Set(itens.map(clienteDoItem).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ value: n, label: n })),
    [itens, equipamentos]
  );
  const locaisOptions = useMemo(() => {
    const fonte = clienteFiltro !== "todos" ? itens.filter((i) => clienteDoItem(i) === clienteFiltro) : itens;
    return Array.from(new Set(fonte.map(localDoItem).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ value: n, label: n }));
  }, [itens, equipamentos, clienteFiltro]);

  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (clienteFiltro !== "todos" && clienteDoItem(i) !== clienteFiltro) return false;
      if (localFiltro !== "todos" && localDoItem(i) !== localFiltro) return false;
      return true;
    });
  }, [itens, equipamentos, clienteFiltro, localFiltro]);
  const total = filtrados.reduce((s, i) => s + Number(i.valor || 0), 0);
  const semPreco = filtrados.filter((i) => !Number(i.valor)).length;

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(filtrados.map((i) => ({
      Data: fmtData(i.data_execucao), Cliente: clienteDoItem(i), Local: localDoItem(i),
      Equipamento: i.equipamento_nome || "", BTUs: i.capacidade_btu ?? "", Valor: Number(i.valor) || 0,
      "Confirmado por": i.confirmado_por || "",
    })));
    XLSX.utils.sheet_add_json(ws, [{ Data: "TOTAL", Equipamento: `${filtrados.length} manutenção(ões)`, Valor: total }], { skipHeader: true, origin: -1 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manutenções PMOC");
    XLSX.writeFile(wb, `pmoc-valores-${dataIni}_a_${dataFim}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">PMOC – Valores e Manutenções</h1>
      </div>
      <Tabs defaultValue="manutencoes">
        <TabsList>
          <TabsTrigger value="manutencoes">Manutenções confirmadas</TabsTrigger>
          <TabsTrigger value="precos">Tabela de preços (BTUs)</TabsTrigger>
        </TabsList>

        <TabsContent value="manutencoes" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div><Label>Data início</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></div>
              <div><Label>Data fim</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
              <div>
                <Label>Cliente</Label>
                <SearchableFilter
                  value={clienteFiltro}
                  onChange={setClienteFiltro}
                  options={clientesOptions}
                  allLabel="Todos os clientes"
                  placeholder="Buscar cliente..."
                  className="w-full"
                />
              </div>
              <div>
                <Label>Local</Label>
                <SearchableFilter
                  value={localFiltro}
                  onChange={setLocalFiltro}
                  options={locaisOptions}
                  allLabel="Todos os locais"
                  placeholder="Buscar local..."
                  className="w-full"
                />
              </div>
              <Button variant="outline" onClick={exportar} disabled={!filtrados.length}><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel</Button>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Manutenções</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{filtrados.length}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Valor total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{brl(total)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sem faixa de preço</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{semPreco}</CardContent></Card>
          </div>
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Local</TableHead>
                  <TableHead>Equipamento</TableHead><TableHead>BTUs</TableHead><TableHead>Valor</TableHead><TableHead>Confirmado por</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma manutenção confirmada no período.</TableCell></TableRow>
                  ) : filtrados.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{fmtData(i.data_execucao)}</TableCell>
                      <TableCell>{clienteDoItem(i) || "-"}</TableCell>
                      <TableCell>{localDoItem(i) || "-"}</TableCell>
                      <TableCell>{i.equipamento_nome || "-"}</TableCell>
                      <TableCell>{i.capacidade_btu?.toLocaleString("pt-BR") ?? "-"}</TableCell>
                      <TableCell className={Number(i.valor) ? "" : "text-destructive"}>{brl(i.valor)}</TableCell>
                      <TableCell>{i.confirmado_por || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="precos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valor por equipamento, conforme a capacidade</CardTitle>
              <p className="text-sm text-muted-foreground">Ex.: de 0 a 12.000 BTUs = R$ 65,00. Mudanças valem só para as próximas confirmações; as antigas mantêm o valor da época.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-w-md">
                <Label>Cliente (contrato)</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={clienteTabela} onChange={(e) => setClienteTabela(e.target.value)}>
                  <option value="">Padrão geral (clientes sem tabela própria)</option>
                  {clientesOrdenados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">{clienteTabela ? (faixas.length ? "Tabela própria deste cliente." : "Este cliente ainda usa o padrão geral. Adicione faixas para criar uma tabela própria.") : "Usada quando o cliente não tem faixa própria para a capacidade."}</p>
              </div>
              {faixas.map((f, i) => (
                <div key={f.id || `n${i}`} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_2fr_auto] gap-2 items-end">
                  <div><Label>BTU mínimo</Label><Input type="number" value={f.btu_min} onChange={(e) => setFaixa(i, { btu_min: Number(e.target.value) })} /></div>
                  <div><Label>BTU máximo</Label><Input type="number" value={f.btu_max} onChange={(e) => setFaixa(i, { btu_max: Number(e.target.value) })} /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.valor} onChange={(e) => setFaixa(i, { valor: Number(e.target.value) })} /></div>
                  <div><Label>Descrição</Label><Input value={f.descricao || ""} placeholder="Ar condicionado 12.000 BTUs" onChange={(e) => setFaixa(i, { descricao: e.target.value })} /></div>
                  <Button variant="ghost" size="icon" onClick={() => excluirFaixa(i)} aria-label="Excluir faixa"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => {
                  const ult = faixas[faixas.length - 1];
                  setFaixas([...faixas, { btu_min: ult ? ult.btu_max + 1 : 0, btu_max: ult ? ult.btu_max + 12000 : 12000, valor: 0, descricao: "" }]);
                }}><Plus className="h-4 w-4 mr-2" />Adicionar faixa</Button>
                <Button onClick={salvarFaixas} disabled={salvando}><Save className="h-4 w-4 mr-2" />Salvar tabela</Button>
                <Button variant="outline" onClick={() => exportarPrecos("pdf")} disabled={!faixas.length}><FileDown className="h-4 w-4 mr-2" />Exportar PDF</Button>
                <Button variant="outline" onClick={() => exportarPrecos("excel")} disabled={!faixas.length}><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
