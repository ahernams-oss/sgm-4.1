import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { corsHeaders } from "@/lib/edge/cors";

const BASE = "https://api.brasilnfe.com.br/services/fiscal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const tipo = Number.isFinite(Number(body?.tipoDocumentoFiscal)) ? Number(body.tipoDocumentoFiscal) : 0;

    const token = Deno.env.get("BRASILNFE_TOKEN");
    if (!token) return json({ ok: false, error: "BRASILNFE_TOKEN não configurado" }, 400);

    // Período: default últimos 30 dias
    const toIso = (d: Date) => d.toISOString().replace("Z", "-00:00");
    const dtFim = body?.dtFim ? new Date(body.dtFim) : new Date();
    const dtInicio = body?.dtInicio
      ? new Date(body.dtInicio)
      : new Date(dtFim.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (isNaN(dtInicio.getTime()) || isNaN(dtFim.getTime()))
      return json({ ok: false, error: "Datas inválidas" }, 400);

    const url = `${BASE}/ObterNotasFiscais`;
    const payload = {
      TipoDocumentoFiscal: tipo,
      DtInicio: toIso(dtInicio),
      DtFim: toIso(dtFim),
    };

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Token: token },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ ok: false, error: `Falha de rede: ${(e as Error).message}`, url }, 502);
    }

    const text = await resp.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* keep raw */ }

    const notas = Array.isArray(data?.Notas) ? data.Notas : Array.isArray(data) ? data : [];
    const erro = data?.Error || (!resp.ok ? String(text).slice(0, 800) : undefined);

    console.log(`brasilnfe-diagnostico: HTTP ${resp.status} — ${notas.length} nota(s)`);

    return json({
      ok: resp.ok && !data?.Error,
      httpStatus: resp.status,
      url,
      request: payload,
      totalDocumentos: notas.length,
      avisos: data?.Avisos ?? [],
      provider: "Brasil NFe",
      preview: notas.slice(0, 5),
      raw: notas.length ? undefined : data,
      error: erro,
    });
  } catch (e) {
    console.error("brasilnfe-diagnostico erro:", e);
    return json({ ok: false, error: (e as Error).message || "Erro inesperado" }, 500);
  }
});

export default __slot.dispatch;
