import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export type StatusCotacao = "Em Andamento" | "Aguardando Aprovação" | "Revisão de Confirmação" | "Finalizada" | "Cancelada";

export interface ItemCotacaoFornecedor {
  itemId: string; descricao: string; quantidade: number; unidadeMedida: string;
  precoUnitario: number; prazoEntrega: string; observacao: string;
}
export interface PropostaFornecedor {
  id: string; fornecedorId: string; fornecedorNome: string;
  condicaoPagamento: string; prazoEntrega: string; validadeProposta: string;
  observacao: string; itens: ItemCotacaoFornecedor[]; valorTotal: number;
  valorFrete?: number; valorOperacao?: number; valorSeguro?: number;
}
export interface ItemVencedor { itemId: string; fornecedorId: string; fornecedorNome: string; }

export interface CotacaoCompras {
  id: string; requisicaoId: string; requisicaoNumero: number; numero: number;
  dataCriacao: string; comprador: string; status: StatusCotacao;
  propostas: PropostaFornecedor[]; fornecedorVencedorId: string;
  justificativaEscolha: string; itensVencedores: ItemVencedor[];
}

interface CotacaoComprasContextType {
  cotacoes: CotacaoCompras[];
  addCotacao: (data: Omit<CotacaoCompras, "id" | "numero" | "dataCriacao" | "status" | "propostas" | "fornecedorVencedorId" | "justificativaEscolha" | "itensVencedores">) => CotacaoCompras;
  addProposta: (cotacaoId: string, proposta: Omit<PropostaFornecedor, "id" | "valorTotal">) => void;
  updateProposta: (cotacaoId: string, propostaId: string, proposta: Omit<PropostaFornecedor, "id" | "valorTotal">) => void;
  removeProposta: (cotacaoId: string, propostaId: string) => void;
  submeterAprovacao: (cotacaoId: string) => void;
  aprovarCotacao: (cotacaoId: string, fornecedorVencedorId: string, justificativa: string, itensVencedores?: ItemVencedor[]) => void;
  finalizarCotacao: (cotacaoId: string, fornecedorVencedorId: string, justificativa: string, itensVencedores?: ItemVencedor[]) => void;
  concluirRevisaoConfirmacao: (cotacaoId: string) => void;
  cancelarCotacao: (cotacaoId: string) => void;
  getCotacaoByRequisicao: (requisicaoId: string) => CotacaoCompras | undefined;
}

const CotacaoComprasContext = createContext<CotacaoComprasContextType | undefined>(undefined);
const QK = ["cotacoes_compras"] as const;

const rowToCotacao = (r: any): CotacaoCompras => ({
  id: r.id, requisicaoId: r.requisicao_id ?? "", requisicaoNumero: r.requisicao_numero ?? 0,
  numero: r.numero ?? 0, dataCriacao: r.data_criacao ?? "", comprador: r.comprador ?? "",
  status: r.status ?? "Em Andamento", propostas: r.propostas ?? [],
  fornecedorVencedorId: r.fornecedor_vencedor_id ?? "",
  justificativaEscolha: r.justificativa_escolha ?? "", itensVencedores: r.itens_vencedores ?? [],
});

const cotacaoToRow = (c: CotacaoCompras) => ({
  requisicao_id: c.requisicaoId, requisicao_numero: c.requisicaoNumero,
  numero: c.numero, data_criacao: c.dataCriacao, comprador: c.comprador,
  status: c.status, propostas: c.propostas as any,
  fornecedor_vencedor_id: c.fornecedorVencedorId,
  justificativa_escolha: c.justificativaEscolha, itens_vencedores: c.itensVencedores as any,
});

