import { useState, useMemo } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useNavigate } from "@/lib/router-compat";
import { useCotacaoCompras } from "@/contexts/CotacaoComprasContext";
import { useRequisicaoCompras, ItemRequisicaoCompras, RequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Search, ChevronDown, ChevronRight, Layers, TrendingUp, Combine, Building2 } from "lucide-react";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { usePermissao } from "@/hooks/usePermissao";

interface OrigemItem {
  cotacaoId: string;
  cotacaoNumero: number;
  requisicaoId: string;
  requisicaoNumero: number;
  solicitante: string;
  centroCustoNome: string;
  itemId: string;
  quantidade: number;
  unidadeMedida: string;
  descricao: string;
  especificacaoTecnica: string;
}

interface GrupoItem {
  materialId: string;
  descricao: string;
  unidadeMedida: string;
  quantidadeTotal: number;
  origens: OrigemItem[];
}

interface GrupoRCs {
  key: string;
  centroCusto: string;
  centroCustoNome: string;
  grupoId: string;
  grupoNome: string;
  requisicoes: RequisicaoCompras[];
  totalItens: number;
}

export default function InteligenciaComprasPage() {
  const { cotacoes } = useCotacaoCompras();
  const { requisicoes, addRequisicao, updateStatus } = useRequisicaoCompras();
  const { materiais } = useMateriaisServicos();
  const { grupos: gruposCat, subGrupos, classes } = useCategoriasCompras();
  const { usuarioLogado } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tem } = usePermissao();
  const podeAglutinar = tem("inteligencia_compras.aglutinar");

  const _icSavedFilters = loadPersistedFilters<{ search: string; searchRC: string; }>("inteligencia_compras_filters_v1");
  const [search, setSearch] = useState(_icSavedFilters?.search ?? "");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ===== Tab 2 state =====
  const [searchRC, setSearchRC] = useState(_icSavedFilters?.searchRC ?? "");
  usePersistFilters("inteligencia_compras_filters_v1", { search, searchRC });
  const [selectedRCs, setSelectedRCs] = useState<Record<string, boolean>>({});
  const [expandedRC, setExpandedRC] = useState<Record<string, boolean>>({});
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [confirmRCOpen, setConfirmRCOpen] = useState(false);

  // ===== Pagination =====
  const [pageItens, setPageItens] = useState(1);
  const [pageSizeItens, setPageSizeItens] = useState(7);
  const [pageRCs, setPageRCs] = useState(1);
  const [pageSizeRCs, setPageSizeRCs] = useState(7);

  // Mapa materialId -> grupoId (via classe -> subgrupo -> grupo)
  const materialToGrupo = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>();
    for (const m of materiais) {
      const classe = classes.find(c => c.id === m.categoriaId);
      if (!classe) continue;
      const sub = subGrupos.find(s => s.id === classe.subGrupoId);
      if (!sub) continue;
      const grupo = gruposCat.find(g => g.id === sub.grupoId);
      if (!grupo) continue;
      map.set(m.id, { id: grupo.id, nome: grupo.nome });
    }
    return map;
  }, [materiais, classes, subGrupos, gruposCat]);

  // Apenas cotações abertas (Em Andamento / Aguardando Aprovação)
  const grupos = useMemo<GrupoItem[]>(() => {
    const cotsAbertas = cotacoes.filter(c => c.status === "Em Andamento" || c.status === "Aguardando Aprovação");
    const map = new Map<string, GrupoItem>();

    for (const cot of cotsAbertas) {
      const req = requisicoes.find(r => r.id === cot.requisicaoId);
      if (!req) continue;
      for (const item of req.itens) {
        if (!item.materialId) continue;
        const key = item.materialId;
        const origem: OrigemItem = {
          cotacaoId: cot.id, cotacaoNumero: cot.numero,
          requisicaoId: req.id, requisicaoNumero: req.numero,
          solicitante: req.solicitante, centroCustoNome: req.centroCustoNome,
          itemId: item.id, quantidade: item.quantidade, unidadeMedida: item.unidadeMedida,
          descricao: item.descricao, especificacaoTecnica: item.especificacaoTecnica,
        };
        const existing = map.get(key);
        if (existing) { existing.quantidadeTotal += item.quantidade; existing.origens.push(origem); }
        else { map.set(key, { materialId: item.materialId, descricao: item.descricao, unidadeMedida: item.unidadeMedida, quantidadeTotal: item.quantidade, origens: [origem] }); }
      }
    }
    return Array.from(map.values()).filter(g => g.origens.length >= 2).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);
  }, [cotacoes, requisicoes]);

  // ===== Grupos de RCs por CC + Grupo de Material =====
  const gruposRCs = useMemo<GrupoRCs[]>(() => {
    // Considera RCs ainda não cotadas
    const rcsCandidatas = requisicoes.filter(r => r.status === "Enviada" || r.status === "Rascunho");
    const map = new Map<string, GrupoRCs>();

    for (const rc of rcsCandidatas) {
      // Determina os grupos de materiais presentes nesta RC
      const gruposNaRC = new Map<string, { id: string; nome: string }>();
      for (const item of rc.itens) {
        if (!item.materialId) continue;
        const g = materialToGrupo.get(item.materialId);
        if (g) gruposNaRC.set(g.id, g);
      }

      // Para cada grupo distinto, registra a RC sob a chave CC+grupo
      for (const g of gruposNaRC.values()) {
        const key = `${rc.centroCusto}::${g.id}`;
        const existing = map.get(key);
        const itensDoGrupo = rc.itens.filter(i => i.materialId && materialToGrupo.get(i.materialId)?.id === g.id).length;
        if (existing) {
          existing.requisicoes.push(rc);
          existing.totalItens += itensDoGrupo;
        } else {
          map.set(key, {
            key,
            centroCusto: rc.centroCusto,
            centroCustoNome: rc.centroCustoNome,
            grupoId: g.id,
            grupoNome: g.nome,
            requisicoes: [rc],
            totalItens: itensDoGrupo,
          });
        }
      }
    }

    return Array.from(map.values())
      .filter(g => g.requisicoes.length >= 2)
      .sort((a, b) => b.requisicoes.length - a.requisicoes.length);
  }, [requisicoes, materialToGrupo]);

  const filteredRCGroups = useMemo(() => {
    const q = searchRC.trim().toLowerCase();
    if (!q) return gruposRCs;
    return gruposRCs.filter(g => g.centroCustoNome.toLowerCase().includes(q) || g.grupoNome.toLowerCase().includes(q));
  }, [gruposRCs, searchRC]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter(g => g.descricao.toLowerCase().includes(q) || g.materialId.toLowerCase().includes(q));
  }, [grupos, search]);

  const selectedGroups = filtered.filter(g => selected[g.materialId]);
  const totalItensConsolidados = selectedGroups.length;
  const totalQuantidade = selectedGroups.reduce((sum, g) => sum + g.quantidadeTotal, 0);
  const totalRCs = new Set(selectedGroups.flatMap(g => g.origens.map(o => o.requisicaoId))).size;

  const toggleSelectAll = (val: boolean) => {
    const novo: Record<string, boolean> = {};
    if (val) filtered.forEach(g => { novo[g.materialId] = true; });
    setSelected(novo);
  };

  const handleConsolidar = async () => {
    if (!podeAglutinar) {
      toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" });
      return;
    }
    if (selectedGroups.length === 0) {
      toast({ title: "Selecione ao menos 1 item para consolidar", variant: "destructive" });
      return;
    }
    const rcsOrigem = [...new Set(selectedGroups.flatMap(g => g.origens.map(o => o.requisicaoNumero)))].sort((a, b) => a - b);
    const itensConsolidados: ItemRequisicaoCompras[] = selectedGroups.map(g => ({
      id: crypto.randomUUID(),
      materialId: g.materialId,
      descricao: g.descricao,
      especificacaoTecnica: g.origens[0]?.especificacaoTecnica || "",
      observacao: `Consolidado de ${g.origens.length} requisições: RC ${g.origens.map(o => o.requisicaoNumero).join(", ")}`,
      quantidade: g.quantidadeTotal,
      unidadeMedida: g.unidadeMedida,
    }));
    const justificativa = `Cotação consolidada gerada via Inteligência de Compras. Origem: RC ${rcsOrigem.join(", ")}. Objetivo: aumentar poder de barganha unificando volumes.`;
    await addRequisicao({
      solicitante: usuarioLogado?.nome || "Inteligência de Compras",
      centroCusto: "CONSOLIDADO", centroCustoNome: "Consolidado (Múltiplos CCs)",
      localEntrega: "", justificativa, urgencia: "Baixa", prazoDesejado: "",
      itens: itensConsolidados, anexos: [],
    });
    for (const grupo of selectedGroups) {
      const reqsUnicos = [...new Set(grupo.origens.map(o => o.requisicaoId))];
      for (const reqId of reqsUnicos) {
        const r = requisicoes.find(x => x.id === reqId);
        if (!r) continue;
        await updateStatus(reqId, r.status, usuarioLogado?.nome || "Inteligência",
          `Item "${grupo.descricao}" incluído em cotação consolidada (Inteligência de Compras)`);
      }
    }
    toast({ title: `Requisição consolidada criada com ${itensConsolidados.length} item(ns) de ${rcsOrigem.length} RC(s).` });
    setConfirmOpen(false);
    setSelected({});
    navigate("/compras/requisicoes");
  };

  // ===== Handler Tab 2: juntar RCs por CC + Grupo =====
  const activeGroup = gruposRCs.find(g => g.key === activeGroupKey) || null;
  const selectedRCList = activeGroup ? activeGroup.requisicoes.filter(r => selectedRCs[r.id]) : [];

  const handleJuntarRCs = async () => {
    if (!podeAglutinar) {
      toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" });
      return;
    }
    if (!activeGroup || selectedRCList.length < 2) {
      toast({ title: "Selecione ao menos 2 requisições para juntar", variant: "destructive" });
      return;
    }

    // Agrega apenas itens do grupo selecionado, somando quantidades por material
    const agg = new Map<string, ItemRequisicaoCompras>();
    const outrosItens: ItemRequisicaoCompras[] = [];
    for (const rc of selectedRCList) {
      for (const item of rc.itens) {
        const grupoItem = item.materialId ? materialToGrupo.get(item.materialId) : null;
        if (grupoItem && grupoItem.id === activeGroup.grupoId) {
          const ex = agg.get(item.materialId);
          if (ex) { ex.quantidade += item.quantidade; }
          else {
            agg.set(item.materialId, {
              id: crypto.randomUUID(),
              materialId: item.materialId,
              descricao: item.descricao,
              especificacaoTecnica: item.especificacaoTecnica,
              observacao: item.observacao,
              quantidade: item.quantidade,
              unidadeMedida: item.unidadeMedida,
            });
          }
        } else {
          // Itens fora do grupo selecionado permanecem nas RCs originais (não migram)
        }
      }
    }

    const itensConsolidados = Array.from(agg.values());
    const rcsNumeros = selectedRCList.map(r => r.numero).sort((a, b) => a - b);
    const justificativa = `RCs unificadas via Inteligência de Compras — Centro de Custo "${activeGroup.centroCustoNome}", Grupo "${activeGroup.grupoNome}". Origem: RC ${rcsNumeros.join(", ")}.`;

    await addRequisicao({
      solicitante: usuarioLogado?.nome || "Inteligência de Compras",
      centroCusto: activeGroup.centroCusto,
      centroCustoNome: activeGroup.centroCustoNome,
      localEntrega: selectedRCList[0]?.localEntrega || "",
      justificativa,
      urgencia: "Baixa",
      prazoDesejado: "",
      itens: itensConsolidados,
      anexos: [],
    });

    for (const rc of selectedRCList) {
      await updateStatus(rc.id, rc.status, usuarioLogado?.nome || "Inteligência",
        `Itens do grupo "${activeGroup.grupoNome}" incluídos em RC unificada (Inteligência de Compras)`);
    }

    toast({ title: `RC unificada criada com ${itensConsolidados.length} item(ns) de ${selectedRCList.length} requisições.` });
    setConfirmRCOpen(false);
    setSelectedRCs({});
    setActiveGroupKey(null);
    navigate("/compras/requisicoes");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Inteligência de Compras</h1>
          <p className="text-sm text-muted-foreground">
            Aglutina itens e requisições para aumentar poder de barganha pela escala.
          </p>
        </div>
      </div>

      <Tabs defaultValue="itens" className="space-y-4">
        <TabsList>
          <TabsTrigger value="itens"><Layers className="h-4 w-4 mr-2" />Por Item (Cotações abertas)</TabsTrigger>
          <TabsTrigger value="rcs"><Building2 className="h-4 w-4 mr-2" />Por Centro de Custo + Grupo</TabsTrigger>
        </TabsList>

        {/* ============ TAB 1 — Por Item ============ */}
        <TabsContent value="itens" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Itens com potencial</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{grupos.length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Selecionados</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalItensConsolidados}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Volume consolidado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalQuantidade.toLocaleString("pt-BR")}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">RCs envolvidas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalRCs}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Itens aglutináveis</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar item..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-64" />
                </div>
                {podeAglutinar && (
                  <Button onClick={() => setConfirmOpen(true)} disabled={selectedGroups.length === 0}>
                    <Combine className="h-4 w-4 mr-2" /> Gerar Cotação Consolidada
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum item duplicado encontrado em cotações abertas no momento.</p>
                  <p className="text-xs mt-1">A inteligência considera apenas itens vinculados ao catálogo de materiais.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={filtered.length > 0 && filtered.every(g => selected[g.materialId])} onCheckedChange={(v) => toggleSelectAll(!!v)} />
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Origens</TableHead>
                      <TableHead className="text-right">Qtd. Total</TableHead>
                      <TableHead>UN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginate(filtered, pageItens, pageSizeItens).paginated.map((g) => (
                      <Collapsible key={g.materialId} open={!!expanded[g.materialId]} onOpenChange={(v) => setExpanded(p => ({ ...p, [g.materialId]: v }))} asChild>
                        <>
                          <TableRow>
                            <TableCell><Checkbox checked={!!selected[g.materialId]} onCheckedChange={(v) => setSelected(p => ({ ...p, [g.materialId]: !!v }))} /></TableCell>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">{expanded[g.materialId] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium">{g.descricao}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary">{g.origens.length}</Badge></TableCell>
                            <TableCell className="text-right font-semibold">{g.quantidadeTotal.toLocaleString("pt-BR")}</TableCell>
                            <TableCell>{g.unidadeMedida}</TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30 p-0">
                                <div className="p-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Cotação</TableHead><TableHead>RC</TableHead><TableHead>Solicitante</TableHead><TableHead>Centro de Custo</TableHead><TableHead className="text-right">Qtd.</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {g.origens.map((o, i) => (
                                        <TableRow key={i}>
                                          <TableCell>COT-{String(o.cotacaoNumero).padStart(4, "0")}</TableCell>
                                          <TableCell>RC-{String(o.requisicaoNumero).padStart(4, "0")}</TableCell>
                                          <TableCell>{o.solicitante}</TableCell>
                                          <TableCell>{o.centroCustoNome}</TableCell>
                                          <TableCell className="text-right">{o.quantidade.toLocaleString("pt-BR")} {o.unidadeMedida}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filtered.length > 0 && (
                <PaginationControls currentPage={pageItens} totalItems={filtered.length} onPageChange={setPageItens} pageSize={pageSizeItens} onPageSizeChange={(s) => { setPageSizeItens(s); setPageItens(1); }} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB 2 — Por Centro de Custo + Grupo ============ */}
        <TabsContent value="rcs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Combinações detectadas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{gruposRCs.length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">RCs candidatas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{new Set(gruposRCs.flatMap(g => g.requisicoes.map(r => r.id))).size}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Centros de Custo</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{new Set(gruposRCs.map(g => g.centroCusto)).size}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Requisições agrupáveis (mesmo CC + mesmo Grupo)</CardTitle>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar CC ou grupo..." value={searchRC} onChange={(e) => setSearchRC(e.target.value)} className="pl-8 w-64" />
              </div>
            </CardHeader>
            <CardContent>
              {filteredRCGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum conjunto de RCs aglutinável encontrado.</p>
                  <p className="text-xs mt-1">Considera RCs em status "Rascunho" ou "Enviada" com materiais do mesmo grupo no mesmo centro de custo.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Grupo de Material</TableHead>
                      <TableHead className="text-center">RCs</TableHead>
                      <TableHead className="text-center">Itens</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginate(filteredRCGroups, pageRCs, pageSizeRCs).paginated.map((g) => (
                      <Collapsible key={g.key} open={!!expandedRC[g.key]} onOpenChange={(v) => setExpandedRC(p => ({ ...p, [g.key]: v }))} asChild>
                        <>
                          <TableRow>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">{expandedRC[g.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium">{g.centroCustoNome}</TableCell>
                            <TableCell>{g.grupoNome}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary">{g.requisicoes.length}</Badge></TableCell>
                            <TableCell className="text-center">{g.totalItens}</TableCell>
                            <TableCell className="text-right">
                              {podeAglutinar && (
                                <Button size="sm" onClick={() => {
                                  setActiveGroupKey(g.key);
                                  const sel: Record<string, boolean> = {};
                                  g.requisicoes.forEach(r => { sel[r.id] = true; });
                                  setSelectedRCs(sel);
                                  setConfirmRCOpen(true);
                                }}>
                                  <Combine className="h-4 w-4 mr-2" /> Juntar RCs
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30 p-0">
                                <div className="p-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>RC</TableHead><TableHead>Solicitante</TableHead><TableHead>Urgência</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Itens do grupo</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {g.requisicoes.map((r) => {
                                        const qtdItensGrupo = r.itens.filter(i => i.materialId && materialToGrupo.get(i.materialId)?.id === g.grupoId).length;
                                        return (
                                          <TableRow key={r.id}>
                                            <TableCell>RC-{String(r.numero).padStart(4, "0")}</TableCell>
                                            <TableCell>{r.solicitante}</TableCell>
                                            <TableCell>{r.urgencia}</TableCell>
                                            <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                                            <TableCell className="text-center">{qtdItensGrupo}</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filteredRCGroups.length > 0 && (
                <PaginationControls currentPage={pageRCs} totalItems={filteredRCGroups.length} onPageChange={setPageRCs} pageSize={pageSizeRCs} onPageSizeChange={(s) => { setPageSizeRCs(s); setPageRCs(1); }} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Tab 1 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cotação Consolidada</DialogTitle>
            <DialogDescription>
              Será criada uma <strong>nova Requisição de Compras consolidada</strong> contendo {totalItensConsolidados} item(ns), totalizando {totalQuantidade.toLocaleString("pt-BR")} unidades, agrupadas de {totalRCs} RC(s).
              <br /><br />
              As RCs originais permanecerão ativas — registramos no histórico delas a inclusão na consolidação para rastreabilidade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleConsolidar}>Confirmar e Consolidar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tab 2 — Juntar RCs */}
      <Dialog open={confirmRCOpen} onOpenChange={(v) => { setConfirmRCOpen(v); if (!v) { setActiveGroupKey(null); setSelectedRCs({}); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Juntar Requisições</DialogTitle>
            <DialogDescription>
              {activeGroup ? (
                <>
                  Selecione as RCs do centro de custo <strong>{activeGroup.centroCustoNome}</strong> com itens do grupo <strong>{activeGroup.grupoNome}</strong> que deseja unificar.
                  Será gerada uma nova RC contendo apenas os itens deste grupo, somando as quantidades por material.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          {activeGroup && (
            <div className="max-h-80 overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>RC</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Itens do grupo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeGroup.requisicoes.map((r) => {
                    const qtdItensGrupo = r.itens.filter(i => i.materialId && materialToGrupo.get(i.materialId)?.id === activeGroup.grupoId).length;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox checked={!!selectedRCs[r.id]} onCheckedChange={(v) => setSelectedRCs(p => ({ ...p, [r.id]: !!v }))} />
                        </TableCell>
                        <TableCell>RC-{String(r.numero).padStart(4, "0")}</TableCell>
                        <TableCell>{r.solicitante}</TableCell>
                        <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                        <TableCell className="text-center">{qtdItensGrupo}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRCOpen(false)}>Cancelar</Button>
            <Button onClick={handleJuntarRCs} disabled={selectedRCList.length < 2}>
              <Combine className="h-4 w-4 mr-2" /> Juntar {selectedRCList.length} RC(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
