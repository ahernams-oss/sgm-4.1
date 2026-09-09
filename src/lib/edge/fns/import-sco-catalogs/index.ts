import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function parseNum(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  // brazilian "1.234,56" or "283,33"
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function rowsFromBase64(b64: string): any[][] {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const wb = XLSX.read(bin, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
}

async function chunkInsert(table: string, rows: any[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "codigo" });
    if (error && table === "sco_composicoes") {
      // composicoes don't have unique key — use insert instead
      const { error: e2 } = await supabase.from(table).insert(chunk);
      if (e2) throw new Error(`${table}@${i}: ${e2.message}`);
    } else if (error) {
      throw new Error(`${table}@${i}: ${error.message}`);
    }
  }
}

function parseElementares(rows: any[][]) {
  // cols: codigo, descricao, unidade, reutilizado, preco
  const out: any[] = [];
  for (const r of rows) {
    const cod = r[0] ? String(r[0]).trim() : "";
    if (!/^[A-Z]{3}\d/.test(cod)) continue;
    out.push({
      codigo: cod,
      descricao: String(r[1] ?? "").slice(0, 1500),
      unidade: r[2] ? String(r[2]).trim() : "",
      grupo: cod.slice(0, 3),
      reutilizado: r[3] ? String(r[3]).trim() : "",
      preco: parseNum(r[4]),
      referencia: "Março/2026",
    });
  }
  return out;
}

function parseServicos(rows: any[][]) {
  const out: any[] = [];
  let cap = "", capD = "", sec = "", secD = "", sub = "", subD = "";
  for (const r of rows) {
    const c0 = r[0] ? String(r[0]).trim() : "";
    const c1 = r[1] ? String(r[1]).trim() : "";
    const c2 = r[2] ? String(r[2]).trim() : "";
    const c3 = r[3] ? String(r[3]).trim() : "";
    const c4 = r[4] ? String(r[4]).trim() : "";
    const c5 = r[5];
    let m = c0.match(/^([A-Z]{2})\s+(.+)$/);
    if (m && !r[1]) { cap = m[1]; capD = m[2].slice(0, 300); continue; }
    m = c1.match(/^([A-Z]{2})\s+(\d+)\s+(.+)$/);
    if (m && !r[2]) { sec = `${m[1]} ${m[2]}`; secD = m[3].slice(0, 300); continue; }
    m = c2.match(/^([A-Z]{2})\s+(\d+\.\d+)\s+(.+)$/);
    if (m && !r[3]) { sub = `${m[1]} ${m[2]}`; subD = m[3].slice(0, 300); continue; }
    m = c2.match(/^([A-Z]{2}\s+\d+\.\d+\.\d+)(?:\s*\([^)]+\))?\s*$/);
    if (m) {
      out.push({
        codigo: c2, descricao: c3.slice(0, 1500), unidade: c4.slice(0, 20),
        preco: parseNum(c5),
        capitulo: cap, capitulo_descricao: capD,
        secao: sec, secao_descricao: secD,
        subsecao: sub, subsecao_descricao: subD,
        referencia: "Março/2026",
      });
    }
  }
  // dedupe by codigo
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.codigo) ? false : (seen.add(x.codigo), true)));
}

function parseComposicoes(rows: any[][]) {
  const out: any[] = [];
  let serv = "";
  for (const r of rows) {
    const c0 = r[0] ? String(r[0]).trim() : "";
    const c1 = r[1] ? String(r[1]).trim() : "";
    const c2 = r[2] ? String(r[2]).trim() : "";
    const c3 = r[3] ? String(r[3]).trim() : "";
    const c4 = r[4] ? String(r[4]).trim() : "";
    const c5 = r[5];
    const m = c0.match(/^([A-Z]{2}\s+\d+\.\d+\.\d+)(?:\s*\([^)]+\))?\s*$/);
    if (m) { serv = c0; continue; }
    if (serv && c2 && /^[A-Z]{3}\d/.test(c2)) {
      out.push({
        servico_codigo: serv,
        elementar_codigo: c2,
        elementar_descricao: c1.slice(0, 1000),
        unidade: c4.slice(0, 20),
        reutilizado: c3.slice(0, 20),
        quantidade: parseNum(c5),
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { fgv04, fgv06, fgv07 } = body as { fgv04?: string; fgv06?: string; fgv07?: string };

    const result: Record<string, number> = {};

    if (fgv04) {
      const rows = rowsFromBase64(fgv04);
      const parsed = parseElementares(rows);
      await supabase.from("sco_elementares").delete().neq("codigo", "");
      await chunkInsert("sco_elementares", parsed);
      result.elementares = parsed.length;
    }

    if (fgv06) {
      const rows = rowsFromBase64(fgv06);
      const parsed = parseServicos(rows);
      await supabase.from("sco_servicos").delete().neq("codigo", "");
      await chunkInsert("sco_servicos", parsed);
      result.servicos = parsed.length;
    }

    if (fgv07) {
      const rows = rowsFromBase64(fgv07);
      const parsed = parseComposicoes(rows);
      await supabase.from("sco_composicoes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await chunkInsert("sco_composicoes", parsed);
      result.composicoes = parsed.length;
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("import-sco-catalogs error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
