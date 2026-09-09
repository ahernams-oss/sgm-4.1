import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export type TipoSco = "SCO" | "SINAPI" | "EMOP";
export const tiposSco: TipoSco[] = ["SCO", "SINAPI", "EMOP"];

export interface Sco { id: string; codSco: string; descricaoSco: string; unidade: string; tipo: TipoSco; familia: string; }

export const emptyScoForm: Omit<Sco, "id"> = { codSco: "", descricaoSco: "", unidade: "", tipo: "SCO", familia: "" };

interface ScoContextType {
  scos: Sco[]; addSco: (s: Omit<Sco, "id">) => void;
  updateSco: (id: string, s: Partial<Omit<Sco, "id">>) => void;
  deleteSco: (id: string) => void;
}

const ScoContext = createContext<ScoContextType | undefined>(undefined);
const QK = ["scos"] as const;

const rowToSco = (r: any): Sco => ({
  id: r.id, codSco: r.cod_sco ?? "", descricaoSco: r.descricao_sco ?? "",
  unidade: r.unidade ?? "", tipo: r.tipo ?? "SCO", familia: r.familia ?? "",
});

const scoToRow = (s: Omit<Sco, "id">) => ({
  cod_sco: s.codSco, descricao_sco: s.descricaoSco, unidade: s.unidade, tipo: s.tipo,
});

export function ScoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Sco");
  const qc = useQueryClient();
  const { data: scos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("scos", "cod_sco")).map(rowToSco),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addSco = async (s: Omit<Sco, "id">) => { await insertRow("scos", scoToRow(s)); invalidate(); };
  const updateSco = async (id: string, data: Partial<Omit<Sco, "id">>) => {
    const current = scos.find(s => s.id === id);
    if (!current) return;
    const merged = { ...current, ...data };
    const { id: _, ...rest } = merged;
    await updateRow("scos", id, scoToRow(rest));
    invalidate();
  };
  const deleteSco = async (id: string) => { await deleteRow("scos", id); invalidate(); };

  return (
    <ScoContext.Provider value={{ scos, addSco, updateSco, deleteSco }}>
      {children}
    </ScoContext.Provider>
  );
}

export function useSco() {
  useActivateProvider("Sco");
  const ctx = useContext(ScoContext);
  if (!ctx) throw new Error("useSco must be used within ScoProvider");
  return ctx;
}
