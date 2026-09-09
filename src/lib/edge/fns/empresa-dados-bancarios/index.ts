import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Lê e grava dados bancários sensíveis da empresa (banco, agência, conta, PIX).
// A tabela "empresa_dados_bancarios" tem RLS deny-all; só esta função (com service role) pode acessá-la.
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

    if (action === "get") {
      const empresaId = url.searchParams.get("empresaId") || "";
      if (!empresaId) return json({ ok: false, error: "empresaId obrigatório" }, 400);
      const { data, error } = await admin
        .from("empresa_dados_bancarios")
        .select("banco, agencia, conta, tipo_conta, chave_pix")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({
        ok: true,
        dados: {
          banco: data?.banco ?? "",
          agencia: data?.agencia ?? "",
          conta: data?.conta ?? "",
          tipo_conta: data?.tipo_conta ?? "",
          chave_pix: data?.chave_pix ?? "",
        },
      });
    }

    const body = await req.json().catch(() => ({}));

    if (action === "save") {
      const empresaId = String(body?.empresaId || "");
      if (!empresaId) return json({ ok: false, error: "empresaId obrigatório" }, 400);
      const payload = {
        empresa_id: empresaId,
        banco: String(body?.banco ?? ""),
        agencia: String(body?.agencia ?? ""),
        conta: String(body?.conta ?? ""),
        tipo_conta: String(body?.tipo_conta ?? ""),
        chave_pix: String(body?.chave_pix ?? ""),
      };
      const { error } = await admin
        .from("empresa_dados_bancarios")
        .upsert(payload, { onConflict: "empresa_id" });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, error: "action inválida (use get | save)" }, 400);
  } catch (e) {
    console.error("empresa-dados-bancarios erro:", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

export default __slot.dispatch;
