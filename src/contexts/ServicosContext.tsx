import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface Servico {
  id: string;
  nome: string;
  descricao: string;
  categoriaId: string;
}

interface ServicosContextType {
  servicos: Servico[];
  addServico: (s: Omit<Servico, "id">) => Promise<void>;
  updateServico: (id: string, data: Partial<Omit<Servico, "id">>) => Promise<void>;
  deleteServico: (id: string) => Promise<void>;
}

const ServicosContext = createContext<ServicosContextType | undefined>(undefined);
const QK = ["servicos"] as const;

const rowToServico = (r: any): Servico => ({
  id: r.id, nome: r.nome ?? "", descricao: r.descricao ?? "", categoriaId: r.categoria_id ?? "",
});

export function ServicosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Servicos");
  const qc = useQueryClient();
  const { data: servicos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("servicos", "nome")).map(rowToServico),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addServico = async (s: Omit<Servico, "id">) => {
    await insertRow("servicos", { nome: s.nome, descricao: s.descricao, categoria_id: s.categoriaId || null });
    invalidate();
  };
  const updateServico = async (id: string, data: Partial<Omit<Servico, "id">>) => {
    const row: any = {};
    if (data.nome !== undefined) row.nome = data.nome;
    if (data.descricao !== undefined) row.descricao = data.descricao;
    if (data.categoriaId !== undefined) row.categoria_id = data.categoriaId || null;
    await updateRow("servicos", id, row);
    invalidate();
  };
  const deleteServico = async (id: string) => { await deleteRow("servicos", id); invalidate(); };

  return (
    <ServicosContext.Provider value={{ servicos, addServico, updateServico, deleteServico }}>
      {children}
    </ServicosContext.Provider>
  );
}

export function useServicos() {
  useActivateProvider("Servicos");
  const ctx = useContext(ServicosContext);
  if (!ctx) throw new Error("useServicos must be used within ServicosProvider");
  return ctx;
}
