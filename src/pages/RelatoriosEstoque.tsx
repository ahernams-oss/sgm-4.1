import { useState, useMemo } from "react";
import { useEstoque } from "@/contexts/EstoqueContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useClientes } from "@/contexts/ClientesContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { gerarPdfEstoque, gerarExcelEstoque } from "@/lib/gerarRelatorioEstoque";
import { useEmpresa } from "@/contexts/EmpresaContext";
import {
  CalendarIcon, FileText, FileSpreadsheet, Printer, Search, Package, TrendingDown,
  AlertTriangle, BarChart3, History, ArrowLeftRight, ClipboardList, Warehouse,
  ShoppingCart, Users, Filter, X
} from "lucide-react";
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import { usePermissao } from "@/hooks/usePermissao";
import PaginationControls, { paginate } from "@/components/PaginationControls";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(210,60%,50%)", "hsl(40,80%,50%)", "hsl(150,60%,40%)", "hsl(280,60%,50%)", "hsl(20,80%,50%)", "hsl(170,60%,40%)"];

export default function RelatoriosEstoquePage() {
  const { empresa } = useEmpresa();
  const { movimentacoes, inventarios, getSaldos, getSaldoPorMaterial } = useEstoque();
  const { materiais } = useMateriaisServicos();
  const { clientes } = useClientes();
  const { pedidos } = usePedidoCompra();
  const { requisicoes } = useRequisicaoCompras();
  const { tem } = usePermissao();
  const podeExportar = tem("relatorios_estoque.exportar");

  const [tab, setTab] = useState("posicao");
  const [search, setSearch] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("__all__");
  const [filtroUsuario, setFiltroUsuario] = useState("__all__");
  const [filtroCC, setFiltroCC] = useState("__all__");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Pagination (shared per tab)
  const [pages, setPages] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState(10);
  const getPage = (k: string) => pages[k] || 1;
  const setPage = (k: string) => (p: number) => setPages(prev => ({ ...prev, [k]: p }));
  const changePageSize = (s: number) => { setPageSize(s); setPages({}); };

  // Derived data
  const locais = useMemo(() => {
    const s = new Set<string>();
    movimentacoes.forEach(m => { if (m.local) s.add(m.local); });
    return Array.from(s).sort();
  }, [movimentacoes]);

  const usuarios = useMemo(() => {
    const s = new Set<string>();
    movimentacoes.forEach(m => { if (m.usuario) s.add(m.usuario); });
    return Array.from(s).sort();
  }, [movimentacoes]);

  const centroCustoMap = useMemo(() => {
    const map = new Map<number, string>();
    pedidos.forEach(p => {
      const rc = requisicoes.find(r => r.id === p.requisicaoId);
      if (rc?.centroCustoNome) map.set(p.numero, rc.centroCustoNome);
    });
    return map;
  }, [pedidos, requisicoes]);

  const getCentroCusto = (docRef: string): string => {
    const match = docRef.match(/Pedido\s+(\d+)/i);
    if (match) return centroCustoMap.get(parseInt(match[1])) || "-";
    return "-";
  };

  const centrosCusto = useMemo(() => {
    const s = new Set<string>();
    movimentacoes.forEach(m => {
      const cc = getCentroCusto(m.documentoRef);
      if (cc && cc !== "-") s.add(cc);
    });
    return Array.from(s).sort();
  }, [movimentacoes, centroCustoMap]);

  // Apply common filters
  const filterByPeriod = (dateStr: string) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (dataInicio && d < dataInicio) return false;
    if (dataFim) { const end = new Date(dataFim); end.setHours(23, 59, 59); if (d > end) return false; }
    return true;
  };

  const filterCommon = (m: typeof movimentacoes[0]) => {
    if (!filterByPeriod(m.dataMovimentacao)) return false;
    if (filtroUnidade !== "__all__" && m.local !== filtroUnidade) return false;
    if (filtroUsuario !== "__all__" && m.usuario !== filtroUsuario) return false;
    if (filtroCC !== "__all__" && getCentroCusto(m.documentoRef) !== filtroCC) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!m.materialCodigo.toLowerCase().includes(s) && !m.materialDescricao.toLowerCase().includes(s)) return false;
    }
    return true;
  };

  const clearFilters = () => { setSearch(""); setFiltroUnidade("__all__"); setFiltroUsuario("__all__"); setFiltroCC("__all__"); setDataInicio(undefined); setDataFim(undefined); };
  const hasFilters = search || filtroUnidade !== "__all__" || filtroUsuario !== "__all__" || filtroCC !== "__all__" || dataInicio || dataFim;

  const filtersText = () => {
    const parts: string[] = [];
    if (dataInicio) parts.push(`De: ${format(dataInicio, "dd/MM/yyyy")}`);
    if (dataFim) parts.push(`Até: ${format(dataFim, "dd/MM/yyyy")}`);
    if (filtroUnidade !== "__all__") parts.push(`Unidade: ${filtroUnidade}`);
    if (filtroCC !== "__all__") parts.push(`C.Custo: ${filtroCC}`);
    if (filtroUsuario !== "__all__") parts.push(`Usuário: ${filtroUsuario}`);
    if (search) parts.push(`Busca: ${search}`);
    return parts.join(" | ");
  };

  // ===== REPORT DATA =====

  // 1. Posição de estoque atual
  const saldos = useMemo(() => {
    const all = getSaldos();
    return all.filter(s => {
      if (filtroUnidade !== "__all__" && s.local !== filtroUnidade) return false;
      if (search) {
        const ss = search.toLowerCase();
        if (!s.materialCodigo.toLowerCase().includes(ss) && !s.materialDescricao.toLowerCase().includes(ss)) return false;
      }
      return true;
    });
  }, [getSaldos, filtroUnidade, search]);

  // 2. Movimentação por período
  const movPeriodo = useMemo(() => movimentacoes.filter(filterCommon), [movimentacoes, dataInicio, dataFim, filtroUnidade, filtroUsuario, search]);

  // Chart: movimentações por dia
  const movPorDia = useMemo(() => {
    const map = new Map<string, { entradas: number; saidas: number }>();
    movPeriodo.forEach(m => {
      const d = m.dataMovimentacao ? format(new Date(m.dataMovimentacao), "dd/MM") : "?";
      if (!map.has(d)) map.set(d, { entradas: 0, saidas: 0 });
      const v = map.get(d)!;
      if (m.tipo === "entrada") v.entradas += m.quantidade;
      else if (m.tipo === "saida") v.saidas += m.quantidade;
    });
    return Array.from(map.entries()).map(([data, v]) => ({ data, entradas: v.entradas, saidas: v.saidas }));
  }, [movPeriodo]);

  // 3. Entradas por fornecedor
  const entradasFornecedor = useMemo(() => {
    const map = new Map<string, { qtd: number; itens: number }>();
    movimentacoes.filter(m => m.tipo === "entrada" && filterCommon(m)).forEach(m => {
      const forn = m.fornecedorNome || "Não informado";
      if (!map.has(forn)) map.set(forn, { qtd: 0, itens: 0 });
      const v = map.get(forn)!;
      v.qtd += m.quantidade;
      v.itens++;
    });
    return Array.from(map.entries()).map(([fornecedor, v]) => ({ fornecedor, ...v })).sort((a, b) => b.qtd - a.qtd);
  }, [movimentacoes, dataInicio, dataFim, filtroUnidade, filtroUsuario, search]);

  // 4. Saídas por setor/unidade
  const saidasSetor = useMemo(() => {
    const map = new Map<string, { qtd: number; itens: number }>();
    movimentacoes.filter(m => m.tipo === "saida" && filterCommon(m)).forEach(m => {
      const loc = m.local || "Não informado";
      if (!map.has(loc)) map.set(loc, { qtd: 0, itens: 0 });
      const v = map.get(loc)!;
      v.qtd += m.quantidade;
      v.itens++;
    });
    return Array.from(map.entries()).map(([setor, v]) => ({ setor, ...v })).sort((a, b) => b.qtd - a.qtd);
  }, [movimentacoes, dataInicio, dataFim, filtroUnidade, filtroUsuario, search]);

  // 5. Inventário e divergências
  const inventarioDivergencias = useMemo(() => {
    return inventarios.flatMap(inv =>
      (inv.itens || []).filter(it => it.diferenca !== 0).map(it => ({
        data: inv.dataInventario, local: inv.local, status: inv.status,
        ...it,
      }))
    );
  }, [inventarios]);

  // 6. Itens abaixo do mínimo
  const itensAbaixoMinimo = useMemo(() => {
    return materiais
      .filter(m => (m.estoqueMinimo || 0) > 0)
      .map(m => ({ ...m, saldo: getSaldoPorMaterial(m.id) }))
      .filter(m => m.saldo <= m.estoqueMinimo);
  }, [materiais, getSaldoPorMaterial]);

  // 7. Itens vencidos ou a vencer
  const itensVencimento = useMemo(() => {
    const hoje = new Date();
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    return movimentacoes
      .filter(m => m.validade && m.tipo === "entrada")
      .map(m => {
        const venc = new Date(m.validade);
        let status = "OK";
        if (venc < hoje) status = "Vencido";
        else if (venc <= em30) status = "A vencer";
        return { ...m, validadeDate: venc, statusVencimento: status };
      })
      .filter(m => m.statusVencimento !== "OK")
      .sort((a, b) => a.validadeDate.getTime() - b.validadeDate.getTime());
  }, [movimentacoes]);

  // 8. Itens sem giro
  const itensSemGiro = useMemo(() => {
    const ultimaMovMap = new Map<string, string>();
    movimentacoes.forEach(m => {
      const cur = ultimaMovMap.get(m.materialId);
      if (!cur || m.dataMovimentacao > cur) ultimaMovMap.set(m.materialId, m.dataMovimentacao);
    });
    const dias90 = new Date(); dias90.setDate(dias90.getDate() - 90);
    const saldosAll = getSaldos();
    return saldosAll.filter(s => {
      const last = ultimaMovMap.get(s.materialId);
      return !last || new Date(last) < dias90;
    }).map(s => ({
      ...s,
      ultimaMov: ultimaMovMap.get(s.materialId) || "-",
      diasSemMov: ultimaMovMap.get(s.materialId)
        ? Math.floor((Date.now() - new Date(ultimaMovMap.get(s.materialId)!).getTime()) / 86400000)
        : 999,
    }));
  }, [movimentacoes, getSaldos]);

  // 9. Consumo por centro de custo
  const consumoCentroCusto = useMemo(() => {
    const map = new Map<string, { qtd: number; itens: number }>();
    movimentacoes.filter(m => m.tipo === "saida" && filterCommon(m)).forEach(m => {
      const cc = getCentroCusto(m.documentoRef);
      if (!map.has(cc)) map.set(cc, { qtd: 0, itens: 0 });
      const v = map.get(cc)!;
      v.qtd += m.quantidade;
      v.itens++;
    });
    return Array.from(map.entries()).map(([cc, v]) => ({ centroCusto: cc, ...v })).sort((a, b) => b.qtd - a.qtd);
  }, [movimentacoes, dataInicio, dataFim, filtroUnidade, filtroUsuario, search]);

  // 10. Rastreabilidade por lote
  const rastreioLote = useMemo(() => {
    return movimentacoes.filter(m => m.lote && filterCommon(m)).sort((a, b) => b.dataMovimentacao.localeCompare(a.dataMovimentacao));
  }, [movimentacoes, dataInicio, dataFim, filtroUnidade, filtroUsuario, search]);

  // 11. Histórico por item
  const [itemHistoricoId, setItemHistoricoId] = useState("");
  const historicoItem = useMemo(() => {
    if (!itemHistoricoId) return [];
    return movimentacoes.filter(m => m.materialId === itemHistoricoId).sort((a, b) => b.dataMovimentacao.localeCompare(a.dataMovimentacao));
  }, [movimentacoes, itemHistoricoId]);

  // 12. Transferências entre depósitos
  const transferencias = useMemo(() => {
    return movimentacoes.filter(m => (m.depositoOrigem || m.depositoDestino) && filterCommon(m))
      .sort((a, b) => b.dataMovimentacao.localeCompare(a.dataMovimentacao));
  }, [movimentacoes, dataInicio, dataFim, filtroUnidade, filtroUsuario, search]);

  // 13. Ajustes realizados
  const ajustes = useMemo(() => {
    return movimentacoes.filter(m => m.tipo === "ajuste" && filterCommon(m))
      .sort((a, b) => b.dataMovimentacao.localeCompare(a.dataMovimentacao));
  }, [movimentacoes, dataInicio, dataFim, filtroUnidade, filtroUsuario, search]);

  // Export helpers
  const exportPdf = (title: string, cols: string[], rows: string[][]) => gerarPdfEstoque(title, cols, rows, filtersText(), empresa?.logoUrl);
  const exportExcel = (title: string, cols: string[], rows: string[][]) => gerarExcelEstoque(title, cols, rows, filtersText());
  const handlePrint = () => window.print();

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";
  const formatQty = (n: number) => n.toLocaleString("pt-BR");

  const tipoLabel = (t: string) => t === "entrada" ? "Entrada" : t === "saida" ? "Saída" : "Ajuste";

  const chartConfig: ChartConfig = {
    entradas: { label: "Entradas", color: "hsl(150,60%,40%)" },
    saidas: { label: "Saídas", color: "hsl(0,70%,50%)" },
  };

  // Date picker component
  const DateFilter = ({ label, date, setDate }: { label: string; date?: Date; setDate: (d?: Date) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left text-xs", !date && "text-muted-foreground")}>
            <CalendarIcon className="mr-1 h-3 w-3" />
            {date ? format(date, "dd/MM/yyyy") : "Selecionar"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={setDate} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  // Export buttons
  const ExportButtons = ({ onPdf, onExcel }: { onPdf: () => void; onExcel: () => void }) => (
    podeExportar ? (
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={onPdf}><FileText className="mr-1 h-3 w-3" />PDF</Button>
        <Button size="sm" variant="outline" onClick={onExcel}><FileSpreadsheet className="mr-1 h-3 w-3" />Excel</Button>
        <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="mr-1 h-3 w-3" />Imprimir</Button>
      </div>
    ) : null
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Relatórios de Estoque</h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Buscar item</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Código ou descrição" className="pl-7 h-8 text-xs w-[180px]" />
              </div>
            </div>
            <DateFilter label="Data Início" date={dataInicio} setDate={setDataInicio} />
            <DateFilter label="Data Fim" date={dataFim} setDate={setDataFim} />
            <div className="space-y-1">
              <Label className="text-xs">Unidade/Local</Label>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {locais.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Centro de Custo</Label>
              <Select value={filtroCC} onValueChange={setFiltroCC}>
                <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {centrosCusto.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Usuário</Label>
              <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {usuarios.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-xs">
                <X className="mr-1 h-3 w-3" />Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="posicao" className="text-xs"><Warehouse className="mr-1 h-3 w-3" />Posição Atual</TabsTrigger>
          <TabsTrigger value="movperiodo" className="text-xs"><BarChart3 className="mr-1 h-3 w-3" />Movimentação</TabsTrigger>
          <TabsTrigger value="entradas" className="text-xs"><ShoppingCart className="mr-1 h-3 w-3" />Entradas Fornecedor</TabsTrigger>
          <TabsTrigger value="saidas" className="text-xs"><Users className="mr-1 h-3 w-3" />Saídas Setor</TabsTrigger>
          <TabsTrigger value="inventario" className="text-xs"><ClipboardList className="mr-1 h-3 w-3" />Inventário</TabsTrigger>
          <TabsTrigger value="minimo" className="text-xs"><AlertTriangle className="mr-1 h-3 w-3" />Abaixo Mínimo</TabsTrigger>
          <TabsTrigger value="vencimento" className="text-xs"><CalendarIcon className="mr-1 h-3 w-3" />Vencimentos</TabsTrigger>
          <TabsTrigger value="semgiro" className="text-xs"><TrendingDown className="mr-1 h-3 w-3" />Sem Giro</TabsTrigger>
          <TabsTrigger value="consumocc" className="text-xs"><Package className="mr-1 h-3 w-3" />Consumo C.Custo</TabsTrigger>
          <TabsTrigger value="lote" className="text-xs"><Search className="mr-1 h-3 w-3" />Rastreio Lote</TabsTrigger>
          <TabsTrigger value="historico" className="text-xs"><History className="mr-1 h-3 w-3" />Histórico Item</TabsTrigger>
          <TabsTrigger value="transferencias" className="text-xs"><ArrowLeftRight className="mr-1 h-3 w-3" />Transferências</TabsTrigger>
          <TabsTrigger value="ajustes" className="text-xs"><Filter className="mr-1 h-3 w-3" />Ajustes</TabsTrigger>
        </TabsList>

        {/* 1. Posição Atual */}
        <TabsContent value="posicao" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{saldos.length} itens</p>
            <ExportButtons
              onPdf={() => exportPdf("Posição de Estoque", ["Código", "Material", "Local", "Quantidade"],
                saldos.map(s => [s.materialCodigo, s.materialDescricao, s.local, formatQty(s.quantidade)]))}
              onExcel={() => exportExcel("Posição de Estoque", ["Código", "Material", "Local", "Quantidade"],
                saldos.map(s => [s.materialCodigo, s.materialDescricao, s.local, formatQty(s.quantidade)]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Quantidade</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {saldos.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum saldo</TableCell></TableRow>
                  : paginate(saldos, getPage("posicao"), pageSize).paginated.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{s.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{s.materialDescricao}</TableCell>
                      <TableCell className="text-xs">{s.local}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatQty(s.quantidade)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("posicao")} totalItems={saldos.length} onPageChange={setPage("posicao")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 2. Movimentação por período */}
        <TabsContent value="movperiodo" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{movPeriodo.length} movimentações</p>
            <ExportButtons
              onPdf={() => exportPdf("Movimentação por Período", ["Data", "Tipo", "Código", "Material", "Local", "Qtd", "Doc", "Usuário"],
                movPeriodo.map(m => [formatDate(m.dataMovimentacao), tipoLabel(m.tipo), m.materialCodigo, m.materialDescricao, m.local, formatQty(m.quantidade), m.documentoRef, m.usuario]))}
              onExcel={() => exportExcel("Movimentação por Período", ["Data", "Tipo", "Código", "Material", "Local", "Qtd", "Doc", "Usuário"],
                movPeriodo.map(m => [formatDate(m.dataMovimentacao), tipoLabel(m.tipo), m.materialCodigo, m.materialDescricao, m.local, formatQty(m.quantidade), m.documentoRef, m.usuario]))}
            />
          </div>
          {movPorDia.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Movimentações por Dia</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={movPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" fontSize={10} />
                    <YAxis fontSize={10} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="entradas" fill="var(--color-entradas)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="saidas" fill="var(--color-saidas)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead>Documento</TableHead><TableHead>Usuário</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movPeriodo.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sem movimentações</TableCell></TableRow>
                  : paginate(movPeriodo, getPage("movperiodo"), pageSize).paginated.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{formatDate(m.dataMovimentacao)}</TableCell>
                      <TableCell><Badge variant={m.tipo === "entrada" ? "default" : m.tipo === "saida" ? "destructive" : "secondary"} className="text-xs">{tipoLabel(m.tipo)}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{m.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{m.materialDescricao}</TableCell>
                      <TableCell className="text-xs">{m.local}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatQty(m.quantidade)}</TableCell>
                      <TableCell className="text-xs">{m.documentoRef || "-"}</TableCell>
                      <TableCell className="text-xs">{m.usuario}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("movperiodo")} totalItems={movPeriodo.length} onPageChange={setPage("movperiodo")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 3. Entradas por Fornecedor */}
        <TabsContent value="entradas" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{entradasFornecedor.length} fornecedores</p>
            <ExportButtons
              onPdf={() => exportPdf("Entradas por Fornecedor", ["Fornecedor", "Qtd Total", "Nº Entradas"],
                entradasFornecedor.map(e => [e.fornecedor, formatQty(e.qtd), String(e.itens)]))}
              onExcel={() => exportExcel("Entradas por Fornecedor", ["Fornecedor", "Qtd Total", "Nº Entradas"],
                entradasFornecedor.map(e => [e.fornecedor, formatQty(e.qtd), String(e.itens)]))}
            />
          </div>
          {entradasFornecedor.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas por Fornecedor</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={{ qtd: { label: "Quantidade", color: COLORS[0] } }} className="h-[200px] w-full">
                  <BarChart data={entradasFornecedor.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="fornecedor" type="category" fontSize={9} width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="qtd" fill="var(--color-qtd)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fornecedor</TableHead><TableHead className="text-right">Qtd Total</TableHead><TableHead className="text-right">Nº Entradas</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {entradasFornecedor.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                  : paginate(entradasFornecedor, getPage("entradas"), pageSize).paginated.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{e.fornecedor}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatQty(e.qtd)}</TableCell>
                      <TableCell className="text-right text-xs">{e.itens}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("entradas")} totalItems={entradasFornecedor.length} onPageChange={setPage("entradas")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 4. Saídas por Setor */}
        <TabsContent value="saidas" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{saidasSetor.length} setores/unidades</p>
            <ExportButtons
              onPdf={() => exportPdf("Saídas por Setor", ["Setor/Unidade", "Qtd Total", "Nº Saídas"],
                saidasSetor.map(s => [s.setor, formatQty(s.qtd), String(s.itens)]))}
              onExcel={() => exportExcel("Saídas por Setor", ["Setor/Unidade", "Qtd Total", "Nº Saídas"],
                saidasSetor.map(s => [s.setor, formatQty(s.qtd), String(s.itens)]))}
            />
          </div>
          {saidasSetor.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Saídas por Setor/Unidade</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={{ qtd: { label: "Quantidade", color: COLORS[1] } }} className="h-[200px] w-full">
                  <BarChart data={saidasSetor.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="setor" type="category" fontSize={9} width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="qtd" fill="var(--color-qtd)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Setor/Unidade</TableHead><TableHead className="text-right">Qtd Total</TableHead><TableHead className="text-right">Nº Saídas</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {saidasSetor.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                  : paginate(saidasSetor, getPage("saidas"), pageSize).paginated.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{s.setor}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatQty(s.qtd)}</TableCell>
                      <TableCell className="text-right text-xs">{s.itens}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("saidas")} totalItems={saidasSetor.length} onPageChange={setPage("saidas")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 5. Inventário e Divergências */}
        <TabsContent value="inventario" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{inventarioDivergencias.length} divergências</p>
            <ExportButtons
              onPdf={() => exportPdf("Inventário - Divergências", ["Data", "Local", "Status", "Código", "Material", "Sistema", "Contagem", "Diferença"],
                inventarioDivergencias.map(d => [formatDate(d.data), d.local, d.status, d.materialCodigo, d.materialDescricao, formatQty(d.saldoSistema), formatQty(d.quantidadeContada), formatQty(d.diferenca)]))}
              onExcel={() => exportExcel("Inventário - Divergências", ["Data", "Local", "Status", "Código", "Material", "Sistema", "Contagem", "Diferença"],
                inventarioDivergencias.map(d => [formatDate(d.data), d.local, d.status, d.materialCodigo, d.materialDescricao, formatQty(d.saldoSistema), formatQty(d.quantidadeContada), formatQty(d.diferenca)]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Local</TableHead><TableHead>Status</TableHead><TableHead>Código</TableHead><TableHead>Material</TableHead>
                <TableHead className="text-right">Sistema</TableHead><TableHead className="text-right">Contagem</TableHead><TableHead className="text-right">Diferença</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {inventarioDivergencias.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sem divergências</TableCell></TableRow>
                  : paginate(inventarioDivergencias, getPage("inventario"), pageSize).paginated.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{formatDate(d.data)}</TableCell>
                      <TableCell className="text-xs">{d.local}</TableCell>
                      <TableCell><Badge variant={d.status === "Fechado" ? "secondary" : "default"} className="text-xs">{d.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{d.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{d.materialDescricao}</TableCell>
                      <TableCell className="text-right text-xs">{formatQty(d.saldoSistema)}</TableCell>
                      <TableCell className="text-right text-xs">{formatQty(d.quantidadeContada)}</TableCell>
                      <TableCell className={cn("text-right font-semibold text-xs", d.diferenca > 0 ? "text-emerald-600" : "text-destructive")}>{d.diferenca > 0 ? "+" : ""}{formatQty(d.diferenca)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("inventario")} totalItems={inventarioDivergencias.length} onPageChange={setPage("inventario")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 6. Itens abaixo do mínimo */}
        <TabsContent value="minimo" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{itensAbaixoMinimo.length} itens</p>
            <ExportButtons
              onPdf={() => exportPdf("Itens Abaixo do Mínimo", ["Código", "Material", "Est. Mínimo", "Saldo Atual", "Déficit"],
                itensAbaixoMinimo.map(m => [m.codigo, m.descricao, formatQty(m.estoqueMinimo), formatQty(m.saldo), formatQty(m.estoqueMinimo - m.saldo)]))}
              onExcel={() => exportExcel("Itens Abaixo do Mínimo", ["Código", "Material", "Est. Mínimo", "Saldo Atual", "Déficit"],
                itensAbaixoMinimo.map(m => [m.codigo, m.descricao, formatQty(m.estoqueMinimo), formatQty(m.saldo), formatQty(m.estoqueMinimo - m.saldo)]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead className="text-right">Mínimo</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Déficit</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {itensAbaixoMinimo.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Todos acima do mínimo</TableCell></TableRow>
                  : paginate(itensAbaixoMinimo, getPage("minimo"), pageSize).paginated.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                      <TableCell className="text-xs">{m.descricao}</TableCell>
                      <TableCell className="text-right text-xs">{formatQty(m.estoqueMinimo)}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatQty(m.saldo)}</TableCell>
                      <TableCell className="text-right text-destructive text-xs">{formatQty(m.estoqueMinimo - m.saldo)}</TableCell>
                      <TableCell>{m.saldo <= 0 ? <Badge variant="destructive" className="text-xs">Zerado</Badge> : <Badge variant="secondary" className="text-xs">Baixo</Badge>}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("minimo")} totalItems={itensAbaixoMinimo.length} onPageChange={setPage("minimo")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 7. Itens vencidos ou a vencer */}
        <TabsContent value="vencimento" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{itensVencimento.length} itens</p>
            <ExportButtons
              onPdf={() => exportPdf("Itens Vencidos/A Vencer", ["Código", "Material", "Lote", "Validade", "Status", "Local", "Qtd"],
                itensVencimento.map(m => [m.materialCodigo, m.materialDescricao, m.lote, formatDate(m.validade), m.statusVencimento, m.local, formatQty(m.quantidade)]))}
              onExcel={() => exportExcel("Itens Vencidos/A Vencer", ["Código", "Material", "Lote", "Validade", "Status", "Local", "Qtd"],
                itensVencimento.map(m => [m.materialCodigo, m.materialDescricao, m.lote, formatDate(m.validade), m.statusVencimento, m.local, formatQty(m.quantidade)]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Status</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Qtd</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {itensVencimento.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum item vencido ou a vencer</TableCell></TableRow>
                  : paginate(itensVencimento, getPage("vencimento"), pageSize).paginated.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{m.materialDescricao}</TableCell>
                      <TableCell className="text-xs">{m.lote || "-"}</TableCell>
                      <TableCell className="text-xs">{formatDate(m.validade)}</TableCell>
                      <TableCell><Badge variant={m.statusVencimento === "Vencido" ? "destructive" : "secondary"} className="text-xs">{m.statusVencimento}</Badge></TableCell>
                      <TableCell className="text-xs">{m.local}</TableCell>
                      <TableCell className="text-right text-xs">{formatQty(m.quantidade)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("vencimento")} totalItems={itensVencimento.length} onPageChange={setPage("vencimento")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 8. Itens sem giro */}
        <TabsContent value="semgiro" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{itensSemGiro.length} itens sem movimentação há 90+ dias</p>
            <ExportButtons
              onPdf={() => exportPdf("Itens Sem Giro", ["Código", "Material", "Local", "Qtd", "Última Mov.", "Dias Parado"],
                itensSemGiro.map(s => [s.materialCodigo, s.materialDescricao, s.local, formatQty(s.quantidade), formatDate(s.ultimaMov), String(s.diasSemMov)]))}
              onExcel={() => exportExcel("Itens Sem Giro", ["Código", "Material", "Local", "Qtd", "Última Mov.", "Dias Parado"],
                itensSemGiro.map(s => [s.materialCodigo, s.materialDescricao, s.local, formatQty(s.quantidade), formatDate(s.ultimaMov), String(s.diasSemMov)]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead>Última Mov.</TableHead><TableHead className="text-right">Dias Parado</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {itensSemGiro.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Todos os itens tiveram movimentação recente</TableCell></TableRow>
                  : paginate(itensSemGiro, getPage("semgiro"), pageSize).paginated.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{s.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{s.materialDescricao}</TableCell>
                      <TableCell className="text-xs">{s.local}</TableCell>
                      <TableCell className="text-right text-xs">{formatQty(s.quantidade)}</TableCell>
                      <TableCell className="text-xs">{formatDate(s.ultimaMov)}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{s.diasSemMov}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("semgiro")} totalItems={itensSemGiro.length} onPageChange={setPage("semgiro")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 9. Consumo por Centro de Custo */}
        <TabsContent value="consumocc" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{consumoCentroCusto.length} centros de custo</p>
            <ExportButtons
              onPdf={() => exportPdf("Consumo por Centro de Custo", ["Centro de Custo", "Qtd Consumida", "Nº Saídas"],
                consumoCentroCusto.map(c => [c.centroCusto, formatQty(c.qtd), String(c.itens)]))}
              onExcel={() => exportExcel("Consumo por Centro de Custo", ["Centro de Custo", "Qtd Consumida", "Nº Saídas"],
                consumoCentroCusto.map(c => [c.centroCusto, formatQty(c.qtd), String(c.itens)]))}
            />
          </div>
          {consumoCentroCusto.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Consumo por Centro de Custo</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={{ qtd: { label: "Quantidade", color: COLORS[2] } }} className="h-[200px] w-full">
                  <BarChart data={consumoCentroCusto.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="centroCusto" type="category" fontSize={9} width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="qtd" fill="var(--color-qtd)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Centro de Custo</TableHead><TableHead className="text-right">Qtd Consumida</TableHead><TableHead className="text-right">Nº Saídas</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {consumoCentroCusto.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                  : paginate(consumoCentroCusto, getPage("consumocc"), pageSize).paginated.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{c.centroCusto}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatQty(c.qtd)}</TableCell>
                      <TableCell className="text-right text-xs">{c.itens}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("consumocc")} totalItems={consumoCentroCusto.length} onPageChange={setPage("consumocc")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 10. Rastreabilidade por Lote */}
        <TabsContent value="lote" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{rastreioLote.length} registros com lote</p>
            <ExportButtons
              onPdf={() => exportPdf("Rastreabilidade por Lote", ["Data", "Tipo", "Código", "Material", "Lote", "Validade", "Local", "Qtd"],
                rastreioLote.map(m => [formatDate(m.dataMovimentacao), tipoLabel(m.tipo), m.materialCodigo, m.materialDescricao, m.lote, formatDate(m.validade), m.local, formatQty(m.quantidade)]))}
              onExcel={() => exportExcel("Rastreabilidade por Lote", ["Data", "Tipo", "Código", "Material", "Lote", "Validade", "Local", "Qtd"],
                rastreioLote.map(m => [formatDate(m.dataMovimentacao), tipoLabel(m.tipo), m.materialCodigo, m.materialDescricao, m.lote, formatDate(m.validade), m.local, formatQty(m.quantidade)]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Qtd</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rastreioLote.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro com lote</TableCell></TableRow>
                  : paginate(rastreioLote, getPage("lote"), pageSize).paginated.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{formatDate(m.dataMovimentacao)}</TableCell>
                      <TableCell><Badge variant={m.tipo === "entrada" ? "default" : "destructive"} className="text-xs">{tipoLabel(m.tipo)}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{m.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{m.materialDescricao}</TableCell>
                      <TableCell className="text-xs font-semibold">{m.lote}</TableCell>
                      <TableCell className="text-xs">{formatDate(m.validade)}</TableCell>
                      <TableCell className="text-xs">{m.local}</TableCell>
                      <TableCell className="text-right text-xs">{formatQty(m.quantidade)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("lote")} totalItems={rastreioLote.length} onPageChange={setPage("lote")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 11. Histórico por Item */}
        <TabsContent value="historico" className="space-y-3">
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Selecione o Material</Label>
              <Select value={itemHistoricoId} onValueChange={setItemHistoricoId}>
                <SelectTrigger className="h-8 text-xs w-[300px]"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {materiais.map(m => <SelectItem key={m.id} value={m.id}>{m.codigo} - {m.descricao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {historicoItem.length > 0 && (
              <ExportButtons
                onPdf={() => { const mat = materiais.find(m => m.id === itemHistoricoId); exportPdf(`Histórico - ${mat?.descricao || ""}`, ["Data", "Tipo", "Local", "Qtd", "Documento", "Lote", "Usuário"],
                  historicoItem.map(m => [formatDate(m.dataMovimentacao), tipoLabel(m.tipo), m.local, formatQty(m.quantidade), m.documentoRef, m.lote, m.usuario])); }}
                onExcel={() => { const mat = materiais.find(m => m.id === itemHistoricoId); exportExcel(`Histórico - ${mat?.descricao || ""}`, ["Data", "Tipo", "Local", "Qtd", "Documento", "Lote", "Usuário"],
                  historicoItem.map(m => [formatDate(m.dataMovimentacao), tipoLabel(m.tipo), m.local, formatQty(m.quantidade), m.documentoRef, m.lote, m.usuario])); }}
              />
            )}
          </div>
          {itemHistoricoId && (
            <>
              {/* Saldo running chart */}
              {historicoItem.length > 0 && (() => {
                const sorted = [...historicoItem].reverse();
                let running = 0;
                const data = sorted.map(m => {
                  if (m.tipo === "entrada") running += m.quantidade;
                  else if (m.tipo === "saida") running -= m.quantidade;
                  else running += m.quantidade;
                  return { data: m.dataMovimentacao ? format(new Date(m.dataMovimentacao), "dd/MM") : "?", saldo: running };
                });
                return (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução do Saldo</CardTitle></CardHeader>
                    <CardContent>
                      <ChartContainer config={{ saldo: { label: "Saldo", color: COLORS[0] } }} className="h-[180px] w-full">
                        <LineChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="data" fontSize={10} />
                          <YAxis fontSize={10} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="saldo" stroke="var(--color-saldo)" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                );
              })()}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead>Documento</TableHead><TableHead>Lote</TableHead><TableHead>Usuário</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {historicoItem.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem movimentações</TableCell></TableRow>
                      : paginate(historicoItem, getPage("historico"), pageSize).paginated.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{formatDate(m.dataMovimentacao)}</TableCell>
                          <TableCell><Badge variant={m.tipo === "entrada" ? "default" : m.tipo === "saida" ? "destructive" : "secondary"} className="text-xs">{tipoLabel(m.tipo)}</Badge></TableCell>
                          <TableCell className="text-xs">{m.local}</TableCell>
                          <TableCell className="text-right font-semibold text-xs">{formatQty(m.quantidade)}</TableCell>
                          <TableCell className="text-xs">{m.documentoRef || "-"}</TableCell>
                          <TableCell className="text-xs">{m.lote || "-"}</TableCell>
                          <TableCell className="text-xs">{m.usuario}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls currentPage={getPage("historico")} totalItems={historicoItem.length} onPageChange={setPage("historico")} pageSize={pageSize} onPageSizeChange={changePageSize} />
            </>
          )}
        </TabsContent>

        {/* 12. Transferências entre depósitos */}
        <TabsContent value="transferencias" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{transferencias.length} transferências</p>
            <ExportButtons
              onPdf={() => exportPdf("Transferências entre Depósitos", ["Data", "Código", "Material", "De", "Para", "Qtd", "Usuário"],
                transferencias.map(m => [formatDate(m.dataMovimentacao), m.materialCodigo, m.materialDescricao, m.depositoOrigem, m.depositoDestino, formatQty(m.quantidade), m.usuario]))}
              onExcel={() => exportExcel("Transferências entre Depósitos", ["Data", "Código", "Material", "De", "Para", "Qtd", "Usuário"],
                transferencias.map(m => [formatDate(m.dataMovimentacao), m.materialCodigo, m.materialDescricao, m.depositoOrigem, m.depositoDestino, formatQty(m.quantidade), m.usuario]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead>Origem</TableHead><TableHead>Destino</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead>Usuário</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transferencias.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma transferência registrada</TableCell></TableRow>
                  : paginate(transferencias, getPage("transferencias"), pageSize).paginated.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{formatDate(m.dataMovimentacao)}</TableCell>
                      <TableCell className="font-mono text-xs">{m.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{m.materialDescricao}</TableCell>
                      <TableCell className="text-xs">{m.depositoOrigem || "-"}</TableCell>
                      <TableCell className="text-xs">{m.depositoDestino || "-"}</TableCell>
                      <TableCell className="text-right font-semibold text-xs">{formatQty(m.quantidade)}</TableCell>
                      <TableCell className="text-xs">{m.usuario}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("transferencias")} totalItems={transferencias.length} onPageChange={setPage("transferencias")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>

        {/* 13. Ajustes realizados */}
        <TabsContent value="ajustes" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{ajustes.length} ajustes</p>
            <ExportButtons
              onPdf={() => exportPdf("Ajustes Realizados", ["Data", "Código", "Material", "Local", "Qtd", "Documento", "Observação", "Usuário"],
                ajustes.map(m => [formatDate(m.dataMovimentacao), m.materialCodigo, m.materialDescricao, m.local, formatQty(m.quantidade), m.documentoRef, m.observacao, m.usuario]))}
              onExcel={() => exportExcel("Ajustes Realizados", ["Data", "Código", "Material", "Local", "Qtd", "Documento", "Observação", "Usuário"],
                ajustes.map(m => [formatDate(m.dataMovimentacao), m.materialCodigo, m.materialDescricao, m.local, formatQty(m.quantidade), m.documentoRef, m.observacao, m.usuario]))}
            />
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Código</TableHead><TableHead>Material</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead>Documento</TableHead><TableHead>Observação</TableHead><TableHead>Usuário</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ajustes.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum ajuste registrado</TableCell></TableRow>
                  : paginate(ajustes, getPage("ajustes"), pageSize).paginated.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{formatDate(m.dataMovimentacao)}</TableCell>
                      <TableCell className="font-mono text-xs">{m.materialCodigo}</TableCell>
                      <TableCell className="text-xs">{m.materialDescricao}</TableCell>
                      <TableCell className="text-xs">{m.local}</TableCell>
                      <TableCell className={cn("text-right font-semibold text-xs", m.quantidade > 0 ? "text-emerald-600" : "text-destructive")}>{m.quantidade > 0 ? "+" : ""}{formatQty(m.quantidade)}</TableCell>
                      <TableCell className="text-xs">{m.documentoRef || "-"}</TableCell>
                      <TableCell className="text-xs">{m.observacao || "-"}</TableCell>
                      <TableCell className="text-xs">{m.usuario}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls currentPage={getPage("ajustes")} totalItems={ajustes.length} onPageChange={setPage("ajustes")} pageSize={pageSize} onPageSizeChange={changePageSize} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
