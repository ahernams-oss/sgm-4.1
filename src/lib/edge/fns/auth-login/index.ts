import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import * as bcrypt from "@/lib/edge/bcrypt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isBcryptHash(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^\$2[aby]\$\d{2}\$/.test(s);
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  const logAudit = async (params: {
    usuario_id: string | null;
    email: string;
    nome: string | null;
    sucesso: boolean;
    motivo: string | null;
  }) => {
    try {
      await supabase.from("login_auditoria").insert({
        usuario_id: params.usuario_id,
        email: params.email,
        nome: params.nome,
        sucesso: params.sucesso,
        motivo: params.motivo,
        ip,
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("[auth-login] Falha ao registrar auditoria:", e);
    }
  };

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const senha = String(body?.senha ?? "");

    if (!email || !senha) {
      await logAudit({ usuario_id: null, email: email || "(vazio)", nome: null, sucesso: false, motivo: "Campos obrigatórios não preenchidos" });
      return new Response(
        JSON.stringify({ error: "E-mail e senha são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Bloqueio: 3 erros seguidos nos últimos 15 minutos bloqueiam o login por 15 minutos.
    const MAX_TENTATIVAS = 3;
    const BLOQUEIO_MS = 15 * 60 * 1000;
    const MOTIVO_BLOQUEIO = "Login bloqueado (excesso de tentativas)";
    const { data: recentes } = await supabase
      .from("login_auditoria")
      .select("sucesso, motivo, created_at")
      .eq("email", email)
      .gte("created_at", new Date(Date.now() - BLOQUEIO_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    const falhas: string[] = [];
    for (const r of recentes ?? []) {
      if (r.sucesso) break;
      if (r.motivo === MOTIVO_BLOQUEIO || r.motivo === "Campos obrigatórios não preenchidos") continue;
      falhas.push(r.created_at as string);
    }
    if (falhas.length >= MAX_TENTATIVAS) {
      const liberaEm = new Date(new Date(falhas[0]).getTime() + BLOQUEIO_MS);
      const min = Math.max(1, Math.ceil((liberaEm.getTime() - Date.now()) / 60000));
      await logAudit({ usuario_id: null, email, nome: null, sucesso: false, motivo: MOTIVO_BLOQUEIO });
      return new Response(
        JSON.stringify({ error: `Login bloqueado por excesso de tentativas. Tente novamente em ${min} minuto(s).`, bloqueado: true, libera_em: liberaEm.toISOString() }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const restantes = MAX_TENTATIVAS - falhas.length - 1;
    const msgFalha = restantes > 0
      ? `Credenciais inválidas. Restam ${restantes} tentativa(s) antes do bloqueio de 15 minutos.`
      : "Credenciais inválidas. Login bloqueado por 15 minutos.";

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      console.error("[auth-login] DB error:", error);
      await logAudit({ usuario_id: null, email, nome: null, sucesso: false, motivo: "Erro ao consultar usuário" });
      return new Response(JSON.stringify({ error: "Erro ao consultar usuário." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user) {
      await logAudit({ usuario_id: null, email, nome: null, sucesso: false, motivo: "Usuário não encontrado" });
      return new Response(JSON.stringify({ error: msgFalha }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Senha agora reside em tabela separada (não publicamente legível)
    const { data: cred } = await supabase
      .from("usuarios_credenciais")
      .select("senha")
      .eq("usuario_id", user.id)
      .maybeSingle();

    const senhaArmazenada: string | null = cred?.senha ?? null;
    if (!senhaArmazenada) {
      await logAudit({ usuario_id: user.id, email, nome: user.nome, sucesso: false, motivo: "Usuário sem senha cadastrada" });
      return new Response(JSON.stringify({ error: msgFalha }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let ok = false;
    let migrated = false;

    if (isBcryptHash(senhaArmazenada)) {
      ok = bcrypt.compareSync(senha, senhaArmazenada);
    } else {
      ok = senha.trim() === String(senhaArmazenada).trim();
      if (ok) {
        const hash = bcrypt.hashSync(senha, bcrypt.genSaltSync(10));
        await supabase.from("usuarios_credenciais").update({ senha: hash }).eq("usuario_id", user.id);
        migrated = true;
      }
    }

    if (!ok) {
      await logAudit({ usuario_id: user.id, email, nome: user.nome, sucesso: false, motivo: "Senha incorreta" });
      return new Response(JSON.stringify({ error: msgFalha }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAudit({ usuario_id: user.id, email, nome: user.nome, sucesso: true, motivo: migrated ? "Login OK (senha migrada para hash)" : "Login OK" });

    // Emite uma sessão real do backend para que as políticas de acesso (RLS)
    // possam exigir usuário autenticado em vez de acesso anônimo.
    let tokenHash: string | null = null;
    try {
      const emailAuth = String(user.email ?? email).trim().toLowerCase();

      const ensureUser = async () => {
        const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: emailAuth,
        });
        if (!linkErr && link?.properties?.hashed_token) {
          return link.properties.hashed_token as string;
        }
        return null;
      };

      tokenHash = await ensureUser();

      if (!tokenHash) {
        // Usuário ainda não existe no provedor de autenticação: cria e tenta de novo.
        await supabase.auth.admin.createUser({
          email: emailAuth,
          email_confirm: true,
          password: crypto.randomUUID() + "Aa1!",
          user_metadata: { usuario_id: user.id, nome: user.nome },
        });
        tokenHash = await ensureUser();
      }

      if (tokenHash && !user.auth_user_id) {
        const { data: authUser } = await supabase
          .from("usuarios")
          .select("auth_user_id")
          .eq("id", user.id)
          .maybeSingle();
        if (!authUser?.auth_user_id) {
          const { data: list } = await supabase.auth.admin.listUsers();
          const found = list?.users?.find(
            (u: any) => (u.email ?? "").toLowerCase() === emailAuth,
          );
          if (found) {
            await supabase.from("usuarios").update({ auth_user_id: found.id }).eq("id", user.id);
          }
        }
      }
    } catch (e) {
      console.error("[auth-login] Falha ao emitir sessão:", e);
    }

    return new Response(JSON.stringify({ usuario: user, migrated, tokenHash, email: String(user.email ?? email).trim().toLowerCase() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[auth-login] Unexpected:", e);
    await logAudit({ usuario_id: null, email: "(erro)", nome: null, sucesso: false, motivo: "Erro inesperado no servidor" });
    return new Response(JSON.stringify({ error: "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
