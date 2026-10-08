import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import * as bcrypt from "@/lib/edge/bcrypt";
import { exigirAcesso, podeModulo } from "@/lib/edge/permissao";
import { MSG_SENHA_VAZADA, senhaVazada } from "../_shared/senha-vazada.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
function gerarSenha(): string {
  const upp = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const low = "abcdefghjkmnpqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%&*?";
  const all = upp + low + num + sym;
  const pick = (s: string) => s[rnd(s.length)];
  let out = pick(upp) + pick(low) + pick(num) + pick(sym);
  for (let i = 0; i < 6; i++) out += pick(all);
  const arr = out.split("");
  for (let i = arr.length - 1; i > 0; i--) { const j = rnd(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Quem abre a tela Fornecedores (o botão "Gerar senha" não tem permissão própria).
    const acesso = await exigirAcesso(req, (c) => podeModulo(c, "fornecedores"));
    if (!acesso.ok) return acesso.resposta;

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

    if (senhaCustom && senhaCustom.length >= 6 && (await senhaVazada(senhaCustom))) {
      return new Response(JSON.stringify({ error: MSG_SENHA_VAZADA }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
