import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BRASILNFE_FISCAL_URL } from "./nfseBrasilNfe";
import { extrairDanfseOficial } from "./danfseOficial";

const sessaoDanfse = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const obterDanfseOficial = createServerFn({ method: "POST" })
  .middleware([sessaoDanfse, requireSupabaseAuth])
  .inputValidator(input => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { exigirAcessoDanfse } = await import("./danfseAcesso.server");
    await exigirAcessoDanfse(context.supabase);
    const { data: nota, error } = await context.supabase.from("nfses_emitidas")
      .select("id, status, numero_dps, ambiente, prestador, servico, protocolo").eq("id", data.id).maybeSingle();
    if (error || !nota) throw new Error("Nota não encontrada ou sem acesso.");
    if (nota.status !== "emitida" && nota.status !== "cancelada") throw new Error("O DANFSe está disponível somente após a autorização.");
    const servico = nota.servico as { brasilNfe?: { codLote?: string } } | null;
    const codLote = servico?.brasilNfe?.codLote || nota.protocolo;
    if (!codLote) throw new Error("Esta nota não possui o identificador de consulta da Brasil NFe.");
    const token = process.env["BRASILNFE_TOKEN"];
    if (!token) throw new Error("Conexão Brasil NFe não configurada.");
    let body: unknown;
    try {
      const response = await fetch(`${BRASILNFE_FISCAL_URL}/BuscarNotaFiscalServico`, {
        method: "POST", headers: { Token: token, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ codLote, Rps: [nota.numero_dps] }), signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error("consulta indisponível");
      body = await response.json();
    } catch { throw new Error("Não foi possível consultar o DANFSe na Brasil NFe. Tente novamente mais tarde."); }
    const documento = extrairDanfseOficial(body, nota);
    return { base64: documento.base64, nome: `danfse-${documento.numero}-${nota.ambiente === 1 ? "producao" : "homologacao"}.pdf` };
  });