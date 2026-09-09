import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

const BASE = "https://api.brasilnfe.com.br/services/fiscal";
const digitsOnly = (s: string) => (s || "").replace(/\D+/g, "");

const STATUS_MAP: Record<string, string> = {
  "1": "autorizada",
  "2": "cancelada",
  "3": "denegada",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const empresaId = body?.empresaId;
    if (!empresaId) return json({ ok: false, error: "empresaId obrigatório" }, 400);

    const token = Deno.env.get("BRASILNFE_TOKEN");
    if (!token) return json({ ok: false, error: "BRASILNFE_TOKEN não configurado" }, 400);

    const toIso = (d: Date) => d.toISOString().replace("Z", "-00:00");
    const dtFim = body?.dataFinal ? new Date(`${body.dataFinal}T23:59:59-03:00`) : new Date();
    const dtInicio = body?.dataInicial
      ? new Date(`${body.dataInicial}T00:00:00-03:00`)
      : new Date(dtFim.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (isNaN(dtInicio.getTime()) || isNaN(dtFim.getTime()))
      return json({ ok: false, error: "Datas inválidas" }, 400);

    const resp = await fetch(`${BASE}/ObterNotasFiscais`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Token: token },
      body: JSON.stringify({ TipoDocumentoFiscal: 0, DtInicio: toIso(dtInicio), DtFim: toIso(dtFim) }),
    });
    const text = await resp.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* raw */ }

    if (!resp.ok || data?.Error) {
      return json({
        ok: false,
        httpStatus: resp.status,
        error: data?.Error || String(text).slice(0, 500),
      });
    }

    const notas: any[] = Array.isArray(data?.Notas) ? data.Notas : Array.isArray(data) ? data : [];

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const nfeRows: any[] = [];
    const nfseRows: any[] = [];

    for (const n of notas) {
      const chave = String(n.Chave || n.chave || "").trim();
      if (!chave) continue;
      const modelo = Number(n.ModeloDocumento ?? 55);
      const status = STATUS_MAP[String(n.Status)] || (n.Status != null ? String(n.Status) : null);
      const isNfse = modelo !== 55 && modelo !== 65;

      if (isNfse) {
        nfseRows.push({
          empresa_id: empresaId,
          chave,
          numero: String(n.Numero ?? ""),
          serie: String(n.Serie ?? ""),
          prestador_cnpj: digitsOnly(n.CnpjEmissor || ""),
          prestador_nome: n.NomeEmissor || "",
          tomador_cnpj: digitsOnly(n.CnpjDestinatario || ""),
          valor_servicos: Number(n.Valor) || 0,
          valor_total: Number(n.Valor) || 0,
          data_emissao: n.DtEmissao || null,
          data_recebimento: n.DtRecebimento || null,
          status,
          origem: "brasilnfe",
          payload: n,
        });
      } else {
        nfeRows.push({
          empresa_id: empresaId,
          chave,
          numero: String(n.Numero ?? ""),
          serie: String(n.Serie ?? ""),
          emitente_cnpj: digitsOnly(n.CnpjEmissor || ""),
          emitente_nome: n.NomeEmissor || "",
          destinatario_cnpj: digitsOnly(n.CnpjDestinatario || ""),
          valor_total: Number(n.Valor) || 0,
          data_emissao: n.DtEmissao || null,
          data_recebimento: n.DtRecebimento || null,
          status,
          payload: n,
        });
      }
    }

    // dedup por chave (a API pode repetir)
    const dedup = (rows: any[]) => Array.from(new Map(rows.map((r) => [r.chave, r])).values());

    let gravadas = 0, erros = 0;
    const CHUNK = 200;

    const upsertAll = async (table: string, rows: any[]) => {
      const list = dedup(rows);
      for (let i = 0; i < list.length; i += CHUNK) {
        const slice = list.slice(i, i + CHUNK);
        const { error } = await admin.from(table).upsert(slice, { onConflict: "chave" });
        if (error) {
          erros += slice.length;
          console.error(`importar-nfes-brasilnfe upsert ${table} erro:`, error.message);
        } else {
          gravadas += slice.length;
        }
      }
      return list.length;
    };

    const totalNfse = await upsertAll("nfses_tomadas", nfseRows);
    await upsertAll("nfes_recebidas", nfeRows);

    console.log(`importar-nfes-brasilnfe: ${notas.length} doc(s) — ${gravadas} gravadas, ${erros} erros`);
    return json({ ok: true, total: notas.length, gravadas, inseridas: gravadas, atualizadas: 0, nfse: totalNfse, erros, provider: "Brasil NFe" });
  } catch (e) {
    console.error("importar-nfes-brasilnfe erro:", e);
    return json({ ok: false, error: (e as Error).message || "Erro inesperado" }, 500);
  }
});

export default __slot.dispatch;
