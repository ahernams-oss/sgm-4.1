import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Publica os itens do lote em portal_holerites + bucket portal-holerites.

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { lote_id } = await req.json();
    if (!lote_id) return new Response(JSON.stringify({ error: "lote_id obrigatório" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: lote, error: eL } = await supabase
      .from("portal_holerites_import_lote").select("*").eq("id", lote_id).single();
    if (eL) throw eL;

    const { data: itens, error: eI } = await supabase
      .from("portal_holerites_import_item").select("*")
      .eq("lote_id", lote_id).eq("publicado", false).eq("ignorar", false)
      .not("funcionario_id", "is", null);
    if (eI) throw eI;

    let publicados = 0;
    for (const item of itens || []) {
      if (!item.pdf_pagina_base64) continue;
      const path = `${item.funcionario_id}/${lote.competencia_ano}-${String(lote.competencia_mes).padStart(2,"0")}-${item.tipo}-${item.id}.pdf`;
      const bytes = Uint8Array.from(atob(item.pdf_pagina_base64), (c) => c.charCodeAt(0));

      const { error: upErr } = await supabase.storage.from("portal-holerites")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) { console.error("upload err", upErr); continue; }

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
      if (insErr) { console.error("insert holerite err", insErr); continue; }

      await supabase.from("portal_holerites_import_item")
        .update({ publicado: true })
        .eq("id", item.id);
      publicados++;
    }

    await supabase.from("portal_holerites_import_lote")
      .update({ status: "publicado", total_publicados: publicados })
      .eq("id", lote_id);

    return new Response(JSON.stringify({ publicados }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

export default __slot.dispatch;
