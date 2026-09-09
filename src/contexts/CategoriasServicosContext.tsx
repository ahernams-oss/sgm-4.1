import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface CategoriaServico {
  id: string;
  nome: string;
  descricao: string;
}

interface CategoriasServicosContextType {
  categorias: CategoriaServico[];
  addCategoria: (c: Omit<CategoriaServico, "id">) => Promise<void>;
  updateCategoria: (id: string, data: Partial<Omit<CategoriaServico, "id">>) => Promise<void>;
  deleteCategoria: (id: string) => Promise<void>;
}

const CategoriasServicosContext = createContext<CategoriasServicosContextType | undefined>(undefined);
const QK = ["categorias_servicos"] as const;

export function CategoriasServicosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("CategoriasServicos");
  const qc = useQueryClient();
  const { data: categorias = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("categorias_servicos", "nome")).map((r: any) => ({
      id: r.id, nome: r.nome ?? "", descricao: r.descricao ?? "",
    })),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addCategoria = async (c: Omit<CategoriaServico, "id">) => {
    await insertRow("categorias_servicos", { nome: c.nome, descricao: c.descricao });
    invalidate();
  };
  const updateCategoria = async (id: string, data: Partial<Omit<CategoriaServico, "id">>) => {
    await updateRow("categorias_servicos", id, data); invalidate();
  };
  const deleteCategoria = async (id: string) => { await deleteRow("categorias_servicos", id); invalidate(); };

  return (
    <CategoriasServicosContext.Provider value={{ categorias, addCategoria, updateCategoria, deleteCategoria }}>
      {children}
    </CategoriasServicosContext.Provider>
  );
}

export function useCategoriasServicos() {
  useActivateProvider("CategoriasServicos");
  const ctx = useContext(CategoriasServicosContext);
  if (!ctx) throw new Error("useCategoriasServicos must be used within CategoriasServicosProvider");
  return ctx;
}
