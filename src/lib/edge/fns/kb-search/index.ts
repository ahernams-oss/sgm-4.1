import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;

import { respostaErroIA } from "@/lib/edge/ai";
import { buscarBaseConhecimento } from "../_shared/kb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Busca semântica na Base de Conhecimento.
 * Body: { query: string, limit?: number, threshold?: number }
 * Retorno: { results: Array<{ tipo, id, titulo, conteudo, categoria_nome, similarity }> }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, limit = 5, threshold = 0.5 } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await buscarBaseConhecimento(query, limit, threshold);
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kb-search error:", e);
    return respostaErroIA(e, corsHeaders);
  }
});

export default __slot.dispatch;
