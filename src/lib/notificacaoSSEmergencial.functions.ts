import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sessaoSS = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const notificarSSEmergencial = createServerFn({ method: "POST" })
  .middleware([sessaoSS, requireSupabaseAuth])
  .inputValidator(input => z.object({ solicitacaoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: permitido, error } = await context.supabase.rpc("has_module", {
      _modulo: "solicitacao_servicos.status.aprovada",
    });
    if (error || permitido !== true) throw new Error("Sem permissão para avisar a aprovação desta solicitação.");
    const { avisarSSEmergencial } = await import("./notificacaoSSEmergencial.server");
    return avisarSSEmergencial(context.supabase, data.solicitacaoId, process.env["PLUGSEND_TOKEN"]);
  });

export const notificarSSSetorCritico = createServerFn({ method: "POST" })
  .middleware([sessaoSS, requireSupabaseAuth])
  .inputValidator(input => z.object({ solicitacaoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Opening permission remains required; approval permission is deliberately not required.
    const { data: permitido, error } = await context.supabase.rpc("has_module", {
      _modulo: "solicitacao_servicos.criar",
    });
    if (error || permitido !== true) throw new Error("Sem permissão para avisar a abertura desta solicitação.");
    const { avisarSSEmergencial } = await import("./notificacaoSSEmergencial.server");
    return avisarSSEmergencial(context.supabase, data.solicitacaoId, process.env["PLUGSEND_TOKEN"], "setor-critico");
  });