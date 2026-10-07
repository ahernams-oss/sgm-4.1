// Quem pode chamar cada função da ponte /api/public/edge/<nome>.
// As funções portadas usam a service role e quase nenhuma confere quem chamou,
// então esta é a barreira de acesso delas.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Nivel = "publica" | "chave-publica" | "cron" | "usuario";

// Chamadas externas sem credencial do Supabase: a própria função confere
// a assinatura (Lovable) ou o token do webhook (BrasilNFe).
const PUBLICAS = new Set([
  "auth-email-hook",
  "handle-email-events",
  "nfe-webhook",
  "preview-transactional-email",
]);

// Páginas que o front chama sem sessão do Supabase: login, OAuth, portal do
// fornecedor, portal do funcionário/candidato e links de EPI. Exigem só a chave
// publishable (que o front sempre manda); a função confere senha ou token.
const CHAVE_PUBLICA = new Set([
  "auth-login",
  "fornecedor-login",
  "fornecedor-trocar-senha",
  "epi-recebimento-publico",
  "epi-devolucao-publico",
  "portal-api",
]);

// Rotinas disparadas só pelo pg_cron do Supabase (deploy/pg_cron_jobs.sql),
// com o cabeçalho x-cron-secret igual à variável CRON_SECRET do servidor.
const CRON = new Set([
  "check-parcelas-vencimento",
  "notificar-vencimento-ferias",
  "cotacao-epis-vencendo",
  "notificar-vencimento-epi",
  "notificar-vencimento-nr",
  "check-exames-vencimento",
  "check-experiencia-vencimento",
  "check-calibracao-vencimento",
  "check-oc-entrega-atrasada",
]);

// Todas as outras exigem usuário logado (JWT do Supabase com assinatura válida).
export function nivelDa(nome: string): Nivel {
  if (PUBLICAS.has(nome)) return "publica";
  if (CHAVE_PUBLICA.has(nome)) return "chave-publica";
  if (CRON.has(nome)) return "cron";
  return "usuario";
}

export type Autorizacao = { ok: true } | { ok: false; status: number; error: string };

const LIBERADO: Autorizacao = { ok: true };
const NEGADO: Autorizacao = { ok: false, status: 401, error: "Não autorizado" };

// Comparação em tempo constante, para não vazar o segredo pelo tempo de resposta.
function iguais(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// A chave do bundle (VITE_*) e a do .env do servidor deveriam ser a mesma;
// aceitamos as duas para o login não depender de as duas estarem iguais.
function chavesPublicas(): string[] {
  return [
    process.env["SUPABASE_PUBLISHABLE_KEY"],
    process.env["SUPABASE_ANON_KEY"],
    import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"],
  ].filter((k): k is string => !!k);
}

let verificador: SupabaseClient | undefined;

function clienteVerificador(): SupabaseClient {
  if (!verificador) {
    const url = process.env["SUPABASE_URL"] || import.meta.env?.["VITE_SUPABASE_URL"];
    const chave = chavesPublicas()[0] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !chave)
      throw new Error("SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY ausente no servidor");
    verificador = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return verificador;
}

// Tokens já conferidos, por até 60 s (nunca além do exp). Com chave de assinatura
// simétrica (HS256) cada conferência é uma ida ao Auth do Supabase.
const conferidos = new Map<string, number>();

async function usuarioValido(token: string | null): Promise<boolean> {
  if (!token || token.split(".").length !== 3) return false;
  if (chavesPublicas().some((k) => iguais(token, k))) return false;

  const agora = Date.now();
  const validoAte = conferidos.get(token);
  if (validoAte !== undefined) {
    if (validoAte > agora) return true;
    conferidos.delete(token);
  }

  try {
    // getClaims confere a assinatura pelo JWKS do projeto (chaves assimétricas)
    // ou, com chave HS256, pergunta ao Auth do Supabase (getUser).
    const { data, error } = await clienteVerificador().auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims?.sub || claims.role !== "authenticated" || claims.is_anonymous) {
      return false;
    }
    if (conferidos.size >= 1000) conferidos.clear();
    conferidos.set(token, Math.min(agora + 60_000, Number(claims.exp ?? 0) * 1000));
    return true;
  } catch (e) {
    console.error("[edge:auth] falha ao conferir o JWT", e);
    return false;
  }
}

export async function autorizar(request: Request, nome: string): Promise<Autorizacao> {
  const nivel = nivelDa(nome);
  if (nivel === "publica") return LIBERADO;

  if (nivel === "cron") {
    const segredo = process.env["CRON_SECRET"];
    if (!segredo) {
      console.error(`[edge:${nome}] CRON_SECRET não configurado no servidor`);
      return { ok: false, status: 503, error: "CRON_SECRET não configurado no servidor" };
    }
    if (iguais(request.headers.get("x-cron-secret"), segredo)) return LIBERADO;
    console.warn(`[edge:${nome}] chamada de rotina sem x-cron-secret válido`);
    return NEGADO;
  }

  const apikey = request.headers.get("apikey");
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null;

  // Chamadas de servidor para servidor com a service role.
  const servico = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (servico && (iguais(bearer, servico) || iguais(apikey, servico))) return LIBERADO;

  if (
    nivel === "chave-publica" &&
    chavesPublicas().some((k) => iguais(apikey, k) || iguais(bearer, k))
  ) {
    return LIBERADO;
  }

  return (await usuarioValido(bearer)) ? LIBERADO : NEGADO;
}
