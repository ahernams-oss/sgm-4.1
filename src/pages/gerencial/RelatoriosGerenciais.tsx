import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileSpreadsheet, BarChart3 } from "lucide-react";
import { useFinanceiro, formatBRL, formatDate } from "@/contexts/FinanceiroContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useFuncionarios } from "@/contexts/FuncionariosContext";
import { useCargos } from "@/contexts/CargosContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useOrdensServico } from "@/contexts/OrdensServicoContext";
import { useSolicitacoesServicos } from "@/contexts/SolicitacoesServicosContext";
import { gerarPdfFinanceiro, gerarExcelFinanceiro, FinReport } from "@/lib/gerarRelatoriosFinanceiros";
import { MESES_PT, montarFaturamentoPorClienteMes, formatBRLValor, parseMoedaBR, dataFaturamentoOS, calcularValorTotalOS } from "@/lib/faturamentoClientes";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

type Periodo = "semanal" | "quinzenal" | "mensal" | "personalizado";
type TipoRel =
  | "os_status" | "os_cliente" | "ss_status" | "compras_pedidos"
  | "requisicoes_status" | "funcionarios_cliente" | "funcionarios_cargo" | "fin_resumo"
  | "faturamento_cliente_mes" | "empenhos_saldo";

const PERIODOS: { value: Periodo; label: string; desc: string }[] = [
  { value: "semanal", label: "Semanal", desc: "Últimos 7 dias." },
  { value: "quinzenal", label: "Quinzenal", desc: "Últimos 15 dias." },
  { value: "mensal", label: "Mensal", desc: "Últimos 30 dias." },
  { value: "personalizado", label: "Personalizado", desc: "Definir intervalo de datas." },
];

const TIPOS: { value: TipoRel; label: string; desc: string; usaCliente: boolean; usaSituacao: boolean }[] = [
  { value: "os_status", label: "OS por Situação", desc: "Total de Ordens de Serviço agrupadas por situação no período.", usaCliente: true, usaSituacao: true },
  { value: "os_cliente", label: "OS por Cliente", desc: "Quantidade de Ordens de Serviço por cliente no período.", usaCliente: true, usaSituacao: true },
  { value: "ss_status", label: "SS por Situação", desc: "Solicitações de Serviço agrupadas por situação no período.", usaCliente: true, usaSituacao: true },
  { value: "compras_pedidos", label: "Ordens de Compra por Fornecedor", desc: "Total emitido em ordens de compra agrupado por fornecedor.", usaCliente: false, usaSituacao: false },
  { value: "requisicoes_status", label: "Requisições de Compras por Status", desc: "Volume e percentual de RCs por status no período.", usaCliente: false, usaSituacao: false },
  { value: "funcionarios_cliente", label: "Funcionários Ativos por Cliente", desc: "Quadro de funcionários ativos distribuídos por cliente/contrato.", usaCliente: true, usaSituacao: false },
  { value: "funcionarios_cargo", label: "Funcionários por Cargo", desc: "Distribuição de funcionários ativos por cargo (CBO).", usaCliente: false, usaSituacao: false },
  { value: "fin_resumo", label: "Resumo Financeiro do Período", desc: "Recebimentos, pagamentos e saldo do período.", usaCliente: false, usaSituacao: false },
  { value: "faturamento_cliente_mes", label: "Faturamento por Cliente / Mês", desc: "Valor faturado (OS Faturadas) por cliente e mês, com valor contratual e saldo. Usa o ano do período selecionado.", usaCliente: true, usaSituacao: false },
  { value: "empenhos_saldo", label: "Saldo de Empenhos por Cliente", desc: "Total empenhado menos o total de OS Faturadas desde a data de início do contrato.", usaCliente: true, usaSituacao: false },
];

