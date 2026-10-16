import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { ehOProprio, exigirAcesso, pode, temAcessoTotal, usuarioSgmPorId } from "@/lib/edge/permissao";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Ativa/inativa um usuário do SGM. Inativar bloqueia a conta de login (sessões e renovações).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId ?? "").trim();
    const ativo = body?.ativo === true;
    const acesso = await exigirAcesso(req);
    if (!acesso.ok) return acesso.resposta;
    const quem = acesso.chamador;
    if (!pode(quem, "usuarios.editar", "usuarios.excluir")) return json({ error: "Sem permissão para inativar usuários." }, 403);
    if (!userId) return json({ error: "userId é obrigatório." }, 400);
    if (ehOProprio(quem, userId)) return json({ error: "Você não pode inativar o próprio usuário." }, 400);
    const alvo = await usuarioSgmPorId(userId);
    if (!alvo) return json({ error: "Usuário não encontrado." }, 404);
    if (alvo.acessoTotal && !temAcessoTotal(quem)) return json({ error: "Só quem tem acesso total pode alterar este usuário." }, 403);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: linha, error } = await db.from("usuarios").update({ ativo }).eq("id", userId).select("auth_user_id").maybeSingle();
    if (error) { console.error("[usuario-status]", error); return json({ error: "Erro ao gravar." }, 500); }
    const authId = (linha as { auth_user_id?: string | null } | null)?.auth_user_id;
    if (authId) {
      const { error: banErr } = await db.auth.admin.updateUserById(authId, { ban_duration: ativo ? "none" : "876000h" });
      if (banErr) console.error("[usuario-status] ban:", banErr.message);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[usuario-status]", e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

export default __slot.dispatch;
