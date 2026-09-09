import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, FileSpreadsheet, Receipt } from "lucide-react";
import { useClientes } from "@/contexts/ClientesContext";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { gerarPdfFinanceiro, gerarExcelFinanceiro, FinReport } from "@/lib/gerarRelatoriosFinanceiros";
import {
  MESES_PT,
  montarFaturamentoPorClienteMes,
  formatBRLValor,
} from "@/lib/faturamentoClientes";
import { toast } from "sonner";

export default function PainelFaturamentoClientes() {
  const { clientes } = useClientes();
  const { ordens } = useOrdensServico();

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const [clienteSel, setClienteSel] = useState<string>("todos");

  const anos = useMemo(
    () => Array.from({ length: 6 }, (_, i) => anoAtual - 3 + i),
    [anoAtual],
  );

  const linhas = useMemo(
    () => montarFaturamentoPorClienteMes(ordens, clientes, ano, clienteSel),
    [ordens, clientes, ano, clienteSel],
  );

  const totais = useMemo(() => {
    const meses = Array(12).fill(0) as number[];
    let total = 0, contratual = 0;
    linhas.forEach((l) => {
      l.meses.forEach((v, i) => { meses[i] += v; });
      total += l.total;
      contratual += l.valorContratual;
    });
    return { meses, total, contratual, saldo: contratual - total };
  }, [linhas]);

  const buildReport = (): FinReport => ({
    titulo: `Faturamento por Cliente - ${ano}`,
    subtitulo: "Ordens de Serviço com situação Faturada (por Data de Faturamento)",
    filtros: clienteSel === "todos"
      ? "Todos os clientes"
      : `Cliente: ${clientes.find((c) => c.id === clienteSel)?.nome ?? "—"}`,
    colunas: ["Cliente", ...MESES_PT, "Total", "Valor Contratual", "Saldo"],
    linhas: linhas.map((l) => [
      l.clienteNome,
      ...l.meses.map((v) => (v ? formatBRLValor(v) : "-")),
      formatBRLValor(l.total),
      formatBRLValor(l.valorContratual),
      formatBRLValor(l.saldo),
    ]),
    totais: [
      { label: "Total Faturado", valor: formatBRLValor(totais.total) },
      { label: "Total Contratual", valor: formatBRLValor(totais.contratual) },
      { label: "Saldo Contratual", valor: formatBRLValor(totais.saldo) },
    ],
  });

  const exportar = (fmt: "pdf" | "xlsx") => {
    if (!linhas.length) { toast.warning("Nenhum faturamento encontrado no período."); return; }
    const r = buildReport();
    if (fmt === "pdf") gerarPdfFinanceiro(r, "landscape");
    else gerarExcelFinanceiro(r);
    toast.success(`${fmt.toUpperCase()} gerado com sucesso!`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Receipt className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-serif font-semibold">Painel de Faturamento por Cliente</h1>
            <p className="text-sm text-muted-foreground">
              Valor faturado por mês (OS com situação “Faturada”) e saldo contratual.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportar("xlsx")} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={() => exportar("pdf")} className="gap-2" style={{ background: "#673ab7" }}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Ano</Label>
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label>Cliente</Label>
          <Select value={clienteSel} onValueChange={setClienteSel}>
            <SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.filter((c) => c.tipo !== "Fornecedor").map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Faturado", valor: totais.total, cls: "text-primary" },
          { label: "Valor Contratual", valor: totais.contratual, cls: "" },
          { label: "Saldo Contratual", valor: totais.saldo, cls: totais.saldo >= 0 ? "text-emerald-600" : "text-destructive" },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${k.cls}`}>{formatBRLValor(k.valor)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background min-w-[180px]">Cliente</TableHead>
                {MESES_PT.map((m) => (
                  <TableHead key={m} className="text-right whitespace-nowrap">{m.slice(0, 3)}</TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Valor Contratual</TableHead>
                <TableHead className="text-right whitespace-nowrap">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                    Nenhuma OS faturada em {ano}.
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((l) => (
                  <TableRow key={l.clienteId}>
                    <TableCell className="sticky left-0 bg-background font-medium">{l.clienteNome}</TableCell>
                    {l.meses.map((v, i) => (
                      <TableCell key={i} className="text-right tabular-nums whitespace-nowrap">
                        {v ? formatBRLValor(v) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">{formatBRLValor(l.total)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{formatBRLValor(l.valorContratual)}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums whitespace-nowrap ${l.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {formatBRLValor(l.saldo)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {linhas.length > 0 && (
              <tfoot>
                <TableRow className="bg-muted/50">
                  <TableCell className="sticky left-0 bg-muted/50 font-bold">TOTAL</TableCell>
                  {totais.meses.map((v, i) => (
                    <TableCell key={i} className="text-right font-semibold tabular-nums whitespace-nowrap">
                      {v ? formatBRLValor(v) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold tabular-nums whitespace-nowrap">{formatBRLValor(totais.total)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums whitespace-nowrap">{formatBRLValor(totais.contratual)}</TableCell>
                  <TableCell className={`text-right font-bold tabular-nums whitespace-nowrap ${totais.saldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatBRLValor(totais.saldo)}
                  </TableCell>
                </TableRow>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
