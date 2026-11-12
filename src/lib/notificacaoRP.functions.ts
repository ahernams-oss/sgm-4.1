import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sessaoRP = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const notificarRequisicaoPessoal = createServerFn({ method: "POST" })
  .middleware([sessaoRP, requireSupabaseAuth])
  .inputValidator(input => z.object({ requisicaoId: z.string().uuid(), mensagem: z.string().min(1).max(5000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: req, error } = await context.supabase.from("requisicoes")
      .select("id,solicitante_usuario_id").eq("id", data.requisicaoId).maybeSingle();
    if (error || !req) throw new Error("Requisição não encontrada ou sem acesso.");
    const { data: usuario } = await context.supabase.from("usuarios")
      .select("id,ativo").eq("auth_user_id", context.userId).maybeSingle();
    if (!usuario || usuario.ativo === false) throw new Error("Usuário sem acesso.");
    if (req.solicitante_usuario_id !== usuario.id) {
      const { data: permitido, error: erroPermissao } = await context.supabase.rpc("has_module_prefix", { _prefixo: "processos_seletivos" });
      const { data: permitidoRp, error: erroRp } = await context.supabase.rpc("has_module_prefix", { _prefixo: "requisicao_colaboradores" });
      if (erroPermissao || erroRp || (!permitido && !permitidoRp)) throw new Error("Sem permissão para notificar esta requisição.");
    }
    const { notificarRpServidor } = await import("./notificacaoRP.server");
    return notificarRpServidor(context.supabase, data.requisicaoId, data.mensagem);
  });