export default function RelatoriosGerenciais() {
  const { tem } = usePermissao();
  const podePdf = tem("gerencial_relatorios.exportar_pdf");
  const podeExcel = tem("gerencial_relatorios.exportar_excel");

  const fin = useFinanceiro();
  const { clientes } = useClientes();
  const { funcionarios } = useFuncionarios();
  const { cargos } = useCargos();
  const { pedidos } = usePedidoCompra();
  const { requisicoes } = useRequisicaoCompras();
  const { ordens } = useOrdensServico();
  const { solicitacoes } = useSolicitacoesServicos();

  const [periodo, setPeriodo] = useState<Periodo>("semanal");
  const [tipo, setTipo] = useState<TipoRel>("os_status");
  const [clienteSel, setClienteSel] = useState<string>("todos");
  const [situacaoSel, setSituacaoSel] = useState<string>("todas");
  const [orientacao, setOrientacao] = useState<"portrait" | "landscape">("portrait");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  const intervalo = useMemo(() => {
    const fim = new Date();
    const ini = new Date();
    if (periodo === "semanal") ini.setDate(fim.getDate() - 7);
    else if (periodo === "quinzenal") ini.setDate(fim.getDate() - 15);
    else if (periodo === "mensal") ini.setDate(fim.getDate() - 30);
    else {
      if (dataIni) ini.setTime(new Date(dataIni).getTime());
      if (dataFim) fim.setTime(new Date(dataFim).getTime());
    }
    return { ini: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
  }, [periodo, dataIni, dataFim]);

  const inRange = (d?: string | null) => {
    if (!d) return false;
    const s = d.slice(0, 10);
    return s >= intervalo.ini && s <= intervalo.fim;
  };
  const cargoNome = (id: string) => cargos.find((c) => c.id === id)?.nome || "—";
  const clienteNomeOf = (id: string) => clientes.find((c) => c.id === id)?.nome || "—";
  const periodoTxt = `Período: ${formatDate(intervalo.ini)} a ${formatDate(intervalo.fim)}`;

  const situacoesUnicas = useMemo(() => {
    const set = new Set<string>();
    ordens.forEach((o) => o.situacao && set.add(o.situacao));
    solicitacoes.forEach((s) => s.situacao && set.add(s.situacao));
    return Array.from(set);
  }, [ordens, solicitacoes]);

  const tipoCfg = TIPOS.find((t) => t.value === tipo)!;

  const groupBy = <T,>(arr: T[], keyFn: (x: T) => string): Record<string, T[]> => {
    const m: Record<string, T[]> = {};
    arr.forEach((it) => {
      const k = keyFn(it) || "—";
      (m[k] ||= []).push(it);
    });
    return m;
  };

  const filtroLabel = useMemo(() => {
    const parts = [periodoTxt];
    if (tipoCfg.usaCliente && clienteSel !== "todos") parts.push(`Cliente: ${clienteNomeOf(clienteSel)}`);
    if (tipoCfg.usaSituacao && situacaoSel !== "todas") parts.push(`Situação: ${situacaoSel}`);
    return parts.join(" | ");
  }, [periodoTxt, clienteSel, situacaoSel, tipoCfg]);

  const build = (): FinReport => {
    const filtroCliOs = (o: any) =>
      !tipoCfg.usaCliente || clienteSel === "todos" || o.clienteId === clienteSel;
    const filtroSit = (o: any) =>
      !tipoCfg.usaSituacao || situacaoSel === "todas" || o.situacao === situacaoSel;

    if (tipo === "os_status") {
      const lista = ordens.filter((o) => inRange(o.createdAt) && filtroCliOs(o) && filtroSit(o));
      const g = groupBy(lista, (o) => o.situacao || "—");
      return {
        titulo: "OS por Situação", filtros: filtroLabel,
        colunas: ["Situação", "Quantidade", "% do Total"],
        linhas: Object.entries(g)
          .map(([k, v]) => [k, v.length, `${((v.length / Math.max(1, lista.length)) * 100).toFixed(1)}%`])
          .sort((a: any, b: any) => b[1] - a[1]) as any,
        totais: [{ label: "Total OS", valor: String(lista.length) }],
      };
    }
    if (tipo === "os_cliente") {
      const lista = ordens.filter((o) => inRange(o.createdAt) && filtroCliOs(o) && filtroSit(o));
      const g = groupBy(lista, (o) => o.clienteNome);
      return {
        titulo: "OS por Cliente", filtros: filtroLabel,
        colunas: ["Cliente", "Quantidade"],
        linhas: Object.entries(g).map(([k, v]) => [k, v.length]).sort((a: any, b: any) => b[1] - a[1]) as any,
        totais: [{ label: "Total", valor: String(lista.length) }],
      };
    }
    if (tipo === "ss_status") {
      const lista = solicitacoes.filter((s) => inRange(s.createdAt) && filtroCliOs(s) && filtroSit(s));
      const g = groupBy(lista, (s) => s.situacao || "—");
      return {
        titulo: "SS por Situação", filtros: filtroLabel,
        colunas: ["Situação", "Quantidade"],
        linhas: Object.entries(g).map(([k, v]) => [k, v.length]) as any,
        totais: [{ label: "Total SS", valor: String(lista.length) }],
      };
    }
    if (tipo === "compras_pedidos") {
      const lista = pedidos.filter((p) => inRange(p.dataCriacao));
      const g = groupBy(lista, (p) => p.fornecedorNome || "—");
      const linhas = Object.entries(g).map(([k, v]) => {
        const total = v.reduce((s, p) => s + Number(p.valorTotal || 0), 0);
        return [k, v.length, formatBRL(total)];
      });
      const total = lista.reduce((s, p) => s + Number(p.valorTotal || 0), 0);
      return {
        titulo: "Ordens de Compra por Fornecedor", filtros: filtroLabel,
        colunas: ["Fornecedor", "Qtd. Pedidos", "Valor Total"],
        linhas: linhas as any,
        totais: [{ label: "Total Geral", valor: formatBRL(total) }],
      };
    }
    if (tipo === "requisicoes_status") {
      const lista = requisicoes.filter((r) => inRange(r.dataCriacao));
      const g = groupBy(lista, (r) => r.status || "—");
      return {
        titulo: "Requisições de Compras por Status", filtros: filtroLabel,
        colunas: ["Status", "Quantidade", "% do Total"],
        linhas: Object.entries(g).map(([k, v]) => [k, v.length, `${((v.length / Math.max(1, lista.length)) * 100).toFixed(1)}%`]) as any,
        totais: [{ label: "Total RC", valor: String(lista.length) }],
      };
    }
    if (tipo === "funcionarios_cliente") {
      const lista = funcionarios.filter((f) => f.status === "Ativo" && (clienteSel === "todos" || f.clienteId === clienteSel));
      const g = groupBy(lista, (f) => clienteNomeOf(f.clienteId));
      return {
        titulo: "Funcionários Ativos por Cliente", filtros: filtroLabel,
        colunas: ["Cliente", "Quantidade"],
        linhas: Object.entries(g).map(([k, v]) => [k, v.length]).sort((a: any, b: any) => b[1] - a[1]) as any,
        totais: [{ label: "Total Ativos", valor: String(lista.length) }],
      };
    }
    if (tipo === "funcionarios_cargo") {
      const lista = funcionarios.filter((f) => f.status === "Ativo");
      const g = groupBy(lista, (f) => cargoNome(f.cargoId));
      return {
        titulo: "Funcionários por Cargo", filtros: filtroLabel,
        colunas: ["Cargo", "Quantidade"],
        linhas: Object.entries(g).map(([k, v]) => [k, v.length]).sort((a: any, b: any) => b[1] - a[1]) as any,
        totais: [{ label: "Total Ativos", valor: String(lista.length) }],
      };
    }
    if (tipo === "faturamento_cliente_mes") {
      const ano = Number(intervalo.fim.slice(0, 4));
      const linhas = montarFaturamentoPorClienteMes(ordens as any, clientes as any, ano, clienteSel);
      const totalGeral = linhas.reduce((s, l) => s + l.total, 0);
      const totalContratual = linhas.reduce((s, l) => s + l.valorContratual, 0);
      return {
        titulo: `Faturamento por Cliente - ${ano}`,
        subtitulo: "OS com situação Faturada (por Data de Faturamento)",
        filtros: filtroLabel,
        colunas: ["Cliente", ...MESES_PT.map((m) => m.slice(0, 3)), "Total", "Valor Contratual", "Saldo"],
        linhas: linhas.map((l) => [
          l.clienteNome,
          ...l.meses.map((v) => (v ? formatBRLValor(v) : "-")),
          formatBRLValor(l.total),
          formatBRLValor(l.valorContratual),
          formatBRLValor(l.saldo),
        ]) as any,
        totais: [
          { label: "Total Faturado", valor: formatBRLValor(totalGeral) },
          { label: "Total Contratual", valor: formatBRLValor(totalContratual) },
          { label: "Saldo Contratual", valor: formatBRLValor(totalContratual - totalGeral) },
        ],
      };
    }
    if (tipo === "empenhos_saldo") {
      const alvo = clientes.filter((c) => c.tipo !== "Fornecedor" && (clienteSel === "todos" || c.id === clienteSel));
      const linhas = alvo.map((c) => {
        const contratos = c.contratos || [];
        const inicio =
          contratos
            .map((ct) => ct.dataInicio)
            .filter(Boolean)
            .sort()[0] || (c as any).dataInicioContrato || "";
        const totalEmpenho = contratos.reduce(
          (s, ct) => s + (ct.empenhos || []).reduce((s2, e) => s2 + parseMoedaBR(e.valor), 0),
          0,
        );
        const faturado = ordens
          .filter((o) => o.clienteId === c.id && o.situacao === "Faturada")
          .filter((o) => {
            const d = String(dataFaturamentoOS(o as any) || "").slice(0, 10);
            return !inicio || (d && d >= inicio.slice(0, 10));
          })
          .reduce((s, o) => s + calcularValorTotalOS(o as any), 0);
        return { nome: c.nome, inicio, totalEmpenho, faturado, saldo: totalEmpenho - faturado };
      }).filter((l) => l.totalEmpenho > 0 || l.faturado > 0);

      const te = linhas.reduce((s, l) => s + l.totalEmpenho, 0);
      const tf = linhas.reduce((s, l) => s + l.faturado, 0);
      return {
        titulo: "Saldo de Empenhos por Cliente",
        subtitulo: "Total empenhado - OS Faturadas desde o início do contrato",
        filtros: filtroLabel,
        colunas: ["Cliente", "Início do Contrato", "Total Empenhado", "OS Faturadas", "Saldo de Empenho"],
        linhas: linhas
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((l) => [
            l.nome,
            l.inicio ? formatDate(l.inicio) : "—",
            formatBRLValor(l.totalEmpenho),
            formatBRLValor(l.faturado),
            formatBRLValor(l.saldo),
          ]) as any,
        totais: [
          { label: "Total Empenhado", valor: formatBRLValor(te) },
          { label: "Total Faturado", valor: formatBRLValor(tf) },
          { label: "Saldo Geral", valor: formatBRLValor(te - tf) },
        ],
      };
    }
    // fin_resumo
    const cr = fin.contasReceber.filter((c) => c.status === "recebida" && inRange(c.data_recebimento));
    const cp = fin.contasPagar.filter((c) => c.status === "paga" && inRange(c.data_pagamento));
    const totalR = cr.reduce((s, c) => s + Number(c.valor_recebido || 0), 0);
    const totalP = cp.reduce((s, c) => s + Number(c.valor_pago || 0), 0);
    return {
      titulo: "Resumo Financeiro do Período", filtros: filtroLabel,
      colunas: ["Indicador", "Quantidade", "Valor"],
      linhas: [
        ["Contas Recebidas", cr.length, formatBRL(totalR)],
        ["Contas Pagas", cp.length, formatBRL(totalP)],
        ["Saldo (R - P)", "—", formatBRL(totalR - totalP)],
      ],
      totais: [{ label: "Saldo Período", valor: formatBRL(totalR - totalP) }],
    };
  };

  const exportar = (fmt: "pdf" | "xlsx") => {
    try {
      const report = build();
      if (!report.linhas.length) {
        toast.warning("Nenhum dado encontrado para os filtros aplicados.");
        return;
      }
      if (fmt === "pdf") gerarPdfFinanceiro(report, orientacao);
      else gerarExcelFinanceiro(report);
      toast.success(`${fmt.toUpperCase()} gerado com sucesso!`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar relatório");
    }
  };

  const radioCard = (checked: boolean) =>
    `flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
      checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
    }`;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-serif font-semibold">Relatórios Gerenciais</h1>
          <p className="text-sm text-muted-foreground">
            Gere relatórios semanais, quinzenais ou mensais em PDF ou Excel.
          </p>
        </div>
      </div>

      {/* Período */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Período de Fechamento</Label>
        <RadioGroup value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PERIODOS.map((p) => (
            <label key={p.value} className={radioCard(periodo === p.value)}>
              <RadioGroupItem value={p.value} className="mt-0.5" />
              <div>
                <div className="font-medium">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.desc}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
        {periodo === "personalizado" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <Label>Data Início</Label>
              <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Tipo de Relatório */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Tipo de Relatório</Label>
        <Card>
          <CardContent className="p-3">
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as TipoRel)} className="space-y-2">
              {TIPOS.map((t) => (
                <label key={t.value} className={`flex items-start gap-3 rounded-md p-2 cursor-pointer ${tipo === t.value ? "bg-primary/5" : "hover:bg-muted/40"}`}>
                  <RadioGroupItem value={t.value} className="mt-0.5" />
                  <div>
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      {/* Cliente + Situação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Cliente</Label>
          <Select value={clienteSel} onValueChange={setClienteSel} disabled={!tipoCfg.usaCliente}>
            <SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Situação</Label>
          <Select value={situacaoSel} onValueChange={setSituacaoSel} disabled={!tipoCfg.usaSituacao}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {situacoesUnicas.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orientação */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Orientação da Impressão (PDF)</Label>
        <RadioGroup value={orientacao} onValueChange={(v) => setOrientacao(v as any)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className={radioCard(orientacao === "portrait")}>
            <RadioGroupItem value="portrait" className="mt-0.5" />
            <div className="font-medium">Retrato</div>
          </label>
          <label className={radioCard(orientacao === "landscape")}>
            <RadioGroupItem value="landscape" className="mt-0.5" />
            <div className="font-medium">Paisagem</div>
          </label>
        </RadioGroup>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
        {filtroLabel}
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" disabled={!podeExcel} onClick={() => exportar("xlsx")} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </Button>
        <Button disabled={!podePdf} onClick={() => exportar("pdf")} className="gap-2" style={{ background: "#673ab7" }}>
          <FileText className="h-4 w-4" /> PDF
        </Button>
      </div>
    </div>
  );
}
