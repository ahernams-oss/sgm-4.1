// Quem pode chamar cada função da ponte /api/public/edge/<nome>.
// As funções portadas usam a service role, então esta é a primeira barreira de acesso
// delas. As sensíveis conferem também o perfil do usuário (src/lib/edge/permissao.ts).
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

// Dono de um JWT já conferido: id em auth.users e e-mail da conta.
type Dono = { authId: string; email: string | null };

// Tokens já conferidos, por até 60 s (nunca além do exp). Com chave de assinatura
// simétrica (HS256) cada conferência é uma ida ao Auth do Supabase.
const conferidos = new Map<string, Dono & { ate: number }>();

async function donoDoToken(token: string | null): Promise<Dono | null> {
  if (!token || token.split(".").length !== 3) return null;
  if (chavesPublicas().some((k) => iguais(token, k))) return null;

  const agora = Date.now();
  const salvo = conferidos.get(token);
  if (salvo !== undefined) {
    if (salvo.ate > agora) return { authId: salvo.authId, email: salvo.email };
    conferidos.delete(token);
  }

  try {
    // getClaims confere a assinatura pelo JWKS do projeto (chaves assimétricas)
    // ou, com chave HS256, pergunta ao Auth do Supabase (getUser).
    const { data, error } = await clienteVerificador().auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims?.sub || claims.role !== "authenticated" || claims.is_anonymous) {
      return null;
    }
    const dono: Dono = {
      authId: String(claims.sub),
      email: typeof claims.email === "string" && claims.email ? claims.email.trim().toLowerCase() : null,
    };
    if (conferidos.size >= 1000) conferidos.clear();
    conferidos.set(token, { ...dono, ate: Math.min(agora + 60_000, Number(claims.exp ?? 0) * 1000) });
    return dono;
  } catch (e) {
    console.error("[edge:auth] falha ao conferir o JWT", e);
    return null;
  }
}

function credenciais(request: Request) {
  const apikey = request.headers.get("apikey");
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null;
  const servico = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const ehServico = !!servico && (iguais(bearer, servico) || iguais(apikey, servico));
  return { apikey, bearer, ehServico };
}

export type Identidade =
  | { tipo: "servico" }
  | ({ tipo: "usuario" } & Dono)
  | { tipo: "anonimo" };

// Quem fez a chamada, para as funções decidirem a permissão (src/lib/edge/permissao.ts).
// Depois da ponte o token já está no cache, então isto não vai de novo ao Auth.
export async function identificar(request: Request): Promise<Identidade> {
  const { bearer, ehServico } = credenciais(request);
  if (ehServico) return { tipo: "servico" };
  const dono = await donoDoToken(bearer);
  return dono ? { tipo: "usuario", ...dono } : { tipo: "anonimo" };
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

  const { apikey, bearer, ehServico } = credenciais(request);

  // Chamadas de servidor para servidor com a service role.
  if (ehServico) return LIBERADO;

  if (
    nivel === "chave-publica" &&
    chavesPublicas().some((k) => iguais(apikey, k) || iguais(bearer, k))
  ) {
    return LIBERADO;
  }

  // Aqui só se confere que o JWT é válido; quem pode o quê é decidido dentro de
  // cada função sensível (src/lib/edge/permissao.ts).
  return (await donoDoToken(bearer)) ? LIBERADO : NEGADO;
}
