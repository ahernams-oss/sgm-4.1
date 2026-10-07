import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import * as bcrypt from "@/lib/edge/bcrypt";
import { ehOProprio, exigirAcesso, pode, temAcessoTotal, usuarioSgmPorId } from "@/lib/edge/permissao";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function validatePolicy(senha: string): string | null {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Z]/.test(senha)) return "A senha deve conter ao menos uma letra maiúscula.";
  if (!/[0-9]/.test(senha)) return "A senha deve conter ao menos um número.";
  if (!/[^A-Za-z0-9]/.test(senha)) return "A senha deve conter ao menos um caractere especial.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId ?? "").trim();
    const novaSenha = String(body?.novaSenha ?? "");

    // Troca a própria senha, ou a de outro usuário com permissão de administrar usuários.
    const acesso = await exigirAcesso(req);
    if (!acesso.ok) return acesso.resposta;
    const quem = acesso.chamador;
    const propria = ehOProprio(quem, userId);
    if (!propria && !pode(quem, "usuarios.criar", "usuarios.editar", "usuarios.resetar_senha")) {
      return new Response(
        JSON.stringify({ error: "Você só pode trocar a sua própria senha." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // p/ senhas temporárias geradas pelo sistema; a própria senha sempre segue a política
    const skipPolicy = body?.skipPolicy === true && !propria;

    if (!userId || !novaSenha) {
      return new Response(
        JSON.stringify({ error: "userId e novaSenha são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Senha de quem tem acesso total (Diretor, Gerente Executivo, Coordenadores) só pode ser
    // trocada por ele mesmo ou por outro usuário com acesso total.
    if (!propria) {
      const alvo = await usuarioSgmPorId(userId);
      if (!alvo) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (alvo.acessoTotal && !temAcessoTotal(quem)) {
        return new Response(
          JSON.stringify({ error: "Só quem tem acesso total pode trocar a senha deste usuário." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!skipPolicy) {
      const policyError = validatePolicy(novaSenha);
      if (policyError) {
        return new Response(JSON.stringify({ error: policyError }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(novaSenha, salt);

    const { error } = await supabase
      .from("usuarios_credenciais")
      .upsert({ usuario_id: userId, senha: hash }, { onConflict: "usuario_id" });

    if (error) {
      console.error("[auth-set-password] DB error:", error);
      return new Response(JSON.stringify({ error: "Erro ao gravar senha." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[auth-set-password] Unexpected:", e);
    return new Response(JSON.stringify({ error: "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
