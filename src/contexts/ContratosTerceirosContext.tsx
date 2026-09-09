import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface ContratoAditivo {
  id: string; numero: string; data: string;
  tipo: "prazo" | "valor" | "prazo_valor";
  valor_adicional?: number; nova_data_fim?: string; descricao?: string;
}

export interface ContratoMedicaoVinc {
  medicao_id: string; numero?: number; data?: string; valor?: number;
}

export interface ContratoAnexo {
  nome: string; url: string; size?: number; tipo?: string;
}

export interface ContratoTerceiro {
  id: string; numero?: number;
  fornecedor_id?: string | null; fornecedor_nome?: string | null;
  fornecedor_cnpj?: string | null; fornecedor_endereco?: string | null;
  cliente_id?: string | null; cliente_nome?: string | null;
  obra_id?: string | null; obra_nome?: string | null;
  objeto: string; valor?: number;
  data_inicio?: string | null; data_fim?: string | null;
  status: string; observacoes?: string | null;
  aditivos: ContratoAditivo[];
  medicoes_vinculadas: ContratoMedicaoVinc[];
  anexos: ContratoAnexo[];
  created_at?: string; updated_at?: string;
}

interface Ctx {
  contratos: ContratoTerceiro[];
  loading: boolean;
  add: (c: Partial<ContratoTerceiro>) => Promise<ContratoTerceiro | null>;
  update: (id: string, c: Partial<ContratoTerceiro>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const ContratosTerceirosContext = createContext<Ctx>({
  contratos: [], loading: false,
  add: async () => null, update: async () => false, remove: async () => false,
  refresh: async () => {},
});
export const useContratosTerceiros = () => useContext(ContratosTerceirosContext);
const QK = ["contratos_terceiros"] as const;

export function ContratosTerceirosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("ContratosTerceiros");
  const qc = useQueryClient();
  const { data: contratos = [], isLoading: loading, refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("contratos_terceiros", "created_at");
      return (data as ContratoTerceiro[]).sort((a, b) => (b.numero || 0) - (a.numero || 0));
    },
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const add = async (c: Partial<ContratoTerceiro>) => {
    const data = await insertRow("contratos_terceiros", c);
    if (data) { invalidate(); toast.success("Contrato cadastrado!"); }
    return data as ContratoTerceiro | null;
  };
  const update = async (id: string, c: Partial<ContratoTerceiro>) => {
    const ok = await updateRow("contratos_terceiros", id, c);
    if (ok) { invalidate(); toast.success("Contrato atualizado!"); }
    return ok;
  };
  const remove = async (id: string) => {
    const ok = await deleteRow("contratos_terceiros", id);
    if (ok) { invalidate(); toast.success("Contrato removido!"); }
    return ok;
  };
  const refresh = async () => { await refetch(); };

  return (
    <ContratosTerceirosContext.Provider value={{ contratos, loading, add, update, remove, refresh }}>
      {children}
    </ContratosTerceirosContext.Provider>
  );
}
