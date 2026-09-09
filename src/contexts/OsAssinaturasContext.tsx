import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export type PapelOsAssinatura = "fiscal" | "fiscal_2" | "fiscal_3" | "solicitante";

export interface OsAssinatura {
  id: string; os_id: string; os_numero: number;
  papel: PapelOsAssinatura;
  signatario_user_id: string; signatario_nome: string;
  signatario_email: string; signatario_cargo: string; signatario_matricula: string;
  hash_documento: string; codigo_verificador: string;
  ip_origem: string; user_agent: string; base_legal: string;
  metodo_autenticacao?: string; nivel_assinatura?: string;
  signed_at: string; created_at: string;
}

interface Ctx {
  assinaturas: OsAssinatura[];
  porOs: (osId: string) => OsAssinatura[];
  registrar: (a: Partial<OsAssinatura>) => Promise<OsAssinatura | null>;
  buscarPorCodigo: (codigo: string) => Promise<OsAssinatura | null>;
  refresh: () => Promise<void>;
}

const OsAssinaturasContext = createContext<Ctx>({
  assinaturas: [],
  porOs: () => [],
  registrar: async () => null,
  buscarPorCodigo: async () => null,
  refresh: async () => {},
});
export const useOsAssinaturas = () => useContext(OsAssinaturasContext);
const QK = ["os_assinaturas"] as const;

export function OsAssinaturasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("OsAssinaturas");
  const qc = useQueryClient();
  const { data: assinaturas = [], refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("os_assinaturas", "signed_at")) as OsAssinatura[],
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const registrar = async (a: Partial<OsAssinatura>) => {
    const data = await insertRow("os_assinaturas", a);
    if (data) invalidate();
    return data as OsAssinatura | null;
  };
  const porOs = (osId: string) => assinaturas.filter((a) => a.os_id === osId);
  const buscarPorCodigo = async (codigo: string): Promise<OsAssinatura | null> => {
    const { data, error } = await supabase
      .from("os_assinaturas").select("*").eq("codigo_verificador", codigo).maybeSingle();
    if (error || !data) return null;
    return data as OsAssinatura;
  };
  const refresh = async () => { await refetch(); };

  return (
    <OsAssinaturasContext.Provider value={{ assinaturas, porOs, registrar, buscarPorCodigo, refresh }}>
      {children}
    </OsAssinaturasContext.Provider>
  );
}
