import type { OrdemServico } from "@/contexts/OrdensServicoContext";
import type { Cliente } from "@/contexts/ClientesContext";

export const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const parseMoedaBR = (s?: string | number | null): number => {
  if (s == null || s === "") return 0;
  if (typeof s === "number") return isNaN(s) ? 0 : s;
  const cleaned = String(s).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

export const formatBRLValor = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** Valor total da OS = materiais (SCO + estoque) + BDI */
export const calcularValorTotalOS = (os: OrdemServico): number => {
  const totalItens =
    (os.materiais || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0) +
    (os.materiaisEstoque || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0);
  const bdi = (() => {
    const n = Number(String((os as any).bdi || 0).replace(",", "."));
    return isNaN(n) ? 0 : n;
  })();
  return totalItens + totalItens * (bdi / 100);
};

/** Data usada como referência de faturamento da OS */
export const dataFaturamentoOS = (os: OrdemServico): string =>
  (os as any).dataFaturamento || (os as any).faturadoEm || (os as any).createdAt || "";

/** Valor contratual do cliente = VTM Contratual + Mão de Obra Contratual (contrato mais recente) */
export const valorContratualCliente = (cliente?: Cliente): number => {
  const contratos = cliente?.contratos || [];
  if (!contratos.length) return 0;
  const ct = [...contratos].sort((a, b) => (b.dataInicio || "").localeCompare(a.dataInicio || ""))[0];
  return parseMoedaBR(ct.valorBase3) + parseMoedaBR(ct.maoDeObraContratual);
};

export interface LinhaFaturamentoCliente {
  clienteId: string;
  clienteNome: string;
  meses: number[]; // 12 posições
  total: number;
  valorContratual: number;
  saldo: number;
}

/** Monta a matriz Cliente x Mês com base nas OS com status "Faturada" no ano informado. */
export function montarFaturamentoPorClienteMes(
  ordens: OrdemServico[],
  clientes: Cliente[],
  ano: number,
  clienteIdFiltro?: string,
): LinhaFaturamentoCliente[] {
  const faturadas = ordens.filter((os) => {
    if (os.situacao !== "Faturada") return false;
    const d = dataFaturamentoOS(os);
    if (!d) return false;
    return Number(String(d).slice(0, 4)) === ano;
  });

  const mapa = new Map<string, LinhaFaturamentoCliente>();
  const garantir = (id: string, nome: string) => {
    if (!mapa.has(id)) {
      const cli = clientes.find((c) => c.id === id);
      const valorContratual = valorContratualCliente(cli);
      mapa.set(id, {
        clienteId: id,
        clienteNome: cli?.nome || nome || "—",
        meses: Array(12).fill(0),
        total: 0,
        valorContratual,
        saldo: valorContratual,
      });
    }
    return mapa.get(id)!;
  };

  faturadas.forEach((os) => {
    if (clienteIdFiltro && clienteIdFiltro !== "todos" && os.clienteId !== clienteIdFiltro) return;
    const linha = garantir(os.clienteId, (os as any).clienteNome);
    const mes = Number(String(dataFaturamentoOS(os)).slice(5, 7)) - 1;
    if (mes < 0 || mes > 11) return;
    const valor = calcularValorTotalOS(os);
    linha.meses[mes] += valor;
    linha.total += valor;
  });

  const linhas = Array.from(mapa.values());
  linhas.forEach((l) => { l.saldo = l.valorContratual - l.total; });
  return linhas.sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
}
