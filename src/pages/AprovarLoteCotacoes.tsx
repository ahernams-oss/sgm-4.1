import { useMemo, useState, useCallback } from "react";
import { loadPersistedFilters, usePersistFilters } from "@/lib/persistedFilters";
import { useCotacaoCompras, CotacaoCompras, ItemVencedor } from "@/contexts/CotacaoComprasContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { usePedidoCompra, PedidoCompra } from "@/contexts/PedidoCompraContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCargos } from "@/contexts/CargosContext";
import { useLimiteAprovacao } from "@/hooks/useLimiteAprovacao";
import { usePermissao } from "@/hooks/usePermissao";
import { usePcAssinaturas } from "@/contexts/PcAssinaturasContext";
import { gerarHashPc } from "@/lib/assinaturaHashPc";
import { obterIpOrigem } from "@/lib/assinaturaHashOs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { matchNumero } from "@/lib/matchNumero";
import { CheckCircle2, Search, Trophy, AlertTriangle, ShieldCheck, MessageCircle, Loader2 } from "lucide-react";
import { notificarCompras, formatarPrioridade, formatarDataHora, formatarData, formatarPedido } from "@/lib/notificacoesCompras";
import { notificarPedidoGrupo } from "@/lib/notificacaoPedidoCompra";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";

