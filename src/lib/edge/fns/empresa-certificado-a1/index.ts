import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Gerencia upload, remoção e armazenamento da senha do certificado A1.
// O bucket "certificados-digitais" é privado e a senha fica em empresa_credenciais (RLS deny-all).
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    if (action === "upload") {
      const form = await req.formData();
      const file = form.get("file");
      const empresaId = String(form.get("empresaId") || "");
      if (!(file instanceof File)) return json({ ok: false, error: "Arquivo obrigatório" }, 400);
      if (!empresaId) return json({ ok: false, error: "empresaId obrigatório" }, 400);
      if (file.size > 5 * 1024 * 1024) return json({ ok: false, error: "Arquivo muito grande (máx 5MB)" }, 400);
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".pfx") && !lower.endsWith(".p12")) {
        return json({ ok: false, error: "Selecione um arquivo .pfx ou .p12" }, 400);
      }
      const fileName = `${empresaId}/certificado_${Date.now()}.pfx`;
      const buf = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await admin.storage.from("certificados-digitais")
        .upload(fileName, buf, { upsert: true, contentType: "application/x-pkcs12" });
      if (upErr) return json({ ok: false, error: upErr.message }, 500);
      return json({ ok: true, url: fileName, nome: file.name });
    }

    const body = await req.json().catch(() => ({}));

    if (action === "remove") {
      const empresaId = String(body?.empresaId || "");
      const path = String(body?.path || "");
      if (path) await admin.storage.from("certificados-digitais").remove([path]);
      if (empresaId) {
        await admin.from("empresa_credenciais").delete().eq("empresa_id", empresaId);
      }
      return json({ ok: true });
    }

    if (action === "set-senha") {
      const empresaId = String(body?.empresaId || "");
      const senha = String(body?.senha || "");
      if (!empresaId || !senha) return json({ ok: false, error: "empresaId e senha obrigatórios" }, 400);
      const { error } = await admin.from("empresa_credenciais")
        .upsert({ empresa_id: empresaId, certificado_a1_senha: senha }, { onConflict: "empresa_id" });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, error: "action inválida (use upload | remove | set-senha)" }, 400);
  } catch (e) {
    console.error("empresa-certificado-a1 erro:", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

export default __slot.dispatch;
