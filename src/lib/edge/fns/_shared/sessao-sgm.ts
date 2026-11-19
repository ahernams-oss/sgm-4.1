// Emissão da sessão autenticada do SGM (auth.users) para quem já provou a identidade.
//
// O app confere a identidade no próprio servidor (senha em usuarios_credenciais ou
// assinatura de uma chave de acesso) e usa este helper só para abrir a sessão do
// Supabase, para que as políticas de acesso (RLS) vejam um usuário autenticado.
import type { SupabaseClient } from "@supabase/supabase-js";

export type UsuarioParaSessao = {
  id: string;
  nome?: string | null;
  email?: string | null;
  auth_user_id?: string | null;
};

/**
 * Devolve o `hashed_token` de um link mágico da conta, criando a conta de login se
 * ela ainda não existir. O navegador troca esse token pela sessão real.
 */
export async function emitirSessaoSgm(
  db: SupabaseClient,
  usuario: UsuarioParaSessao,
  emailFallback: string,
): Promise<string | null> {
  const emailAuth = String(usuario.email ?? emailFallback ?? "").trim().toLowerCase();
  if (!emailAuth) return null;

  const gerarLink = async (): Promise<string | null> => {
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: emailAuth,
    });
    if (!error && data?.properties?.hashed_token) {
      return data.properties.hashed_token as string;
    }
    return null;
  };

  let tokenHash = await gerarLink();

  if (!tokenHash) {
    // A conta de login ainda não existe: cria com senha aleatória (ninguém usa senha aqui).
    await db.auth.admin.createUser({
      email: emailAuth,
      email_confirm: true,
      password: crypto.randomUUID() + "Aa1!",
      user_metadata: { usuario_id: usuario.id, nome: usuario.nome ?? "" },
    });
    tokenHash = await gerarLink();
  }

  // Completa o vínculo usuarios.auth_user_id quando estiver faltando.
  if (tokenHash && !usuario.auth_user_id) {
    const { data: conta } = await db.auth.admin.getUserByEmail(emailAuth).catch(() => ({ data: null }));
    const authId = conta?.user?.id;
    if (authId) {
      await db.from("usuarios").update({ auth_user_id: authId }).eq("id", usuario.id);
    }
  }

  return tokenHash;
}
