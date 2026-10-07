import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { gerarEmbedding, respostaErroIA } from "@/lib/edge/ai";
import { reindexarBaseConhecimento } from "../_shared/kb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Gera um embedding (vector 768) para o texto enviado.
 * Body: { text: string }
 * Retorno: { embedding: number[] }
 *
 * Com { reindexar: true } e Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>, regera os
 * embeddings de todos os artigos e FAQs da Base de Conhecimento (uso administrativo, no servidor).
 *
 * Usa o Gemini (gemini-embedding-2, 768 dimensões) com a GEMINI_API_KEY.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, reindexar } = await req.json();

    if (reindexar === true) {
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceRole || req.headers.get("authorization") !== `Bearer ${serviceRole}`) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resultado = await reindexarBaseConhecimento();
      return new Response(JSON.stringify(resultado), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embedding = await gerarEmbedding(text.slice(0, 8000));
    return new Response(JSON.stringify({ embedding }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kb-embedding error:", e);
    return respostaErroIA(e, corsHeaders);
  }
});

export default __slot.dispatch;
