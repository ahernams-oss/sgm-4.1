import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adaptarClima, consultaClimaSchema } from "./clima";

const sessaoClima = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const consultarClima = createServerFn({ method: "POST" })
  .middleware([sessaoClima, requireSupabaseAuth])
  .inputValidator(input => consultaClimaSchema.parse(input))
  .handler(async ({ data }) => {
    const chave = process.env['UDC_WEATHERAPI_API_KEY'];
    const autorizacao = process.env['LOVABLE_API_KEY'];
    if (!chave || !autorizacao) return { clima: null, erro: "A conexão com a WeatherAPI não está configurada." };
    try {
      const url = new URL("https://connector-gateway.lovable.dev/udc_weatherapi/v1/current.json");
      url.searchParams.set("q", data.cidade);
      url.searchParams.set("lang", "pt");
      const resposta = await fetch(url, { headers: { Authorization: `Bearer ${autorizacao}`, "X-Connection-Api-Key": chave }, signal: AbortSignal.timeout(15000) });
      if (!resposta.ok) {
        const corpo = await resposta.text();
        console.error("WeatherAPI", resposta.status, corpo);
        let codigo: number | undefined;
        try { codigo = JSON.parse(corpo)?.error?.code; } catch { /* Resposta não JSON. */ }
        const erro = codigo === 1006 ? "Cidade não encontrada. Informe cidade e estado ou país." : codigo === 2007 ? "O limite de consultas do seu plano WeatherAPI foi atingido." : `Não foi possível consultar o clima (código ${resposta.status}). Tente novamente mais tarde.`;
        return { clima: null, erro };
      }
      return { clima: adaptarClima(await resposta.json()), erro: null };
    } catch {
      return { clima: null, erro: "O serviço de clima está indisponível no momento. Tente novamente." };
    }
  });