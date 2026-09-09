import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface LaudoAssinatura {
  id: string;
  laudo_id: string;
  laudo_numero: number;
  papel: string; // 'responsavel_tecnico'
  signatario_user_id: string;
  signatario_nome: string;
  signatario_email: string;
  signatario_cargo: string;
  signatario_matricula: string;
  responsavel_tecnico_nome: string;
  responsavel_tecnico_registro: string;
  hash_documento: string;
  codigo_verificador: string;
  ip_origem: string;
  user_agent: string;
  base_legal: string;
  signed_at: string;
  created_at: string;
}

interface Ctx {
  assinaturas: LaudoAssinatura[];
  porLaudo: (laudoId: string) => LaudoAssinatura[];
  registrar: (a: Partial<LaudoAssinatura>) => Promise<LaudoAssinatura | null>;
  remover: (id: string) => Promise<boolean>;
  buscarPorCodigo: (codigo: string) => Promise<LaudoAssinatura | null>;
  refresh: () => Promise<void>;
}

const LaudosAssinaturasContext = createContext<Ctx>({
  assinaturas: [],
  porLaudo: () => [],
  registrar: async () => null,
  remover: async () => false,
  buscarPorCodigo: async () => null,
  refresh: async () => {},
});

export const useLaudosAssinaturas = () => useContext(LaudosAssinaturasContext);
const QK = ["laudos_assinaturas"] as const;

export function LaudosAssinaturasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("LaudosAssinaturas");
  const qc = useQueryClient();
  const { data: assinaturas = [], refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () =>
      (await fetchAll("equipamentos_laudos_assinaturas" as any, "signed_at")) as LaudoAssinatura[],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const registrar = async (a: Partial<LaudoAssinatura>) => {
    const data = await insertRow("equipamentos_laudos_assinaturas" as any, a);
    if (data) invalidate();
    return data as LaudoAssinatura | null;
  };
  const remover = async (id: string) => {
    const ok = await deleteRow("equipamentos_laudos_assinaturas" as any, id);
    if (ok) invalidate();
    return ok;
  };
  const porLaudo = (laudoId: string) => assinaturas.filter((a) => a.laudo_id === laudoId);
  const buscarPorCodigo = async (codigo: string): Promise<LaudoAssinatura | null> => {
    const { data, error } = await (supabase as any)
      .from("equipamentos_laudos_assinaturas")
      .select("*")
      .eq("codigo_verificador", codigo)
      .maybeSingle();
    if (error || !data) return null;
    return data as LaudoAssinatura;
  };
  const refresh = async () => { await refetch(); };

  return (
    <LaudosAssinaturasContext.Provider value={{ assinaturas, porLaudo, registrar, remover, buscarPorCodigo, refresh }}>
      {children}
    </LaudosAssinaturasContext.Provider>
  );
}
