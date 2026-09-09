import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface EventogramaEvento {
  id: string;
  ordem: number;
  marco: string;
  descricao: string;
  prazo: string;
  data_prevista: string;
  data_realizada: string;
  percentual: number;
  valor: number;
  criterio_medicao: string;
  status: "Planejado" | "Em andamento" | "Concluído" | "Cancelado";
  observacao: string;
}

export interface Eventograma {
  id: string;
  numero: number;
  cliente_id: string;
  cliente_nome: string;
  obra: string;
  descricao: string;
  responsavel: string;
  contrato_numero: string;
  data_assinatura: string;
  valor_total: number;
  eventos: EventogramaEvento[];
  status: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

interface Ctx {
  eventogramas: Eventograma[];
  loading: boolean;
  addEventograma: (e: Partial<Eventograma>) => Promise<Eventograma | null>;
  updateEventograma: (id: string, e: Partial<Eventograma>) => Promise<boolean>;
  deleteEventograma: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const EventogramasContext = createContext<Ctx>({} as Ctx);
export const useEventogramas = () => useContext(EventogramasContext);

const QK = ["eventogramas"] as const;

export function EventogramasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Eventogramas");
  const qc = useQueryClient();
  const { data: eventogramas = [], isLoading: loading } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("eventogramas", "created_at");
      return (data as Eventograma[]).reverse();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });
  const refresh = async () => { await invalidate(); };

  const addEventograma = async (e: Partial<Eventograma>) => {
    const data = await insertRow("eventogramas", e);
    if (data) { invalidate(); toast.success("Eventograma criado!"); }
    return data as Eventograma | null;
  };

  const updateEventograma = async (id: string, e: Partial<Eventograma>) => {
    const ok = await updateRow("eventogramas", id, { ...e, updated_at: new Date().toISOString() });
    if (ok) { invalidate(); toast.success("Eventograma atualizado!"); }
    return ok;
  };

  const deleteEventograma = async (id: string) => {
    const ok = await deleteRow("eventogramas", id);
    if (ok) { invalidate(); toast.success("Eventograma removido!"); }
    return ok;
  };

  return (
    <EventogramasContext.Provider value={{ eventogramas, loading, addEventograma, updateEventograma, deleteEventograma, refresh }}>
      {children}
    </EventogramasContext.Provider>
  );
}
