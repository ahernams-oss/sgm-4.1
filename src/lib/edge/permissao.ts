// Permissão por perfil dentro das funções de servidor.
// A ponte (auth.ts) só confere se o JWT é válido. Aqui se descobre QUEM é o usuário
// do SGM por trás dele e se aplica a mesma regra do front (src/lib/permissoes.ts):
// acesso total pelo cargo, o resto pelo perfil de acesso.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { identificar } from "@/lib/edge/auth";
import {
  cargoTemAcessoTotal,
  temPermissao,
  temPermissaoNoModulo,
  type Permissoes,
} from "@/lib/permissoes";

export type UsuarioSgm = {
  id: string;
  nome: string;
  email: string;
  acessoTotal: boolean;
  permissoes: Permissoes;
};

export type ChamadorSgm =
  | { tipo: "servico" } // o próprio servidor, com a service role
  | { tipo: "usuario"; usuario: UsuarioSgm };

export type Chamador =
  | ChamadorSgm
  // JWT válido, mas nenhum usuário do SGM corresponde à conta.
  | { tipo: "sem-cadastro"; authId: string; email: string | null };

let admin: SupabaseClient | undefined;

function clienteAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env["SUPABASE_URL"];
    const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !chave)
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no servidor");
    admin = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return admin;
}

type LinhaUsuario = {
  id: string;
  nome: string | null;
  email: string | null;
  auth_user_id: string | null;
  cargo_id: string | null;
  perfil_acesso_id: string | null;
};

const COLUNAS = "id, nome, email, auth_user_id, cargo_id, perfil_acesso_id";

