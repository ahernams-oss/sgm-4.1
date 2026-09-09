import { supabase } from "@/integrations/supabase/client";

/**
 * Valida a senha do usuário chamando a edge function auth-login.
 * Necessário porque a senha NÃO é persistida no client após o login
 * (usuarioLogado.senha é sempre "").
 */
export async function verificarSenhaUsuario(email: string, senha: string): Promise<boolean> {
  if (!email || !senha) return false;
  try {
    const { data, error } = await supabase.functions.invoke("auth-login", {
      body: { email: email.trim().toLowerCase(), senha },
    });
    if (error) return false;
    return !!data?.usuario;
  } catch {
    return false;
  }
}
