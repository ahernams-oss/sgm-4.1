import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, BarChart3 } from "lucide-react";
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
        <Button onClick={() => setOpenSaldos(true)} variant="default">
          <BarChart3 className="h-4 w-4 mr-2" /> Relatório de Saldos
        </Button>
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
