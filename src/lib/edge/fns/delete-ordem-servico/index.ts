import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CARGOS_ACESSO_TOTAL = ["Diretor", "Gerente Executivo", "Coordenador de Departamento"];
const PERM_KEY = "ordem_servico.excluir";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId, osId } = await req.json();
    if (!userId || !osId) {
      return new Response(JSON.stringify({ error: "userId e osId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: usuario, error: uErr } = await supabase
      .from("usuarios")
      .select("id, cargo_id, perfil_acesso_id")
      .eq("id", userId)
      .maybeSingle();

    if (uErr || !usuario) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Acesso total via cargo
    let autorizado = false;
    if (usuario.cargo_id) {
      const { data: cargo } = await supabase
        .from("cargos")
        .select("nome")
        .eq("id", usuario.cargo_id)
        .maybeSingle();
      if (cargo && CARGOS_ACESSO_TOTAL.includes(cargo.nome)) autorizado = true;
    }

    // Permissão via perfil
    if (!autorizado && usuario.perfil_acesso_id) {
      const { data: perfil } = await supabase
        .from("perfis_acesso")
        .select("permissoes")
        .eq("id", usuario.perfil_acesso_id)
        .maybeSingle();
      const perms = (perfil?.permissoes ?? {}) as Record<string, boolean>;
      if (perms[PERM_KEY]) autorizado = true;
    }

    if (!autorizado) {
      return new Response(
        JSON.stringify({ error: "Você não possui permissão para excluir Ordens de Serviço." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
