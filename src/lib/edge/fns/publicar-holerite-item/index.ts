import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Publica ou despublica UM item de holerite processado.

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { item_id, acao } = await req.json();
    if (!item_id || !["publicar", "despublicar"].includes(acao)) {
      return json({ error: "item_id e acao (publicar|despublicar) são obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: item, error: eI } = await supabase
      .from("portal_holerites_import_item").select("*").eq("id", item_id).single();
    if (eI) throw eI;

    const { data: lote, error: eL } = await supabase
      .from("portal_holerites_import_lote").select("*").eq("id", item.lote_id).single();
    if (eL) throw eL;

    const path = `${item.funcionario_id}/${lote.competencia_ano}-${String(lote.competencia_mes).padStart(2, "0")}-${item.tipo}-${item.id}.pdf`;

    if (acao === "publicar") {
      if (item.publicado) return json({ ok: true, publicado: true });
      if (!item.funcionario_id) return json({ error: "Item sem funcionário vinculado." }, 400);
      if (item.ignorar) return json({ error: "Item marcado como ignorado." }, 400);
      if (!item.pdf_pagina_base64) return json({ error: "PDF da página não está mais disponível; reimporte o lote." }, 400);

      const bytes = Uint8Array.from(atob(item.pdf_pagina_base64), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabase.storage.from("portal-holerites")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      // Atualização: remove holerite anterior da mesma competência/tipo do funcionário
      const { data: antigos } = await supabase.from("portal_holerites").select("id,arquivo_path")
        .eq("funcionario_id", item.funcionario_id).eq("tipo", item.tipo)
        .eq("competencia_mes", lote.competencia_mes).eq("competencia_ano", lote.competencia_ano);
      for (const a of antigos || []) {
        if (a.arquivo_path && a.arquivo_path !== path) {
          await supabase.storage.from("portal-holerites").remove([a.arquivo_path]);
        }
        await supabase.from("portal_holerites").delete().eq("id", a.id);
      }

      const { error: insErr } = await supabase.from("portal_holerites").insert({
        funcionario_id: item.funcionario_id,
        tipo: item.tipo,
        competencia_mes: lote.competencia_mes,
        competencia_ano: lote.competencia_ano,
        arquivo_path: path,
        disponibilizado_por: lote.importado_por,
      });
      if (insErr) throw insErr;

      // mantém o base64 para permitir republicação após despublicar
      const { error: updErr } = await supabase.from("portal_holerites_import_item")
        .update({ publicado: true }).eq("id", item.id);
      if (updErr) throw updErr;

      return json({ ok: true, publicado: true });
    }

    // despublicar
    await supabase.from("portal_holerites").delete().eq("arquivo_path", path);
    await supabase.storage.from("portal-holerites").remove([path]);
    const { error: updErr } = await supabase.from("portal_holerites_import_item")
      .update({ publicado: false }).eq("id", item.id);
    if (updErr) throw updErr;

    return json({ ok: true, publicado: false });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

export default __slot.dispatch;
