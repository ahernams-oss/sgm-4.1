// Hash SHA-256 do conteúdo essencial do Ordem de Compra para garantir integridade
import type { PedidoCompra } from "@/contexts/PedidoCompraContext";

const s = (v: any) => (v === null || v === undefined ? "" : String(v));
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const arr = (v: any) => (Array.isArray(v) ? v : []);
const pick = (o: any, camel: string, snake: string) =>
  o?.[camel] !== undefined ? o[camel] : o?.[snake];

export async function gerarHashPc(p: Partial<PedidoCompra> | any): Promise<string> {
  const conteudo = JSON.stringify({
    numero: n(p.numero),
    cotacaoId: s(pick(p, "cotacaoId", "cotacao_id")),
    requisicaoId: s(pick(p, "requisicaoId", "requisicao_id")),
    requisicaoNumero: n(pick(p, "requisicaoNumero", "requisicao_numero")),
    dataCriacao: s(pick(p, "dataCriacao", "data_criacao")),
    comprador: s(p.comprador),
    fornecedorId: s(pick(p, "fornecedorId", "fornecedor_id")),
    fornecedorNome: s(pick(p, "fornecedorNome", "fornecedor_nome")),
    itens: arr(p.itens),
    condicaoPagamento: s(pick(p, "condicaoPagamento", "condicao_pagamento")),
    prazoEntrega: s(pick(p, "prazoEntrega", "prazo_entrega")),
    localEntrega: s(pick(p, "localEntrega", "local_entrega")),
    observacoes: s(p.observacoes),
    valorTotal: n(pick(p, "valorTotal", "valor_total")),
  });
  const buffer = new TextEncoder().encode(conteudo);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
