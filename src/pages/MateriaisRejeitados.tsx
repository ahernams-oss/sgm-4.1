import { useMemo, useState } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useRecebimento } from "@/contexts/RecebimentoContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Ban, XCircle } from "lucide-react";
import { formatarPedido } from "@/lib/notificacoesCompras";

const FILTERS_KEY = "materiais_rejeitados_filters_v1";

interface LinhaRejeitada {
  recebimentoId: string;
  pedidoNumero: number;
  requisicaoNumero: number;
  departamento: string;
  fornecedorNome: string;
  itemDescricao: string;
  unidadeMedida: string;
  quantidadePedida: number;
  quantidadeRejeitada: number;
  motivoItem: string;
  justificativa: string;
  rejeitadoPor: string;
  rejeitadoEm: string;
}

export default function MateriaisRejeitadosPage() {
  const { recebimentos } = useRecebimento();
  const { requisicoes } = useRequisicaoCompras();

  const persisted = loadPersistedFilters(FILTERS_KEY);
  const [busca, setBusca] = useState<string>((persisted.busca as string) ?? "");
  const [dataIni, setDataIni] = useState<string>((persisted.dataIni as string) ?? "");
  const [dataFim, setDataFim] = useState<string>((persisted.dataFim as string) ?? "");
  usePersistFilters(FILTERS_KEY, { busca, dataIni, dataFim });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const linhas = useMemo<LinhaRejeitada[]>(() => {
    const out: LinhaRejeitada[] = [];
    for (const r of recebimentos) {
      if (!r.rejeitado) continue;
      const req = requisicoes.find(q => q.id === r.requisicaoId);
      const departamento = req?.centroCustoNome || req?.centroCusto || "-";
      for (const it of r.itens as any[]) {
        const qtdRej = Number(it.quantidadeRejeitada ?? 0);
        if (qtdRej <= 0) continue;
        out.push({
          recebimentoId: r.id,
          pedidoNumero: r.pedidoNumero,
          requisicaoNumero: r.requisicaoNumero,
          departamento,
          fornecedorNome: r.fornecedorNome,
          itemDescricao: it.descricao ?? "",
          unidadeMedida: it.unidadeMedida ?? "",
          quantidadePedida: Number(it.quantidadePedida ?? 0),
          quantidadeRejeitada: qtdRej,
          motivoItem: it.observacao ?? "",
          justificativa: r.justificativaRejeicao ?? "",
          rejeitadoPor: r.rejeitadoPor ?? "",
          rejeitadoEm: r.rejeitadoEm ?? "",
        });
      }
    }
    return out.sort((a, b) => (b.rejeitadoEm || "").localeCompare(a.rejeitadoEm || ""));
  }, [recebimentos, requisicoes]);

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
      return true;
    });
  }, [linhas, busca, dataIni, dataFim]);

  const totalRejeitado = filtradas.reduce((s, l) => s + l.quantidadeRejeitada, 0);
  const pag = paginate(filtradas, page, pageSize);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ban className="h-6 w-6 text-destructive" /> Materiais Rejeitados
          </h1>
          <p className="text-sm text-muted-foreground">
            Itens de recebimento rejeitados, vinculados à Ordem de Compra e ao departamento solicitante.
          </p>
        </div>
        <Badge variant="destructive" className="text-sm px-3 py-1">
          {filtradas.length} item(ns) · {totalRejeitado} unidade(s) rejeitada(s)
        </Badge>
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
                <TableHead>Motivo do Item</TableHead>
                <TableHead>Justificativa Geral</TableHead>
                <TableHead>Rejeitado por</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pag.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    Nenhum material rejeitado encontrado.
                  </TableCell>
                </TableRow>
              )}
              {pag.items.map((l, i) => (
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
        page={page}
        pageSize={pageSize}
        total={filtradas.length}
        onPageChange={setPage}
        onPageSizeChange={s => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
