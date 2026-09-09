import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface OsModelo {
  id: string;
  nome: string;
  descricao: string;
}

interface Ctx {
  modelos: OsModelo[];
  addModelo: (m: Omit<OsModelo, "id">) => Promise<void>;
  updateModelo: (id: string, data: Partial<Omit<OsModelo, "id">>) => Promise<void>;
  deleteModelo: (id: string) => Promise<void>;
}

const OsModelosContext = createContext<Ctx | undefined>(undefined);
const QK = ["os_modelos"] as const;

const rowTo = (r: any): OsModelo => ({
  id: r.id, nome: r.nome ?? "", descricao: r.descricao ?? "",
});

export function OsModelosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("OsModelos");
  const qc = useQueryClient();
  const { data: modelos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("os_modelos", "nome")).map(rowTo),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addModelo = async (m: Omit<OsModelo, "id">) => {
    await insertRow("os_modelos", { nome: m.nome, descricao: m.descricao || null });
    invalidate();
  };
  const updateModelo = async (id: string, data: Partial<Omit<OsModelo, "id">>) => {
    const row: any = {};
    if (data.nome !== undefined) row.nome = data.nome;
    if (data.descricao !== undefined) row.descricao = data.descricao || null;
    await updateRow("os_modelos", id, row);
    invalidate();
  };
  const deleteModelo = async (id: string) => { await deleteRow("os_modelos", id); invalidate(); };

  return (
    <OsModelosContext.Provider value={{ modelos, addModelo, updateModelo, deleteModelo }}>
      {children}
    </OsModelosContext.Provider>
  );
}

export function useOsModelos() {
  useActivateProvider("OsModelos");
  const ctx = useContext(OsModelosContext);
  if (!ctx) throw new Error("useOsModelos must be used within OsModelosProvider");
  return ctx;
}
