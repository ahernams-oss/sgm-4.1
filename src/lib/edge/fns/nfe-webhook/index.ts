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
    // 1) Autenticação do webhook: token na query (?token=) ou header x-webhook-token
    // Aceita o segredo dedicado (NFE_WEBHOOK_SECRET) ou o próprio token do provedor (BRASILNFE_TOKEN)
    const url = new URL(req.url);
    const secret = Deno.env.get("NFE_WEBHOOK_SECRET") || "";
    const token = Deno.env.get("BRASILNFE_TOKEN") || "";
    if (!secret && !token) return json({ ok: false, error: "Autenticação do webhook não configurada" }, 500);
    const provided = url.searchParams.get("token") || req.headers.get("x-webhook-token") || "";
    if (!provided || (provided !== secret && provided !== token)) {
      return json({ ok: false, error: "Token inválido" }, 401);
    }
    if (!token) return json({ ok: false, error: "BRASILNFE_TOKEN não configurado" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 2) Empresa destinatária (a nota recebida é sempre contra o CNPJ da empresa)
    const { data: empresa, error: empErr } = await admin
      .from("empresa")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (empErr || !empresa) return json({ ok: false, error: "Empresa não encontrada" }, 400);

    // 3) Lê o payload do evento (se houver) — usado só para contexto; a importação é incremental
    const body = await req.json().catch(() => ({}));
    const evento = body?.Evento || body?.evento || body?.Tipo || null;
    const chaveEvento = String(body?.Chave || body?.chave || "").trim() || null;

    // Janela incremental: últimos N dias (padrão 3) — cobre atrasos/retentativas do provedor
    const dias = Math.min(Math.max(Number(url.searchParams.get("dias")) || 3, 1), 30);
    const dtFim = new Date();
    const dtInicio = new Date(dtFim.getTime() - dias * 24 * 60 * 60 * 1000);
    const toIso = (d: Date) => d.toISOString().replace("Z", "-00:00");

    const resp = await fetch(`${BASE}/ObterNotasFiscais`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Token: token },
      body: JSON.stringify({ TipoDocumentoFiscal: 0, DtInicio: toIso(dtInicio), DtFim: toIso(dtFim) }),
    });
    const text = await resp.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* raw */ }

    if (!resp.ok || data?.Error) {
      return json({ ok: false, httpStatus: resp.status, error: data?.Error || String(text).slice(0, 500) });
    }

    const notas: any[] = Array.isArray(data?.Notas) ? data.Notas : Array.isArray(data) ? data : [];

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
          empresa_id: empresa.id,
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
          origem: "brasilnfe-webhook",
          payload: n,
        });
      } else {
        nfeRows.push({
          empresa_id: empresa.id,
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
          console.error(`nfe-webhook upsert ${table} erro:`, error.message);
        } else {
          gravadas += slice.length;
        }
      }
      return list.length;
    };

    const totalNfse = await upsertAll("nfses_tomadas", nfseRows);
    await upsertAll("nfes_recebidas", nfeRows);

    console.log(`nfe-webhook: evento=${evento} chave=${chaveEvento} — ${notas.length} doc(s), ${gravadas} gravadas, ${erros} erros`);
    return json({ ok: true, evento, chave: chaveEvento, total: notas.length, gravadas, nfse: totalNfse, erros });
  } catch (e) {
    console.error("nfe-webhook erro:", e);
    return json({ ok: false, error: (e as Error).message || "Erro inesperado" }, 500);
  }
});

export default __slot.dispatch;
