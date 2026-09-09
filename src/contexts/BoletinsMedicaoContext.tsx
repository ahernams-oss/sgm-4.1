import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface BoletimMedicaoItem {
  id: string;
  numero: number;
  periodo_inicio: string;
  periodo_fim: string;
  valor: number;
}

export interface BoletimMedicaoFrente {
  id: string;
  nome: string;
  valor_contrato: number;
  medicoes: BoletimMedicaoItem[];
}

export interface BoletimMedicao {
  id: string;
  numero: number;
  ano: number;
  cliente_id: string;
  cliente_nome: string;
  contrato_numero: string;
  processo_numero: string;
  objeto: string;
  obra: string;
  responsavel_tecnico: string;
  valor_total_contrato: number;
  data_emissao: string;
  frentes: BoletimMedicaoFrente[];
  status: string;
  observacoes: string;
  enviado_cliente: boolean;
  data_envio?: string | null;
  created_at: string;
  updated_at: string;
}

interface Ctx {
  boletins: BoletimMedicao[];
  loading: boolean;
  addBoletim: (b: Partial<BoletimMedicao>) => Promise<BoletimMedicao | null>;
  updateBoletim: (id: string, b: Partial<BoletimMedicao>) => Promise<boolean>;
  deleteBoletim: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const BoletinsMedicaoContext = createContext<Ctx>({} as Ctx);
export const useBoletinsMedicao = () => useContext(BoletinsMedicaoContext);

const QK = ["boletins_medicao"] as const;

export function BoletinsMedicaoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("BoletinsMedicao");
  const qc = useQueryClient();
  const { data: boletins = [], isLoading: loading } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("boletins_medicao", "created_at");
      return (data as BoletimMedicao[]).reverse();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });
  const refresh = async () => { await invalidate(); };

  const addBoletim = async (b: Partial<BoletimMedicao>) => {
    const data = await insertRow("boletins_medicao", b);
    if (data) { invalidate(); toast.success("Boletim de medição criado!"); }
    return data as BoletimMedicao | null;
  };

  const updateBoletim = async (id: string, b: Partial<BoletimMedicao>) => {
    const ok = await updateRow("boletins_medicao", id, { ...b, updated_at: new Date().toISOString() });
    if (ok) { invalidate(); toast.success("Boletim atualizado!"); }
    return ok;
  };

  const deleteBoletim = async (id: string) => {
    const ok = await deleteRow("boletins_medicao", id);
    if (ok) { invalidate(); toast.success("Boletim removido!"); }
    return ok;
  };

  return (
    <BoletinsMedicaoContext.Provider value={{ boletins, loading, addBoletim, updateBoletim, deleteBoletim, refresh }}>
      {children}
    </BoletinsMedicaoContext.Provider>
  );
}
