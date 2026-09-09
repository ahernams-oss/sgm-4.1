import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export type PapelPcAssinatura = "aprovador";

export interface PcAssinatura {
  id: string;
  pedido_id: string;
  pedido_numero: number;
  papel: PapelPcAssinatura;
  signatario_user_id: string;
  signatario_nome: string;
  signatario_email: string | null;
  signatario_cargo: string | null;
  signatario_matricula: string | null;
  hash_documento: string;
  codigo_verificador: string;
  ip_origem: string | null;
  user_agent: string | null;
  base_legal: string;
  signed_at: string;
  created_at: string;
}

interface Ctx {
  assinaturas: PcAssinatura[];
  porPedido: (pedidoId: string) => PcAssinatura[];
  registrar: (a: Partial<PcAssinatura>) => Promise<PcAssinatura | null>;
  refresh: () => Promise<void>;
}

const PcAssinaturasContext = createContext<Ctx>({
  assinaturas: [],
  porPedido: () => [],
  registrar: async () => null,
  refresh: async () => {},
});
export const usePcAssinaturas = () => useContext(PcAssinaturasContext);

const QK = ["pc_assinaturas"] as const;

export function PcAssinaturasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("PcAssinaturas");
  const qc = useQueryClient();

  const { data: assinaturas = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const { data } = await supabase.from("pc_assinaturas").select("*").order("signed_at");
      return (data || []) as PcAssinatura[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const refresh = async () => qc.invalidateQueries({ queryKey: QK });

  const registrar = async (a: Partial<PcAssinatura>) => {
    const { data, error } = await supabase.from("pc_assinaturas").insert(a as any).select().single();
    if (error || !data) return null;
    qc.invalidateQueries({ queryKey: QK });
    return data as PcAssinatura;
  };

  const porPedido = (pedidoId: string) => assinaturas.filter((a) => a.pedido_id === pedidoId);

  return (
    <PcAssinaturasContext.Provider value={{ assinaturas, porPedido, registrar, refresh }}>
      {children}
    </PcAssinaturasContext.Provider>
  );
}