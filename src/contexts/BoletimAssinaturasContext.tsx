import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export type PapelBoletimAssinatura = "responsavel" | "fiscalizacao" | "gestor";

export interface BoletimAssinatura {
  id: string; boletim_id: string; boletim_numero: number;
  papel: PapelBoletimAssinatura;
  signatario_user_id: string; signatario_nome: string;
  signatario_email: string; signatario_cargo: string; signatario_matricula: string;
  hash_documento: string; codigo_verificador: string;
  ip_origem: string; user_agent: string; base_legal: string;
  metodo_autenticacao: string; nivel_assinatura: string;
  signed_at: string; created_at: string;
}

interface Ctx {
  assinaturas: BoletimAssinatura[];
  porBoletim: (boletimId: string) => BoletimAssinatura[];
  registrar: (a: Partial<BoletimAssinatura>) => Promise<BoletimAssinatura | null>;
  buscarPorCodigo: (codigo: string) => Promise<BoletimAssinatura | null>;
  refresh: () => Promise<void>;
}

const BoletimAssinaturasContext = createContext<Ctx>({
  assinaturas: [],
  porBoletim: () => [],
  registrar: async () => null,
  buscarPorCodigo: async () => null,
  refresh: async () => {},
});
export const useBoletimAssinaturas = () => useContext(BoletimAssinaturasContext);
const QK = ["boletim_assinaturas"] as const;

export function BoletimAssinaturasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("BoletimAssinaturas");
  const qc = useQueryClient();
  const { data: assinaturas = [], refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("boletim_assinaturas", "signed_at")) as BoletimAssinatura[],
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const registrar = async (a: Partial<BoletimAssinatura>) => {
    const data = await insertRow("boletim_assinaturas", a);
    if (data) invalidate();
    return data as BoletimAssinatura | null;
  };
  const porBoletim = (boletimId: string) => assinaturas.filter((a) => a.boletim_id === boletimId);
  const buscarPorCodigo = async (codigo: string): Promise<BoletimAssinatura | null> => {
    const { data, error } = await supabase
      .from("boletim_assinaturas").select("*").eq("codigo_verificador", codigo).maybeSingle();
    if (error || !data) return null;
    return data as BoletimAssinatura;
  };
  const refresh = async () => { await refetch(); };

  return (
    <BoletimAssinaturasContext.Provider value={{ assinaturas, porBoletim, registrar, buscarPorCodigo, refresh }}>
      {children}
    </BoletimAssinaturasContext.Provider>
  );
}
