import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface Evidencia {
  id: string; numero: number; titulo: string; descricao: string;
  tipo: string; processo_vinculado: string;
  centro_custo_id: string; centro_custo_nome: string; setor: string;
  data_fato_gerador: string; data_registro: string;
  responsavel_registro: string; status: string; observacoes: string;
  palavras_chave: string; anexos: any[]; historico: any[]; created_at: string;
}

interface EvidenciasContextType {
  evidencias: Evidencia[];
  loading: boolean;
  addEvidencia: (e: Partial<Evidencia>) => Promise<Evidencia | null>;
  updateEvidencia: (id: string, e: Partial<Evidencia>) => Promise<boolean>;
  deleteEvidencia: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  uploadAnexo: (file: File, evidenciaId: string) => Promise<string | null>;
}

const EvidenciasContext = createContext<EvidenciasContextType>({} as EvidenciasContextType);
export const useEvidencias = () => useContext(EvidenciasContext);
const QK = ["evidencias"] as const;

export function EvidenciasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Evidencias");
  const qc = useQueryClient();
  const { data: evidencias = [], isLoading: loading, refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("evidencias")) as Evidencia[],
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const getNextNumero = () => {
    if (evidencias.length === 0) return 1;
    return Math.max(...evidencias.map((e) => e.numero || 0)) + 1;
  };

  const addEvidencia = async (e: Partial<Evidencia>) => {
    const row = { ...e, numero: getNextNumero() };
    const data = await insertRow("evidencias", row);
    if (data) { invalidate(); toast.success("Evidência registrada com sucesso!"); }
    return data;
  };
  const updateEvidencia = async (id: string, e: Partial<Evidencia>) => {
    const ok = await updateRow("evidencias", id, e);
    if (ok) { invalidate(); toast.success("Evidência atualizada!"); }
    return ok;
  };
  const deleteEvidencia = async (id: string) => {
    const ok = await deleteRow("evidencias", id);
    if (ok) { invalidate(); toast.success("Evidência removida!"); }
    return ok;
  };
  const uploadAnexo = async (file: File, evidenciaId: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${evidenciaId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("evidencias-anexos").upload(path, file);
    if (error) { console.error("Upload error:", error); toast.error("Erro ao fazer upload do arquivo."); return null; }
    const { data: urlData } = supabase.storage.from("evidencias-anexos").getPublicUrl(path);
    return urlData.publicUrl;
  };
  const refresh = async () => { await refetch(); };

  return (
    <EvidenciasContext.Provider value={{ evidencias, loading, addEvidencia, updateEvidencia, deleteEvidencia, refresh, uploadAnexo }}>
      {children}
    </EvidenciasContext.Provider>
  );
}
