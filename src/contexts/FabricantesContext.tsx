import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface Fabricante { id: string; nome: string; }

interface FabricantesContextType {
  fabricantes: Fabricante[]; addFabricante: (nome: string) => void;
  updateFabricante: (id: string, nome: string) => void;
  deleteFabricante: (id: string) => void;
}

const FabricantesContext = createContext<FabricantesContextType | undefined>(undefined);
const QK = ["fabricantes"] as const;

export function FabricantesProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Fabricantes");
  const qc = useQueryClient();
  const { data: fabricantes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("fabricantes", "nome")).map((r: any) => ({ id: r.id, nome: r.nome ?? "" })),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addFabricante = async (nome: string) => { await insertRow("fabricantes", { nome }); invalidate(); };
  const updateFabricante = async (id: string, nome: string) => { await updateRow("fabricantes", id, { nome }); invalidate(); };
  const deleteFabricante = async (id: string) => { await deleteRow("fabricantes", id); invalidate(); };

  return (
    <FabricantesContext.Provider value={{ fabricantes, addFabricante, updateFabricante, deleteFabricante }}>
      {children}
    </FabricantesContext.Provider>
  );
}

export function useFabricantes() {
  useActivateProvider("Fabricantes");
  const ctx = useContext(FabricantesContext);
  if (!ctx) throw new Error("useFabricantes must be used within FabricantesProvider");
  return ctx;
}
