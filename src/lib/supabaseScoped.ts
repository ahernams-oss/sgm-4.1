import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const cache = new Map<string, SupabaseClient<Database>>();

/**
 * Cria (ou reaproveita) um client do backend que envia cabeçalhos extras.
 * Usado nas telas públicas do fornecedor para que as regras de acesso
 * consigam limitar os dados ao convite/fornecedor correto.
 */
export function getScopedClient(headers: Record<string, string>): SupabaseClient<Database> {
  const key = JSON.stringify(headers);
  const cached = cache.get(key);
  if (cached) return cached;

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers },
  });
  cache.set(key, client);
  return client;
}

export const getCotacaoTokenClient = (token: string) =>
  getScopedClient({ "x-cotacao-token": token });

export const getFornecedorClient = (fornecedorId: string) =>
  getScopedClient({ "x-fornecedor-id": fornecedorId });
