import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { useRequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { useEstoque } from "@/contexts/EstoqueContext";
import { fetchAll, insertRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface ItemRecebimento {
  itemId: string; descricao: string; quantidadePedida: number;
  quantidadeRecebida: number; unidadeMedida: string; observacao: string;
}
export interface AnexoNF { nome: string; tipo: string; dados: string; }

export interface Recebimento {
  id: string; pedidoId: string; pedidoNumero: number;
  requisicaoId: string; requisicaoNumero: number; fornecedorNome: string;
  localEntrega: string; dataRecebimento: string; usuario: string;
  itens: ItemRecebimento[]; observacaoGeral: string;
  tipo: "Total" | "Parcial"; notaFiscal: string; anexosNF: AnexoNF[];
}

interface RecebimentoContextType {
  recebimentos: Recebimento[];
  registrarRecebimento: (data: Omit<Recebimento, "id" | "dataRecebimento" | "tipo">) => void;
  getRecebimentosByPedido: (pedidoId: string) => Recebimento[];
  getTotalRecebidoPorItem: (pedidoId: string, itemId: string) => number;
}

const RecebimentoContext = createContext<RecebimentoContextType | undefined>(undefined);
const QK = ["recebimentos"] as const;

const rowToRecebimento = (r: any): Recebimento => ({
  id: r.id, pedidoId: r.pedido_id ?? "", pedidoNumero: r.pedido_numero ?? 0,
  requisicaoId: r.requisicao_id ?? "", requisicaoNumero: r.requisicao_numero ?? 0,
  fornecedorNome: r.fornecedor_nome ?? "", localEntrega: r.local_entrega ?? "",
  dataRecebimento: r.data_recebimento ?? "", usuario: r.usuario ?? "",
  itens: r.itens ?? [], observacaoGeral: r.observacao_geral ?? "",
  tipo: r.tipo ?? "Total", notaFiscal: r.nota_fiscal ?? "", anexosNF: r.anexos_nf ?? [],
});

const recebimentoToRow = (r: Recebimento) => ({
  pedido_id: r.pedidoId, pedido_numero: r.pedidoNumero,
  requisicao_id: r.requisicaoId, requisicao_numero: r.requisicaoNumero,
  fornecedor_nome: r.fornecedorNome, local_entrega: r.localEntrega,
  data_recebimento: r.dataRecebimento, usuario: r.usuario,
  itens: r.itens as any, observacao_geral: r.observacaoGeral,
  tipo: r.tipo, nota_fiscal: r.notaFiscal, anexos_nf: r.anexosNF as any,
});

export function RecebimentoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Recebimento");
  const qc = useQueryClient();
  const { pedidos, updateStatus: updatePedidoStatus } = usePedidoCompra(__active);
  const { requisicoes, updateStatus: updateReqStatus } = useRequisicaoCompras(__active);
  const { registrarEntradaRecebimento } = useEstoque(__active);

  const { data: recebimentos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("recebimentos", "created_at")).map(rowToRecebimento),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const getRecebimentosByPedido = (pedidoId: string) =>
    recebimentos.filter(r => r.pedidoId === pedidoId);

  const getTotalRecebidoPorItem = (pedidoId: string, itemId: string) => {
    return recebimentos
      .filter(r => r.pedidoId === pedidoId)
      .reduce((sum, r) => {
        const item = r.itens.find(i => i.itemId === itemId);
        return sum + (item?.quantidadeRecebida || 0);
      }, 0);
  };

  const registrarRecebimento = async (data: Omit<Recebimento, "id" | "dataRecebimento" | "tipo">) => {
    const pedido = pedidos.find(p => p.id === data.pedidoId);
    if (!pedido) return;

    const allFullyReceived = pedido.itens.every(pi => {
      const jaRecebido = getTotalRecebidoPorItem(pedido.id, pi.itemId);
      const recebendoAgora = data.itens.find(i => i.itemId === pi.itemId)?.quantidadeRecebida || 0;
      return (jaRecebido + recebendoAgora) >= pi.quantidade;
    });

    const tipo = allFullyReceived ? "Total" : "Parcial";

    const recebimento: Recebimento = {
      ...data, id: crypto.randomUUID(),
      dataRecebimento: new Date().toISOString(), tipo,
    };

    await insertRow("recebimentos", recebimentoToRow(recebimento));

    const itensEstoque = data.itens
      .filter(i => i.quantidadeRecebida > 0)
      .map(i => {
        const itemPedido = pedido.itens.find(pi => pi.itemId === i.itemId);
        return {
          materialId: i.itemId, materialCodigo: "", materialDescricao: i.descricao,
          quantidade: i.quantidadeRecebida, unidadeMedida: i.unidadeMedida,
          valorUnitario: itemPedido?.precoUnitario || 0,
        };
      });
    if (itensEstoque.length > 0) {
      await registrarEntradaRecebimento(itensEstoque, data.localEntrega, `NF: ${data.notaFiscal || "N/A"} - Pedido ${data.pedidoNumero}`, data.usuario);
    }

    if (allFullyReceived) {
      updatePedidoStatus(pedido.id, "Entregue", data.usuario, `Recebimento total - NF: ${data.notaFiscal || "N/A"}`);
    } else if (pedido.status !== "Entregue Parcial") {
      updatePedidoStatus(pedido.id, "Entregue Parcial", data.usuario, `Recebimento parcial - NF: ${data.notaFiscal || "N/A"}`);
    }

    const updatedRecebimentos = [...recebimentos, recebimento];
    const pedidosRC = pedidos.filter(p => p.requisicaoId === pedido.requisicaoId && p.status !== "Cancelado");

    const allPedidosFullyReceived = pedidosRC.every(p => {
      return p.itens.every(pi => {
        const jaRecebido = updatedRecebimentos
          .filter(r => r.pedidoId === p.id)
          .reduce((sum, r) => {
            const item = r.itens.find(i => i.itemId === pi.itemId);
            return sum + (item?.quantidadeRecebida || 0);
          }, 0);
        return jaRecebido >= pi.quantidade;
      });
    });

    const anyPedidoHasReceipt = pedidosRC.some(p => updatedRecebimentos.some(r => r.pedidoId === p.id));

    if (allPedidosFullyReceived) {
      updateReqStatus(pedido.requisicaoId, "Recebida", data.usuario, "Todos os pedidos recebidos");
    } else if (anyPedidoHasReceipt) {
      const req = requisicoes.find(r => r.id === pedido.requisicaoId);
      if (req && req.status !== "Recebida") {
        updateReqStatus(pedido.requisicaoId, "Recebida Parcial", data.usuario, "Recebimento parcial");
      }
    }

    qc.invalidateQueries({ queryKey: QK });
  };

  return (
    <RecebimentoContext.Provider value={{ recebimentos, registrarRecebimento, getRecebimentosByPedido, getTotalRecebidoPorItem }}>
      {children}
    </RecebimentoContext.Provider>
  );
}

export function useRecebimento() {
  useActivateProvider("Recebimento");
  const ctx = useContext(RecebimentoContext);
  if (!ctx) throw new Error("useRecebimento must be used within RecebimentoProvider");
  return ctx;
}
