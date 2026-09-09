import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface ItemServico {
  id: string;
  descricao: string;
  unidade: string;
  quantidade_contratada: number;
  valor_unitario: number;
  valor_total_contratado: number;
}

export interface LancamentoMedicao {
  id: string;
  numero: number;
  data: string;
  tipo: "percentual" | "valor";
  itens: {
    item_id: string;
    descricao: string;
    percentual?: number;
    valor?: number;
    quantidade?: number;
  }[];
  valor_total: number;
  percentual_total: number;
  status: string;
  observacao: string;
  anexos?: { nome: string; path: string; tamanho: number }[];
}

export interface MedicaoServico {
  id: string;
  created_at?: string;
  numero: number;
  cliente_id: string;
  cliente_nome: string;
  contrato: string;
  descricao: string;
  status: string;
  valor_total_contratado: number;
  valor_total_medido: number;
  percentual_medido: number;
  itens: ItemServico[];
  medicoes: LancamentoMedicao[];
  observacoes: string;
  anexos?: { nome: string; path: string; tamanho: number }[];
}

interface MedicoesContextType {
  medicoes: MedicaoServico[];
  loading: boolean;
  addMedicao: (m: Omit<MedicaoServico, "id">) => Promise<void>;
  updateMedicao: (id: string, m: Partial<MedicaoServico>) => Promise<void>;
  deleteMedicao: (id: string) => Promise<void>;
}

const MedicoesContext = createContext<MedicoesContextType | undefined>(undefined);
const QK = ["medicoes_servicos"] as const;

export function MedicoesProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Medicoes");
  const qc = useQueryClient();
  const { data: medicoes = [], isLoading: loading } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("medicoes_servicos");
      return (data || []).map((d: any) => ({
        ...d,
        itens: Array.isArray(d.itens) ? d.itens : [],
        medicoes: Array.isArray(d.medicoes) ? d.medicoes : [],
      })) as MedicaoServico[];
    },
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addMedicao = async (m: Omit<MedicaoServico, "id">) => { await insertRow("medicoes_servicos", m); invalidate(); };
  const updateMedicao = async (id: string, m: Partial<MedicaoServico>) => { await updateRow("medicoes_servicos", id, m); invalidate(); };
  const deleteMedicao = async (id: string) => { await deleteRow("medicoes_servicos", id); invalidate(); };

  return (
    <MedicoesContext.Provider value={{ medicoes, loading, addMedicao, updateMedicao, deleteMedicao }}>
      {children}
    </MedicoesContext.Provider>
  );
}

export function useMedicoes() {
  useActivateProvider("Medicoes");
  const ctx = useContext(MedicoesContext);
  if (!ctx) throw new Error("useMedicoes deve ser usado dentro de MedicoesProvider");
  return ctx;
}
