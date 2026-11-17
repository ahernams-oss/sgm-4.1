import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BRASILNFE_FISCAL_URL } from "./nfseBrasilNfe";
import { numeroFiscalNfse } from "./gerarPdfNfse";
import { interpretarCancelamentoBrasilNfe, montarCancelamentoBrasilNfe } from "./cancelamentoNfse";

const sessao = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const cancelarNfseOficial = createServerFn({ method: "POST" })
  .middleware([sessao, requireSupabaseAuth])
  .inputValidator(input => z.object({
    id: z.string().uuid(), codigo: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(9)]),
    justificativa: z.string().trim().min(15).max(1000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { exigirAcessoDanfse } = await import("./danfseAcesso.server");
    await exigirAcessoDanfse(context.supabase);
    const { data: nota, error } = await context.supabase.from("nfses_emitidas")
      .select("id, status, ambiente, xml_nfse, servico").eq("id", data.id).maybeSingle();
    if (error || !nota) throw new Error("Nota não encontrada ou sem acesso.");
    const servico = (nota.servico || {}) as Record<string, any>;
    if (servico.brasilNfe?.cancelamento?.situacao === "cancelada")
      throw new Error("Esta nota já foi cancelada oficialmente.");
    if (nota.status !== "emitida" && nota.status !== "cancelada") throw new Error("Só notas autorizadas podem ser canceladas.");
    const numero = numeroFiscalNfse(nota.xml_nfse);
    if (!numero) throw new Error("Não encontrei o número oficial da nota no XML. Cancele pelo Portal Nacional.");
    const token = process.env["BRASILNFE_TOKEN"];
    if (!token) throw new Error("Conexão Brasil NFe não configurada.");
    let body: unknown;
    try {
      const r = await fetch(`${BRASILNFE_FISCAL_URL}/CancelarNotaFiscal`, {
        method: "POST", headers: { Token: token, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(montarCancelamentoBrasilNfe(numero, Number(nota.ambiente), data.codigo, data.justificativa)),
        signal: AbortSignal.timeout(30_000),
      });
      body = await r.json().catch(() => null);
      if (!r.ok && !body) throw new Error("http");
    } catch {
      // Delivery is uncertain: never retry automatically.
      throw new Error("Não houve resposta da Brasil NFe. Confira no Portal Nacional se a nota foi cancelada antes de tentar de novo.");
    }
    const res = interpretarCancelamentoBrasilNfe(body);
    if (res.situacao === "erro") throw new Error(`Cancelamento recusado: ${res.mensagem}`);
    const agora = new Date().toISOString();
    const novoServico = { ...servico, brasilNfe: { ...(servico.brasilNfe || {}), cancelamento: {
      situacao: res.situacao, protocolo: res.situacao === "cancelada" ? res.protocolo : null, codigo: data.codigo, data: agora } } };
    const update: Record<string, unknown> = { servico: novoServico, mensagem_retorno: res.mensagem };
    if (res.situacao === "cancelada") Object.assign(update, { status: "cancelada", motivo_cancelamento: data.justificativa, data_cancelamento: agora });
    const { error: upErr } = await context.supabase.from("nfses_emitidas").update(update as never).eq("id", nota.id);
    if (upErr) throw new Error(`Cancelamento ${res.situacao === "cancelada" ? "autorizado" : "enviado"} na Brasil NFe, mas não foi possível salvar no SGM.`);
    return res;
  });
