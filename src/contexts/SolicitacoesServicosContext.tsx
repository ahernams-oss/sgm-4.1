// Solicitações de Serviços Context
import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface HistoricoEntry {
  situacao: string;
  data: string;
  usuario: string;
}

export interface SolicitacaoServico {
  id: string; numero: number; tipo: string;
  clienteId: string; clienteNome: string;
  localId: string; localDescricao: string;
  pavimentoId: string; pavimentoDescricao: string;
  setorId: string; setorDescricao: string;
  equipamentoId: string; equipamentoNome: string;
  descricaoServicos: string; situacao: string; prioridade: string;
  observacoes: string; visitado: boolean; imagens: string[];
  createdAt: string; dataHoraSolicitacao: string;
  solicitanteId: string; solicitanteNome: string;
  historico: HistoricoEntry[];
  ressalvaAprovacao: string;
  impresso: boolean;
  impressoEm: string;
  impressoPor: string;
}

interface SolicitacoesServicosContextType {
  solicitacoes: SolicitacaoServico[];
  addSolicitacao: (d: any) => Promise<void>;
  updateSolicitacao: (id: string, d: any) => Promise<void>;
  deleteSolicitacao: (id: string) => Promise<void>;
}

const SolicitacoesServicosContext = createContext<SolicitacoesServicosContextType | undefined>(undefined);
const QK = ["solicitacoes_servicos"] as const;

const rowToSolicitacao = (r: any): SolicitacaoServico => ({
  id: r.id, numero: r.numero ?? 0, tipo: r.tipo ?? "Predial",
  clienteId: r.cliente_id ?? "", clienteNome: r.cliente_nome ?? "",
  localId: r.local_id ?? "", localDescricao: r.local_descricao ?? "",
  pavimentoId: r.pavimento_id ?? "", pavimentoDescricao: r.pavimento_descricao ?? "",
  setorId: r.setor_id ?? "", setorDescricao: r.setor_descricao ?? "",
  equipamentoId: r.equipamento_id ?? "", equipamentoNome: r.equipamento_nome ?? "",
  descricaoServicos: r.descricao_servicos ?? "",
  situacao: r.situacao ?? "Aguardando aprovação",
  prioridade: r.prioridade ?? "", observacoes: r.observacoes ?? "",
  visitado: r.visitado ?? false,
  imagens: Array.isArray(r.imagens) ? r.imagens : [],
  createdAt: r.created_at ?? "",
  dataHoraSolicitacao: r.data_hora_solicitacao ?? "",
  solicitanteId: r.solicitante_id ?? "",
  solicitanteNome: r.solicitante_nome ?? "",
  historico: Array.isArray(r.historico) ? r.historico : [],
  ressalvaAprovacao: r.ressalva_aprovacao ?? "",
  impresso: !!r.impresso,
  impressoEm: r.impresso_em ?? "",
  impressoPor: r.impresso_por ?? "",
});

export function SolicitacoesServicosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("SolicitacoesServicos");
  const qc = useQueryClient();
  const { data: solicitacoes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("solicitacoes_servicos", "numero")).map(rowToSolicitacao),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addSolicitacao = async (d: any) => { await insertRow("solicitacoes_servicos", d); invalidate(); };
  const updateSolicitacao = async (id: string, d: any) => { await updateRow("solicitacoes_servicos", id, d); invalidate(); };
  const deleteSolicitacao = async (id: string) => { await deleteRow("solicitacoes_servicos", id); invalidate(); };

  return (
    <SolicitacoesServicosContext.Provider value={{ solicitacoes, addSolicitacao, updateSolicitacao, deleteSolicitacao }}>
      {children}
    </SolicitacoesServicosContext.Provider>
  );
}

export function useSolicitacoesServicos() {
  useActivateProvider("SolicitacoesServicos");
  const ctx = useContext(SolicitacoesServicosContext);
  if (!ctx) throw new Error("useSolicitacoesServicos must be used within SolicitacoesServicosProvider");
  return ctx;
}
