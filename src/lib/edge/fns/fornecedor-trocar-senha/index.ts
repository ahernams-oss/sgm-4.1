import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import * as bcrypt from "@/lib/edge/bcrypt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isBcryptHash(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^\$2[aby]\$\d{2}\$/.test(s);
}

function validar(senha: string): string | null {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Z]/.test(senha)) return "A senha deve conter ao menos uma letra maiúscula.";
  if (!/[0-9]/.test(senha)) return "A senha deve conter ao menos um número.";
  if (!/[^A-Za-z0-9]/.test(senha)) return "A senha deve conter ao menos um caractere especial.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const fornecedorId = String(body?.fornecedorId ?? "");
    const senhaAtual = String(body?.senhaAtual ?? "");
    const novaSenha = String(body?.novaSenha ?? "");

    if (!fornecedorId || !senhaAtual || !novaSenha) {
      return new Response(JSON.stringify({ error: "Dados incompletos." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const erroValid = validar(novaSenha);
    if (erroValid) {
      return new Response(JSON.stringify({ error: erroValid }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cred } = await supabase
      .from("clientes_credenciais")
      .select("senha_portal")
      .eq("cliente_id", fornecedorId)
      .maybeSingle();

    if (!cred?.senha_portal || !isBcryptHash(cred.senha_portal) || !bcrypt.compareSync(senhaAtual, cred.senha_portal)) {
      return new Response(JSON.stringify({ error: "Senha atual incorreta." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hash = bcrypt.hashSync(novaSenha, bcrypt.genSaltSync(10));
    const { error } = await supabase
      .from("clientes_credenciais")
      .upsert({ cliente_id: fornecedorId, senha_portal: hash, senha_portal_trocada: true }, { onConflict: "cliente_id" });

    if (error) {
      return new Response(JSON.stringify({ error: "Erro ao salvar senha." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fornecedor-trocar-senha]", e);
    return new Response(JSON.stringify({ error: "Erro inesperado." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
