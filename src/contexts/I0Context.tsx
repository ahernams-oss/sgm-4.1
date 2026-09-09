import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface I0 { id: string; mes: number; ano: number; codSco: string; valor: number; }

export const emptyI0Form: Omit<I0, "id"> = {
  mes: new Date().getMonth() + 1, ano: new Date().getFullYear(), codSco: "", valor: 0,
};

interface I0ContextType {
  items: I0[]; addItem: (item: Omit<I0, "id">) => void;
  updateItem: (id: string, data: Partial<Omit<I0, "id">>) => void;
  deleteItem: (id: string) => void;
}

const I0Context = createContext<I0ContextType | undefined>(undefined);
const QK = ["i0_items"] as const;

const rowToI0 = (r: any): I0 => ({
  id: r.id, mes: r.mes ?? 1, ano: r.ano ?? 2024, codSco: r.cod_sco ?? "", valor: Number(r.valor) || 0,
});

export function I0Provider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("I0");
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("i0_items")).map(rowToI0),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addItem = async (item: Omit<I0, "id">) => {
    await insertRow("i0_items", { mes: item.mes, ano: item.ano, cod_sco: item.codSco, valor: item.valor });
    invalidate();
  };

  const updateItem = async (id: string, data: Partial<Omit<I0, "id">>) => {
    const current = items.find(i => i.id === id);
    if (!current) return;
    const merged = { ...current, ...data };
    await updateRow("i0_items", id, { mes: merged.mes, ano: merged.ano, cod_sco: merged.codSco, valor: merged.valor });
    invalidate();
  };

  const deleteItem = async (id: string) => { await deleteRow("i0_items", id); invalidate(); };

  return (
    <I0Context.Provider value={{ items, addItem, updateItem, deleteItem }}>
      {children}
    </I0Context.Provider>
  );
}

export function useI0() {
  useActivateProvider("I0");
  const ctx = useContext(I0Context);
  if (!ctx) throw new Error("useI0 must be used within I0Provider");
  return ctx;
}
