import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface ItemScoOrcamento {
  id: string; codSco: string; descricao: string; unidade: string;
  quantidade: number; valorUnitario: number; valorTotal: number;
  familia?: string;
}

export interface ItemMaterialOrcamento {
  id: string; materialId: string; codigo: string; descricao: string;
  unidade: string; quantidade: number; valorUnitario: number; valorTotal: number;
  familia?: string;
}

export interface RevisaoEntry { motivo: string; data: string; usuario: string; }

export interface Orcamento {
  id: string; numero: number; solicitacaoId: string; solicitacaoNumero: number;
  clienteId: string; clienteNome: string;
  categoria: string;
  itensSco: ItemScoOrcamento[]; itensMateriais: ItemMaterialOrcamento[];
  anexos: string[]; valorTotal: number; status: string; observacoes: string;
  memoriaCalculo: any[];
  revisaoMotivo: string; revisoes: RevisaoEntry[];
  aprovadoPor: string; dataAprovacao: string;
  criadoPor: string; dataCriacao: string; createdAt: string;
}

interface OrcamentosContextType {
  orcamentos: Orcamento[];
  addOrcamento: (d: any) => Promise<any>;
  updateOrcamento: (id: string, d: any) => Promise<void>;
  deleteOrcamento: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const OrcamentosContext = createContext<OrcamentosContextType | undefined>(undefined);
const QK = ["orcamentos"] as const;

const rowToOrcamento = (r: any): Orcamento => ({
  id: r.id, numero: r.numero ?? 0,
  solicitacaoId: r.solicitacao_id ?? "", solicitacaoNumero: r.solicitacao_numero ?? 0,
  clienteId: r.cliente_id ?? "", clienteNome: r.cliente_nome ?? "",
  categoria: r.categoria ?? "",
  itensSco: Array.isArray(r.itens_sco) ? r.itens_sco : [],
  itensMateriais: Array.isArray(r.itens_materiais) ? r.itens_materiais : [],
  anexos: Array.isArray(r.anexos) ? r.anexos : [],
  valorTotal: Number(r.valor_total) || 0,
  status: r.status ?? "Pendente", observacoes: r.observacoes ?? "",
  memoriaCalculo: Array.isArray(r.memoria_calculo) ? r.memoria_calculo : [],
  revisaoMotivo: r.revisao_motivo ?? "",
  revisoes: Array.isArray(r.revisoes) ? r.revisoes : [],
  aprovadoPor: r.aprovado_por ?? "", dataAprovacao: r.data_aprovacao ?? "",
  criadoPor: r.criado_por ?? "",
  dataCriacao: r.data_criacao ?? r.created_at ?? "",
  createdAt: r.created_at ?? "",
});

export function OrcamentosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Orcamentos");
  const qc = useQueryClient();
  const { data: orcamentos = [], refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("orcamentos", "numero")).map(rowToOrcamento),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addOrcamento = async (d: any) => {
    const result = await insertRow("orcamentos", d);
    invalidate();
    return result;
  };
  const updateOrcamento = async (id: string, d: any) => { await updateRow("orcamentos", id, d); invalidate(); };
  const deleteOrcamento = async (id: string) => { await deleteRow("orcamentos", id); invalidate(); };
  const reload = async () => { await refetch(); };

  return (
    <OrcamentosContext.Provider value={{ orcamentos, addOrcamento, updateOrcamento, deleteOrcamento, reload }}>
      {children}
    </OrcamentosContext.Provider>
  );
}

export function useOrcamentos() {
  useActivateProvider("Orcamentos");
  const ctx = useContext(OrcamentosContext);
  if (!ctx) throw new Error("useOrcamentos must be used within OrcamentosProvider");
  return ctx;
}
