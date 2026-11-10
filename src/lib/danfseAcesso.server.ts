import type { SupabaseClient } from "@supabase/supabase-js";

/** Use the already authenticated client, never re-parse a server-function request as legacy JSON. */
export async function exigirAcessoDanfse(supabase: Pick<SupabaseClient, "rpc">): Promise<void> {
  const resultados = await Promise.all(
    ["financeiro.nfes_recebidas", "faturamentos"].map(_prefixo =>
      supabase.rpc("has_module_prefix", { _prefixo }),
    ),
  );
  if (resultados.some(resultado => resultado.error)) {
    throw new Error("Não foi possível conferir sua permissão para baixar a nota. Tente novamente.");
  }
  if (!resultados.some(resultado => resultado.data === true)) {
    throw new Error("Você não possui permissão para baixar esta nota.");
  }
}