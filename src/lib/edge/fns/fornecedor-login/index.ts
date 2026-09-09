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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const senha = String(body?.senha ?? "");

    if (!email || !senha) {
      return new Response(JSON.stringify({ error: "E-mail e senha são obrigatórios." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error } = await supabase
      .from("clientes")
      .select("id, nome, nome_fantasia, email, cnpj")
      .eq("tipo", "Fornecedor")
      .ilike("email", email)
      .limit(1);

    if (error) {
      console.error("[fornecedor-login] DB error:", error);
      return new Response(JSON.stringify({ error: "Erro ao consultar fornecedor." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = rows?.[0];
    if (!user) {
      return new Response(JSON.stringify({ error: "Credenciais inválidas." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cred } = await supabase
      .from("clientes_credenciais")
      .select("senha_portal, senha_portal_trocada")
      .eq("cliente_id", user.id)
      .maybeSingle();

    if (!cred?.senha_portal) {
      return new Response(JSON.stringify({ error: "Credenciais inválidas." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ok = isBcryptHash(cred.senha_portal) && bcrypt.compareSync(senha, cred.senha_portal);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Credenciais inválidas." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safe = {
      id: user.id,
      nome: user.nome,
      nomeFantasia: user.nome_fantasia,
      email: user.email,
      cnpj: user.cnpj,
      mustChangePassword: cred.senha_portal_trocada === false,
    };

    return new Response(JSON.stringify({ fornecedor: safe }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fornecedor-login] Unexpected:", e);
    return new Response(JSON.stringify({ error: "Erro inesperado." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
