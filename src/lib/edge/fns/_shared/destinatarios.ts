// Antes de enviar e-mail ou WhatsApp em nome da empresa, o servidor confere
// que o destino está cadastrado no SGM (usuários, funcionários, clientes/
// fornecedores, empresa, contatos e grupos). Evita usar o app para mandar
// mensagens a qualquer endereço ou número.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | undefined;
function db(): SupabaseClient {
  if (!admin) {
    admin = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

const EMAIL_RE = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/;

/** Lista de e-mails (string com , ; ou array) → todos precisam estar cadastrados. */
export async function emailsCadastrados(to: unknown): Promise<boolean> {
  const lista = (Array.isArray(to) ? to : String(to ?? "").split(/[,;]/))
    .map((e) => String(e).trim().toLowerCase())
    .filter(Boolean);
  if (lista.length === 0 || lista.length > 20) return false;
  for (const e of lista) {
    if (!EMAIL_RE.test(e) || e.length > 254) return false;
    const { data, error } = await db().rpc("destinatario_email_cadastrado", { _email: e });
    if (error || data !== true) return false;
  }
  return true;
}

/** Telefone ou grupo (JID) cadastrado no SGM. */
export async function telefoneCadastrado(destino: unknown): Promise<boolean> {
  const digitos = String(destino ?? "").replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 40) return false;
  const { data, error } = await db().rpc("destinatario_telefone_cadastrado", { _digitos: digitos });
  return !error && data === true;
}

export const MSG_DESTINO_NAO_CADASTRADO =
  "Destinatário não cadastrado no sistema. Cadastre o contato antes de enviar.";

/**
 * Remove do HTML do e-mail o que pode virar código ou formulário falso:
 * scripts, iframes, formulários, eventos on*, e links javascript:/data:.
 */
export function sanitizarHtmlEmail(html: unknown): string {
  let s = String(html ?? "").slice(0, 500_000);
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(
    /<\s*(script|iframe|object|embed|form|input|button|textarea|select|link|meta|base|frame|frameset|applet|svg|math)\b[\s\S]*?(<\s*\/\s*\1\s*>|\/?>)/gi,
    "",
  );
  s = s.replace(/<\s*\/?\s*(script|iframe|object|embed|form|input|button|textarea|select|link|meta|base|frame|frameset|applet|svg|math)\b[^>]*>/gi, "");
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/(href|src|action|formaction|background)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'\s>]*("|')?/gi, '$1="#"');
  s = s.replace(/expression\s*\(/gi, "");
  return s;
}
