import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface ResponsavelTecnico {
  id: string;
  nome: string;
  titulo: string;
  crea: string;
  cpf: string;
  carteira_crea_url?: string | null;
  carteira_crea_nome?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Ctx {
  responsaveis: ResponsavelTecnico[];
  loading: boolean;
  add: (r: Partial<ResponsavelTecnico>) => Promise<ResponsavelTecnico | null>;
  update: (id: string, r: Partial<ResponsavelTecnico>) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  uploadCarteira: (file: File) => Promise<{ url: string; nome: string } | null>;
  refresh: () => Promise<void>;
}

const ResponsaveisTecnicosContext = createContext<Ctx>({} as Ctx);
export const useResponsaveisTecnicos = () => useContext(ResponsaveisTecnicosContext);
const QK = ["responsaveis_tecnicos"] as const;

export function ResponsaveisTecnicosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("ResponsaveisTecnicos");
  const qc = useQueryClient();
  const { data: responsaveis = [], isLoading: loading, refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("responsaveis_tecnicos", "nome")) as ResponsavelTecnico[],
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const add = async (r: Partial<ResponsavelTecnico>) => {
    const data = await insertRow("responsaveis_tecnicos", r);
    if (data) { invalidate(); toast.success("Responsável Técnico cadastrado!"); }
    return data;
  };
  const update = async (id: string, r: Partial<ResponsavelTecnico>) => {
    const ok = await updateRow("responsaveis_tecnicos", id, r);
    if (ok) { invalidate(); toast.success("Responsável Técnico atualizado!"); }
    return ok;
  };
  const remove = async (id: string) => {
    const ok = await deleteRow("responsaveis_tecnicos", id);
    if (ok) { invalidate(); toast.success("Responsável Técnico removido!"); }
    return ok;
  };
  const uploadCarteira = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("responsaveis-tecnicos").upload(path, file);
    if (error) { toast.error("Erro ao enviar carteira do CREA."); return null; }
    const { data } = supabase.storage.from("responsaveis-tecnicos").getPublicUrl(path);
    return { url: data.publicUrl, nome: file.name };
  };
  const refresh = async () => { await refetch(); };

  return (
    <ResponsaveisTecnicosContext.Provider value={{ responsaveis, loading, add, update, remove, uploadCarteira, refresh }}>
      {children}
    </ResponsaveisTecnicosContext.Provider>
  );
}
