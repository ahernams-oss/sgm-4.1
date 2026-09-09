import React, { createContext, useContext, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

export interface BimQuantitativo {
  id: string; modelo_id: string; categoria: string; elemento: string;
  quantidade: number; unidade: string; observacao: string;
  cronograma_atividade_id?: string; cronograma_id?: string | null;
  created_at: string;
}

export interface BimPrancha {
  id: string; modelo_id: string; codigo: string; titulo: string;
  escala: string; revisao: string; data_revisao: string | null;
  arquivo_url: string; arquivo_nome: string; observacao: string;
  created_at: string;
}

export interface BimModelo {
  id: string; numero: number;
  cliente_id: string; cliente_nome: string;
  obra: string; nome: string; descricao: string;
  disciplina: string; versao: string; status: string;
  responsavel_tecnico: string; data_upload: string | null;
  formato: string; arquivo_url: string; arquivo_nome: string;
  arquivo_tamanho: number; thumbnail_url: string;
  tags: string[]; observacoes: string;
  created_at: string; updated_at: string;
}

interface BimContextType {
  modelos: BimModelo[];
  quantitativos: BimQuantitativo[];
  pranchas: BimPrancha[];
  loading: boolean;
  addModelo: (m: Partial<BimModelo>) => Promise<BimModelo | null>;
  updateModelo: (id: string, m: Partial<BimModelo>) => Promise<boolean>;
  deleteModelo: (id: string) => Promise<boolean>;
  addQuantitativo: (q: Partial<BimQuantitativo>) => Promise<BimQuantitativo | null>;
  updateQuantitativo: (id: string, q: Partial<BimQuantitativo>) => Promise<boolean>;
  deleteQuantitativo: (id: string) => Promise<boolean>;
  addPrancha: (p: Partial<BimPrancha>) => Promise<BimPrancha | null>;
  updatePrancha: (id: string, p: Partial<BimPrancha>) => Promise<boolean>;
  deletePrancha: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const BimContext = createContext<BimContextType>({} as BimContextType);

const QK_M = ["bim_modelos"] as const;
const QK_Q = ["bim_quantitativos"] as const;
const QK_P = ["bim_pranchas"] as const;

export function BimProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Bim");
  const qc = useQueryClient();
  const results = useQueries({
    queries: gateQueries([
      { queryKey: QK_M, queryFn: async () => (await fetchAll("bim_modelos", "numero")) as BimModelo[], staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_Q, queryFn: async () => (await fetchAll("bim_quantitativos")) as BimQuantitativo[], staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_P, queryFn: async () => (await fetchAll("bim_pranchas")) as BimPrancha[], staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
    ], __active),
  });
  const modelos = results[0].data ?? [];
  const quantitativos = results[1].data ?? [];
  const pranchas = results[2].data ?? [];
  const loading = results.some(r => r.isLoading);

  const invM = () => qc.invalidateQueries({ queryKey: QK_M });
  const invQ = () => qc.invalidateQueries({ queryKey: QK_Q });
  const invP = () => qc.invalidateQueries({ queryKey: QK_P });

  const addModelo = async (m: Partial<BimModelo>) => {
    const row = await insertRow("bim_modelos", m);
    if (row) { invM(); toast.success("Modelo BIM cadastrado!"); }
    return row;
  };
  const updateModelo = async (id: string, m: Partial<BimModelo>) => {
    const ok = await updateRow("bim_modelos", id, m);
    if (ok) { invM(); toast.success("Modelo atualizado!"); }
    return ok;
  };
  const deleteModelo = async (id: string) => {
    const ok = await deleteRow("bim_modelos", id);
    if (ok) { invM(); invQ(); invP(); toast.success("Modelo removido!"); }
    return ok;
  };

  const addQuantitativo = async (q: Partial<BimQuantitativo>) => {
    const row = await insertRow("bim_quantitativos", q);
    if (row) invQ();
    return row;
  };
  const updateQuantitativo = async (id: string, q: Partial<BimQuantitativo>) => {
    const ok = await updateRow("bim_quantitativos", id, q);
    if (ok) invQ();
    return ok;
  };
  const deleteQuantitativo = async (id: string) => {
    const ok = await deleteRow("bim_quantitativos", id);
    if (ok) invQ();
    return ok;
  };

  const addPrancha = async (p: Partial<BimPrancha>) => {
    const row = await insertRow("bim_pranchas", p);
    if (row) invP();
    return row;
  };
  const updatePrancha = async (id: string, p: Partial<BimPrancha>) => {
    const ok = await updateRow("bim_pranchas", id, p);
    if (ok) invP();
    return ok;
  };
  const deletePrancha = async (id: string) => {
    const ok = await deleteRow("bim_pranchas", id);
    if (ok) invP();
    return ok;
  };

  const refresh = async () => { invM(); invQ(); invP(); };

  return (
    <BimContext.Provider value={{
      modelos, quantitativos, pranchas, loading,
      addModelo, updateModelo, deleteModelo,
      addQuantitativo, updateQuantitativo, deleteQuantitativo,
      addPrancha, updatePrancha, deletePrancha,
      refresh,
    }}>
      {children}
    </BimContext.Provider>
  );
}

export const useBim = () => useContext(BimContext);