const emailNormal = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// % e _ são curingas no ilike; escapados, o filtro procura o e-mail literal.
const semCuringas = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function completar(linha: LinhaUsuario): Promise<UsuarioSgm> {
  const db = clienteAdmin();
  const [cargo, perfil] = await Promise.all([
    linha.cargo_id ? db.from("cargos").select("nome").eq("id", linha.cargo_id).maybeSingle() : null,
    linha.perfil_acesso_id
      ? db.from("perfis_acesso").select("permissoes").eq("id", linha.perfil_acesso_id).maybeSingle()
      : null,
  ]);
  if (cargo?.error) throw cargo.error;
  if (perfil?.error) throw perfil.error;

  const p = perfil?.data?.permissoes;
  return {
    id: linha.id,
    nome: linha.nome ?? "",
    email: linha.email ?? "",
    acessoTotal: cargo?.data ? cargoTemAcessoTotal(cargo.data.nome) : false,
    permissoes: p && typeof p === "object" && !Array.isArray(p) ? (p as Permissoes) : {},
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A conta de auth.users ainda existe? Erro que não seja "não encontrado" conta como sim.
async function contaExiste(authId: string): Promise<boolean> {
  if (!UUID.test(authId)) return false; // não é id de auth.users
  const { data, error } = await clienteAdmin().auth.admin.getUserById(authId);
  if (error) return (error as { status?: number }).status !== 404;
  return !!data?.user;
}

/**
 * Usuário do SGM dono da conta de login (auth.users).
 * O vínculo é usuarios.auth_user_id, gravado pelo auth-login e pelo migrate-users-to-auth.
 * Contas antigas podem estar sem vínculo (o auth-login só procura nos primeiros 50 de
 * listUsers): aí vale o e-mail da conta, que é o mesmo critério do auth-login, desde que
 * a linha não esteja ligada a outra conta que ainda existe.
 */
async function usuarioDaConta(authId: string, email: string | null): Promise<UsuarioSgm | null> {
  const db = clienteAdmin();

  const vinculo = await db.from("usuarios").select(COLUNAS).eq("auth_user_id", authId).limit(2);
  if (vinculo.error) throw vinculo.error;
  const vinculados = (vinculo.data ?? []) as LinhaUsuario[];
  if (vinculados.length > 1) {
    console.warn(`[edge:permissao] mais de um usuário ligado à conta ${authId}`);
    return null;
  }
  if (vinculados.length === 1) return completar(vinculados[0]);

  const alvo = emailNormal(email);
  if (!alvo) return null;
  const porEmail = await db
    .from("usuarios")
    .select(COLUNAS)
    .ilike("email", semCuringas(alvo))
    .limit(10);
  if (porEmail.error) throw porEmail.error;
  const mesmos = ((porEmail.data ?? []) as LinhaUsuario[]).filter(
    (u) => emailNormal(u.email) === alvo,
  );
  if (mesmos.length !== 1) return null;
  const linha = mesmos[0];
  if (
    linha.auth_user_id &&
    linha.auth_user_id !== authId &&
    (await contaExiste(linha.auth_user_id))
  ) {
    console.warn(`[edge:permissao] usuário ${linha.id} está ligado a outra conta de login`);
    return null;
  }
  return completar(linha);
}

/** Usuário do SGM pelo id da tabela usuarios (ex.: o alvo de uma troca de senha). */
export async function usuarioSgmPorId(id: string): Promise<UsuarioSgm | null> {
  if (!id) return null;
  const { data, error } = await clienteAdmin()
    .from("usuarios")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? completar(data as LinhaUsuario) : null;
}

/** Quem fez a chamada; null quando não há credencial válida. */
export async function quemChamou(req: Request): Promise<Chamador | null> {
  const id = await identificar(req);
  if (id.tipo === "anonimo") return null;
  if (id.tipo === "servico") return { tipo: "servico" };
  const usuario = await usuarioDaConta(id.authId, id.email);
  return usuario
    ? { tipo: "usuario", usuario }
    : { tipo: "sem-cadastro", authId: id.authId, email: id.email };
}

/** Tem a ação (qualquer uma das chaves). O servidor pode tudo. */
export function pode(c: ChamadorSgm, ...chaves: string[]): boolean {
  if (c.tipo === "servico") return true;
  return chaves.some((k) => temPermissao(c.usuario.acessoTotal, c.usuario.permissoes, k));
}

/** Tem alguma permissão do módulo (qualquer um dos prefixos), como a rota do front. */
export function podeModulo(c: ChamadorSgm, ...modulos: string[]): boolean {
  if (c.tipo === "servico") return true;
  return modulos.some((m) => temPermissaoNoModulo(c.usuario.acessoTotal, c.usuario.permissoes, m));
}

export function temAcessoTotal(c: ChamadorSgm): boolean {
  return c.tipo === "servico" || c.usuario.acessoTotal;
}

/** A chamada é do próprio usuário (ex.: trocar a própria senha, pedir o próprio código). */
export function ehOProprio(c: ChamadorSgm, usuarioId: string): boolean {
  return c.tipo === "usuario" && !!usuarioId && c.usuario.id === usuarioId;
}

function negar(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type Acesso = { ok: true; chamador: ChamadorSgm } | { ok: false; resposta: Response };

const SEM_PERMISSAO = "Você não possui permissão para esta ação.";

/**
 * Confere quem chamou e, se houver, a regra da função. Uso:
 *   const acesso = await exigirAcesso(req, (c) => pode(c, "auditoria.visualizar"));
 *   if (!acesso.ok) return acesso.resposta;
 */
export async function exigirAcesso(
  req: Request,
  regra?: (c: ChamadorSgm) => boolean,
  mensagem = SEM_PERMISSAO,
): Promise<Acesso> {
  const funcao = new URL(req.url).pathname.split("/").pop();
  let c: Chamador | null;
  try {
    c = await quemChamou(req);
  } catch (e) {
    console.error(`[edge:permissao] ${funcao}: falha ao carregar o usuário`, e);
    return {
      ok: false,
      resposta: negar(500, "Não foi possível conferir a sua permissão. Tente de novo."),
    };
  }
  if (!c) return { ok: false, resposta: negar(401, "Não autorizado") };
  if (c.tipo === "sem-cadastro") {
    console.warn(`[edge:permissao] ${funcao}: conta ${c.authId} sem usuário do SGM`);
    return {
      ok: false,
      resposta: negar(403, "Sua sessão não corresponde a um usuário do SGM. Saia e entre de novo."),
    };
  }
  if (regra && !regra(c)) {
    console.warn(
      `[edge:permissao] ${funcao}: negado para o usuário ${c.tipo === "usuario" ? c.usuario.id : c.tipo}`,
    );
    return { ok: false, resposta: negar(403, mensagem) };
  }
  return { ok: true, chamador: c };
}
