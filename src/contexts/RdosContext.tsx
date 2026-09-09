import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface RdoEfetivoItem { funcao: string; quantidade: number; horas: number; }
export interface RdoEquipamentoItem { descricao: string; quantidade: number; horas: number; }
export interface RdoAtividadeItem { descricao: string; percentual_avanco: number; observacao: string; }
export interface RdoAnexo { nome: string; url: string; tipo: string; descricao?: string; }

export interface Rdo {
  id: string; numero: number; data_rdo: string;
  cliente_id: string; cliente_nome: string;
  obra_id?: string | null; obra: string; responsavel: string;
  clima_manha: string; clima_tarde: string; clima_noite: string;
  condicao_manha: string; condicao_tarde: string; condicao_noite: string;
  efetivo: RdoEfetivoItem[]; equipamentos: RdoEquipamentoItem[];
  atividades: RdoAtividadeItem[]; avanco_fisico_geral: number;
  ocorrencias: string; observacoes: string; anexos: RdoAnexo[];
  assinatura_responsavel: string; assinatura_responsavel_nome: string;
  assinatura_fiscalizacao: string; assinatura_fiscalizacao_nome: string;
  status: string; created_at: string; updated_at: string;
}

interface RdosContextType {
  rdos: Rdo[]; loading: boolean;
  addRdo: (r: Partial<Rdo>) => Promise<Rdo | null>;
  updateRdo: (id: string, r: Partial<Rdo>) => Promise<boolean>;
  deleteRdo: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  uploadAnexo: (file: File, rdoId: string) => Promise<string | null>;
}

const RdosContext = createContext<RdosContextType>({} as RdosContextType);
export const useRdos = () => useContext(RdosContext);
const QK = ["rdos"] as const;

export function RdosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Rdos");
  const qc = useQueryClient();
  const { data: rdos = [], isLoading: loading, refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("rdos", "data_rdo");
      return (data as Rdo[]).reverse();
    },
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addRdo = async (r: Partial<Rdo>) => {
    const data = await insertRow("rdos", r);
    if (data) { invalidate(); toast.success("RDO registrado com sucesso!"); }
    return data;
  };
  const updateRdo = async (id: string, r: Partial<Rdo>) => {
    const ok = await updateRow("rdos", id, { ...r, updated_at: new Date().toISOString() });
    if (ok) { invalidate(); toast.success("RDO atualizado!"); }
    return ok;
  };
  const deleteRdo = async (id: string) => {
    const ok = await deleteRow("rdos", id);
    if (ok) { invalidate(); toast.success("RDO removido!"); }
    return ok;
  };
  const uploadAnexo = async (file: File, rdoId: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${rdoId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("rdo-anexos").upload(path, file);
    if (error) { console.error("Upload error:", error); toast.error("Erro ao fazer upload do arquivo."); return null; }
    const { data: urlData } = supabase.storage.from("rdo-anexos").getPublicUrl(path);
    return urlData.publicUrl;
  };
  const refresh = async () => { await refetch(); };

  return (
    <RdosContext.Provider value={{ rdos, loading, addRdo, updateRdo, deleteRdo, refresh, uploadAnexo }}>
      {children}
    </RdosContext.Provider>
  );
}
