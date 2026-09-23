import { gerarPdfEstoque, gerarExcelEstoque } from "@/lib/gerarRelatorioEstoque";
import type { Recebimento } from "@/contexts/RecebimentoContext";
import type { PedidoCompra } from "@/contexts/PedidoCompraContext";

const fmtData = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
};
const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// 1) Analítico: cada recebimento com seus itens
export async function relatorioRecebimentosAnalitico(
  recebimentos: Recebimento[],
  formato: "pdf" | "excel",
  filtros?: string
) {
  const columns = ["Data", "Pedido", "RC", "Fornecedor", "NF", "Item", "Qtd. Pedida", "Qtd. Recebida", "Un.", "Tipo", "Usuário"];
  const rows: string[][] = [];
  recebimentos.forEach((r) => {
    r.itens.forEach((i) => {
      rows.push([
        fmtData(r.dataRecebimento),
        String(r.pedidoNumero),
        String(r.requisicaoNumero),
        r.fornecedorNome,
        r.notaFiscal || "-",
        i.descricao,
        String(i.quantidadePedida),
        String(i.quantidadeRecebida),
        i.unidadeMedida,
        r.tipo,
        r.usuario,
      ]);
    });
  });
  const title = "Recebimentos de Materiais - Analítico";
  if (formato === "pdf") await gerarPdfEstoque(title, columns, rows, filtros);
  else await gerarExcelEstoque(title, columns, rows, filtros);
}

// 2) Sintético por pedido: um registro por recebimento
export async function relatorioRecebimentosPorPedido(
  recebimentos: Recebimento[],
  formato: "pdf" | "excel",
  filtros?: string
) {
  const columns = ["Data", "Pedido", "RC", "Fornecedor", "Local de Entrega", "NF", "Tipo", "Qtd. Itens", "Usuário", "Observação"];
  const rows = recebimentos.map((r) => [
    fmtData(r.dataRecebimento),
    String(r.pedidoNumero),
    String(r.requisicaoNumero),
    r.fornecedorNome,
    r.localEntrega,
    r.notaFiscal || "-",
    r.tipo,
    String(r.itens.length),
    r.usuario,
    r.observacaoGeral || "-",
  ]);
  const title = "Recebimentos de Materiais - Por Pedido";
  if (formato === "pdf") await gerarPdfEstoque(title, columns, rows, filtros);
  else await gerarExcelEstoque(title, columns, rows, filtros);
}

// 3) Pendências: pedidos com itens ainda não recebidos integralmente
export async function relatorioPendenciasRecebimento(
  pedidos: PedidoCompra[],
  getTotalRecebidoPorItem: (pedidoId: string, itemId: string) => number,
  formato: "pdf" | "excel",
  filtros?: string
) {
  const columns = ["Pedido", "RC", "Fornecedor", "Status", "Item", "Qtd. Pedida", "Qtd. Recebida", "Saldo", "Un.", "Valor Unit.", "Valor Saldo"];
  const rows: string[][] = [];
  pedidos
    .filter((p) => p.status !== "Cancelado")
    .forEach((p) => {
      p.itens.forEach((pi) => {
        const recebido = getTotalRecebidoPorItem(p.id, pi.itemId);
        const saldo = pi.quantidade - recebido;
        if (saldo > 0) {
          rows.push([
            String(p.numero),
            String(p.requisicaoNumero),
            p.fornecedorNome,
            p.status,
            pi.descricao,
            String(pi.quantidade),
            String(recebido),
            String(saldo),
            pi.unidadeMedida,
            fmtMoeda(pi.precoUnitario || 0),
            fmtMoeda(saldo * (pi.precoUnitario || 0)),
          ]);
        }
      });
    });
  const title = "Pendências de Recebimento de Materiais";
  if (formato === "pdf") await gerarPdfEstoque(title, columns, rows, filtros);
  else await gerarExcelEstoque(title, columns, rows, filtros);
}
