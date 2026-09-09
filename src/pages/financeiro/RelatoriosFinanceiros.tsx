import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileSpreadsheet, BarChart3 } from "lucide-react";
import { useFinanceiro, formatBRL, formatDate, isVencida } from "@/contexts/FinanceiroContext";
import { useClientes } from "@/contexts/ClientesContext";
import { gerarPdfFinanceiro, gerarExcelFinanceiro, FinReport } from "@/lib/gerarRelatoriosFinanceiros";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

interface RelDef {
  id: string;
  titulo: string;
  descricao: string;
  build: () => FinReport;
}

export default function RelatoriosFinanceiros() {
  const fin = useFinanceiro();
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podePdf = tem("financeiro.relatorios.exportar_pdf");
  const podeExcel = tem("financeiro.relatorios.exportar_excel");

  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [dataIni, setDataIni] = useState(inicioMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [fCentroCusto, setFCentroCusto] = useState<string>("todos");

  const ccNome = fCentroCusto === "todos" ? "Todos" : (fin.centrosCusto.find(c => c.id === fCentroCusto)?.nome || "—");
  const filtrosTxt = `Período: ${formatDate(dataIni)} a ${formatDate(dataFim)} | C. Custo: ${ccNome}`;

  const nomePC = (id?: string | null) => fin.planoContas.find(p => p.id === id)?.nome || "—";
  const nomeCC = (id?: string | null) => fin.centrosCusto.find(c => c.id === id)?.nome || "—";
  const nomeCB = (id?: string | null) => fin.contasBancarias.find(c => c.id === id)?.nome || "—";
  const nomeCli = (id?: string | null) => clientes.find(c => c.id === id)?.nome || "—";

  const matchCC = (id?: string | null) => fCentroCusto === "todos" || id === fCentroCusto;

  const inRange = (d?: string | null) => {
    if (!d) return false;
    return d >= dataIni && d <= dataFim;
  };

  const relatorios: RelDef[] = useMemo(() => [
    {
      id: "cp_aberto",
      titulo: "Contas a Pagar - Em Aberto",
      descricao: "Todas as contas a pagar com status em aberto ou parcial.",
      build: () => {
        const dados = fin.contasPagar.filter(c => (c.status === "aberta" || c.status === "parcial") && matchCC(c.centro_custo_id));
        const total = dados.reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_pago)), 0);
        return {
          titulo: "Contas a Pagar - Em Aberto",
          filtros: `Status: aberta/parcial`,
          colunas: ["Vencimento", "Descrição", "Fornecedor", "Categoria", "C. Custo", "Valor Total", "Pago", "Saldo", "Status"],
          linhas: dados.map(c => [
            formatDate(c.data_vencimento), c.descricao, c.fornecedor_nome || "—",
            nomePC(c.plano_conta_id), nomeCC(c.centro_custo_id),
            formatBRL(Number(c.valor_total)), formatBRL(Number(c.valor_pago)),
            formatBRL(Number(c.valor_total) - Number(c.valor_pago)),
            isVencida(c) ? "VENCIDA" : c.status,
          ]),
          totais: [{ label: "Saldo Total em Aberto", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "cp_pagas",
      titulo: "Contas a Pagar - Pagas",
      descricao: "Contas pagas dentro do período selecionado.",
      build: () => {
        const dados = fin.contasPagar.filter(c => c.status === "paga" && inRange(c.data_pagamento) && matchCC(c.centro_custo_id));
        const total = dados.reduce((s, c) => s + Number(c.valor_pago), 0);
        return {
          titulo: "Contas a Pagar - Pagas",
          filtros: filtrosTxt,
          colunas: ["Pagamento", "Vencimento", "Descrição", "Fornecedor", "Categoria", "C. Custo", "Conta", "Valor Pago"],
          linhas: dados.map(c => [
            formatDate(c.data_pagamento), formatDate(c.data_vencimento), c.descricao,
            c.fornecedor_nome || "—", nomePC(c.plano_conta_id), nomeCC(c.centro_custo_id),
            nomeCB(c.conta_bancaria_id), formatBRL(Number(c.valor_pago)),
          ]),
          totais: [{ label: "Total Pago no Período", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "cp_vencidas",
      titulo: "Contas a Pagar - Vencidas",
      descricao: "Contas em aberto cuja data de vencimento já passou.",
      build: () => {
        const dados = fin.contasPagar.filter(c => isVencida(c) && matchCC(c.centro_custo_id));
        const total = dados.reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_pago)), 0);
        return {
          titulo: "Contas a Pagar - Vencidas",
          filtros: `Posição em ${formatDate(hoje)}`,
          colunas: ["Vencimento", "Dias Atraso", "Descrição", "Fornecedor", "Categoria", "Saldo"],
          linhas: dados.map(c => {
            const dias = Math.floor((Date.now() - new Date(c.data_vencimento + "T00:00:00").getTime()) / 86400000);
            return [
              formatDate(c.data_vencimento), dias, c.descricao, c.fornecedor_nome || "—",
              nomePC(c.plano_conta_id),
              formatBRL(Number(c.valor_total) - Number(c.valor_pago)),
            ];
          }),
          totais: [{ label: "Total Vencido", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "cr_aberto",
      titulo: "Contas a Receber - Em Aberto",
      descricao: "Recebíveis em aberto ou parcialmente recebidos.",
      build: () => {
        const dados = fin.contasReceber.filter(c => (c.status === "aberta" || c.status === "parcial") && matchCC(c.centro_custo_id));
        const total = dados.reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_recebido)), 0);
        return {
          titulo: "Contas a Receber - Em Aberto",
          filtros: `Status: aberta/parcial`,
          colunas: ["Vencimento", "Descrição", "Cliente", "Categoria", "C. Custo", "Valor Total", "Recebido", "Saldo", "Status"],
          linhas: dados.map(c => [
            formatDate(c.data_vencimento), c.descricao, c.cliente_nome || "—",
            nomePC(c.plano_conta_id), nomeCC(c.centro_custo_id),
            formatBRL(Number(c.valor_total)), formatBRL(Number(c.valor_recebido)),
            formatBRL(Number(c.valor_total) - Number(c.valor_recebido)),
            isVencida(c as any) ? "VENCIDA" : c.status,
          ]),
          totais: [{ label: "Saldo Total a Receber", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "cr_recebidas",
      titulo: "Contas a Receber - Recebidas",
      descricao: "Recebimentos efetivados no período.",
      build: () => {
        const dados = fin.contasReceber.filter(c => c.status === "recebida" && inRange(c.data_recebimento) && matchCC(c.centro_custo_id));
        const total = dados.reduce((s, c) => s + Number(c.valor_recebido), 0);
        return {
          titulo: "Contas a Receber - Recebidas",
          filtros: filtrosTxt,
          colunas: ["Recebimento", "Vencimento", "Descrição", "Cliente", "Categoria", "C. Custo", "Conta", "Valor Recebido"],
          linhas: dados.map(c => [
            formatDate(c.data_recebimento), formatDate(c.data_vencimento), c.descricao,
            c.cliente_nome || "—", nomePC(c.plano_conta_id), nomeCC(c.centro_custo_id),
            nomeCB(c.conta_bancaria_id), formatBRL(Number(c.valor_recebido)),
          ]),
          totais: [{ label: "Total Recebido no Período", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "cr_vencidas",
      titulo: "Contas a Receber - Vencidas",
      descricao: "Recebíveis em aberto com vencimento expirado.",
      build: () => {
        const dados = fin.contasReceber.filter(c => isVencida(c as any) && matchCC(c.centro_custo_id));
        const total = dados.reduce((s, c) => s + (Number(c.valor_total) - Number(c.valor_recebido)), 0);
        return {
          titulo: "Contas a Receber - Vencidas",
          filtros: `Posição em ${formatDate(hoje)}`,
          colunas: ["Vencimento", "Dias Atraso", "Descrição", "Cliente", "Categoria", "Saldo"],
          linhas: dados.map(c => {
            const dias = Math.floor((Date.now() - new Date(c.data_vencimento + "T00:00:00").getTime()) / 86400000);
            return [
              formatDate(c.data_vencimento), dias, c.descricao, c.cliente_nome || "—",
              nomePC(c.plano_conta_id),
              formatBRL(Number(c.valor_total) - Number(c.valor_recebido)),
            ];
          }),
          totais: [{ label: "Total Vencido", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "fluxo",
      titulo: "Fluxo de Caixa Realizado",
      descricao: "Lançamentos (entradas, saídas e transferências) do período.",
      build: () => {
        const dados = fin.lancamentos.filter(l => inRange(l.data) && matchCC(l.centro_custo_id));
        const entradas = dados.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0);
        const saidas = dados.filter(l => l.tipo === "saida").reduce((s, l) => s + Number(l.valor), 0);
        return {
          titulo: "Fluxo de Caixa Realizado",
          filtros: filtrosTxt,
          colunas: ["Data", "Tipo", "Conta", "Conta Destino", "Categoria", "C. Custo", "Descrição", "Valor"],
          linhas: dados.map(l => [
            formatDate(l.data), l.tipo, nomeCB(l.conta_bancaria_id),
            l.conta_destino_id ? nomeCB(l.conta_destino_id) : "—",
            nomePC(l.plano_conta_id), nomeCC(l.centro_custo_id),
            l.descricao || "—", formatBRL(Number(l.valor)),
          ]),
          totais: [
            { label: "Total Entradas", valor: formatBRL(entradas) },
            { label: "Total Saídas", valor: formatBRL(saidas) },
            { label: "Resultado Líquido", valor: formatBRL(entradas - saidas) },
          ],
        };
      },
    },
    {
      id: "saldos",
      titulo: "Posição Bancária (Saldos)",
      descricao: "Saldo atual de cada conta bancária ativa.",
      build: () => {
        const dados = fin.contasBancarias.filter(c => c.ativo);
        const total = dados.reduce((s, c) => s + fin.saldoConta(c.id), 0);
        return {
          titulo: "Posição Bancária",
          filtros: `Posição em ${formatDate(hoje)}`,
          colunas: ["Conta", "Banco", "Agência", "Conta Nº", "Tipo", "Saldo Inicial", "Saldo Atual"],
          linhas: dados.map(c => [
            c.nome, c.banco || "—", c.agencia || "—", c.conta || "—", c.tipo,
            formatBRL(Number(c.saldo_inicial) || 0), formatBRL(fin.saldoConta(c.id)),
          ]),
          totais: [{ label: "Saldo Total Consolidado", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "dre",
      titulo: "DRE Sintético",
      descricao: "Receitas, despesas e resultado líquido do período (caixa).",
      build: () => {
        const lanc = fin.lancamentos.filter(l => inRange(l.data) && matchCC(l.centro_custo_id));
        const map = new Map<string, { tipo: string; total: number }>();
        lanc.forEach(l => {
          const pc = fin.planoContas.find(p => p.id === l.plano_conta_id);
          const key = pc ? `${pc.tipo}::${pc.nome}` : `${l.tipo === "entrada" ? "receita" : "despesa"}::Sem categoria`;
          const cur = map.get(key) || { tipo: key.split("::")[0], total: 0 };
          if (l.tipo === "entrada") cur.total += Number(l.valor);
          else if (l.tipo === "saida") cur.total -= Number(l.valor);
          map.set(key, cur);
        });
        const linhas: (string | number)[][] = [];
        let receitas = 0, despesas = 0;
        Array.from(map.entries()).sort().forEach(([k, v]) => {
          const [tipo, nome] = k.split("::");
          linhas.push([tipo === "receita" ? "Receita" : "Despesa", nome, formatBRL(Math.abs(v.total))]);
          if (v.total >= 0) receitas += v.total; else despesas += Math.abs(v.total);
        });
        return {
          titulo: "DRE Sintético",
          filtros: filtrosTxt,
          colunas: ["Tipo", "Categoria", "Valor"],
          linhas,
          totais: [
            { label: "Total Receitas", valor: formatBRL(receitas) },
            { label: "Total Despesas", valor: formatBRL(despesas) },
            { label: "Resultado Líquido", valor: formatBRL(receitas - despesas) },
          ],
        };
      },
    },
    {
      id: "centro_custo",
      titulo: "Despesas por Centro de Custo",
      descricao: "Consolidação de despesas pagas por centro de custo no período.",
      build: () => {
        const dados = fin.contasPagar.filter(c => c.status === "paga" && inRange(c.data_pagamento) && matchCC(c.centro_custo_id));
        const map = new Map<string, number>();
        dados.forEach(c => {
          const k = nomeCC(c.centro_custo_id);
          map.set(k, (map.get(k) || 0) + Number(c.valor_pago));
        });
        const linhas = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([cc, v]) => [cc, formatBRL(v)]);
        const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
        return {
          titulo: "Despesas por Centro de Custo",
          filtros: filtrosTxt,
          colunas: ["Centro de Custo", "Total Pago"],
          linhas,
          totais: [{ label: "Total Geral", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "categoria",
      titulo: "Despesas por Categoria (Plano de Contas)",
      descricao: "Total pago por categoria do plano de contas no período.",
      build: () => {
        const dados = fin.contasPagar.filter(c => c.status === "paga" && inRange(c.data_pagamento) && matchCC(c.centro_custo_id));
        const map = new Map<string, number>();
        dados.forEach(c => {
          const k = nomePC(c.plano_conta_id);
          map.set(k, (map.get(k) || 0) + Number(c.valor_pago));
        });
        const linhas = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, formatBRL(v)]);
        const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
        return {
          titulo: "Despesas por Categoria",
          filtros: filtrosTxt,
          colunas: ["Categoria", "Total Pago"],
          linhas,
          totais: [{ label: "Total Geral", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "fornecedor",
      titulo: "Top Fornecedores (Pagamentos)",
      descricao: "Ranking de fornecedores por valor pago no período.",
      build: () => {
        const dados = fin.contasPagar.filter(c => c.status === "paga" && inRange(c.data_pagamento) && matchCC(c.centro_custo_id));
        const map = new Map<string, { total: number; qt: number }>();
        dados.forEach(c => {
          const k = c.fornecedor_nome || "—";
          const cur = map.get(k) || { total: 0, qt: 0 };
          cur.total += Number(c.valor_pago); cur.qt += 1;
          map.set(k, cur);
        });
        const linhas = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total)
          .map(([k, v]) => [k, v.qt, formatBRL(v.total)]);
        const total = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
        return {
          titulo: "Top Fornecedores",
          filtros: filtrosTxt,
          colunas: ["Fornecedor", "Qtd Títulos", "Total Pago"],
          linhas,
          totais: [{ label: "Total Pago", valor: formatBRL(total) }],
        };
      },
    },
    {
      id: "cliente",
      titulo: "Top Clientes (Recebimentos)",
      descricao: "Ranking de clientes por valor recebido no período.",
      build: () => {
        const dados = fin.contasReceber.filter(c => c.status === "recebida" && inRange(c.data_recebimento) && matchCC(c.centro_custo_id));
        const map = new Map<string, { total: number; qt: number }>();
        dados.forEach(c => {
          const k = c.cliente_nome || nomeCli(c.cliente_id) || "—";
          const cur = map.get(k) || { total: 0, qt: 0 };
          cur.total += Number(c.valor_recebido); cur.qt += 1;
          map.set(k, cur);
        });
        const linhas = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total)
          .map(([k, v]) => [k, v.qt, formatBRL(v.total)]);
        const total = Array.from(map.values()).reduce((s, v) => s + v.total, 0);
        return {
          titulo: "Top Clientes",
          filtros: filtrosTxt,
          colunas: ["Cliente", "Qtd Títulos", "Total Recebido"],
          linhas,
          totais: [{ label: "Total Recebido", valor: formatBRL(total) }],
        };
      },
    },
  ], [fin, clientes, dataIni, dataFim, fCentroCusto]);

  const exportar = (def: RelDef, tipo: "pdf" | "excel") => {
    if (tipo === "pdf" && !podePdf) { toast.error("Você não possui permissão para exportar PDF."); return; }
    if (tipo === "excel" && !podeExcel) { toast.error("Você não possui permissão para exportar Excel."); return; }
    const r = def.build();
    if (tipo === "pdf") gerarPdfFinanceiro(r);
    else gerarExcelFinanceiro(r);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
          <p className="text-sm text-muted-foreground">
            Geração de relatórios em PDF e Excel para análise financeira.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Data Inicial</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <Label>Data Final</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <Label>Centro de Custo</Label>
            <Select value={fCentroCusto} onValueChange={setFCentroCusto}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {fin.centrosCusto.filter(c => c.ativo).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {relatorios.map((r) => (
          <Card key={r.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{r.titulo}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between gap-4">
              <p className="text-sm text-muted-foreground">{r.descricao}</p>
              <div className="flex gap-2">
                {podePdf && <Button size="sm" variant="outline" className="flex-1" onClick={() => exportar(r, "pdf")}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </Button>}
                {podeExcel && <Button size="sm" variant="outline" className="flex-1" onClick={() => exportar(r, "excel")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
