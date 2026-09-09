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

function gerarSenha(): string {
  const upp = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const low = "abcdefghjkmnpqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%&*?";
  const all = upp + low + num + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let out = pick(upp) + pick(low) + pick(num) + pick(sym);
  for (let i = 0; i < 6; i++) out += pick(all);
  return out.split("").sort(() => Math.random() - 0.5).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const fornecedorId = String(body?.fornecedorId ?? "");
    const senhaCustom = body?.senha ? String(body.senha) : null;

    if (!fornecedorId) {
      return new Response(JSON.stringify({ error: "fornecedorId é obrigatório." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const senha = senhaCustom && senhaCustom.length >= 6 ? senhaCustom : gerarSenha();
    const hash = bcrypt.hashSync(senha, bcrypt.genSaltSync(10));

    const { error } = await supabase
      .from("clientes_credenciais")
      .upsert({ cliente_id: fornecedorId, senha_portal: hash, senha_portal_trocada: false }, { onConflict: "cliente_id" });

    if (error) {
      console.error("[fornecedor-set-senha] DB error:", error);
      return new Response(JSON.stringify({ error: "Erro ao salvar senha." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ senha }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[fornecedor-set-senha] Unexpected:", e);
    return new Response(JSON.stringify({ error: "Erro inesperado." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