export function CotacaoComprasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("CotacaoCompras");
  const qc = useQueryClient();
  const { data: cotacoes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("cotacoes_compras", "created_at")).map(rowToCotacao),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const saveAndReload = async (id: string, updated: CotacaoCompras) => {
    await updateRow("cotacoes_compras", id, cotacaoToRow(updated));
    invalidate();
  };

  const addCotacao = (data: Omit<CotacaoCompras, "id" | "numero" | "dataCriacao" | "status" | "propostas" | "fornecedorVencedorId" | "justificativaEscolha" | "itensVencedores">) => {
    const maxNum = cotacoes.length > 0 ? Math.max(...cotacoes.map(c => c.numero)) : 0;
    const cot: CotacaoCompras = {
      ...data, id: crypto.randomUUID(), numero: maxNum + 1,
      dataCriacao: new Date().toISOString(), status: "Em Andamento",
      propostas: [], fornecedorVencedorId: "", justificativaEscolha: "", itensVencedores: [],
    };
    insertRow("cotacoes_compras", cotacaoToRow(cot)).then(() => invalidate());
    return cot;
  };

  const addProposta = async (cotacaoId: string, proposta: Omit<PropostaFornecedor, "id" | "valorTotal">) => {
    const c = cotacoes.find(c => c.id === cotacaoId);
    if (!c || c.status === "Finalizada" || c.status === "Cancelada") return;
    const valorTotal = proposta.itens.reduce((sum, i) => sum + i.precoUnitario * i.quantidade, 0)
      + (Number(proposta.valorFrete) || 0) + (Number(proposta.valorOperacao) || 0) + (Number(proposta.valorSeguro) || 0);
    const updated = { ...c, propostas: [...c.propostas, { ...proposta, id: crypto.randomUUID(), valorTotal }] };
    await saveAndReload(cotacaoId, updated);
  };

  const updateProposta = async (cotacaoId: string, propostaId: string, proposta: Omit<PropostaFornecedor, "id" | "valorTotal">) => {
    const c = cotacoes.find(c => c.id === cotacaoId);
    if (!c || c.status === "Finalizada" || c.status === "Cancelada") return;
    const valorTotal = proposta.itens.reduce((sum, i) => sum + i.precoUnitario * i.quantidade, 0)
      + (Number(proposta.valorFrete) || 0) + (Number(proposta.valorOperacao) || 0) + (Number(proposta.valorSeguro) || 0);
    const updated = { ...c, propostas: c.propostas.map(p => p.id === propostaId ? { ...proposta, id: propostaId, valorTotal } : p) };
    await saveAndReload(cotacaoId, updated);
  };

  const removeProposta = async (cotacaoId: string, propostaId: string) => {
    const c = cotacoes.find(c => c.id === cotacaoId);
    if (!c || c.status === "Finalizada" || c.status === "Cancelada") return;
    await saveAndReload(cotacaoId, { ...c, propostas: c.propostas.filter(p => p.id !== propostaId) });
  };

  const submeterAprovacao = async (cotacaoId: string) => {
    const c = cotacoes.find(c => c.id === cotacaoId);
    if (!c || c.status !== "Em Andamento") return;
    await saveAndReload(cotacaoId, { ...c, status: "Aguardando Aprovação" });
  };

  const aprovarCotacao = async (cotacaoId: string, fornecedorVencedorId: string, justificativa: string, itensVencedores?: ItemVencedor[]) => {
    const c = cotacoes.find(c => c.id === cotacaoId);
    if (!c) return;
    await saveAndReload(cotacaoId, { ...c, status: "Revisão de Confirmação", fornecedorVencedorId, justificativaEscolha: justificativa, itensVencedores: itensVencedores || [] });
  };

  const finalizarCotacao = async (cotacaoId: string, fornecedorVencedorId: string, justificativa: string, itensVencedores?: ItemVencedor[]) => {
    await aprovarCotacao(cotacaoId, fornecedorVencedorId, justificativa, itensVencedores);
  };

  const concluirRevisaoConfirmacao = async (cotacaoId: string) => {
    const c = cotacoes.find(c => c.id === cotacaoId);
    if (!c) return;
    await saveAndReload(cotacaoId, { ...c, status: "Finalizada" });
  };

  const cancelarCotacao = async (cotacaoId: string) => {
    const c = cotacoes.find(c => c.id === cotacaoId);
    if (!c) return;
    await saveAndReload(cotacaoId, { ...c, status: "Cancelada" });
  };

  const getCotacaoByRequisicao = (requisicaoId: string) => cotacoes.find(c => c.requisicaoId === requisicaoId);

  return (
    <CotacaoComprasContext.Provider value={{ cotacoes, addCotacao, addProposta, updateProposta, removeProposta, submeterAprovacao, aprovarCotacao, finalizarCotacao, concluirRevisaoConfirmacao, cancelarCotacao, getCotacaoByRequisicao }}>
      {children}
    </CotacaoComprasContext.Provider>
  );
}

export function useCotacaoCompras() {
  useActivateProvider("CotacaoCompras");
  const ctx = useContext(CotacaoComprasContext);
  if (!ctx) throw new Error("useCotacaoCompras must be used within CotacaoComprasProvider");
  return ctx;
}
