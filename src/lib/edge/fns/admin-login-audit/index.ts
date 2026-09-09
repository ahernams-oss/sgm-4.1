import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Lê a auditoria de login (PII restrita). Usa service_role para bypass de RLS.
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { dias } = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let q = admin.from("login_auditoria").select("*").order("created_at", { ascending: false }).limit(2000);
    const d = Number(dias);
    if (!Number.isNaN(d) && d > 0) {
      const since = new Date(Date.now() - d * 86_400_000).toISOString();
      q = q.gte("created_at", since);
    }
    const { data, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, data });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

export default __slot.dispatch;