type Preview = {
  cotacao: CotacaoCompras;
  reqNumero: number;
  centroCusto: string;
  centroCustoNome: string;
  itens: Array<{ itemId: string; descricao: string; quantidade: number; fornecedorId: string; fornecedorNome: string; precoUnitario: number; total: number; }>;
  porFornecedor: Array<{ fornecedorId: string; fornecedorNome: string; total: number; qtdItens: number; }>;
  totalCotacao: number;
  possivel: boolean;
  motivo?: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AprovarLoteCotacoesPage() {
  const { cotacoes, aprovarCotacao } = useCotacaoCompras();
  const { requisicoes, updateStatus } = useRequisicaoCompras();
  const { addPedido } = usePedidoCompra();
  const { clientes } = useClientes();
  const { usuarioLogado } = useAuth();
  const { cargos } = useCargos();
  const { podeAprovar } = useLimiteAprovacao();
  const { tem } = usePermissao();
  const { registrar: registrarAssinaturaPc } = usePcAssinaturas();
  const { empresa } = useEmpresa();
  const { toast } = useToast();

  const podeAprovarCot = tem("cotacoes.status.finalizada");

  const _alcSavedFilters = loadPersistedFilters<{ search: string; fCompradorId: string; fFornecedorId: string; fCentroCustoId: string; fStatus: string; fValorMin: string; fValorMax: string; }>("aprovar_lote_cotacoes_filters_v1");
  const [search, setSearch] = useState(_alcSavedFilters?.search ?? "");
  const [fCompradorId, setFCompradorId] = useState<string>(_alcSavedFilters?.fCompradorId ?? "__all__");
  const [fFornecedorId, setFFornecedorId] = useState<string>(_alcSavedFilters?.fFornecedorId ?? "__all__");
  const [fCentroCustoId, setFCentroCustoId] = useState<string>(_alcSavedFilters?.fCentroCustoId ?? "__all__");
  const [fStatus, setFStatus] = useState<string>(_alcSavedFilters?.fStatus ?? "__all__");
  const [fValorMin, setFValorMin] = useState<string>(_alcSavedFilters?.fValorMin ?? "");
  const [fValorMax, setFValorMax] = useState<string>(_alcSavedFilters?.fValorMax ?? "");
  usePersistFilters("aprovar_lote_cotacoes_filters_v1", { search, fCompradorId, fFornecedorId, fCentroCustoId, fStatus, fValorMin, fValorMax });
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [otpStep, setOtpStep] = useState<"idle" | "sending" | "await" | "verifying">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpTelefone, setOtpTelefone] = useState("");
  const [otpError, setOtpError] = useState("");

  const elegiveis = useMemo(() => {
    return cotacoes
      .filter(c => (c.status === "Em Andamento" || c.status === "Aguardando Aprovação") && c.propostas.length > 0)
      .sort((a, b) => b.numero - a.numero);
  }, [cotacoes]);

  const previews: Preview[] = useMemo(() => {
    return elegiveis.map(c => {
      const req = requisicoes.find(r => r.id === c.requisicaoId);
      if (!req) return { cotacao: c, reqNumero: c.requisicaoNumero, centroCusto: "", centroCustoNome: "", itens: [], porFornecedor: [], totalCotacao: 0, possivel: false, motivo: "RCS não encontrada" };
      const itens = req.itens.map(item => {
        // Menor preço por item entre todas as propostas que ofertaram esse item
        let melhor: { fornecedorId: string; fornecedorNome: string; precoUnitario: number } | null = null;
        for (const p of c.propostas) {
          const linha = p.itens.find(i => i.itemId === item.id);
          if (!linha || linha.precoUnitario <= 0) continue;
          if (!melhor || linha.precoUnitario < melhor.precoUnitario) {
            melhor = { fornecedorId: p.fornecedorId, fornecedorNome: p.fornecedorNome, precoUnitario: linha.precoUnitario };
          }
        }
        return melhor
          ? { itemId: item.id, descricao: item.descricao, quantidade: item.quantidade, fornecedorId: melhor.fornecedorId, fornecedorNome: melhor.fornecedorNome, precoUnitario: melhor.precoUnitario, total: melhor.precoUnitario * item.quantidade }
          : { itemId: item.id, descricao: item.descricao, quantidade: item.quantidade, fornecedorId: "", fornecedorNome: "—", precoUnitario: 0, total: 0 };
      });
      const cobertos = itens.every(i => i.fornecedorId);
      const totalCotacao = itens.reduce((s, i) => s + i.total, 0);
      const mapa = new Map<string, { fornecedorNome: string; total: number; qtdItens: number }>();
      itens.forEach(i => {
        if (!i.fornecedorId) return;
        const cur = mapa.get(i.fornecedorId) || { fornecedorNome: i.fornecedorNome, total: 0, qtdItens: 0 };
        cur.total += i.total; cur.qtdItens += 1;
        mapa.set(i.fornecedorId, cur);
      });
      const porFornecedor = Array.from(mapa.entries()).map(([fornecedorId, v]) => ({ fornecedorId, ...v }));
      return {
        cotacao: c,
        reqNumero: req.numero,
        centroCusto: req.centroCusto,
        centroCustoNome: req.centroCustoNome,
        itens,
        porFornecedor,
        totalCotacao,
        possivel: cobertos,
        motivo: cobertos ? undefined : "Nem todos os itens têm preço ofertado",
      };
    });
  }, [elegiveis, requisicoes]);

  const compradoresOpts = useMemo(() => {
    const set = new Set<string>();
    previews.forEach(p => { if (p.cotacao.comprador) set.add(p.cotacao.comprador); });
    return Array.from(set).sort();
  }, [previews]);

  const fornecedoresOpts = useMemo(() => {
    const map = new Map<string, string>();
    previews.forEach(p => p.porFornecedor.forEach(f => map.set(f.fornecedorId, f.fornecedorNome)));
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [previews]);

  const centrosCustoOpts = useMemo(() => {
    const map = new Map<string, string>();
    previews.forEach(p => { if (p.centroCusto) map.set(p.centroCusto, p.centroCustoNome); });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [previews]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const vMin = parseFloat(fValorMin.replace(",", ".")) || null;
    const vMax = parseFloat(fValorMax.replace(",", ".")) || null;
    return previews.filter(p => {
      if (s && !(
        matchNumero(p.cotacao.numero, s) ||
        matchNumero(p.reqNumero, s) ||
        p.cotacao.comprador.toLowerCase().includes(s) ||
        p.centroCustoNome.toLowerCase().includes(s) ||
        p.porFornecedor.some(f => f.fornecedorNome.toLowerCase().includes(s))
      )) return false;
      if (fCompradorId !== "__all__" && p.cotacao.comprador !== fCompradorId) return false;
      if (fFornecedorId !== "__all__" && !p.porFornecedor.some(f => f.fornecedorId === fFornecedorId)) return false;
      if (fCentroCustoId !== "__all__" && p.centroCusto !== fCentroCustoId) return false;
      if (fStatus === "pronta" && !p.possivel) return false;
      if (fStatus === "incompleta" && p.possivel) return false;
      if (vMin !== null && p.totalCotacao < vMin) return false;
      if (vMax !== null && p.totalCotacao > vMax) return false;
      return true;
    });
  }, [previews, search, fCompradorId, fFornecedorId, fCentroCustoId, fStatus, fValorMin, fValorMax]);

  const { paginated, totalPages } = paginate(filtered, page, pageSize);

  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selecionaveis = paginated.filter(p => p.possivel).map(p => p.cotacao.id);
  const allSelected = selecionaveis.length > 0 && selecionaveis.every(id => selected.includes(id));
  const toggleAll = () => setSelected(allSelected ? selected.filter(id => !selecionaveis.includes(id)) : [...new Set([...selected, ...selecionaveis])]);

  const selecionados = filtered.filter(p => selected.includes(p.cotacao.id) && p.possivel);
  const totalSelecionado = selecionados.reduce((s, p) => s + p.totalCotacao, 0);

  const assinarPedido = useCallback(async (pedido: PedidoCompra) => {
    if (!usuarioLogado) return;
    try {
      const hash = await gerarHashPc(pedido);
      const ip = await obterIpOrigem();
      const cargo = cargos.find(c => c.id === usuarioLogado.cargoId);
      await registrarAssinaturaPc({
        pedido_id: pedido.id,
        pedido_numero: pedido.numero,
        papel: "aprovador",
        signatario_user_id: usuarioLogado.id,
        signatario_nome: usuarioLogado.nome,
        signatario_email: usuarioLogado.email,
        signatario_cargo: cargo?.nome || "",
        signatario_matricula: usuarioLogado.matricula || "",
        hash_documento: hash,
        ip_origem: ip,
        user_agent: navigator.userAgent,
      });
    } catch (e) { console.error("Falha ao assinar PC em lote:", e); }
  }, [usuarioLogado, cargos, registrarAssinaturaPc]);

  const notificarCliente = (reqId: string) => {
    const r = requisicoes.find(x => x.id === reqId);
    if (!r) return;
    const cli = clientes.find(c => c.id === r.centroCusto);
    if (!cli?.grupoWhatsapp) return;
    notificarCompras({
      jid: cli.grupoWhatsapp,
      clienteNome: cli.nome,
      pedido: formatarPedido(r.numero, r.dataCriacao),
      statusLabel: "APROVADA - PEDIDO EMITIDO (COMPRADO)",
      dataSolicitacao: formatarDataHora(r.dataCriacao),
      dataExtraLabel: "Data da aprovação",
      dataExtraValor: formatarDataHora(new Date().toISOString()),
      solicitante: r.solicitante,
      prioridade: formatarPrioridade(r.urgencia),
      obs: r.justificativa,
      entregaPrevista: r.prazoDesejado ? formatarData(r.prazoDesejado) : undefined,
    });
  };

  const notificarPedidoNoGrupo = async (pedido: PedidoCompra, reqId: string) => {
    const r = requisicoes.find(x => x.id === reqId);
    const cli = r ? clientes.find(c => c.id === r.centroCusto) : null;
    if (!cli?.grupoWhatsapp) return;
    await notificarPedidoGrupo({
      jid: cli.grupoWhatsapp,
      clienteNome: cli.nome,
      pedido,
      empresa,
      fornecedor: clientes.find(c => c.id === pedido.fornecedorId) || null,
      autorizadoPor: usuarioLogado?.nome || "",
    });
  };

  const enviarOtp = async () => {
    if (!usuarioLogado?.id) { toast({ title: "Usuário não identificado.", variant: "destructive" }); return; }
    setOtpError("");
    setOtpStep("sending");
    try {
      const { data, error } = await supabase.functions.invoke("mfa-send-otp", {
        body: { usuario_id: usuarioLogado.id, purpose: "aprovacao_lote_cotacoes" },
      });
      if (error || !data?.success) {
        setOtpStep("idle");
        setOtpError(data?.error || error?.message || "Falha ao enviar código.");
        return;
      }
      setOtpTelefone(data.telefone_mascarado || "");
      setOtpCode("");
      setOtpStep("await");
      toast({ title: "Código enviado por WhatsApp." });
    } catch (e: unknown) {
      setOtpStep("idle");
      setOtpError(e instanceof Error ? e.message : "Falha ao enviar código.");
    }
  };

  const abrirConfirmacao = async () => {
    if (!podeAprovarCot) { toast({ title: "Você não possui permissão para aprovar cotações.", variant: "destructive" }); return; }
    if (selecionados.length === 0) return;
    if (!podeAprovar(totalSelecionado, "compras")) return;
    setConfirmOpen(true);
    setOtpStep("idle");
    setOtpCode("");
    setOtpError("");
    await enviarOtp();
  };

  const executar = async () => {
    if (!podeAprovarCot) { toast({ title: "Você não possui permissão para aprovar cotações.", variant: "destructive" }); return; }
    if (selecionados.length === 0) return;
    if (!podeAprovar(totalSelecionado, "compras")) { setConfirmOpen(false); return; }
    if (!usuarioLogado?.id) return;

    // Verifica OTP
    setOtpStep("verifying");
    setOtpError("");
    try {
      const { data, error } = await supabase.functions.invoke("mfa-verify-otp", {
        body: { usuario_id: usuarioLogado.id, purpose: "aprovacao_lote_cotacoes", code: otpCode },
      });
      if (error || !data?.success) {
        setOtpStep("await");
        setOtpError(data?.error || error?.message || "Código inválido.");
        return;
      }
    } catch (e: unknown) {
      setOtpStep("await");
      setOtpError(e instanceof Error ? e.message : "Falha ao validar código.");
      return;
    }

    setProcessing(true);
    let okCount = 0;
    let pcCount = 0;
    for (const prev of selecionados) {
      try {
        const cot = prev.cotacao;
        const req = requisicoes.find(r => r.id === cot.requisicaoId);
        if (!req) continue;

        const itensVencedores: ItemVencedor[] = prev.itens.map(i => ({
          itemId: i.itemId, fornecedorId: i.fornecedorId, fornecedorNome: i.fornecedorNome,
        }));
        const fornIds = [...new Set(itensVencedores.map(iv => iv.fornecedorId))];
        const principal = fornIds[0];

        await aprovarCotacao(cot.id, principal, "Aprovação em lote — menor preço por item", itensVencedores);

        const pedidos: PedidoCompra[] = [];
        for (const fid of fornIds) {
          const prop = cot.propostas.find(p => p.fornecedorId === fid);
          if (!prop) continue;
          const itemIds = itensVencedores.filter(iv => iv.fornecedorId === fid).map(iv => iv.itemId);
          const itensPedido = prop.itens
            .filter(i => itemIds.includes(i.itemId))
            .map(i => ({ itemId: i.itemId, descricao: i.descricao, quantidade: i.quantidade, unidadeMedida: i.unidadeMedida, precoUnitario: i.precoUnitario, valorTotal: i.precoUnitario * i.quantidade }));
          const novo = await addPedido({
            cotacaoId: cot.id,
            requisicaoId: cot.requisicaoId,
            requisicaoNumero: cot.requisicaoNumero,
            comprador: usuarioLogado?.nome || "Comprador",
            fornecedorId: prop.fornecedorId,
            fornecedorNome: prop.fornecedorNome,
            itens: itensPedido,
            condicaoPagamento: prop.condicaoPagamento,
            prazoEntrega: prop.prazoEntrega,
            localEntrega: req.localEntrega || "",
            observacoes: "",
          } as any);
          pedidos.push(novo);
          pcCount++;
        }
        await Promise.all(pedidos.map(p => assinarPedido(p)));
        await Promise.all(pedidos.map(p => notificarPedidoNoGrupo(p, cot.requisicaoId)));
        await updateStatus(cot.requisicaoId, "Pedido Emitido", usuarioLogado?.nome || "Aprovador",
          fornIds.length > 1 ? `${fornIds.length} pedidos gerados (aprovação em lote — menor preço)` : "Pedido gerado (aprovação em lote — menor preço)");
        notificarCliente(cot.requisicaoId);
        okCount++;
      } catch (e) {
        console.error("Erro ao aprovar cotação em lote:", e);
      }
    }
    setProcessing(false);
    setConfirmOpen(false);
    setSelected([]);
    toast({ title: `Lote processado: ${okCount} cotação(ões) aprovada(s), ${pcCount} PC(s) emitido(s) e assinado(s).` });
  };

  return (
    <div className="space-y-4 pt-[15px] pl-0 pr-[10px]">
      <div className="flex items-center justify-between mx-[7px]">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" /> Aprovação em Lote — Menor Preço
          </h1>
          <p className="text-sm text-muted-foreground">Aprova automaticamente, para cada item de cada cotação selecionada, o fornecedor com o menor preço unitário e emite os Ordens de Compra agrupados por fornecedor.</p>
        </div>
        <Button
          disabled={selecionados.length === 0 || processing}
          onClick={abrirConfirmacao}
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Aprovar Lote ({selecionados.length})
        </Button>
      </div>

      <Card className="mx-[7px]">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Filtros</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFCompradorId("__all__"); setFFornecedorId("__all__"); setFCentroCustoId("__all__"); setFStatus("__all__"); setFValorMin(""); setFValorMax(""); setPage(1); }}>Limpar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <Input className="lg:col-span-2" placeholder="Buscar nº cotação, RCS, comprador, fornecedor, centro de custo..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <Select value={fCompradorId} onValueChange={(v) => { setFCompradorId(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Comprador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos compradores</SelectItem>
                {compradoresOpts.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fFornecedorId} onValueChange={(v) => { setFFornecedorId(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos fornecedores</SelectItem>
                {fornecedoresOpts.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fCentroCustoId} onValueChange={(v) => { setFCentroCustoId(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Centro de Custo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos centros de custo</SelectItem>
                {centrosCustoOpts.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={(v) => { setFStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos status</SelectItem>
                <SelectItem value="pronta">Pronta</SelectItem>
                <SelectItem value="incompleta">Incompleta</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="number" inputMode="decimal" placeholder="Valor mín." value={fValorMin} onChange={e => { setFValorMin(e.target.value); setPage(1); }} />
              <Input type="number" inputMode="decimal" placeholder="Valor máx." value={fValorMax} onChange={e => { setFValorMax(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {filtered.length} cotação(ões) elegível(is) — {selecionados.length} selecionada(s) — Total: <span className="font-semibold ml-1">{brl(totalSelecionado)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg mx-[7px] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={selecionaveis.length === 0} />
              </TableHead>
              <TableHead className="text-center">Nº Cotação</TableHead>
              <TableHead className="text-center">RCS</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead>Fornecedores Vencedores (menor preço)</TableHead>
              <TableHead className="text-right">Total (menor preço)</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma cotação elegível.</TableCell></TableRow>
            ) : paginated.map(p => (
              <TableRow key={p.cotacao.id} className={!p.possivel ? "opacity-60" : ""}>
                <TableCell>
                  <Checkbox checked={selected.includes(p.cotacao.id)} disabled={!p.possivel} onCheckedChange={() => toggle(p.cotacao.id)} />
                </TableCell>
                <TableCell className="text-center font-medium">#{p.cotacao.numero}</TableCell>
                <TableCell className="text-center">#{p.reqNumero}</TableCell>
                <TableCell>
                  {p.centroCustoNome ? (
                    <Badge variant="outline" className="text-xs whitespace-nowrap">{p.centroCustoNome}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{p.cotacao.comprador}</TableCell>
                <TableCell className="text-center">{p.itens.length}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.porFornecedor.map(f => (
                      <Badge key={f.fornecedorId} variant="secondary" className="text-xs">
                        {f.fornecedorNome} · {f.qtdItens} it. · {brl(f.total)}
                      </Badge>
                    ))}
                    {p.porFornecedor.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">{brl(p.totalCotacao)}</TableCell>
                <TableCell className="text-center">
                  {p.possivel ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">Pronta</Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {p.motivo}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={confirmOpen} onOpenChange={(o) => !processing && setConfirmOpen(o)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Confirmar Aprovação em Lote</DialogTitle>
            <DialogDescription>
              Serão aprovadas <b>{selecionados.length}</b> cotação(ões), gerando ordens de compra agrupados por fornecedor vencedor e assinados eletronicamente em seu nome.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-3">
            {selecionados.map(p => (
              <div key={p.cotacao.id} className="border rounded p-2 text-sm">
                <div className="font-medium">Cotação #{p.cotacao.numero} · RCS #{p.reqNumero}{p.centroCustoNome ? ` · ${p.centroCustoNome}` : ""} — Total {brl(p.totalCotacao)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.porFornecedor.map(f => (
                    <Badge key={f.fornecedorId} variant="outline" className="text-xs">{f.fornecedorNome} · {f.qtdItens} it. · {brl(f.total)}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-right font-semibold border-t pt-2">Valor total do lote: {brl(totalSelecionado)}</div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4 text-green-600" />
              Confirmação em duas etapas (WhatsApp)
            </div>
            {otpStep === "sending" && (
              <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enviando código para seu WhatsApp…</div>
            )}
            {(otpStep === "await" || otpStep === "verifying") && (
              <>
                <p className="text-xs text-muted-foreground">
                  Enviamos um código de 6 dígitos para o WhatsApp <b>{otpTelefone || "cadastrado"}</b>. Digite abaixo para confirmar.
                </p>
                <div className="flex items-center gap-3">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} disabled={otpStep === "verifying" || processing}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                    </InputOTPGroup>
                  </InputOTP>
                  <Button variant="ghost" size="sm" onClick={enviarOtp} disabled={otpStep === "verifying" || processing}>
                    Reenviar código
                  </Button>
                </div>
              </>
            )}
            {otpStep === "idle" && (
              <Button variant="outline" size="sm" onClick={enviarOtp}>Enviar código de confirmação</Button>
            )}
            {otpError && <div className="text-xs text-destructive">{otpError}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={processing || otpStep === "verifying"}>Cancelar</Button>
            <Button
              onClick={executar}
              disabled={processing || otpStep !== "await" || otpCode.length !== 6}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {processing ? "Processando..." : otpStep === "verifying" ? "Validando código…" : "Confirmar Aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
