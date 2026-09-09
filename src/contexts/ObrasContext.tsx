import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface Obra {
  id: string;
  numero?: number;
  cliente_id: string;
  cliente_nome: string;
  nome: string;
  descricao?: string;
  endereco?: string;
  responsavel?: string;
  data_inicio?: string | null;
  data_prevista_termino?: string | null;
  status?: string;
  contrato_numero?: string;
  processo_numero?: string;
  valor_total_contrato?: number;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

interface Ctx {
  obras: Obra[];
  loading: boolean;
  add: (o: Partial<Obra>) => Promise<Obra | null>;
  update: (id: string, o: Partial<Obra>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  porCliente: (clienteId: string) => Obra[];
  refresh: () => Promise<void>;
}

const ObrasContext = createContext<Ctx>({
  obras: [], loading: false,
  add: async () => null, update: async () => false, remove: async () => false,
  porCliente: () => [], refresh: async () => {},
});
export const useObras = () => useContext(ObrasContext);
const QK = ["obras"] as const;

export function ObrasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Obras");
  const qc = useQueryClient();
  const { data: obras = [], isLoading: loading, refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("obras", "nome")) as Obra[],
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const add = async (o: Partial<Obra>) => {
    const data = await insertRow("obras", o);
    if (data) { invalidate(); toast.success("Obra cadastrada!"); }
    return data as Obra | null;
  };
  const update = async (id: string, o: Partial<Obra>) => {
    const ok = await updateRow("obras", id, o);
    if (ok) { invalidate(); toast.success("Obra atualizada!"); }
    return ok;
  };
  const remove = async (id: string) => {
    const ok = await deleteRow("obras", id);
    if (ok) { invalidate(); toast.success("Obra removida!"); }
    return ok;
  };
  const porCliente = (clienteId: string) => obras.filter((o) => o.cliente_id === clienteId);
  const refresh = async () => { await refetch(); };

  return (
    <ObrasContext.Provider value={{ obras, loading, add, update, remove, porCliente, refresh }}>
      {children}
    </ObrasContext.Provider>
  );
}
