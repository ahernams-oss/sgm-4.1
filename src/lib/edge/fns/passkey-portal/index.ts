import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { exigirAcesso } from "@/lib/edge/permissao";
import {
  contextoRp,
  opcoesRegistro,
  conferirRegistro,
  mensagemDigital,
  type DigitalCadastrada,
} from "../_shared/passkeys";

// Gerenciamento das digitais (chaves de acesso) do próprio usuário:
// listar, cadastrar uma nova e remover. Só entra quem já está logado.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_DIGITAIS = 10;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type LinhaDigital = {
  credential_id: string;
  transports: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const acesso = await exigirAcesso(req);
  if (!acesso.ok) return acesso.resposta;
  if (acesso.chamador.tipo !== "usuario") {
    return json({ error: "Faça login para gerenciar a sua digital." }, 403);
  }
  const usuario = acesso.chamador.usuario;

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const acao = String(corpo?.acao ?? "");

  try {
    const { data: atuais, error: erroLista } = await db
      .from("usuario_passkeys")
      .select("id, credential_id, nome, device_type, transports, criado_em, ultimo_uso")
      .eq("usuario_id", usuario.id)
      .order("criado_em", { ascending: false });
    if (erroLista) throw erroLista;
    const lista = (atuais ?? []) as LinhaDigital[];

    if (acao === "listar") {
      return json({ digitais: atuais ?? [] });
    }

    if (acao === "registrar-inicio") {
      if (lista.length >= MAX_DIGITAIS) {
        return json(
          { error: `Você já tem ${MAX_DIGITAIS} digitais cadastradas. Remova alguma antes de incluir outra.` },
          400,
        );
      }
      const ctx = contextoRp(req);
      const { opts, estado } = await opcoesRegistro(ctx, usuario, lista as DigitalCadastrada[]);
      return json({ opts, estado });
    }

    if (acao === "registrar-fim") {
      const ctx = contextoRp(req);
      let gravar;
      try {
        gravar = await conferirRegistro(ctx, corpo.estado, corpo.resposta as never);
      } catch (e) {
        return json({ error: mensagemDigital(e) }, 400);
      }
      const nome = String(corpo?.nome ?? "").trim().slice(0, 60);
      const { data: nova, error: erroInsert } = await db
        .from("usuario_passkeys")
        .insert({
          usuario_id: usuario.id,
          credential_id: gravar.credential_id,
          public_key: gravar.public_key,
          counter: gravar.counter,
          transports: gravar.transports,
          device_type: gravar.device_type,
          nome: nome || "Digital do aparelho",
        })
        .select("id, nome, device_type, transports, criado_em, ultimo_uso")
        .single();
      if (erroInsert) {
        if (erroInsert.code === "23505") {
          return json({ error: "Esta digital já foi cadastrada antes." }, 400);
        }
        throw erroInsert;
      }
      return json({ ok: true, digital: nova });
    }

    if (acao === "remover") {
      const id = String(corpo?.id ?? "").trim();
      if (!id) return json({ error: "Informe qual digital deseja remover." }, 400);
      const { error: erroDelete } = await db
        .from("usuario_passkeys")
        .delete()
        .eq("id", id)
        .eq("usuario_id", usuario.id);
      if (erroDelete) throw erroDelete;
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("[passkey-portal] Erro:", e);
    return json({ error: "Não foi possível concluir a operação da digital." }, 500);
  }
});

export default __slot.dispatch;
