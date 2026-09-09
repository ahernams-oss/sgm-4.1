import { useState, useMemo } from "react";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { useMaterialScoVinculos } from "@/contexts/MaterialScoVinculosContext";
import { useEstoque, MovimentacaoEstoque, SaldoEstoque } from "@/contexts/EstoqueContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";
import { verificarSenhaUsuario } from "@/lib/verifySenha";
import { useClientes } from "@/contexts/ClientesContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle, ClipboardList, Package, Warehouse, TrendingDown, ChevronsUpDown, Check, Pencil, ArrowLeftRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import type { ReactNode } from "react";

export default function EstoquePage() {
  const { getVinculos } = useMaterialScoVinculos();
  const { movimentacoes, inventarios, registrarMovimentacao, getSaldos, getSaldoPorMaterial, getSaldoPorLocal, getLotesFIFO, transferirEntreLocais, criarInventario, atualizarInventario, fecharInventario, atualizarValorMovimentacao } = useEstoque();
  const { materiais } = useMateriaisServicos();
  const { usuarioLogado } = useAuth();
  const { tem } = usePermissao();
  const { clientes } = useClientes();
  const { pedidos } = usePedidoCompra();
  const { requisicoes } = useRequisicaoCompras();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("saldos");
  const [pageSaldos, setPageSaldos] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageMov, setPageMov] = useState(1);
  const [pageAlertas, setPageAlertas] = useState(1);
  const [pageInv, setPageInv] = useState(1);

  const colDefsSaldos: Record<string, { label: string; className?: string }> = {
    codigo: { label: "Código", className: "text-center" },
    material: { label: "Material/Serviço" },
    centroCusto: { label: "Centro de Custo" },
    local: { label: "Local" },
    quantidade: { label: "Quantidade", className: "text-center" },
    vlrUnit: { label: "Vlr Unit. (FIFO)", className: "text-center" },
    vlrTotal: { label: "Vlr Total", className: "text-center" },
    acoes: { label: "Ações", className: "text-center" },
  };
  const { order: colOrderSaldos, setOrder: setColOrderSaldos } = useColumnOrder(
    "compras.estoque.saldos",
    ["codigo", "material", "centroCusto", "local", "quantidade", "vlrUnit", "vlrTotal", "acoes"]
  );

  const colDefsMov: Record<string, { label: string; className?: string }> = {
    data: { label: "Data", className: "text-center" },
    tipo: { label: "Tipo", className: "text-center" },
    codigo: { label: "Código", className: "text-center" },
    material: { label: "Material" },
    centroCusto: { label: "Centro de Custo" },
    local: { label: "Local" },
    qtd: { label: "Qtd", className: "text-center" },
    codSco: { label: "Cód. SCO", className: "text-center" },
    qtdSco: { label: "Qtd SCO", className: "text-center" },
    vlrUnit: { label: "Vlr Unit.", className: "text-center" },
    documento: { label: "Documento", className: "text-center" },
    usuario: { label: "Usuário", className: "text-center" },
  };
  const { order: colOrderMov, setOrder: setColOrderMov } = useColumnOrder(
    "compras.estoque.movimentacoes",
    ["data", "tipo", "codigo", "material", "centroCusto", "local", "qtd", "codSco", "qtdSco", "vlrUnit", "documento", "usuario"]
  );

  const colDefsAlertas: Record<string, { label: string; className?: string }> = {
    codigo: { label: "Código", className: "text-center" },
    material: { label: "Material" },
    estoqueMinimo: { label: "Estoque Mínimo", className: "text-center" },
    saldoAtual: { label: "Saldo Atual", className: "text-center" },
    status: { label: "Status", className: "text-center" },
  };
  const { order: colOrderAlertas, setOrder: setColOrderAlertas } = useColumnOrder(
    "compras.estoque.alertas",
    ["codigo", "material", "estoqueMinimo", "saldoAtual", "status"]
  );

  const colDefsInv: Record<string, { label: string; className?: string }> = {
    data: { label: "Data", className: "text-center" },
    local: { label: "Local" },
    itens: { label: "Itens", className: "text-center" },
    usuario: { label: "Usuário", className: "text-center" },
    status: { label: "Status", className: "text-center" },
  };
  const { order: colOrderInv, setOrder: setColOrderInv } = useColumnOrder(
    "compras.estoque.inventarios",
    ["data", "local", "itens", "usuario", "status"]
  );

  // Filtros
  const [filtroCentroCusto, setFiltroCentroCusto] = useState("todos");
  const [filtroMaterial, setFiltroMaterial] = useState("todos");
  const [filtroLocal, setFiltroLocal] = useState("todos");

  // Movimentação dialog

  const [movDialogOpen, setMovDialogOpen] = useState(false);
  const [movTipo, setMovTipo] = useState<"entrada" | "saida">("entrada");
  const [movMaterialId, setMovMaterialId] = useState("");
  const [movMaterialPopoverOpen, setMovMaterialPopoverOpen] = useState(false);
  const [movQuantidade, setMovQuantidade] = useState("");
  const [movLocal, setMovLocal] = useState("");
  const [movDocRef, setMovDocRef] = useState("");
  const [movObs, setMovObs] = useState("");
  const [movValorUnit, setMovValorUnit] = useState("");
  const [movVinculoId, setMovVinculoId] = useState("");

  // Inventário dialog
  const [invDialogOpen, setInvDialogOpen] = useState(false);
  const [invLocal, setInvLocal] = useState("");
  const [invCentroCusto, setInvCentroCusto] = useState("");
  const [invObs, setInvObs] = useState("");
  const [invItens, setInvItens] = useState<{ materialId: string; materialCodigo: string; materialDescricao: string; saldoSistema: number; quantidadeContada: number; diferenca: number; observacao: string }[]>([]);
  const [editInvId, setEditInvId] = useState<string | null>(null);

  // Estoque mínimo dialog
  const [minDialogOpen, setMinDialogOpen] = useState(false);
  const [minMaterialId, setMinMaterialId] = useState("");
  const [minValue, setMinValue] = useState("");

  // Transferência dialog
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferMaterialId, setTransferMaterialId] = useState("");
  const [transferMaterialPopoverOpen, setTransferMaterialPopoverOpen] = useState(false);
  const [transferOrigem, setTransferOrigem] = useState("");
  const [transferDestino, setTransferDestino] = useState("");
  const [transferQuantidade, setTransferQuantidade] = useState("");
  const [transferObs, setTransferObs] = useState("");
  const [transferSenha, setTransferSenha] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  // Editar preços dialog
  const [precoDialogOpen, setPrecoDialogOpen] = useState(false);
  const [precoSaldo, setPrecoSaldo] = useState<SaldoEstoque | null>(null);
  const [precoLotes, setPrecoLotes] = useState<{ id: string; data: string; documento: string; quantidade: number; valorUnitario: string }[]>([]);
  const [precoSaving, setPrecoSaving] = useState(false);

  const openPrecoDialog = (s: SaldoEstoque) => {
    const lotes = getLotesFIFO(s.materialId, s.local);
    setPrecoSaldo(s);
    setPrecoLotes(lotes.map(l => ({
      id: l.movimentacaoId,
      data: l.dataMovimentacao,
      documento: l.documentoRef,
      quantidade: l.quantidade,
      valorUnitario: (l.valorUnitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
    })));
    setPrecoDialogOpen(true);
  };

  const handleSavePrecos = async () => {
    setPrecoSaving(true);
    try {
      for (const l of precoLotes) {
        const v = Number(String(l.valorUnitario).replace(/\./g, "").replace(",", ".")) || 0;
        await atualizarValorMovimentacao(l.id, v);
      }
      toast({ title: "Preços atualizados com sucesso" });
      setPrecoDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao atualizar preços", description: e?.message, variant: "destructive" });
    } finally {
      setPrecoSaving(false);
    }
  };

  const locais = useMemo(() => {
    const locs = new Set<string>();
    clientes.filter(c => c.tipo !== "Fornecedor").forEach(c => {
      if (c.nome) locs.add(c.nome);
    });
    return Array.from(locs).sort();
  }, [clientes]);

  // Locais apenas de clientes (sem fornecedores) para saídas
  const locaisClientes = useMemo(() => {
    const locs = new Set<string>();
    clientes.filter(c => c.tipo !== "Fornecedor").forEach(c => {
      if (c.nome) locs.add(c.nome);
      const locaisArr = (c as any).locais || [];
      locaisArr.forEach((l: any) => { if (l?.nome) locs.add(`${c.nome} - ${l.nome}`); });
    });
    return Array.from(locs).sort();
  }, [clientes]);

  // Centro de custo lookup: pedidoNumero → centroCustoNome
  const centroCustoMap = useMemo(() => {
    const map = new Map<number, string>();
    pedidos.forEach(p => {
      const rc = requisicoes.find(r => r.id === p.requisicaoId);
      if (rc?.centroCustoNome) map.set(p.numero, rc.centroCustoNome);
    });
    return map;
  }, [pedidos, requisicoes]);

  const getCentroCustoFromDocRef = (docRef: string): string => {
    const match = docRef.match(/Pedido\s+(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      return centroCustoMap.get(num) || "-";
    }
    return "-";
  };

  // Map each movement → centro de custo
  const movCentroCusto = useMemo(() => {
    const map = new Map<string, string>();
    movimentacoes.forEach(m => {
      const cc = getCentroCustoFromDocRef(m.documentoRef);
      if (cc !== "-") {
        map.set(m.id, cc);
      }
    });
    return map;
  }, [movimentacoes, centroCustoMap]);

  // Available centros de custo (from requisições + movements)
  const centrosCustoDisponiveis = useMemo(() => {
    const ccs = new Set<string>();
    requisicoes.forEach(r => {
      if (r.centroCustoNome) ccs.add(r.centroCustoNome);
    });
    movimentacoes.forEach(m => {
      const cc = getCentroCustoFromDocRef(m.documentoRef);
      if (cc !== "-") ccs.add(cc);
    });
    return Array.from(ccs).sort();
  }, [requisicoes, movimentacoes, centroCustoMap]);

  // Map saldo (material+local) → centro de custo from most recent movement
  const saldoCentroCusto = useMemo(() => {
    const map = new Map<string, string>();
    // Process movements in order so latest wins
    movimentacoes.forEach(m => {
      const cc = getCentroCustoFromDocRef(m.documentoRef);
      if (cc !== "-") {
        map.set(`${m.materialId}|${m.local}`, cc);
      }
    });
    return map;
  }, [movimentacoes, centroCustoMap]);

  // Locais disponíveis
  const locaisDisponiveis = useMemo(() => {
    const set = new Set<string>();
    movimentacoes.forEach(m => { if (m.local) set.add(m.local); });
    return Array.from(set).sort();
  }, [movimentacoes]);

  // === SALDOS ===
  const saldos = useMemo(() => {
    const all = getSaldos();
    const s = search.toLowerCase();
    return all.filter(sl => {
      if (search && !(sl.materialCodigo.toLowerCase().includes(s) || sl.materialDescricao.toLowerCase().includes(s) || sl.local.toLowerCase().includes(s))) return false;
      if (filtroMaterial !== "todos" && sl.materialId !== filtroMaterial) return false;
      if (filtroLocal !== "todos" && sl.local !== filtroLocal) return false;
      if (filtroCentroCusto !== "todos" && (saldoCentroCusto.get(`${sl.materialId}|${sl.local}`) || "-") !== filtroCentroCusto) return false;
      return true;
    });
  }, [getSaldos, search, filtroMaterial, filtroLocal, filtroCentroCusto, saldoCentroCusto]);


  // Saldos agrupados por centro de custo + material
  const getSaldosPorCentroCusto = (centroCusto: string) => {
    const materialMap = new Map<string, { materialId: string; materialCodigo: string; materialDescricao: string; quantidade: number }>();
    movimentacoes.forEach(m => {
      const cc = getCentroCustoFromDocRef(m.documentoRef);
      if (cc !== centroCusto) return;
      const key = m.materialId;
      if (!materialMap.has(key)) {
        materialMap.set(key, { materialId: m.materialId, materialCodigo: m.materialCodigo, materialDescricao: m.materialDescricao, quantidade: 0 });
      }
      const s = materialMap.get(key)!;
      if (m.tipo === "entrada") s.quantidade += m.quantidade;
      else if (m.tipo === "saida") s.quantidade -= m.quantidade;
      else s.quantidade += m.quantidade;
    });
    return Array.from(materialMap.values()).filter(s => s.quantidade !== 0);
  };

  // === ALERTAS ===
  const alertas = useMemo(() => {
    return materiais
      .filter(m => {
        const min = (m as any).estoqueMinimo || 0;
        if (min <= 0) return false;
        const saldo = getSaldoPorMaterial(m.id);
        return saldo <= min;
      })
      .map(m => ({
        ...m,
        estoqueMinimo: (m as any).estoqueMinimo || 0,
        saldoAtual: getSaldoPorMaterial(m.id),
      }));
  }, [materiais, getSaldoPorMaterial]);

  // === MOVIMENTAÇÕES ===
  const movFiltered = useMemo(() => {
    const s = search.toLowerCase();
    return [...movimentacoes].reverse().filter(m => {
      if (search && !(m.materialCodigo.toLowerCase().includes(s) || m.materialDescricao.toLowerCase().includes(s) || m.local.toLowerCase().includes(s))) return false;
      if (filtroMaterial !== "todos" && m.materialId !== filtroMaterial) return false;
      if (filtroLocal !== "todos" && m.local !== filtroLocal) return false;
      if (filtroCentroCusto !== "todos" && getCentroCustoFromDocRef(m.documentoRef) !== filtroCentroCusto) return false;
      return true;
    });
  }, [movimentacoes, search, filtroMaterial, filtroLocal, filtroCentroCusto, centroCustoMap]);


  // KPIs
  const totalItensEstoque = useMemo(() => saldos.reduce((s, i) => s + i.quantidade, 0), [saldos]);
  const totalLocais = useMemo(() => new Set(saldos.map(s => s.local)).size, [saldos]);

  const openMovDialog = (tipo: "entrada" | "saida") => {
    setMovTipo(tipo);
    setMovMaterialId("");
    setMovQuantidade("");
    setMovLocal("");
    setMovDocRef("");
    setMovObs("");
    setMovValorUnit("");
    setMovVinculoId("");
    setMovDialogOpen(true);
  };

  const vinculosMaterial = useMemo(
    () => (movMaterialId ? getVinculos(movMaterialId) : []),
    [movMaterialId, getVinculos]
  );
  const vinculoSel = vinculosMaterial.find(v => v.id === movVinculoId);

  const handleMovSave = async () => {
    const podeMov = movTipo === "entrada" ? podeEntrada : podeSaida;
    if (!podeMov) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!movMaterialId || !movQuantidade || !movLocal) {
      toast({ title: "Preencha Material, Quantidade e Local", variant: "destructive" });
      return;
    }
    const mat = materiais.find(m => m.id === movMaterialId);
    if (!mat) return;
    const qty = Number(movQuantidade);
    if (qty <= 0) { toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return; }
    if (movTipo === "saida") {
      const saldo = getSaldoPorMaterial(mat.id);
      if (qty > saldo) { toast({ title: `Saldo insuficiente. Disponível: ${saldo}`, variant: "destructive" }); return; }
    }
    const valorUnit = movTipo === "entrada" ? Number(String(movValorUnit).replace(/\./g, "").replace(",", ".")) || 0 : 0;
    await registrarMovimentacao({
      materialId: mat.id, materialCodigo: mat.codigo, materialDescricao: mat.descricao,
      tipo: movTipo, quantidade: qty, local: movLocal,
      documentoRef: movDocRef, observacao: movObs,
      usuario: usuarioLogado?.nome || "",
      lote: "", validade: "", depositoOrigem: "", depositoDestino: "", fornecedorNome: "", valorUnitario: valorUnit,
      codSco: vinculoSel?.codSco || "", descricaoSco: vinculoSel?.descricaoSco || "",
      quantidadeSco: vinculoSel ? qty * vinculoSel.fatorConversao : 0,
      fatorConversao: vinculoSel?.fatorConversao || 1,
    });
    toast({ title: `${movTipo === "entrada" ? "Entrada" : "Saída"} registrada com sucesso` });
    setMovDialogOpen(false);
  };

  const openInvDialog = () => {
    setInvLocal("");
    setInvCentroCusto("");
    setInvObs("");
    setInvItens([]);
    setEditInvId(null);
    setInvDialogOpen(true);
  };

  const loadInvItens = (centroCusto: string) => {
    setInvCentroCusto(centroCusto);
    setInvLocal(centroCusto);
    const saldosCC = getSaldosPorCentroCusto(centroCusto);
    setInvItens(saldosCC.map(s => ({
      materialId: s.materialId, materialCodigo: s.materialCodigo,
      materialDescricao: s.materialDescricao, saldoSistema: s.quantidade,
      quantidadeContada: s.quantidade, diferenca: 0, observacao: "",
    })));
  };

  const handleEditInventario = (inv: any) => {
    setEditInvId(inv.id);
    setInvLocal(inv.local);
    setInvCentroCusto(inv.local);
    setInvObs(inv.observacao || "");

    const itensSalvos = Array.isArray(inv.itens) ? inv.itens : [];
    if (itensSalvos.length > 0) {
      setInvItens(itensSalvos.map((it: any) => ({
        materialId: it.materialId, materialCodigo: it.materialCodigo,
        materialDescricao: it.materialDescricao, saldoSistema: Number(it.saldoSistema || 0),
        quantidadeContada: Number(it.quantidadeContada || 0), diferenca: Number(it.quantidadeContada || 0) - Number(it.saldoSistema || 0),
        observacao: it.observacao || "",
      })));
    } else {
      const saldosCC = getSaldosPorCentroCusto(inv.local);
      setInvItens(saldosCC.map(s => ({
        materialId: s.materialId, materialCodigo: s.materialCodigo,
        materialDescricao: s.materialDescricao, saldoSistema: s.quantidade,
        quantidadeContada: s.quantidade, diferenca: 0, observacao: "",
      })));
    }

    setInvDialogOpen(true);
  };

  const handleInvSave = async () => {
    if (!podeCriarInv) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!invCentroCusto) { toast({ title: "Selecione um centro de custo", variant: "destructive" }); return; }
    if (invItens.length === 0) { toast({ title: "Nenhum item encontrado para este centro de custo", variant: "destructive" }); return; }
    if (editInvId) {
      await atualizarInventario(editInvId, invItens, invObs);
      toast({ title: "Inventário atualizado" });
    } else {
      await criarInventario({ local: invCentroCusto, itens: invItens, usuario: usuarioLogado?.nome || "", observacao: invObs });
      toast({ title: "Inventário criado" });
    }
    setInvDialogOpen(false);
  };

  const handleFecharInventario = async (id: string) => {
    if (!podeFecharInv) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    await fecharInventario(id, usuarioLogado?.nome || "");
    toast({ title: "Inventário fechado e ajustes aplicados" });
  };

  const podeTransferir = tem("estoque.transferir_locais");
  const podeEntrada = tem("estoque.registrar_entrada");
  const podeSaida = tem("estoque.registrar_saida");
  const podeCriarInv = tem("estoque.criar_inventario");
  const podeFecharInv = tem("estoque.finalizar_inventario");

  const openTransferDialog = () => {
    if (!podeTransferir) {
      toast({ title: "Sem permissão", description: "Seu perfil não tem permissão para transferir entre locais.", variant: "destructive" });
      return;
    }
    setTransferMaterialId("");
    setTransferOrigem("");
    setTransferDestino("");
    setTransferQuantidade("");
    setTransferObs("");
    setTransferSenha("");
    setTransferDialogOpen(true);
  };

  const transferLocaisOrigem = useMemo(() => {
    if (!transferMaterialId) return [];
    const locs = new Set<string>();
    movimentacoes.filter(m => m.materialId === transferMaterialId).forEach(m => { if (m.local) locs.add(m.local); });
    return Array.from(locs).filter(l => getSaldoPorLocal(transferMaterialId, l) > 0).sort();
  }, [movimentacoes, transferMaterialId, getSaldoPorLocal]);

  const transferSaldoOrigem = useMemo(() => {
    if (!transferMaterialId || !transferOrigem) return 0;
    return getSaldoPorLocal(transferMaterialId, transferOrigem);
  }, [transferMaterialId, transferOrigem, getSaldoPorLocal]);

  const handleTransferSave = async () => {
    if (!podeTransferir) {
      toast({ title: "Sem permissão para transferir", variant: "destructive" }); return;
    }
    if (!transferMaterialId || !transferOrigem || !transferDestino || !transferQuantidade) {
      toast({ title: "Preencha Material, Origem, Destino e Quantidade", variant: "destructive" }); return;
    }
    if (transferOrigem === transferDestino) {
      toast({ title: "Origem e destino devem ser diferentes", variant: "destructive" }); return;
    }
    const qty = Number(transferQuantidade);
    if (qty <= 0) { toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return; }
    if (!transferSenha) { toast({ title: "Informe sua senha para autorizar a transferência", variant: "destructive" }); return; }
    const mat = materiais.find(m => m.id === transferMaterialId);
    if (!mat) return;
    setTransferLoading(true);
    try {
      const ok = await verificarSenhaUsuario(usuarioLogado?.email || "", transferSenha);
      if (!ok) {
        toast({ title: "Senha incorreta", variant: "destructive" });
        setTransferLoading(false);
        return;
      }
      await transferirEntreLocais({
        materialId: mat.id, materialCodigo: mat.codigo, materialDescricao: mat.descricao,
        quantidade: qty, localOrigem: transferOrigem, localDestino: transferDestino,
        usuario: usuarioLogado?.nome || "",
        observacao: transferObs ? `${transferObs} (autorizado por ${usuarioLogado?.nome || ""})` : `Autorizado por ${usuarioLogado?.nome || ""}`,
      });
      toast({ title: "Transferência realizada com sucesso" });
      setTransferDialogOpen(false);
    } catch (e: any) {
      toast({ title: e?.message || "Erro ao transferir", variant: "destructive" });
    } finally {
      setTransferLoading(false);
    }
  };

  const tipoColor = (tipo: string) => {
    if (tipo === "entrada") return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
    if (tipo === "saida") return "bg-red-500/10 text-red-700 border-red-200";
    return "bg-amber-500/10 text-amber-700 border-amber-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
        <div className="flex gap-2">
          {podeEntrada && (
            <Button variant="outline" onClick={() => openMovDialog("entrada")}>
              <ArrowDownCircle className="mr-2 h-4 w-4 text-emerald-600" />Entrada
            </Button>
          )}
          {podeSaida && (
            <Button variant="outline" onClick={() => openMovDialog("saida")}>
              <ArrowUpCircle className="mr-2 h-4 w-4 text-red-600" />Saída
            </Button>
          )}
          {podeTransferir && (
            <Button variant="outline" onClick={openTransferDialog}>
              <ArrowLeftRight className="mr-2 h-4 w-4 text-blue-600" />Transferir
            </Button>
          )}
          {podeCriarInv && (
            <Button onClick={openInvDialog}>
              <ClipboardList className="mr-2 h-4 w-4" />Inventário
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Itens em Estoque</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{saldos.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Quantidade Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalItensEstoque.toLocaleString("pt-BR")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Locais</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalLocais}</p></CardContent>
        </Card>
        <Card className={alertas.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Alertas Estoque Mínimo</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${alertas.length > 0 ? "text-destructive" : ""}`}>{alertas.length}</p></CardContent>
        </Card>
      </div>

      {/* Search + Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar material, código ou local..." value={search} onChange={e => { setSearch(e.target.value); setPageSaldos(1); setPageMov(1); setPageAlertas(1); }} className="pl-9" />
        </div>

        <Select value={filtroCentroCusto} onValueChange={(v) => { setFiltroCentroCusto(v); setPageSaldos(1); setPageMov(1); }}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Centro de Custo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os centros de custo</SelectItem>
            {centrosCustoDisponiveis.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroMaterial} onValueChange={(v) => { setFiltroMaterial(v); setPageSaldos(1); setPageMov(1); }}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Material" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="todos">Todos os materiais</SelectItem>
            {materiais.map(m => <SelectItem key={m.id} value={m.id}>{m.codigo} — {m.descricao}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filtroLocal} onValueChange={(v) => { setFiltroLocal(v); setPageSaldos(1); setPageMov(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Local" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="todos">Todos os locais</SelectItem>
            {locaisDisponiveis.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        {(filtroCentroCusto !== "todos" || filtroMaterial !== "todos" || filtroLocal !== "todos") && (
          <Button variant="ghost" size="sm" onClick={() => { setFiltroCentroCusto("todos"); setFiltroMaterial("todos"); setFiltroLocal("todos"); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>

          <TabsTrigger value="saldos"><Warehouse className="mr-1 h-4 w-4" />Saldos por Local</TabsTrigger>
          <TabsTrigger value="movimentacoes"><Package className="mr-1 h-4 w-4" />Movimentações</TabsTrigger>
          <TabsTrigger value="alertas">
            <AlertTriangle className="mr-1 h-4 w-4" />Alertas
            {alertas.length > 0 && <Badge variant="destructive" className="ml-1 text-xs">{alertas.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="inventarios"><ClipboardList className="mr-1 h-4 w-4" />Inventários</TabsTrigger>
        </TabsList>

        {/* SALDOS */}
        <TabsContent value="saldos">
          <div className="border rounded-lg">
            <SortableHeaderRow order={colOrderSaldos} onReorder={setColOrderSaldos}>
            <Table>
             <TableHeader>
                <TableRow>
                  {colOrderSaldos.map(key => {
                    const cd = colDefsSaldos[key];
                    return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {saldos.length === 0 ? (
                  <TableRow><TableCell colSpan={colOrderSaldos.length} className="text-center text-muted-foreground py-8">Nenhum saldo registrado</TableCell></TableRow>
                ) : paginate(saldos, pageSaldos, pageSize).paginated.map((s, i) => {
                  const cellMap: Record<string, ReactNode> = {
                    codigo: <span className="font-mono">{s.materialCodigo}</span>,
                    material: s.materialDescricao,
                    centroCusto: saldoCentroCusto.get(`${s.materialId}|${s.local}`) || "-",
                    local: s.local,
                    quantidade: <span className="font-semibold">{s.quantidade.toLocaleString("pt-BR")}</span>,
                    vlrUnit: s.valorUnitarioFIFO > 0 ? s.valorUnitarioFIFO.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-",
                    vlrTotal: <span className="font-semibold">{s.valorTotal > 0 ? s.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</span>,
                    acoes: podeEntrada ? (
                      <Button size="sm" variant="ghost" onClick={() => openPrecoDialog(s)} title="Editar preços">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null,
                  };
                  return (
                  <TableRow key={i}>
                    {colOrderSaldos.map(key => <TableCell key={key} className={colDefsSaldos[key]?.className}>{cellMap[key]}</TableCell>)}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </SortableHeaderRow>
          </div>
          <PaginationControls currentPage={pageSaldos} totalItems={saldos.length} onPageChange={setPageSaldos} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageSaldos(1); }} />
        </TabsContent>

        {/* MOVIMENTAÇÕES */}
        <TabsContent value="movimentacoes">
          <div className="border rounded-lg">
            <SortableHeaderRow order={colOrderMov} onReorder={setColOrderMov}>
            <Table>
              <TableHeader>
                <TableRow>
                  {colOrderMov.map(key => {
                    const cd = colDefsMov[key];
                    return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {movFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={colOrderMov.length} className="text-center text-muted-foreground py-8">Nenhuma movimentação</TableCell></TableRow>
                ) : paginate(movFiltered, pageMov, pageSize).paginated.map(m => {
                  const cellMap: Record<string, ReactNode> = {
                    data: <span className="text-xs">{m.dataMovimentacao ? new Date(m.dataMovimentacao).toLocaleDateString("pt-BR") : "-"}</span>,
                    tipo: <Badge className={tipoColor(m.tipo)}>{m.tipo === "entrada" ? "Entrada" : m.tipo === "saida" ? "Saída" : "Ajuste"}</Badge>,
                    codigo: <span className="font-mono">{m.materialCodigo}</span>,
                    material: m.materialDescricao,
                    centroCusto: getCentroCustoFromDocRef(m.documentoRef),
                    local: m.local,
                    qtd: <span className="font-semibold">{m.quantidade.toLocaleString("pt-BR")}</span>,
                    codSco: m.codSco ? <span className="font-mono text-xs" title={m.descricaoSco}>{m.codSco}</span> : "-",
                    qtdSco: m.quantidadeSco ? m.quantidadeSco.toLocaleString("pt-BR") : "-",
                    vlrUnit: m.valorUnitario > 0 ? m.valorUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-",
                    documento: <span className="text-xs">{m.documentoRef || "-"}</span>,
                    usuario: <span className="text-xs">{m.usuario}</span>,
                  };
                  return (
                  <TableRow key={m.id}>
                    {colOrderMov.map(key => <TableCell key={key} className={colDefsMov[key]?.className}>{cellMap[key]}</TableCell>)}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </SortableHeaderRow>
          </div>
          <PaginationControls currentPage={pageMov} totalItems={movFiltered.length} onPageChange={setPageMov} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageMov(1); }} />
        </TabsContent>

        {/* ALERTAS */}
        <TabsContent value="alertas">
          <div className="border rounded-lg">
            <SortableHeaderRow order={colOrderAlertas} onReorder={setColOrderAlertas}>
            <Table>
              <TableHeader>
                <TableRow>
                  {colOrderAlertas.map(key => {
                    const cd = colDefsAlertas[key];
                    return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.length === 0 ? (
                  <TableRow><TableCell colSpan={colOrderAlertas.length} className="text-center text-muted-foreground py-8">Nenhum alerta – todos os itens estão acima do mínimo</TableCell></TableRow>
                ) : paginate(alertas, pageAlertas, pageSize).paginated.map(a => {
                  const cellMap: Record<string, ReactNode> = {
                    codigo: <span className="font-mono">{a.codigo}</span>,
                    material: a.descricao,
                    estoqueMinimo: a.estoqueMinimo,
                    saldoAtual: <span className="font-semibold">{a.saldoAtual}</span>,
                    status: a.saldoAtual <= 0
                      ? <Badge variant="destructive">Zerado</Badge>
                      : <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">Baixo</Badge>,
                  };
                  return (
                  <TableRow key={a.id}>
                    {colOrderAlertas.map(key => <TableCell key={key} className={colDefsAlertas[key]?.className}>{cellMap[key]}</TableCell>)}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </SortableHeaderRow>
          </div>
          <PaginationControls currentPage={pageAlertas} totalItems={alertas.length} onPageChange={setPageAlertas} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageAlertas(1); }} />
        </TabsContent>

        {/* INVENTÁRIOS */}
        <TabsContent value="inventarios">
          <div className="border rounded-lg">
            <SortableHeaderRow order={colOrderInv} onReorder={setColOrderInv}>
            <Table>
              <TableHeader>
                <TableRow>
                  {colOrderInv.map(key => {
                    const cd = colDefsInv[key];
                    return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                  })}
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventarios.length === 0 ? (
                  <TableRow><TableCell colSpan={colOrderInv.length + 1} className="text-center text-muted-foreground py-8">Nenhum inventário registrado</TableCell></TableRow>
                ) : paginate([...inventarios].reverse(), pageInv, pageSize).paginated.map(inv => {
                  const cellMap: Record<string, ReactNode> = {
                    data: inv.dataInventario ? new Date(inv.dataInventario).toLocaleDateString("pt-BR") : "-",
                    local: inv.local,
                    itens: inv.itens.length,
                    usuario: inv.usuario,
                    status: <Badge className={inv.status === "Aberto" ? "bg-blue-500/10 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground"}>{inv.status}</Badge>,
                  };
                  return (
                  <TableRow key={inv.id}>
                    {colOrderInv.map(key => <TableCell key={key} className={colDefsInv[key]?.className}>{cellMap[key]}</TableCell>)}
                    <TableCell className="space-x-1">
                      {inv.status === "Aberto" && (
                        <>
                          {podeCriarInv && (
                            <Button variant="ghost" size="icon" onClick={() => handleEditInventario(inv)} title="Editar itens">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {podeFecharInv && (
                            <Button variant="outline" size="sm" onClick={() => handleFecharInventario(inv.id)}>
                              Fechar e Ajustar
                            </Button>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </SortableHeaderRow>
          </div>
          <PaginationControls currentPage={pageInv} totalItems={inventarios.length} onPageChange={setPageInv} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPageInv(1); }} />
        </TabsContent>
      </Tabs>

      {/* Dialog Movimentação */}
      <Dialog open={movDialogOpen} onOpenChange={setMovDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {movTipo === "entrada" ? <><ArrowDownCircle className="inline mr-2 h-5 w-5 text-emerald-600" />Registrar Entrada</> : <><ArrowUpCircle className="inline mr-2 h-5 w-5 text-red-600" />Registrar Saída</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Material *</Label>
              <Popover open={movMaterialPopoverOpen} onOpenChange={setMovMaterialPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={movMaterialPopoverOpen} className="w-full justify-between font-normal h-10">
                    {movMaterialId
                      ? (() => { const m = materiais.find(m => m.id === movMaterialId); return m ? `${m.codigo} - ${m.descricao}` : "Selecione..."; })()
                      : "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar material/serviço..." />
                    <CommandList>
                      <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
                      <CommandGroup>
                        {materiais.map(m => (
                          <CommandItem
                            key={m.id}
                            value={`${m.codigo} ${m.descricao}`}
                            onSelect={() => {
                              setMovMaterialId(m.id);
                              const vs = getVinculos(m.id);
                              setMovVinculoId((vs.find(v => v.padrao) ?? vs[0])?.id ?? "");
                              setMovMaterialPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", movMaterialId === m.id ? "opacity-100" : "opacity-0")} />
                            {m.codigo} - {m.descricao}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" min="1" value={movQuantidade} onChange={e => setMovQuantidade(e.target.value)} />
            </div>
            {movTipo === "saida" && movMaterialId && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                <Label>Código SCO (tabela contratual)</Label>
                {vinculosMaterial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum código SCO vinculado a este material. Cadastre o vínculo em Materiais e Serviços.
                  </p>
                ) : (
                  <>
                    <Select value={movVinculoId} onValueChange={setMovVinculoId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o código SCO..." /></SelectTrigger>
                      <SelectContent>
                        {vinculosMaterial.map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.codSco} - {v.descricaoSco}{v.padrao ? " (padrão)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {vinculoSel && (
                      <p className="text-xs text-muted-foreground">
                        Quantidade SCO: {(Number(movQuantidade) || 0) * vinculoSel.fatorConversao}{" "}
                        {vinculoSel.unidadeSco} (fator {vinculoSel.fatorConversao})
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <div>
              <Label>Local *</Label>
              <Select value={movLocal} onValueChange={setMovLocal}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(movTipo === "saida" ? locaisClientes : locais).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {movTipo === "entrada" && (
              <div>
                <Label>Valor Unitário (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={movValorUnit}
                  onChange={e => setMovValorUnit(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0,00"
                />
              </div>
            )}
            <div><Label>Documento Referência</Label><Input value={movDocRef} onChange={e => setMovDocRef(e.target.value)} placeholder="NF, OS, etc." /></div>
            <div><Label>Observação</Label><Input value={movObs} onChange={e => setMovObs(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleMovSave}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Inventário */}
      <Dialog open={invDialogOpen} onOpenChange={setInvDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle><ClipboardList className="inline mr-2 h-5 w-5" />{editInvId ? "Editar Inventário" : "Novo Inventário"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Centro de Custo *</Label>
              <Select value={invCentroCusto} onValueChange={v => loadInvItens(v)} disabled={!!editInvId}>
                <SelectTrigger><SelectValue placeholder="Selecione o centro de custo..." /></SelectTrigger>
                <SelectContent>
                  {centrosCustoDisponiveis.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {invItens.length > 0 ? (
              <div className="border rounded-lg max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Sistema</TableHead>
                      <TableHead className="text-right">Contado</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead>Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invItens.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{it.materialCodigo}</TableCell>
                        <TableCell className="text-xs">{it.materialDescricao}</TableCell>
                        <TableCell className="text-right">{it.saldoSistema}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" className="w-20 text-right"
                            value={it.quantidadeContada}
                            min={0}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const val = e.target.value === "" ? 0 : Number(e.target.value);
                              setInvItens(prev => prev.map((p, i) => i === idx ? { ...p, quantidadeContada: val, diferenca: val - p.saldoSistema } : p));
                            }} />
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${it.diferenca < 0 ? "text-destructive" : it.diferenca > 0 ? "text-emerald-600" : ""}`}>
                          {it.diferenca > 0 ? `+${it.diferenca}` : it.diferenca}
                        </TableCell>
                        <TableCell>
                          <Input className="w-24 text-xs" value={it.observacao}
                            onChange={e => setInvItens(prev => prev.map((p, i) => i === idx ? { ...p, observacao: e.target.value } : p))} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : invCentroCusto ? (
              <div className="border rounded-lg p-4 text-sm text-muted-foreground text-center">
                Nenhum item com saldo encontrado para este centro de custo.
              </div>
            ) : null}
            <div><Label>Observação Geral</Label><Input value={invObs} onChange={e => setInvObs(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleInvSave}>{editInvId ? "Salvar Alterações" : "Criar Inventário"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Transferência */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><ArrowLeftRight className="inline mr-2 h-5 w-5 text-blue-600" />Transferir entre Locais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Material *</Label>
              <Popover open={transferMaterialPopoverOpen} onOpenChange={setTransferMaterialPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                    {transferMaterialId
                      ? (() => { const m = materiais.find(m => m.id === transferMaterialId); return m ? `${m.codigo} - ${m.descricao}` : "Selecione..."; })()
                      : "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar material/serviço..." />
                    <CommandList>
                      <CommandEmpty>Nenhum material encontrado.</CommandEmpty>
                      <CommandGroup>
                        {materiais.map(m => (
                          <CommandItem key={m.id} value={`${m.codigo} ${m.descricao}`}
                            onSelect={() => { setTransferMaterialId(m.id); setTransferOrigem(""); setTransferMaterialPopoverOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", transferMaterialId === m.id ? "opacity-100" : "opacity-0")} />
                            {m.codigo} - {m.descricao}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Local de Origem *</Label>
                <Select value={transferOrigem} onValueChange={setTransferOrigem} disabled={!transferMaterialId}>
                  <SelectTrigger><SelectValue placeholder={transferMaterialId ? "Selecione..." : "Selecione o material primeiro"} /></SelectTrigger>
                  <SelectContent>
                    {transferLocaisOrigem.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">Nenhum local com saldo</div>
                    ) : transferLocaisOrigem.map(l => (
                      <SelectItem key={l} value={l}>{l} ({getSaldoPorLocal(transferMaterialId, l)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Local de Destino *</Label>
                <Select value={transferDestino} onValueChange={setTransferDestino}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {locais.filter(l => l !== transferOrigem).map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Quantidade * {transferOrigem && <span className="text-xs text-muted-foreground ml-2">Disponível: {transferSaldoOrigem}</span>}</Label>
              <Input type="number" min="1" max={transferSaldoOrigem || undefined} value={transferQuantidade} onChange={e => setTransferQuantidade(e.target.value)} />
            </div>
            <div><Label>Observação</Label><Input value={transferObs} onChange={e => setTransferObs(e.target.value)} placeholder="Motivo da transferência..." /></div>
            <div className="border-t pt-4">
              <Label>Senha de autorização *</Label>
              <Input type="password" value={transferSenha} onChange={e => setTransferSenha(e.target.value)} placeholder="Digite sua senha para confirmar" autoComplete="current-password" />
              <p className="text-xs text-muted-foreground mt-1">Operação restrita: requer permissão no perfil e validação de senha do usuário <strong>{usuarioLogado?.nome}</strong>.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={handleTransferSave} disabled={transferLoading}>{transferLoading ? "Validando..." : "Autorizar e Transferir"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar preços (lotes FIFO) */}
      <Dialog open={precoDialogOpen} onOpenChange={setPrecoDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar preços do estoque</DialogTitle>
          </DialogHeader>
          {precoSaldo && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <div><strong>{precoSaldo.materialCodigo}</strong> — {precoSaldo.materialDescricao}</div>
                <div>Local: {precoSaldo.local}</div>
              </div>
              {precoLotes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lote com saldo disponível.</p>
              ) : (
                <div className="border rounded-lg max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">Data</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead className="text-center">Qtd. disp.</TableHead>
                        <TableHead className="text-center">Vlr Unit. (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precoLotes.map((l, idx) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-center text-xs">{l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "-"}</TableCell>
                          <TableCell className="text-xs">{l.documento || "-"}</TableCell>
                          <TableCell className="text-center">{l.quantidade.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              className="text-right"
                              value={l.valorUnitario}
                              onChange={e => {
                                const v = e.target.value;
                                setPrecoLotes(prev => prev.map((p, i) => i === idx ? { ...p, valorUnitario: v } : p));
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">A alteração ajusta o valor unitário de cada entrada (lote) e recalcula o custo FIFO.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrecoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePrecos} disabled={precoSaving || precoLotes.length === 0}>{precoSaving ? "Salvando..." : "Salvar preços"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
