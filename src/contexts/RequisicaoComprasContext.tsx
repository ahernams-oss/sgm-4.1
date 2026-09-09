import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export type StatusRequisicaoCompras =
  | "Rascunho" | "Enviada" | "Em Cotação" | "Aguardando Aprovação"
  | "Aprovada" | "Reprovada" | "Recusada" | "Pedido Emitido" | "Em Entrega"
  | "Recebida Parcial" | "Recebida" | "Concluída" | "Cancelada";

export type GrauUrgencia = "Baixa" | "Normal" | "Alta" | "Urgente";

export interface AnexoItemRequisicao { nome: string; tipo: string; base64: string; }
export interface ItemRequisicaoCompras {
  id: string; materialId: string; descricao: string; especificacaoTecnica: string;
  observacao: string; quantidade: number; unidadeMedida: string;
  anexo?: AnexoItemRequisicao | null;
}
export interface HistoricoStatusCompras { status: StatusRequisicaoCompras; dataHora: string; usuario: string; observacao: string; }
export interface AnexoRequisicaoCompras { id: string; nome: string; tipo: string; base64: string; }

export interface RequisicaoCompras {
  id: string; numero: number; dataCriacao: string; solicitante: string;
  centroCusto: string; centroCustoNome: string; localEntrega: string;
  justificativa: string; urgencia: GrauUrgencia; prazoDesejado: string;
  status: StatusRequisicaoCompras; itens: ItemRequisicaoCompras[];
  anexos: AnexoRequisicaoCompras[]; historicoStatus: HistoricoStatusCompras[];
}

interface RequisicaoComprasContextType {
  requisicoes: RequisicaoCompras[];
  addRequisicao: (data: Omit<RequisicaoCompras, "id" | "numero" | "dataCriacao" | "status" | "historicoStatus">) => void;
  updateRequisicao: (id: string, data: Partial<Omit<RequisicaoCompras, "id" | "numero" | "dataCriacao">>) => void;
  updateStatus: (id: string, status: StatusRequisicaoCompras, usuario: string, observacao?: string) => void;
  cancelarRequisicao: (id: string, usuario: string, motivo: string) => void;
}

const RequisicaoComprasContext = createContext<RequisicaoComprasContextType | undefined>(undefined);
const QK = ["requisicoes_compras"] as const;

const rowToReq = (r: any): RequisicaoCompras => ({
  id: r.id, numero: r.numero ?? 0, dataCriacao: r.data_criacao ?? "",
  solicitante: r.solicitante ?? "", centroCusto: r.centro_custo ?? "",
  centroCustoNome: r.centro_custo_nome ?? "", localEntrega: r.local_entrega ?? "",
  justificativa: r.justificativa ?? "", urgencia: r.urgencia ?? "Baixa",
  prazoDesejado: r.prazo_desejado ?? "", status: r.status ?? "Enviada",
  itens: r.itens ?? [], anexos: r.anexos ?? [], historicoStatus: r.historico_status ?? [],
});

const reqToRow = (r: RequisicaoCompras) => ({
  numero: r.numero, data_criacao: r.dataCriacao, solicitante: r.solicitante,
  centro_custo: r.centroCusto, centro_custo_nome: r.centroCustoNome,
  local_entrega: r.localEntrega, justificativa: r.justificativa,
  urgencia: r.urgencia, prazo_desejado: r.prazoDesejado, status: r.status,
  itens: r.itens as any, anexos: r.anexos as any, historico_status: r.historicoStatus as any,
});

export function RequisicaoComprasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("RequisicaoCompras");
  const qc = useQueryClient();
  const { data: requisicoes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("requisicoes_compras", "created_at")).map(rowToReq),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addRequisicao = async (data: Omit<RequisicaoCompras, "id" | "numero" | "dataCriacao" | "status" | "historicoStatus">) => {
    const now = new Date().toISOString();
    const maxNum = requisicoes.length > 0 ? Math.max(...requisicoes.map(r => r.numero)) : 0;
    const req: RequisicaoCompras = {
      ...data, id: "", numero: maxNum + 1, dataCriacao: now, status: "Enviada",
      historicoStatus: [{ status: "Enviada", dataHora: now, usuario: data.solicitante, observacao: "Solicitação criada" }],
    };
    await insertRow("requisicoes_compras", reqToRow(req));
    invalidate();
  };

  const updateRequisicao = async (id: string, data: Partial<Omit<RequisicaoCompras, "id" | "numero" | "dataCriacao">>) => {
    const current = requisicoes.find(r => r.id === id);
    if (!current || !["Rascunho", "Enviada", "Recusada"].includes(current.status)) return;
    const merged = { ...current, ...data };
    await updateRow("requisicoes_compras", id, reqToRow(merged));
    invalidate();
  };

  const updateStatus = async (id: string, status: StatusRequisicaoCompras, usuario: string, observacao = "") => {
    const current = requisicoes.find(r => r.id === id);
    if (!current) return;
    const updated = {
      ...current, status,
      historicoStatus: [...current.historicoStatus, { status, dataHora: new Date().toISOString(), usuario, observacao }],
    };
    await updateRow("requisicoes_compras", id, reqToRow(updated));
    invalidate();
  };

  const cancelarRequisicao = (id: string, usuario: string, motivo: string) => {
    updateStatus(id, "Cancelada", usuario, motivo);
  };

  return (
    <RequisicaoComprasContext.Provider value={{ requisicoes, addRequisicao, updateRequisicao, updateStatus, cancelarRequisicao }}>
      {children}
    </RequisicaoComprasContext.Provider>
  );
}

export function useRequisicaoCompras(activate: boolean = true) {
  useActivateProvider("RequisicaoCompras", activate);
  const ctx = useContext(RequisicaoComprasContext);
  if (!ctx) throw new Error("useRequisicaoCompras must be used within RequisicaoComprasProvider");
  return ctx;
}
