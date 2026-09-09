import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import { enviarComLog } from "../_shared/transactional-email-templates/log-send.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mascararEmail(email: string) {
  const [user, dom] = email.split("@");
  if (!dom) return email;
  const visivel = user.slice(0, 2);
  return `${visivel}${"*".repeat(Math.max(user.length - 2, 2))}@${dom}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = String(body.action || "send");
    const usuario_id = String(body.usuario_id || "");
    const purpose = String(body.purpose || "");

    if (!usuario_id || !purpose) {
      return json({ success: false, error: "usuario_id e purpose são obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nome, email")
      .eq("id", usuario_id)
      .maybeSingle();

    if (!usuario) return json({ success: false, error: "Usuário não encontrado" });
    const email = String(usuario.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return json({ success: false, error: "Usuário sem e-mail válido cadastrado." });
    }

    // ============ ENVIO ============
    if (action === "send") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const code_hash = await sha256(code);
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase
        .from("mfa_otps")
        .update({ used_at: new Date().toISOString() })
        .eq("usuario_id", usuario_id)
        .eq("purpose", purpose)
        .is("used_at", null);

      const { error: insErr } = await supabase.from("mfa_otps").insert({
        usuario_id, purpose, code_hash, expires_at, email, canal: "email",
      });
      if (insErr) throw new Error(insErr.message);

      try {
        await enviarComLog("assinatura-otp", email, () =>
          sendTemplateEmail("assinatura-otp", email, {
            templateData: {
              nomeUsuario: usuario.nome,
              codigo: code,
              documento: body.documento || "",
              papel: body.papel || "",
            },
          })
        );
      } catch (mailErr) {
        const m = mailErr instanceof Error ? mailErr.message : String(mailErr);
        throw new Error(`Falha ao enviar e-mail: ${m}`);
      }

      return json({ success: true, email_mascarado: mascararEmail(email) });
    }

    // ============ VERIFICAÇÃO ============
    if (action === "verify") {
      const code = String(body.code || "").trim();
      if (!code) return json({ success: false, error: "Informe o código recebido por e-mail." });

      const { data: otp } = await supabase
        .from("mfa_otps")
        .select("*")
        .eq("usuario_id", usuario_id)
        .eq("purpose", purpose)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otp) return json({ success: false, error: "Nenhum código pendente. Solicite um novo." });
      if (new Date(otp.expires_at).getTime() < Date.now()) {
        return json({ success: false, error: "Código expirado. Solicite um novo." });
      }
      if ((otp.attempts ?? 0) >= 5) {
        return json({ success: false, error: "Muitas tentativas. Solicite um novo código." });
      }

      const hash = await sha256(code);
      if (hash !== otp.code_hash) {
        await supabase.from("mfa_otps").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
        return json({ success: false, error: "Código inválido." });
      }

      await supabase.from("mfa_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id);
      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return json({ success: false, error: msg });
  }
});

export default __slot.dispatch;
