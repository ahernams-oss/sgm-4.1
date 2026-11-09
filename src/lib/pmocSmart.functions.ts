import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SmartExecucao } from "./pmocSmart";
const sessaoSmart = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});
export const gravarPmocSmart = createServerFn({ method: "POST" })
  .middleware([sessaoSmart, requireSupabaseAuth])
  .inputValidator((input) => z.object({
    acao: z.enum(["iniciar", "salvar", "finalizar"]), atividadeId: z.string().uuid().optional(),
    equipamentoId: z.string().uuid().optional(), execucaoId: z.string().uuid().optional(),
    observacoes: z.string().max(10000).optional(), foto: z.string().max(500).optional(), proxima: z.string().datetime().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase.rpc("pmoc_smart_gravar", {
      _acao: data.acao, _atividade: data.atividadeId, _equipamento: data.equipamentoId,
      _execucao: data.execucaoId, _observacoes: data.observacoes, _foto: data.foto, _proxima: data.proxima,
    });
    if (error || !saved) throw new Error(error?.message || "Não foi possível salvar a manutenção.");
    return saved as unknown as SmartExecucao;
  });