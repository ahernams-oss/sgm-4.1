import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface MaterialServico {
  id: string; codigo: string; descricao: string; tipo: "Material" | "Serviço";
  unidadeMedida: string; categoriaId: string; fabricanteId: string; estoqueMinimo: number;
  fotos: string[];
}

interface MateriaisServicosContextType {
  materiais: MaterialServico[];
  addMaterial: (m: Omit<MaterialServico, "id" | "codigo">) => void;
  updateMaterial: (id: string, data: Partial<Omit<MaterialServico, "id">>) => void;
  deleteMaterial: (id: string) => void;
}

const MateriaisServicosContext = createContext<MateriaisServicosContextType | undefined>(undefined);
const QK = ["materiais_servicos"] as const;

const rowToMaterial = (r: any): MaterialServico => ({
  id: r.id, codigo: r.codigo ?? "", descricao: r.descricao ?? "",
  tipo: r.tipo ?? "Material", unidadeMedida: r.unidade_medida ?? "",
  categoriaId: r.categoria_id ?? "", fabricanteId: r.fabricante_id ?? "",
  estoqueMinimo: Number(r.estoque_minimo ?? 0),
  fotos: Array.isArray(r.fotos) ? r.fotos : [],
});

export function MateriaisServicosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("MateriaisServicos");
  const qc = useQueryClient();
  const { data: materiais = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("materiais_servicos", "codigo")).map(rowToMaterial),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const nextCodigo = () => {
    const nums = materiais.map(m => parseInt(m.codigo, 10)).filter(n => !isNaN(n));
    return String((nums.length > 0 ? Math.max(...nums) : 0) + 1).padStart(6, "0");
  };

  const addMaterial = async (m: Omit<MaterialServico, "id" | "codigo">) => {
    await insertRow("materiais_servicos", {
      codigo: nextCodigo(), descricao: m.descricao, tipo: m.tipo,
      unidade_medida: m.unidadeMedida, categoria_id: m.categoriaId, fabricante_id: m.fabricanteId,
      estoque_minimo: m.estoqueMinimo || 0, fotos: m.fotos || [],
    });
    invalidate();
  };

  const updateMaterial = async (id: string, data: Partial<Omit<MaterialServico, "id">>) => {
    const current = materiais.find(m => m.id === id);
    if (!current) return;
    const merged = { ...current, ...data };
    await updateRow("materiais_servicos", id, {
      codigo: merged.codigo, descricao: merged.descricao, tipo: merged.tipo,
      unidade_medida: merged.unidadeMedida, categoria_id: merged.categoriaId,
      fabricante_id: merged.fabricanteId, estoque_minimo: merged.estoqueMinimo,
      fotos: merged.fotos || [],
    });
    invalidate();
  };

  const deleteMaterial = async (id: string) => { await deleteRow("materiais_servicos", id); invalidate(); };

  return (
    <MateriaisServicosContext.Provider value={{ materiais, addMaterial, updateMaterial, deleteMaterial }}>
      {children}
    </MateriaisServicosContext.Provider>
  );
}

export function useMateriaisServicos() {
  useActivateProvider("MateriaisServicos");
  const ctx = useContext(MateriaisServicosContext);
  if (!ctx) throw new Error("useMateriaisServicos must be used within MateriaisServicosProvider");
  return ctx;
}
