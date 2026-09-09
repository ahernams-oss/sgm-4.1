import { createContext, useContext, useCallback, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface MaterialScoVinculo {
  id: string;
  materialId: string;
  scoId: string;
  codSco: string;
  descricaoSco: string;
  unidadeSco: string;
  fatorConversao: number;
  padrao: boolean;
  observacao: string;
}

interface Ctx {
  vinculos: MaterialScoVinculo[];
  getVinculos: (materialId: string) => MaterialScoVinculo[];
  getPadrao: (materialId: string) => MaterialScoVinculo | undefined;
  addVinculo: (v: Omit<MaterialScoVinculo, "id">) => Promise<void>;
  updateVinculo: (id: string, v: Partial<Omit<MaterialScoVinculo, "id" | "materialId">>) => Promise<void>;
  deleteVinculo: (id: string) => Promise<void>;
  definirPadrao: (materialId: string, id: string) => Promise<void>;
}

const MaterialScoVinculosContext = createContext<Ctx | undefined>(undefined);
const QK = ["material_sco_vinculos"] as const;

const rowToVinculo = (r: any): MaterialScoVinculo => ({
  id: r.id,
  materialId: r.material_id ?? "",
  scoId: r.sco_id ?? "",
  codSco: r.cod_sco ?? "",
  descricaoSco: r.descricao_sco ?? "",
  unidadeSco: r.unidade_sco ?? "",
  fatorConversao: Number(r.fator_conversao ?? 1),
  padrao: !!r.padrao,
  observacao: r.observacao ?? "",
});

const toRow = (v: Partial<MaterialScoVinculo>) => ({
  ...(v.materialId !== undefined ? { material_id: v.materialId } : {}),
  ...(v.scoId !== undefined ? { sco_id: v.scoId || null } : {}),
  ...(v.codSco !== undefined ? { cod_sco: v.codSco } : {}),
  ...(v.descricaoSco !== undefined ? { descricao_sco: v.descricaoSco } : {}),
  ...(v.unidadeSco !== undefined ? { unidade_sco: v.unidadeSco } : {}),
  ...(v.fatorConversao !== undefined ? { fator_conversao: v.fatorConversao } : {}),
  ...(v.padrao !== undefined ? { padrao: v.padrao } : {}),
  ...(v.observacao !== undefined ? { observacao: v.observacao } : {}),
});

export function MaterialScoVinculosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("MaterialScoVinculos");
  const qc = useQueryClient();
  const { data: vinculos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("material_sco_vinculos", "cod_sco")).map(rowToVinculo),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const getVinculos = useCallback(
    (materialId: string) => vinculos.filter(v => v.materialId === materialId),
    [vinculos]
  );
  const getPadrao = useCallback(
    (materialId: string) => {
      const list = vinculos.filter(v => v.materialId === materialId);
      return list.find(v => v.padrao) ?? list[0];
    },
    [vinculos]
  );

  const clearPadrao = async (materialId: string, exceptId?: string) => {
    for (const v of vinculos.filter(x => x.materialId === materialId && x.padrao && x.id !== exceptId)) {
      await updateRow("material_sco_vinculos", v.id, { padrao: false });
    }
  };

  const addVinculo = async (v: Omit<MaterialScoVinculo, "id">) => {
    if (v.padrao) await clearPadrao(v.materialId);
    await insertRow("material_sco_vinculos", toRow(v));
    invalidate();
  };

  const updateVinculo = async (id: string, v: Partial<Omit<MaterialScoVinculo, "id" | "materialId">>) => {
    const current = vinculos.find(x => x.id === id);
    if (v.padrao && current) await clearPadrao(current.materialId, id);
    await updateRow("material_sco_vinculos", id, toRow(v));
    invalidate();
  };

  const deleteVinculo = async (id: string) => {
    await deleteRow("material_sco_vinculos", id);
    invalidate();
  };

  const definirPadrao = async (materialId: string, id: string) => {
    await clearPadrao(materialId, id);
    await updateRow("material_sco_vinculos", id, { padrao: true });
    invalidate();
  };

  return (
    <MaterialScoVinculosContext.Provider
      value={{ vinculos, getVinculos, getPadrao, addVinculo, updateVinculo, deleteVinculo, definirPadrao }}
    >
      {children}
    </MaterialScoVinculosContext.Provider>
  );
}

export function useMaterialScoVinculos() {
  useActivateProvider("MaterialScoVinculos");
  const ctx = useContext(MaterialScoVinculosContext);
  if (!ctx) throw new Error("useMaterialScoVinculos must be used within MaterialScoVinculosProvider");
  return ctx;
}
