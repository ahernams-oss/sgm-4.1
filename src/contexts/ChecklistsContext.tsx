import React, { createContext, useContext, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

export interface ChecklistItem {
  descricao: string;
  quantidade: string;
  registro_fotografico: boolean;
}

export interface Checklist {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  itens: ChecklistItem[];
  created_at: string;
}

export interface PreenchimentoItem {
  descricao: string;
  quantidade: string;
  registro_fotografico: boolean;
  status: "Conforme" | "Não Conforme" | "N/A" | "";
  foto_url?: string;
}

export interface ChecklistPreenchimento {
  id: string;
  checklist_id: string;
  checklist_titulo: string;
  evidencia_id: string;
  evidencia_titulo: string;
  itens: PreenchimentoItem[];
  percentual_conformidade: number;
  responsavel: string;
  data_preenchimento: string;
  observacoes: string;
  status: string;
  created_at: string;
}

interface ChecklistsContextType {
  checklists: Checklist[];
  preenchimentos: ChecklistPreenchimento[];
  loading: boolean;
  addChecklist: (c: Partial<Checklist>) => Promise<Checklist | null>;
  updateChecklist: (id: string, c: Partial<Checklist>) => Promise<boolean>;
  deleteChecklist: (id: string) => Promise<boolean>;
  addPreenchimento: (p: Partial<ChecklistPreenchimento>) => Promise<ChecklistPreenchimento | null>;
  updatePreenchimento: (id: string, p: Partial<ChecklistPreenchimento>) => Promise<boolean>;
  deletePreenchimento: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const ChecklistsContext = createContext<ChecklistsContextType>({} as ChecklistsContextType);
export const useChecklists = () => useContext(ChecklistsContext);

const QK_C = ["checklists"] as const;
const QK_P = ["checklist_preenchimentos"] as const;

export function ChecklistsProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Checklists");
  const qc = useQueryClient();
  const results = useQueries({
    queries: gateQueries([
      {
        queryKey: QK_C,
        queryFn: async () => (await fetchAll("checklists")) as Checklist[],
        staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
      },
      {
        queryKey: QK_P,
        queryFn: async () => (await fetchAll("checklist_preenchimentos")) as ChecklistPreenchimento[],
        staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
      },
    ], __active),
  });
  const checklists = results[0].data ?? [];
  const preenchimentos = results[1].data ?? [];
  const loading = results.some(r => r.isLoading);
  const invC = () => qc.invalidateQueries({ queryKey: QK_C });
  const invP = () => qc.invalidateQueries({ queryKey: QK_P });

  const addChecklist = async (c: Partial<Checklist>) => {
    const data = await insertRow("checklists", c);
    if (data) { invC(); toast.success("Checklist criado com sucesso!"); }
    return data;
  };
  const updateChecklist = async (id: string, c: Partial<Checklist>) => {
    const ok = await updateRow("checklists", id, c);
    if (ok) { invC(); toast.success("Checklist atualizado!"); }
    return ok;
  };
  const deleteChecklist = async (id: string) => {
    const ok = await deleteRow("checklists", id);
    if (ok) { invC(); toast.success("Checklist removido!"); }
    return ok;
  };

  const addPreenchimento = async (p: Partial<ChecklistPreenchimento>) => {
    const data = await insertRow("checklist_preenchimentos", p);
    if (data) { invP(); toast.success("Checklist preenchido com sucesso!"); }
    return data;
  };
  const updatePreenchimento = async (id: string, p: Partial<ChecklistPreenchimento>) => {
    const ok = await updateRow("checklist_preenchimentos", id, p);
    if (ok) { invP(); toast.success("Preenchimento atualizado!"); }
    return ok;
  };
  const deletePreenchimento = async (id: string) => {
    const ok = await deleteRow("checklist_preenchimentos", id);
    if (ok) { invP(); toast.success("Preenchimento removido!"); }
    return ok;
  };
  const refresh = async () => { invC(); invP(); };

  return (
    <ChecklistsContext.Provider value={{
      checklists, preenchimentos, loading,
      addChecklist, updateChecklist, deleteChecklist,
      addPreenchimento, updatePreenchimento, deletePreenchimento,
      refresh,
    }}>
      {children}
    </ChecklistsContext.Provider>
  );
}
