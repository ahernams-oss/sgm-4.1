import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Insere registro na tabela auditoria via service_role.
// Captura o IP de origem do cabeçalho da requisição (não confia no client).
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const body = await req.json();
    const allowed = [
      "usuario_id", "usuario_nome", "usuario_email", "modulo", "acao",
      "entidade_id", "entidade_descricao", "dados_antes", "dados_depois", "user_agent",
    ];
    const row: Record<string, unknown> = {};
    for (const k of allowed) if (k in body) row[k] = body[k];
    if (!row.modulo || !row.acao) return json({ ok: false, error: "modulo e acao são obrigatórios" }, 400);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || null;
    if (ip) row.ip = ip;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("auditoria").insert(row);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

export default __slot.dispatch;
