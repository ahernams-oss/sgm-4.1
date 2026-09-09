import { enviarWhatsAppComDocumento } from "./whatsapp";
import { uploadPdfOrdemCompra } from "./gerarPdfOrdemCompra";
import type { PedidoCompra } from "@/contexts/PedidoCompraContext";
import type { Cliente } from "@/contexts/ClientesContext";
import type { Empresa } from "@/contexts/EmpresaContext";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface NotificarPedidoGrupoInput {
  jid: string;
  clienteNome: string;
  pedido: PedidoCompra;
  empresa: Empresa | null;
  fornecedor: Cliente | null;
  autorizadoPor: string;
}

/**
 * Envia ao grupo de WhatsApp de pedidos a mensagem de pedido aprovado + PDF da Ordem de Compra.
 */
export async function notificarPedidoGrupo(input: NotificarPedidoGrupoInput): Promise<void> {
  const jid = (input.jid || "").trim();
  if (!jid) return;

  const { pedido } = input;
  const pcNum = `OC-${String(pedido.numero).padStart(4, "0")}`;

  const linhas: string[] = [];
  linhas.push(`*${input.clienteNome.toUpperCase()}*`, "");
  linhas.push(`PEDIDO DE COMPRA: ${pcNum}`, "");
  linhas.push("STATUS: APROVADO - PEDIDO EMITIDO", "");
  linhas.push(`RCS: ${pedido.requisicaoNumero}`, "");
  linhas.push(`Fornecedor: ${pedido.fornecedorNome}`, "");
  linhas.push(`Valor Total: ${fmt(pedido.valorTotal)}`, "");
  if (pedido.condicaoPagamento) linhas.push(`Condição de Pagamento: ${pedido.condicaoPagamento}`, "");
  if (pedido.prazoEntrega) linhas.push(`Prazo de Entrega: ${pedido.prazoEntrega}`, "");
  if (pedido.localEntrega) linhas.push(`Local de Entrega: ${pedido.localEntrega}`, "");
  linhas.push(`Comprador: ${pedido.comprador}`);

  try {
    const documentUrl = await uploadPdfOrdemCompra({
      pedido,
      empresa: input.empresa,
      fornecedor: input.fornecedor,
      autorizadoPor: input.autorizadoPor,
    });
    await enviarWhatsAppComDocumento({
      telefone: jid,
      mensagem: linhas.join("\n"),
      documentUrl,
      documentFilename: `Ordem_Compra_${pcNum}.pdf`,
    });
  } catch (e) {
    console.error("[notificarPedidoGrupo] falha ao enviar pedido ao grupo:", e);
  }
}
