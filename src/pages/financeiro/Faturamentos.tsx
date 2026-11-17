import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, BarChart3, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useClientes, type Faturamento, type Contrato, type Cliente } from "@/contexts/ClientesContext";
import { usePermissao } from "@/hooks/usePermissao";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useNavigate } from "@/lib/router-compat";
import RelatorioSaldosContratoDialog from "@/components/RelatorioSaldosContratoDialog";

interface Row {
  clienteId: string;
  clienteNome: string;
  contratoNumero: string;
  faturamento: Faturamento;
}

const formatCurrency = (val?: string) => {
  if (!val) return "—";
  const num = parseFloat(String(val).replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (d?: string) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export default function Faturamentos() {
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podeVerFolha = tem("clientes.ver_valor_folha");
  const navigate = useNavigate();

  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openSaldos, setOpenSaldos] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const all: Row[] = [];
    (clientes as Cliente[]).forEach((c) => {
      (c.contratos || []).forEach((ct: Contrato) => {
        (ct.faturamentos || []).forEach((f) => {
          all.push({
            clienteId: c.id,
            clienteNome: c.nome || c.nomeFantasia || "—",
            contratoNumero: ct.numero || "—",
            faturamento: f,
          });
        });
      });
    });
    return all.sort((a, b) => (b.faturamento.periodoFim || "").localeCompare(a.faturamento.periodoFim || ""));
  }, [clientes]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroCliente !== "todos" && r.clienteId !== filtroCliente) return false;
      if (filtroStatus === "pago" && !r.faturamento.pago) return false;
      if (filtroStatus === "pendente" && r.faturamento.pago) return false;
      if (dataIni && (r.faturamento.periodoFim || "") < dataIni) return false;
      if (dataFim && (r.faturamento.periodoInicio || "") > dataFim) return false;
      if (q) {
        const hay = [
          r.clienteNome, r.contratoNumero,
          r.faturamento.numeroNf, r.faturamento.processoNf, r.faturamento.numeroMedicao,
          r.faturamento.descricao, r.faturamento.chaveNf,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, busca, filtroCliente, filtroStatus, dataIni, dataFim]);

  const totais = useMemo(() => {
    const parse = (v?: string) => parseFloat(String(v || "0").replace(/\./g, "").replace(",", ".")) || 0;
    return filtradas.reduce(
      (acc, r) => {
        acc.bruto += parse(r.faturamento.valorBruto);
        acc.liquido += parse(r.faturamento.valorLiquido);
        acc.folha += parse(r.faturamento.valorFolha);
        acc.variavel += parse(r.faturamento.valorVariavel);
        return acc;
      },
      { bruto: 0, liquido: 0, folha: 0, variavel: 0 }
    );
  }, [filtradas]);

  const { paginated: pageRows } = paginate(filtradas, page, pageSize);
  const clientesLista = useMemo(
    () => (clientes as Cliente[]).filter((c) => c.tipo === "Cliente").sort((a, b) => (a.nome || "").localeCompare(b.nome || "")),
    [clientes]
  );

  const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


  type RelKey = "analitico" | "sintetico" | "cliente" | "contrato" | "mes" | "pagos" | "pendentes";
  const RELATORIOS: { key: RelKey; label: string }[] = [
    { key: "analitico", label: "Analítico (detalhado)" },
    { key: "sintetico", label: "Sintético (resumido)" },
    { key: "cliente", label: "Resumo por Cliente" },
    { key: "contrato", label: "Resumo por Contrato" },
    { key: "mes", label: "Resumo por Mês" },
    { key: "pagos", label: "Faturamentos Pagos" },
    { key: "pendentes", label: "Faturamentos Pendentes" },
  ];
  const parseV = (v?: string) => parseFloat(String(v || "0").replace(/\./g, "").replace(",", ".")) || 0;
  const relFiltrosTexto = () => {
    const partes: string[] = [];
    if (filtroCliente !== "todos") partes.push(`Cliente: ${clientesLista.find(c => c.id === filtroCliente)?.nome || ""}`);
    if (filtroStatus !== "todos") partes.push(`Situação: ${filtroStatus === "pago" ? "Pago" : "Pendente"}`);
    if (dataIni) partes.push(`De: ${formatDate(dataIni)}`);
    if (dataFim) partes.push(`Até: ${formatDate(dataFim)}`);
    if (busca.trim()) partes.push(`Busca: ${busca.trim()}`);
    return partes.join(" | ") || "Todos os registros";
  };
  const resumir = (lista: Row[], chave: (r: Row) => string, titulo: string, rotulo: string) => {
    const m = new Map<string, { qtd: number; bruto: number; liquido: number; pagos: number }>();
    lista.forEach(r => {
      const k = chave(r) || "—";
      const a = m.get(k) || { qtd: 0, bruto: 0, liquido: 0, pagos: 0 };
      a.qtd++; a.bruto += parseV(r.faturamento.valorBruto); a.liquido += parseV(r.faturamento.valorLiquido);
      if (r.faturamento.pago) a.pagos++;
      m.set(k, a);
    });
    const linhas = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const tot = linhas.reduce((t, [, v]) => ({ qtd: t.qtd + v.qtd, bruto: t.bruto + v.bruto, liquido: t.liquido + v.liquido, pagos: t.pagos + v.pagos }), { qtd: 0, bruto: 0, liquido: 0, pagos: 0 });
    return {
      titulo, cols: [rotulo, "Qtd", "Pagos", "Pendentes", "Valor Bruto", "Valor Líquido"],
      rows: [...linhas.map(([k, v]) => [k, String(v.qtd), String(v.pagos), String(v.qtd - v.pagos), fmtBRL(v.bruto), fmtBRL(v.liquido)]),
        ...(linhas.length ? [["TOTAL", String(tot.qtd), String(tot.pagos), String(tot.qtd - tot.pagos), fmtBRL(tot.bruto), fmtBRL(tot.liquido)]] : [])],
    };
  };
  const analitico = (lista: Row[], titulo: string) => {
    const cols = ["Cliente", "Contrato", "Período", "Medição", "NF", "Processo", "Valor Bruto", "Valor Líquido", ...(podeVerFolha ? ["Valor Folha", "Valor Variável"] : []), "Situação", "Data Pagamento"];
    const rows = lista.map(r => { const f = r.faturamento as any; return [
      r.clienteNome, r.contratoNumero, `${formatDate(f.periodoInicio)} a ${formatDate(f.periodoFim)}`, f.numeroMedicao || "—", f.numeroNf || "—", f.processoNf || "—",
      formatCurrency(f.valorBruto), formatCurrency(f.valorLiquido), ...(podeVerFolha ? [formatCurrency(f.valorFolha), formatCurrency(f.valorVariavel)] : []),
      f.pago ? "Pago" : "Pendente", f.dataPagamento ? formatDate(f.dataPagamento) : "—"]; });
    if (rows.length) {
      const t = lista.reduce((a, r) => ({ b: a.b + parseV(r.faturamento.valorBruto), l: a.l + parseV(r.faturamento.valorLiquido), fo: a.fo + parseV(r.faturamento.valorFolha), v: a.v + parseV(r.faturamento.valorVariavel) }), { b: 0, l: 0, fo: 0, v: 0 });
      rows.push(["TOTAL", "", "", "", "", "", fmtBRL(t.b), fmtBRL(t.l), ...(podeVerFolha ? [fmtBRL(t.fo), fmtBRL(t.v)] : []), "", ""]);
    }
    return { titulo, cols, rows };
  };
  const montarRelatorio = (key: RelKey) => {
    switch (key) {
      case "analitico": return analitico(filtradas, "Faturamentos - Analítico");
      case "pagos": return analitico(filtradas.filter(r => r.faturamento.pago), "Faturamentos Pagos");
      case "pendentes": return analitico(filtradas.filter(r => !r.faturamento.pago), "Faturamentos Pendentes");
      case "sintetico": {
        const rows = filtradas.map(r => [r.clienteNome, r.contratoNumero, formatDate(r.faturamento.periodoFim), r.faturamento.numeroNf || "—", formatCurrency(r.faturamento.valorLiquido), r.faturamento.pago ? "Pago" : "Pendente"]);
        return { titulo: "Faturamentos - Sintético", cols: ["Cliente", "Contrato", "Fim do Período", "NF", "Valor Líquido", "Situação"], rows };
      }
      case "cliente": return resumir(filtradas, r => r.clienteNome, "Faturamentos - Resumo por Cliente", "Cliente");
      case "contrato": return resumir(filtradas, r => `${r.clienteNome} - ${r.contratoNumero}`, "Faturamentos - Resumo por Contrato", "Cliente / Contrato");
      case "mes": return resumir(filtradas, r => (r.faturamento.periodoFim || "").slice(0, 7).split("-").reverse().join("/"), "Faturamentos - Resumo por Mês", "Mês/Ano (fim do período)");
    }
  };
  const exportarRelatorio = async (key: RelKey, tipo: "pdf" | "excel") => {
    const { titulo, cols, rows } = montarRelatorio(key);
    if (rows.length === 0) { toast.error("Nenhum registro na listagem atual."); return; }
    const mod = await import("@/lib/gerarRelatorioEstoque");
    if (tipo === "pdf") await mod.gerarPdfEstoque(titulo, cols, rows, relFiltrosTexto());
    else await mod.gerarExcelEstoque(titulo, cols, rows, relFiltrosTexto());
  };

  return (
    <div className="container max-w-full mx-auto px-4 py-6 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Financeiro</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">Faturamentos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento consolidado de todos os faturamentos lançados por cliente e contrato.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><FileText className="h-4 w-4 mr-2" /> Relatórios <ChevronDown className="h-4 w-4 ml-2" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {RELATORIOS.map(r => (
              <div key={r.key} className="flex items-center justify-between gap-2 px-2 py-1 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => exportarRelatorio(r.key, "pdf")}>PDF</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => exportarRelatorio(r.key, "excel")}>Excel</Button>
                </span>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={() => setOpenSaldos(true)} variant="default">
          <BarChart3 className="h-4 w-4 mr-2" /> Relatório de Saldos
        </Button>
        </div>
      </div>

      <RelatorioSaldosContratoDialog open={openSaldos} onOpenChange={setOpenSaldos} />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Valor Bruto</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{fmtBRL(totais.bruto)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Valor Líquido</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{fmtBRL(totais.liquido)}</CardContent></Card>
        {podeVerFolha && (
          <>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Valor Folha</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{fmtBRL(totais.folha)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Valor Variável</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{fmtBRL(totais.variavel)}</CardContent></Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <Input placeholder="Buscar (NF, processo, medição, descrição...)" value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} />
          <Select value={filtroCliente} onValueChange={(v) => { setFiltroCliente(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientesLista.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome || c.nomeFantasia}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dataIni} onChange={(e) => { setDataIni(e.target.value); setPage(1); }} title="Período de" />
          <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(1); }} title="Período até" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Cliente</TableHead>
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Contrato</TableHead>
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Período</TableHead>
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Nº Medição</TableHead>
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Nº NF</TableHead>
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Processo da NF</TableHead>
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Emissão</TableHead>
                <TableHead className="px-4 sm:px-6 text-right whitespace-nowrap">Bruto</TableHead>
                <TableHead className="px-4 sm:px-6 text-right whitespace-nowrap">Líquido</TableHead>
                {podeVerFolha && <TableHead className="px-4 sm:px-6 text-right whitespace-nowrap">Folha</TableHead>}
                {podeVerFolha && <TableHead className="px-4 sm:px-6 text-right whitespace-nowrap">Variável</TableHead>}
                <TableHead className="px-4 sm:px-6 whitespace-nowrap">Status</TableHead>
                <TableHead className="w-12 px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={podeVerFolha ? 13 : 11} className="text-center text-muted-foreground py-8">
                    Nenhum faturamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <TableRow key={r.clienteId + r.contratoNumero + r.faturamento.id}>
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap font-medium">{r.clienteNome}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap">{r.contratoNumero}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap tabular-nums">{formatDate(r.faturamento.periodoInicio)} a {formatDate(r.faturamento.periodoFim)}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap">{r.faturamento.numeroMedicao || "—"}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap">{r.faturamento.numeroNf || "—"}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap">{r.faturamento.processoNf || "—"}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap">{formatDate(r.faturamento.dataEmissaoNf)}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(r.faturamento.valorBruto)}</TableCell>
                    <TableCell className="px-4 sm:px-6 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(r.faturamento.valorLiquido)}</TableCell>
                    {podeVerFolha && <TableCell className="px-4 sm:px-6 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(r.faturamento.valorFolha)}</TableCell>}
                    {podeVerFolha && <TableCell className="px-4 sm:px-6 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(r.faturamento.valorVariavel)}</TableCell>}
                    <TableCell className="px-4 sm:px-6 py-3 whitespace-nowrap">
                      {r.faturamento.pago ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700">Pago</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <Button variant="ghost" size="icon" title="Abrir no cadastro" onClick={() => navigate(`/clientes?tab=faturamento&clienteId=${r.clienteId}`)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginationControls
        currentPage={page} pageSize={pageSize} totalItems={filtradas.length}
        onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
