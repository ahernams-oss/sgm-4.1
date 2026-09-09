import { useState, useMemo } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useOrdensServico, OrdemServico } from "@/contexts/OrdensServicoContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useOsAssinaturas } from "@/contexts/OsAssinaturasContext";
import { gerarPdfOrdemServicoLote } from "@/lib/gerarPdfOrdemServico";
import {
  gerarPdfOrdemServicoComFotosLote,
  gerarPdfOrdemServicoFotosMemoriaLote,
  gerarPdfOrdemServicoFotosMemoriaFotosLote,
} from "@/lib/gerarPdfOrdemServicoFotos";
import { useOrcamentos } from "@/contexts/OrcamentosContext";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { formatNumeroAno } from "@/lib/formatNumero";
import { usePermissao } from "@/hooks/usePermissao";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Printer, Search } from "lucide-react";



export default function ImprimirLoteOs() {
  const { ordens } = useOrdensServico();
  const { clientes } = useClientes();
  const { empresa } = useEmpresa();
  const { assinaturas: assinaturasOs } = useOsAssinaturas();
  const { orcamentos: orcamentosAll } = useOrcamentos();
  const { tem } = usePermissao();
  const podeImprimirLote = tem("os.imprimir_lote");
  const [tipoImpressao, setTipoImpressao] = useState<"os" | "fotos" | "fotos_memoria" | "fotos_memoria_fotos">("os");



  const _saved = loadPersistedFilters<{ search: string; filterCliente: string; filtroDataIni: string; filtroDataFim: string; }>("imprimir_lote_os_filters_v1");
  const [search, setSearch] = useState(_saved?.search ?? "");
  const [filterCliente, setFilterCliente] = useState(_saved?.filterCliente ?? "all");
  const [filtroDataIni, setFiltroDataIni] = useState(_saved?.filtroDataIni ?? "");
  const [filtroDataFim, setFiltroDataFim] = useState(_saved?.filtroDataFim ?? "");
  usePersistFilters("imprimir_lote_os_filters_v1", { search, filterCliente, filtroDataIni, filtroDataFim });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  const [filterSituacao, setFilterSituacao] = useState("all");

  const disponiveis = ordens;

  const situacoesUnicas = useMemo(
    () => Array.from(new Set(ordens.map((o) => o.situacao).filter(Boolean))).sort(),
    [ordens]
  );

  const filtered = useMemo(() => {
    let result = disponiveis;
    if (filterSituacao !== "all") result = result.filter((s) => s.situacao === filterSituacao);
    if (filterCliente !== "all") result = result.filter((s) => s.clienteId === filterCliente);
    if (filtroDataIni) result = result.filter((s) => (s.createdAt || "") >= filtroDataIni);
    if (filtroDataFim) result = result.filter((s) => (s.createdAt || "").slice(0, 10) <= filtroDataFim);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          String(s.numero).includes(q) ||
          formatNumeroAno(s.numero, s.createdAt).toLowerCase().includes(q) ||
          s.clienteNome?.toLowerCase().includes(q) ||
          s.descricaoServicos?.toLowerCase().includes(q) ||
          s.localDescricao?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [disponiveis, search, filterCliente, filterSituacao, filtroDataIni, filtroDataFim]);

  const { paginated } = paginate(filtered, page, pageSize);
  const allPageIds = paginated.map((s) => s.id);
  const allPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) allPageIds.forEach((id) => next.delete(id));
      else allPageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((s) => s.id)));
  };

  const clientesUnicos = useMemo(
    () =>
      (clientes || [])
        .filter((c: any) => (c.tipo || "Cliente") === "Cliente")
        .map((c: any) => [c.id, c.nome] as [string, string])
        .sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [clientes]
  );

  const getMemoriaCalculoDaOS = (os: any): any[] => {
    if (!os?.solicitacaoId) return [];
    const ts = (o: any) => new Date(o.dataAprovacao || o.createdAt || o.dataCriacao || 0).getTime() || 0;
    const orcs = (orcamentosAll || [])
      .filter((o: any) => o.solicitacaoId === os.solicitacaoId)
      .sort((a: any, b: any) => ts(b) - ts(a));
    const aprovados = orcs.filter((o: any) => (o.status || "").toLowerCase().includes("aprovad"));
    const escolhido =
      aprovados.find((o: any) => Array.isArray(o.memoriaCalculo) && o.memoriaCalculo.length) ||
      aprovados[0] ||
      orcs.find((o: any) => Array.isArray(o.memoriaCalculo) && o.memoriaCalculo.length);
    return Array.isArray((escolhido as any)?.memoriaCalculo) ? (escolhido as any).memoriaCalculo : [];
  };

  const handleImprimirLote = async () => {
    if (!podeImprimirLote) {
      toast.error("Você não possui permissão para esta ação.");
      return;
    }
    const lista = ordens
      .filter((o) => selectedIds.has(o.id))
      .map((o) => ({
        os: o,
        empresa,
        cliente: clientes.find((c) => c.id === o.clienteId),
        assinaturas: assinaturasOs.filter((a) => a.os_id === o.id),
        memoriaCalculo: getMemoriaCalculoDaOS(o),
      }));
    if (lista.length === 0) return;
    setPrinting(true);
    try {
      if (tipoImpressao === "fotos") await gerarPdfOrdemServicoComFotosLote(lista);
      else if (tipoImpressao === "fotos_memoria") await gerarPdfOrdemServicoFotosMemoriaLote(lista);
      else if (tipoImpressao === "fotos_memoria_fotos") await gerarPdfOrdemServicoFotosMemoriaFotosLote(lista);
      else await gerarPdfOrdemServicoLote(lista);
      toast.success(`${lista.length} OS impressa(s) em lote.`);
    } catch (e: any) {
      toast.error("Falha ao gerar PDF: " + (e?.message || ""));
    } finally {
      setPrinting(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Printer className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Imprimir OS em Lote</h1>
            <p className="text-sm text-muted-foreground">
              Selecione as Ordens de Serviço e escolha o tipo de impressão em um único PDF
            </p>
          </div>
        </div>
        <Badge variant="secondary">{filtered.length} disponíveis</Badge>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[220px]">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nº, cliente, descrição..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="w-[260px]">
          <Label className="text-xs">Cliente</Label>
          <Select value={filterCliente} onValueChange={(v) => { setFilterCliente(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Clientes</SelectItem>
              {clientesUnicos.map(([id, nome]) => (
                <SelectItem key={id} value={id}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <Label className="text-xs">Situação</Label>
          <Select value={filterSituacao} onValueChange={(v) => { setFilterSituacao(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Situações</SelectItem>
              {situacoesUnicas.map((st) => (
                <SelectItem key={st} value={st}>{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Data Início</Label>
          <Input type="date" value={filtroDataIni} onChange={(e) => { setFiltroDataIni(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label className="text-xs">Data Fim</Label>
          <Input type="date" value={filtroDataFim} onChange={(e) => { setFiltroDataFim(e.target.value); setPage(1); }} />
        </div>
        <div className="w-[320px]">
          <Label className="text-xs">Tipo de impressão</Label>
          <Select value={tipoImpressao} onValueChange={(v) => setTipoImpressao(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="os">Imprimir OS</SelectItem>
              <SelectItem value="fotos">Imprimir OS com Fotos</SelectItem>
              <SelectItem value="fotos_memoria">Imprimir OS com Fotos e Memória de Cálculo</SelectItem>
              <SelectItem value="fotos_memoria_fotos">Imprimir OS com Fotos e Memória de Cálculo com Fotos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-accent rounded-lg border border-border">
          <span className="text-sm font-medium">{selectedIds.size} OS selecionada(s)</span>
          {podeImprimirLote && (
            <Button size="sm" onClick={handleImprimirLote} disabled={printing}>
              <Printer className="mr-2 h-4 w-4" />
              {printing ? "Gerando PDF..." : "Imprimir selecionadas"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={selectAllFiltered}>
            Selecionar todas filtradas ({filtered.length})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todos da página"
                />
              </TableHead>
              <TableHead className="w-16">Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Descrição do Serviço</TableHead>
              <TableHead className="w-32">Solicitante</TableHead>
              <TableHead className="w-40 text-center">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
            <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  <Printer className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhuma OS encontrada
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((s: OrdemServico, idx: number) => (
                <TableRow key={s.id} className={selectedIds.has(s.id) ? "bg-accent/50" : (idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60")}>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onCheckedChange={() => toggleSelect(s.id)}
                      aria-label={`Selecionar OS ${s.numero}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-bold">{formatNumeroAno(s.numero, s.createdAt)}</TableCell>
                  <TableCell>{s.clienteNome || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {[s.localDescricao, s.pavimentoDescricao, s.setorDescricao].filter(Boolean).join(" › ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate">
                    {s.descricaoServicos || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{s.solicitante || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{s.situacao}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        currentPage={page}
        totalItems={filtered.length}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
