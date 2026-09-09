import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow } from "@/lib/supabaseHelper";

export type CategoriaVariacao = "Saving" | "Cost Avoidance" | "Reajuste";

export interface ConfirmacaoValor {
  id: string;
  cotacaoId: string;
  requisicaoId: string;
  requisicaoNumero: number;
  pedidoId: string;
  fornecedorId: string;
  fornecedorNome: string;
  itemId: string;
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
  precoAprovado: number;
  precoConfirmado: number;
  valorAprovado: number;
  valorConfirmado: number;
  variacaoValor: number;
  variacaoPercentual: number;
  categoria: CategoriaVariacao;
  justificativa: string;
  confirmadoPor: string;
  confirmadoEm: string;
  alcada: string;
  limiteAlcadaPercentual: number;
  aprovadoPorAlcada: string;
  requerDiretoria: boolean;
  diretoriaNotificadaEm: string | null;
  diretoriaAceite: boolean;
  diasAtrasoAprovacao: number;
  impactoAtraso: number;
}

export const QK_CONFIRMACOES = ["compras_confirmacoes_valores"] as const;

const rowToConfirmacao = (r: any): ConfirmacaoValor => ({
  id: r.id,
  cotacaoId: r.cotacao_id ?? "",
  requisicaoId: r.requisicao_id ?? "",
  requisicaoNumero: r.requisicao_numero ?? 0,
  pedidoId: r.pedido_id ?? "",
  fornecedorId: r.fornecedor_id ?? "",
  fornecedorNome: r.fornecedor_nome ?? "",
  itemId: r.item_id ?? "",
  descricao: r.descricao ?? "",
  quantidade: Number(r.quantidade) || 0,
  unidadeMedida: r.unidade_medida ?? "",
  precoAprovado: Number(r.preco_aprovado) || 0,
  precoConfirmado: Number(r.preco_confirmado) || 0,
  valorAprovado: Number(r.valor_aprovado) || 0,
  valorConfirmado: Number(r.valor_confirmado) || 0,
  variacaoValor: Number(r.variacao_valor) || 0,
  variacaoPercentual: Number(r.variacao_percentual) || 0,
  categoria: (r.categoria ?? "Cost Avoidance") as CategoriaVariacao,
  justificativa: r.justificativa ?? "",
  confirmadoPor: r.confirmado_por ?? "",
  confirmadoEm: r.confirmado_em ?? "",
        alcada: r.alcada ?? "Automática",
        limiteAlcadaPercentual: Number(r.limite_alcada_percentual) || 20,
        aprovadoPorAlcada: r.aprovado_por_alcada ?? "",
  requerDiretoria: !!r.requer_diretoria,
  diretoriaNotificadaEm: r.diretoria_notificada_em ?? null,
  diretoriaAceite: !!r.diretoria_aceite,
  diasAtrasoAprovacao: Number(r.dias_atraso_aprovacao) || 0,
  impactoAtraso: Number(r.impacto_atraso) || 0,
});

export function useConfirmacoesValores() {
  const qc = useQueryClient();
  const { data: confirmacoes = [] } = useQuery({
    queryKey: QK_CONFIRMACOES,
    queryFn: async () => (await fetchAll("compras_confirmacoes_valores", "confirmado_em")).map(rowToConfirmacao),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const registrarConfirmacoes = async (linhas: Omit<ConfirmacaoValor, "id" | "confirmadoEm">[]) => {
    for (const l of linhas) {
      await insertRow("compras_confirmacoes_valores", {
        cotacao_id: l.cotacaoId,
        requisicao_id: l.requisicaoId,
        requisicao_numero: l.requisicaoNumero,
        pedido_id: l.pedidoId,
        fornecedor_id: l.fornecedorId,
        fornecedor_nome: l.fornecedorNome,
        item_id: l.itemId,
        descricao: l.descricao,
        quantidade: l.quantidade,
        unidade_medida: l.unidadeMedida,
        preco_aprovado: l.precoAprovado,
        preco_confirmado: l.precoConfirmado,
        valor_aprovado: l.valorAprovado,
        valor_confirmado: l.valorConfirmado,
        variacao_valor: l.variacaoValor,
        variacao_percentual: l.variacaoPercentual,
        categoria: l.categoria,
        justificativa: l.justificativa,
        confirmado_por: l.confirmadoPor,
        alcada: l.alcada ?? "Automática",
        limite_alcada_percentual: l.limiteAlcadaPercentual ?? 20,
        aprovado_por_alcada: l.aprovadoPorAlcada ?? null,
        requer_diretoria: l.requerDiretoria ?? false,
        diretoria_notificada_em: l.diretoriaNotificadaEm ?? null,
        diretoria_aceite: l.diretoriaAceite ?? false,
        dias_atraso_aprovacao: l.diasAtrasoAprovacao ?? 0,
        impacto_atraso: l.impactoAtraso ?? 0,
      });
    }
    qc.invalidateQueries({ queryKey: QK_CONFIRMACOES });
  };

  return { confirmacoes, registrarConfirmacoes };
}

/** Classificação automática da variação de preço. */
export function classificarVariacao(precoAprovado: number, precoConfirmado: number): CategoriaVariacao {
  if (precoConfirmado < precoAprovado) return "Saving";
  if (precoConfirmado > precoAprovado) return "Reajuste";
  return "Cost Avoidance";
}
