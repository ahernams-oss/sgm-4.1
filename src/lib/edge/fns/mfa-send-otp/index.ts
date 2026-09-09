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

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { usuario_id, purpose } = await req.json();
    if (!usuario_id || !purpose) {
      return new Response(JSON.stringify({ success: false, error: "usuario_id e purpose obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: usuario, error: uErr } = await supabase
      .from("usuarios").select("id, nome, telefone").eq("id", usuario_id).maybeSingle();
    if (uErr || !usuario) throw new Error("Usuário não encontrado");
    const telDigits = onlyDigits(usuario.telefone || "");
    if (telDigits.length < 10) {
      return new Response(JSON.stringify({ success: false, error: "Usuário sem telefone válido cadastrado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const telefone = telDigits.startsWith("55") ? telDigits : `55${telDigits}`;

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code);
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Invalidate previous unused codes for same purpose
    await supabase.from("mfa_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("usuario_id", usuario_id).eq("purpose", purpose).is("used_at", null);

    await supabase.from("mfa_otps").insert({
      usuario_id, purpose, code_hash, expires_at, telefone,
    });

    const mensagem = `🔐 *Código de confirmação Lasant*\n\nSeu código é: *${code}*\n\nVálido por 5 minutos.\nSe você não solicitou, ignore esta mensagem.`;

    const { error: waErr } = await supabase.functions.invoke("send-whatsapp", {
      body: { telefone, mensagem },
    });
    if (waErr) throw new Error(`Falha ao enviar WhatsApp: ${waErr.message}`);

    return new Response(JSON.stringify({ success: true, telefone_mascarado: telefone.replace(/(\d{4})(\d+)(\d{2})/, "$1****$3") }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

export default __slot.dispatch;
