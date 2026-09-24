import { useMemo, useState } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useRecebimento } from "@/contexts/RecebimentoContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Ban, XCircle, FileText, FileSpreadsheet } from "lucide-react";
import { formatarPedido } from "@/lib/notificacoesCompras";
import { toast } from "sonner";

const FILTERS_KEY = "materiais_rejeitados_filters_v1";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface LinhaRejeitada {
  recebimentoId: string;
  situacao: "Recebimento Rejeitado" | "Rejeição Parcial";
  pedidoNumero: number;
  requisicaoNumero: number;
  departamento: string;
  fornecedorNome: string;
  itemDescricao: string;
  unidadeMedida: string;
  quantidadePedida: number;
  quantidadeRejeitada: number;
  valorRejeitado: number;
  motivoItem: string;
  justificativa: string;
  rejeitadoPor: string;
  rejeitadoEm: string;
}

const REL_COLS = [
  "Ordem de Compra", "Requisição", "Situação", "Departamento", "Fornecedor", "Item",
  "Qtd. Pedida", "Qtd. Rejeitada", "Valor Rejeitado", "Motivo do Item",
  "Justificativa Geral", "Rejeitado por", "Data",
];

export default function MateriaisRejeitadosPage() {
  const { recebimentos } = useRecebimento();
  const { requisicoes } = useRequisicaoCompras();
  const { pedidos } = usePedidoCompra();

  const persisted = loadPersistedFilters(FILTERS_KEY) ?? {};
  const [busca, setBusca] = useState<string>((persisted.busca as string) ?? "");
  const [dataIni, setDataIni] = useState<string>((persisted.dataIni as string) ?? "");
  const [dataFim, setDataFim] = useState<string>((persisted.dataFim as string) ?? "");
  const [situacao, setSituacao] = useState<string>((persisted.situacao as string) ?? "Todas");
  usePersistFilters(FILTERS_KEY, { busca, dataIni, dataFim, situacao });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const linhas = useMemo<LinhaRejeitada[]>(() => {
    const out: LinhaRejeitada[] = [];
    for (const r of recebimentos) {
      if (!r.rejeitado) continue;
      const req = requisicoes.find(q => q.id === r.requisicaoId);
      const departamento = req?.centroCustoNome || req?.centroCusto || "-";
      const pedido = pedidos.find(p => p.id === r.pedidoId);
      for (const it of r.itens as any[]) {
        const qtdRej = Number(it.quantidadeRejeitada ?? 0);
        if (qtdRej <= 0) continue;
        const itemPedido = pedido?.itens?.find((pi: any) => pi.itemId === it.itemId);
        const precoUnit = Number(itemPedido?.precoUnitario ?? 0);
        out.push({
          recebimentoId: r.id,
          situacao: pedido?.status === "Rejeição Parcial" ? "Rejeição Parcial" : "Recebimento Rejeitado",
          pedidoNumero: r.pedidoNumero,
          requisicaoNumero: r.requisicaoNumero,
          departamento,
          fornecedorNome: r.fornecedorNome,
          itemDescricao: it.descricao ?? "",
          unidadeMedida: it.unidadeMedida ?? "",
          quantidadePedida: Number(it.quantidadePedida ?? 0),
          quantidadeRejeitada: qtdRej,
          valorRejeitado: qtdRej * precoUnit,
          motivoItem: it.observacao ?? "",
          justificativa: r.justificativaRejeicao ?? "",
          rejeitadoPor: r.rejeitadoPor ?? "",
          rejeitadoEm: r.rejeitadoEm ?? "",
        });
      }
    }
    return out.sort((a, b) => (b.rejeitadoEm || "").localeCompare(a.rejeitadoEm || ""));
  }, [recebimentos, requisicoes, pedidos]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter(l => {
      if (q) {
        const alvo = `${l.pedidoNumero} ${l.requisicaoNumero} ${l.departamento} ${l.fornecedorNome} ${l.itemDescricao} ${l.rejeitadoPor}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      const dia = (l.rejeitadoEm || "").slice(0, 10);
      if (dataIni && dia < dataIni) return false;
      if (dataFim && dia > dataFim) return false;
      if (situacao !== "Todas" && l.situacao !== situacao) return false;
      return true;
    });
  }, [linhas, busca, dataIni, dataFim, situacao]);

  const totalRejeitado = filtradas.reduce((s, l) => s + l.quantidadeRejeitada, 0);
  const valorRejeitado = filtradas.reduce((s, l) => s + l.valorRejeitado, 0);
  const ocsAfetadas = new Set(filtradas.map(l => l.pedidoNumero)).size;
  const pag = paginate(filtradas, page, pageSize);

  const relFiltros = () => {
    const p: string[] = [];
    if (busca.trim()) p.push(`Busca: ${busca.trim()}`);
    if (dataIni) p.push(`De: ${new Date(dataIni + "T12:00:00").toLocaleDateString("pt-BR")}`);
    if (dataFim) p.push(`Até: ${new Date(dataFim + "T12:00:00").toLocaleDateString("pt-BR")}`);
    return p.length ? `Filtros: ${p.join("  |  ")}` : "Filtros: nenhum (todos os rejeitados)";
  };
  const relRows = () => filtradas.map(l => [
    formatarPedido(l.pedidoNumero),
    `RCS-${String(l.requisicaoNumero).padStart(4, "0")}`,
    l.departamento,
    l.fornecedorNome,
    `${l.itemDescricao}${l.unidadeMedida ? ` (${l.unidadeMedida})` : ""}`,
    String(l.quantidadePedida),
    String(l.quantidadeRejeitada),
    brl(l.valorRejeitado),
    l.motivoItem || "-",
    l.justificativa || "-",
    l.rejeitadoPor || "-",
    l.rejeitadoEm ? new Date(l.rejeitadoEm).toLocaleString("pt-BR") : "-",
  ]);
  const exportarRelatorio = async (tipo: "pdf" | "excel") => {
    if (filtradas.length === 0) {
      toast.error("Nada para exportar", { description: "Nenhum material rejeitado na listagem atual." });
      return;
    }
    const mod = await import("@/lib/gerarRelatorioEstoque");
    const titulo = "Materiais Rejeitados no Recebimento";
    if (tipo === "pdf") await mod.gerarPdfEstoque(titulo, REL_COLS, relRows(), relFiltros());
    else await mod.gerarExcelEstoque(titulo, REL_COLS, relRows(), relFiltros());
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ban className="h-6 w-6 text-destructive" /> Mat. Rejeitados
          </h1>
          <p className="text-sm text-muted-foreground">
            Materiais rejeitados no recebimento, vinculados à Ordem de Compra — informação para o Departamento de Compras.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => exportarRelatorio("pdf")}>
            <FileText className="mr-2 h-4 w-4" />PDF
          </Button>
          <Button variant="outline" onClick={() => exportarRelatorio("excel")}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Itens Rejeitados</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{filtradas.length}</p>
            <p className="text-xs text-muted-foreground">{totalRejeitado} unidade(s) no total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ordens de Compra Afetadas</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold">{ocsAfetadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valor Rejeitado</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-2xl font-bold text-destructive">{brl(valorRejeitado)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label>Busca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="OC, requisição, departamento, fornecedor, item..."
                value={busca}
                onChange={e => { setBusca(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          <div className="w-[160px]">
            <Label>Data inicial</Label>
            <Input type="date" value={dataIni} onChange={e => { setDataIni(e.target.value); setPage(1); }} />
          </div>
          <div className="w-[160px]">
            <Label>Data final</Label>
            <Input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(1); }} />
          </div>
          {(dataIni || dataFim || busca) && (
            <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setDataIni(""); setDataFim(""); setPage(1); }}>
              <XCircle className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem de Compra</TableHead>
                <TableHead>Requisição</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qtd. Pedida</TableHead>
                <TableHead className="text-right">Qtd. Rejeitada</TableHead>
                <TableHead className="text-right">Valor Rejeitado</TableHead>
                <TableHead>Motivo do Item</TableHead>
                <TableHead>Justificativa Geral</TableHead>
                <TableHead>Rejeitado por</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pag.paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Nenhum material rejeitado encontrado.
                  </TableCell>
                </TableRow>
              )}
              {pag.paginated.map((l, i) => (
                <TableRow key={`${l.recebimentoId}-${i}`}>
                  <TableCell className="font-semibold">{formatarPedido(l.pedidoNumero)}</TableCell>
                  <TableCell className="font-semibold">RCS-{String(l.requisicaoNumero).padStart(4, "0")}</TableCell>
                  <TableCell className="font-semibold">{l.departamento}</TableCell>
                  <TableCell>{l.fornecedorNome}</TableCell>
                  <TableCell>{l.itemDescricao}{l.unidadeMedida ? ` (${l.unidadeMedida})` : ""}</TableCell>
                  <TableCell className="text-right">{l.quantidadePedida}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="destructive">{l.quantidadeRejeitada}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{brl(l.valorRejeitado)}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={l.motivoItem}>{l.motivoItem || "-"}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={l.justificativa}>{l.justificativa || "-"}</TableCell>
                  <TableCell>{l.rejeitadoPor || "-"}</TableCell>
                  <TableCell>{l.rejeitadoEm ? new Date(l.rejeitadoEm).toLocaleString("pt-BR") : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PaginationControls
        currentPage={page}
        pageSize={pageSize}
        totalItems={filtradas.length}
        onPageChange={setPage}
        onPageSizeChange={s => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
