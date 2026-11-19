import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import {
  contextoRp,
  opcoesLogin,
  conferirLogin,
  mensagemDigital,
} from "../_shared/passkeys";
import { emitirSessaoSgm } from "../_shared/sessao-sgm";

// Login com digital (chave de acesso) na tela de entrada.
// Não usa senha: o aparelho assina um desafio do servidor com a chave cadastrada.
// A resposta é a mesma do auth-login (usuario + tokenHash + email), para que o
// navegador abra a sessão do Supabase do mesmo jeito.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ipDo(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ip = ipDo(req);
  const userAgent = req.headers.get("user-agent");

  const logAudit = async (params: {
    usuario_id: string | null;
    email: string;
    nome: string | null;
    sucesso: boolean;
    motivo: string | null;
  }) => {
    try {
      await db.from("login_auditoria").insert({
        usuario_id: params.usuario_id,
        email: params.email,
        nome: params.nome,
        sucesso: params.sucesso,
        motivo: params.motivo,
        ip,
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("[passkey-login] Falha ao registrar auditoria:", e);
    }
  };

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = String(corpo?.acao ?? "");

  try {
    if (acao === "inicio") {
      const ctx = contextoRp(req);
      const { opts, estado } = await opcoesLogin(ctx);
      return json({ opts, estado });
    }

    if (acao === "fim") {
      const ctx = contextoRp(req);
      const resposta = corpo.resposta as { id?: unknown } | undefined;
      const credentialId = typeof resposta?.id === "string" ? resposta.id : "";
      if (!credentialId) {
        return json({ error: "Nenhuma digital foi informada neste aparelho." }, 400);
      }

      const { data: digital, error: erroDigital } = await db
        .from("usuario_passkeys")
        .select("id, usuario_id, credential_id, public_key, counter, transports")
        .eq("credential_id", credentialId)
        .maybeSingle();
      if (erroDigital) {
        console.error("[passkey-login] Erro ao consultar a digital:", erroDigital);
        return json({ error: "Erro ao consultar a digital." }, 500);
      }

      if (!digital) {
        await logAudit({
          usuario_id: null,
          email: "(digital não cadastrada)",
          nome: null,
          sucesso: false,
          motivo: "Digital não cadastrada no sistema",
        });
        return json(
          { error: "Este aparelho não tem digital cadastrada aqui. Entre com a senha e cadastre a digital." },
          401,
        );
      }

      const { data: usuario, error: erroUsuario } = await db
        .from("usuarios")
        .select("*")
        .eq("id", digital.usuario_id)
        .maybeSingle();
      if (erroUsuario) {
        console.error("[passkey-login] Erro ao consultar usuário:", erroUsuario);
        return json({ error: "Erro ao consultar usuário." }, 500);
      }
      if (!usuario) {
        await logAudit({
          usuario_id: digital.usuario_id,
          email: "(digital)",
          nome: null,
          sucesso: false,
          motivo: "Digital ligada a usuário inexistente",
        });
        return json({ error: "A digital informada não pertence a um usuário ativo." }, 401);
      }
      if (usuario.ativo === false) {
        await logAudit({
          usuario_id: usuario.id,
          email: String(usuario.email ?? ""),
          nome: usuario.nome ?? null,
          sucesso: false,
          motivo: "Usuário inativo (digital)",
        });
        return json(
          { error: "Usuário inativo. Procure o administrador do sistema." },
          403,
        );
      }

      let conferida;
      try {
        conferida = await conferirLogin(ctx, corpo.estado, corpo.resposta as never, digital);
      } catch (e) {
        await logAudit({
          usuario_id: usuario.id,
          email: String(usuario.email ?? ""),
          nome: usuario.nome ?? null,
          sucesso: false,
          motivo: "Digital não conferida",
        });
        return json({ error: mensagemDigital(e) }, 401);
      }

      await db
        .from("usuario_passkeys")
        .update({ counter: conferida.newCounter, ultimo_uso: new Date().toISOString() })
        .eq("id", digital.id);

      const email = String(usuario.email ?? "").trim().toLowerCase();
      const tokenHash = await emitirSessaoSgm(db, usuario, email);

      await logAudit({
        usuario_id: usuario.id,
        email,
        nome: usuario.nome ?? null,
        sucesso: true,
        motivo: "Login com digital",
      });

      return json({ usuario, tokenHash, email });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("[passkey-login] Erro inesperado:", e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

export default __slot.dispatch;
