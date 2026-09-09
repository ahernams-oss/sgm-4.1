import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { usuario_id, purpose, code } = await req.json();
    if (!usuario_id || !purpose || !code) {
      return new Response(JSON.stringify({ success: false, error: "usuario_id, purpose e code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: otp } = await supabase.from("mfa_otps")
      .select("*")
      .eq("usuario_id", usuario_id).eq("purpose", purpose).is("used_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (!otp) return new Response(JSON.stringify({ success: false, error: "Nenhum código pendente. Solicite um novo." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, error: "Código expirado. Solicite um novo." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if ((otp.attempts ?? 0) >= 5) {
      return new Response(JSON.stringify({ success: false, error: "Muitas tentativas. Solicite um novo código." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hash = await sha256(String(code).trim());
    if (hash !== otp.code_hash) {
      await supabase.from("mfa_otps").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
      return new Response(JSON.stringify({ success: false, error: "Código inválido." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("mfa_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id);
    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

export default __slot.dispatch;
