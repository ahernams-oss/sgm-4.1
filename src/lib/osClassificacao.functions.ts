import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { associarPadrao, encontrarPadrao, type PadraoClassificacao } from "./osClassificacao";

// Scoped to this function: preserve the project's existing session transport.
const sessaoClassificacao = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const sugerirClassificacaoOs = createServerFn({ method: "POST" })
  .middleware([sessaoClassificacao, requireSupabaseAuth])
  .inputValidator(input => z.object({ descricao: z.string().trim().min(1).max(10000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { exigirAcesso, podeModulo } = await import("@/lib/edge/permissao");
    const acesso = await exigirAcesso(getRequest(), c => podeModulo(c, "ordem_servico"));
    if (!acesso.ok) throw new Error("Você não possui acesso às ordens de serviço.");
    const { default: base } = await import("./data/os-classificacao-historico.server.json");
    const padrao = encontrarPadrao(data.descricao, base.patterns as PadraoClassificacao[]);
    if (!padrao) return null;
    const [categorias, servicos] = await Promise.all([
      context.supabase.from("categorias_servicos").select("id,nome").eq("nome", padrao[1]),
      context.supabase.from("servicos").select("id,nome,categoria_id").eq("nome", padrao[2]),
    ]);
    if (categorias.error || servicos.error) throw new Error("Não foi possível conferir os cadastros da sugestão.");
    return associarPadrao(padrao, categorias.data ?? [], servicos.data ?? []);
  });