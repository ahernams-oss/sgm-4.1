import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ServicoEventualCatalogo = Pick<
  Database["public"]["Tables"]["servicos_eventuais"]["Row"],
  "id" | "item" | "discriminacao" | "unidade" | "quantidade" | "unitario_com_citl" | "preco_unitario" | "citl_percentual" | "grupo" | "subgrupo"
>;

const COLUNAS = "id,item,discriminacao,unidade,quantidade,unitario_com_citl,preco_unitario,citl_percentual,grupo,subgrupo";

export function useServicosEventuaisContrato(clienteId: string, contratoId: string, enabled: boolean) {
  const vinculoValido = enabled && Boolean(clienteId && contratoId);
  const query = useQuery<ServicoEventualCatalogo[]>({
    queryKey: ["servicos-eventuais-os", clienteId, contratoId],
    enabled: vinculoValido,
    staleTime: 60_000,
    queryFn: async () => {
      const resultado: ServicoEventualCatalogo[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase
          .from("servicos_eventuais")
          .select(COLUNAS)
          .eq("cliente_id", clienteId)
          .eq("contrato_id", contratoId)
          .order("item")
          .order("id")
          .range(inicio, inicio + 999);
        if (error) throw error;
        resultado.push(...data);
        if (data.length < 1000) return resultado;
      }
    },
  });

  return { ...query, itens: query.data ?? [], vinculoValido };
}
