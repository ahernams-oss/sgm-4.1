import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

const BASE = "https://api.brasilnfe.com.br/services/fiscal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { path, chave, tabela } = await req.json().catch(() => ({} as any));
    if (!path && !chave) return json({ ok: false, error: "path ou chave obrigatório" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tblNota = tabela === "nfse" ? "nfses_tomadas" : "nfes_recebidas";

    // Só nota já cadastrada no sistema: o caminho ou a chave precisam existir na tabela.
    if (path) {
      const p = String(path);
      if (p.includes("..")) return json({ ok: false, error: "Caminho inválido" }, 400);
      const [a, b] = await Promise.all([
        admin.from("nfes_recebidas").select("id").eq("xml_url", p).limit(1),
        admin.from("nfses_tomadas").select("id").eq("xml_url", p).limit(1),
      ]);
      if (!(a.data?.length || b.data?.length)) return json({ ok: false, error: "Nota não encontrada" }, 404);
    } else {
      const { data: nota } = await admin.from(tblNota).select("id").eq("chave", String(chave)).limit(1);
      if (!nota?.length) return json({ ok: false, error: "Nota não encontrada" }, 404);
    }

    let storagePath: string | null = path ?? null;

    // Sem XML armazenado: baixa da Brasil NFe pela chave e guarda no bucket
    if (!storagePath && chave) {
      const token = Deno.env.get("BRASILNFE_TOKEN");
      if (!token) return json({ ok: false, error: "BRASILNFE_TOKEN não configurado" }, 400);

      const resp = await fetch(`${BASE}/ObterArquivoNotaFiscal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Token: token },
        body: JSON.stringify({ ChaveNF: String(chave), FileType: 1, TipoDocumentoFiscal: 0 }),
      });
      const text = (await resp.text()).trim();
      if (!resp.ok) return json({ ok: false, error: `Brasil NFe HTTP ${resp.status}: ${text.slice(0, 300)}` }, 502);

      let b64 = text;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "string") b64 = parsed;
        else if (parsed?.Error) return json({ ok: false, error: String(parsed.Error) }, 502);
        else b64 = parsed?.Arquivo ?? parsed?.Base64 ?? parsed?.Xml ?? "";
      } catch { /* string crua */ }
      b64 = String(b64).replace(/^"|"$/g, "").trim();
      if (!b64) return json({ ok: false, error: "XML não retornado pela Brasil NFe" }, 502);

      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } catch {
        bytes = new TextEncoder().encode(b64); // já veio como XML puro
      }

      storagePath = `brasilnfe/${chave}.xml`;
      const { error: upErr } = await admin.storage.from("nfes-xml").upload(storagePath, bytes, {
        contentType: "application/xml",
        upsert: true,
      });
      if (upErr) return json({ ok: false, error: upErr.message }, 500);

      const tbl = tabela === "nfse" ? "nfses_tomadas" : "nfes_recebidas";
      await admin.from(tbl).update({ xml_url: storagePath }).eq("chave", String(chave));
    }

    const { data, error } = await admin.storage.from("nfes-xml").createSignedUrl(storagePath!, 300);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, url: data.signedUrl, path: storagePath });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

export default __slot.dispatch;
