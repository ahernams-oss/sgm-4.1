import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, FileSpreadsheet } from "lucide-react";
import { usePedidoCompra, PedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { gerarPdfFinanceiro, gerarExcelFinanceiro, FinReport } from "@/lib/gerarRelatoriosFinanceiros";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmtMoney = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function RelatoriosComprasDialog({ open, onOpenChange }: Props) {
  const { pedidos } = usePedidoCompra();
  const { requisicoes } = useRequisicaoCompras();
  const { materiais } = useMateriaisServicos();
  const { empresa } = useEmpresa() as any;

  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [fornecedorFiltro, setFornecedorFiltro] = useState("todos");
  const [centroCustoFiltro, setCentroCustoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "Material" | "Serviço">("todos");
  const [tab, setTab] = useState("itens");

  // Mapa requisição → centro de custo
  const reqMap = useMemo(() => {
    const m = new Map<string, { nome: string; id: string }>();
    requisicoes.forEach(r => m.set(r.id, { nome: r.centroCustoNome || "Não informado", id: r.centroCusto || "" }));
    return m;
  }, [requisicoes]);

  const fornecedorOptions = useMemo(() => {
    const set = new Map<string, string>();
    pedidos.forEach(p => { if (p.fornecedorId) set.set(p.fornecedorId, p.fornecedorNome); });
    return Array.from(set.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pedidos]);

  const centroCustoOptions = useMemo(() => {
    const set = new Map<string, string>();
    requisicoes.forEach(r => { if (r.centroCusto) set.set(r.centroCusto, r.centroCustoNome || ""); });
    return Array.from(set.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [requisicoes]);

  // Pedidos filtrados
  const pedidosFiltrados = useMemo(() => {
    const di = dataIni ? new Date(dataIni + "T00:00:00") : null;
    const df = dataFim ? new Date(dataFim + "T23:59:59") : null;
    return pedidos.filter(p => {
      if (p.status === "Cancelado") return false;
      const d = new Date(p.dataCriacao);
      if (di && d < di) return false;
      if (df && d > df) return false;
      if (fornecedorFiltro !== "todos" && p.fornecedorId !== fornecedorFiltro) return false;
      if (centroCustoFiltro !== "todos") {
        const cc = reqMap.get(p.requisicaoId)?.id;
        if (cc !== centroCustoFiltro) return false;
      }
      return true;
    });
  }, [pedidos, dataIni, dataFim, fornecedorFiltro, centroCustoFiltro, reqMap]);

  const tipoDoItem = (itemId: string): "Material" | "Serviço" => {
    const mat = materiais.find(m => m.id === itemId);
    return mat?.tipo === "Serviço" ? "Serviço" : "Material";
  };

  // ===== Relatório 1: Itens mais comprados =====
  const itensMaisComprados = useMemo(() => {
    const agg: Record<string, { codigo: string; descricao: string; unidade: string; tipo: string; quantidade: number; valor: number; pedidos: Set<string> }> = {};
    pedidosFiltrados.forEach(p => {
      p.itens.forEach(it => {
        const tipo = tipoDoItem(it.itemId);
        if (tipoFiltro !== "todos" && tipo !== tipoFiltro) return;
        const mat = materiais.find(m => m.id === it.itemId);
        const key = it.itemId || it.descricao;
        if (!agg[key]) agg[key] = {
          codigo: mat?.codigo || "-",
          descricao: mat?.descricao || it.descricao || "Item",
          unidade: it.unidadeMedida || mat?.unidadeMedida || "-",
          tipo, quantidade: 0, valor: 0, pedidos: new Set(),
        };
        agg[key].quantidade += Number(it.quantidade) || 0;
        agg[key].valor += Number(it.valorTotal) || 0;
        agg[key].pedidos.add(p.id);
      });
    });
    return Object.values(agg).map(x => ({ ...x, pedidos: x.pedidos.size })).sort((a, b) => b.valor - a.valor);
  }, [pedidosFiltrados, materiais, tipoFiltro]);

  // ===== Relatório 2/3: Fornecedores =====
  const fornecedoresRanking = useMemo(() => {
    const agg: Record<string, { nome: string; pedidos: number; itens: number; quantidade: number; valor: number }> = {};
    pedidosFiltrados.forEach(p => {
      const key = p.fornecedorId || p.fornecedorNome;
      if (!agg[key]) agg[key] = { nome: p.fornecedorNome || "Não informado", pedidos: 0, itens: 0, quantidade: 0, valor: 0 };
      agg[key].pedidos += 1;
      p.itens.forEach(it => {
        const tipo = tipoDoItem(it.itemId);
        if (tipoFiltro !== "todos" && tipo !== tipoFiltro) return;
        agg[key].itens += 1;
        agg[key].quantidade += Number(it.quantidade) || 0;
        agg[key].valor += Number(it.valorTotal) || 0;
      });
    });
    return Object.values(agg).sort((a, b) => b.valor - a.valor);
  }, [pedidosFiltrados, tipoFiltro]);

  // ===== Relatório 4: Por centro de custo / cliente =====
  const porCentroCusto = useMemo(() => {
    const agg: Record<string, { nome: string; pedidos: number; itens: number; valor: number }> = {};
    pedidosFiltrados.forEach(p => {
      const cc = reqMap.get(p.requisicaoId)?.nome || "Não informado";
      if (!agg[cc]) agg[cc] = { nome: cc, pedidos: 0, itens: 0, valor: 0 };
      agg[cc].pedidos += 1;
      p.itens.forEach(it => {
        const tipo = tipoDoItem(it.itemId);
        if (tipoFiltro !== "todos" && tipo !== tipoFiltro) return;
        agg[cc].itens += 1;
        agg[cc].valor += Number(it.valorTotal) || 0;
      });
    });
    return Object.values(agg).sort((a, b) => b.valor - a.valor);
  }, [pedidosFiltrados, reqMap, tipoFiltro]);

  const filtrosLabel = useMemo(() => {
    const parts: string[] = [];
    if (dataIni || dataFim) parts.push(`Período: ${dataIni || "—"} a ${dataFim || "—"}`);
    if (fornecedorFiltro !== "todos") parts.push(`Fornecedor: ${fornecedorOptions.find(f => f.id === fornecedorFiltro)?.nome}`);
    if (centroCustoFiltro !== "todos") parts.push(`Centro: ${centroCustoOptions.find(c => c.id === centroCustoFiltro)?.nome}`);
    if (tipoFiltro !== "todos") parts.push(`Tipo: ${tipoFiltro}`);
    return parts.join(" • ");
  }, [dataIni, dataFim, fornecedorFiltro, centroCustoFiltro, tipoFiltro, fornecedorOptions, centroCustoOptions]);

  const buildReport = (kind: string): FinReport => {
    const sub = empresa?.nomeFantasia || empresa?.razaoSocial || "SGM Lasant";
    if (kind === "itens") {
      const totalQtd = itensMaisComprados.reduce((s, x) => s + x.quantidade, 0);
      const totalVal = itensMaisComprados.reduce((s, x) => s + x.valor, 0);
      return {
        titulo: "Itens Mais Comprados",
        subtitulo: sub, filtros: filtrosLabel,
        colunas: ["Código", "Descrição", "Tipo", "Un.", "Pedidos", "Qtd. Total", "Valor Total"],
        linhas: itensMaisComprados.map(x => [x.codigo, x.descricao, x.tipo, x.unidade, x.pedidos, fmtNum(x.quantidade), fmtMoney(x.valor)]),
        totais: [{ label: "Qtd. total", valor: fmtNum(totalQtd) }, { label: "Valor total", valor: fmtMoney(totalVal) }],
      };
    }
    if (kind === "fornecedores") {
      const totalVal = fornecedoresRanking.reduce((s, x) => s + x.valor, 0);
      return {
        titulo: "Ranking de Fornecedores",
        subtitulo: sub, filtros: filtrosLabel,
        colunas: ["Fornecedor", "Pedidos", "Itens", "Qtd.", "Valor Total", "% Total"],
        linhas: fornecedoresRanking.map(x => [
          x.nome, x.pedidos, x.itens, fmtNum(x.quantidade), fmtMoney(x.valor),
          totalVal ? `${((x.valor / totalVal) * 100).toFixed(1)}%` : "0%",
        ]),
        totais: [{ label: "Valor total", valor: fmtMoney(totalVal) }],
      };
    }
    // centro custo
    const totalVal = porCentroCusto.reduce((s, x) => s + x.valor, 0);
    return {
      titulo: "Compras por Centro de Custo",
      subtitulo: sub, filtros: filtrosLabel,
      colunas: ["Centro de Custo / Cliente", "Pedidos", "Itens", "Valor Total", "% Total"],
      linhas: porCentroCusto.map(x => [
        x.nome, x.pedidos, x.itens, fmtMoney(x.valor),
        totalVal ? `${((x.valor / totalVal) * 100).toFixed(1)}%` : "0%",
      ]),
      totais: [{ label: "Valor total", valor: fmtMoney(totalVal) }],
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatórios de Compras</DialogTitle>
          <DialogDescription>
            Análises consolidadas a partir dos Ordens de Compra emitidos.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Fornecedor</Label>
              <Select value={fornecedorFiltro} onValueChange={setFornecedorFiltro}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {fornecedorOptions.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Centro de Custo</Label>
              <Select value={centroCustoFiltro} onValueChange={setCentroCustoFiltro}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {centroCustoOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Material">Materiais</SelectItem>
                  <SelectItem value="Serviço">Serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="itens">Itens Mais Comprados</TabsTrigger>
            <TabsTrigger value="fornecedores">Maiores Fornecedores</TabsTrigger>
            <TabsTrigger value="centro">Por Centro de Custo</TabsTrigger>
          </TabsList>

          <TabsContent value="itens" className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => gerarPdfFinanceiro(buildReport("itens"))}>
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => gerarExcelFinanceiro(buildReport("itens"))}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Código</TableHead><TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead><TableHead>Un.</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {itensMaisComprados.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                  )}
                  {itensMaisComprados.slice(0, 100).map((x, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{x.codigo}</TableCell>
                      <TableCell>{x.descricao}</TableCell>
                      <TableCell>{x.tipo}</TableCell>
                      <TableCell>{x.unidade}</TableCell>
                      <TableCell className="text-right">{x.pedidos}</TableCell>
                      <TableCell className="text-right">{fmtNum(x.quantidade)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtMoney(x.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
            {itensMaisComprados.length > 100 && (
              <p className="text-xs text-muted-foreground text-center">Exibindo 100 de {itensMaisComprados.length} — exporte para ver todos.</p>
            )}
          </TabsContent>

          <TabsContent value="fornecedores" className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => gerarPdfFinanceiro(buildReport("fornecedores"))}>
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => gerarExcelFinanceiro(buildReport("fornecedores"))}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">% Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fornecedoresRanking.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                  )}
                  {(() => {
                    const tot = fornecedoresRanking.reduce((s, x) => s + x.valor, 0);
                    return fornecedoresRanking.map((x, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{x.nome}</TableCell>
                        <TableCell className="text-right">{x.pedidos}</TableCell>
                        <TableCell className="text-right">{x.itens}</TableCell>
                        <TableCell className="text-right">{fmtNum(x.quantidade)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtMoney(x.valor)}</TableCell>
                        <TableCell className="text-right">{tot ? ((x.valor / tot) * 100).toFixed(1) + "%" : "-"}</TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="centro" className="space-y-3">
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => gerarPdfFinanceiro(buildReport("centro"))}>
                <FileText className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => gerarExcelFinanceiro(buildReport("centro"))}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Centro de Custo / Cliente</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">% Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {porCentroCusto.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                  )}
                  {(() => {
                    const tot = porCentroCusto.reduce((s, x) => s + x.valor, 0);
                    return porCentroCusto.map((x, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{x.nome}</TableCell>
                        <TableCell className="text-right">{x.pedidos}</TableCell>
                        <TableCell className="text-right">{x.itens}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtMoney(x.valor)}</TableCell>
                        <TableCell className="text-right">{tot ? ((x.valor / tot) * 100).toFixed(1) + "%" : "-"}</TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
