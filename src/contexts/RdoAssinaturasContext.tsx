import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface RdoAssinatura {
  id: string; rdo_id: string; rdo_numero: number;
  papel: "responsavel" | "fiscalizacao";
  signatario_user_id: string; signatario_nome: string;
  signatario_email: string; signatario_cargo: string; signatario_matricula: string;
  hash_documento: string; codigo_verificador: string;
  ip_origem: string; user_agent: string; base_legal: string;
  metodo_autenticacao?: string; nivel_assinatura?: string;
  signed_at: string; created_at: string;
}

interface Ctx {
  assinaturas: RdoAssinatura[];
  porRdo: (rdoId: string) => RdoAssinatura[];
  registrar: (a: Partial<RdoAssinatura>) => Promise<RdoAssinatura | null>;
  buscarPorCodigo: (codigo: string) => Promise<RdoAssinatura | null>;
  refresh: () => Promise<void>;
}

const RdoAssinaturasContext = createContext<Ctx>({} as Ctx);
export const useRdoAssinaturas = () => useContext(RdoAssinaturasContext);
const QK = ["rdo_assinaturas"] as const;

export function RdoAssinaturasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("RdoAssinaturas");
  const qc = useQueryClient();
  const { data: assinaturas = [], refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("rdo_assinaturas", "signed_at")) as RdoAssinatura[],
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const registrar = async (a: Partial<RdoAssinatura>) => {
    const data = await insertRow("rdo_assinaturas", a);
    if (data) invalidate();
    return data as RdoAssinatura | null;
  };
  const porRdo = (rdoId: string) => assinaturas.filter(a => a.rdo_id === rdoId);
  const buscarPorCodigo = async (codigo: string): Promise<RdoAssinatura | null> => {
    const { data, error } = await supabase
      .from("rdo_assinaturas").select("*").eq("codigo_verificador", codigo).maybeSingle();
    if (error || !data) return null;
    return data as RdoAssinatura;
  };
  const refresh = async () => { await refetch(); };

  return (
    <RdoAssinaturasContext.Provider value={{ assinaturas, porRdo, registrar, buscarPorCodigo, refresh }}>
      {children}
    </RdoAssinaturasContext.Provider>
  );
}
