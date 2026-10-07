import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { exigirAcesso, pode } from "@/lib/edge/permissao";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PERM_KEY = "ordem_servico.excluir";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // O usuário é o dono da sessão; o userId do corpo é ignorado (dava para mandar o de outro).
    const { osId } = await req.json();
    const acesso = await exigirAcesso(req, (c) => pode(c, PERM_KEY),
      "Você não possui permissão para excluir Ordens de Serviço.");
    if (!acesso.ok) return acesso.resposta;

    if (!osId) {
      return new Response(JSON.stringify({ error: "osId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: delErr } = await supabase.from("ordens_servico").delete().eq("id", osId);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
