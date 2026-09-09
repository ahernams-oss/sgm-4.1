import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function brtToday(): { dateStr: string } {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return { dateStr: `${y}-${m}-${d}` };
}

function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + "T00:00:00Z").getTime();
  const b = new Date(toStr.slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

const ANTECEDENCIAS = [30, 20, 10];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { dateStr: today } = brtToday();

    const { data: empresa } = await supabase
      .from("empresa")
      .select("whatsapp_rh, whatsapp_segtrab, whatsapp_compras")
      .limit(1)
      .maybeSingle();

    const e = (empresa || {}) as Record<string, string | null>;
    const destinos = [
      { nome: "RH", numero: String(e.whatsapp_rh || "").trim() },
      { nome: "SEGTRAB", numero: String(e.whatsapp_segtrab || "").trim() },
      { nome: "Compras", numero: String(e.whatsapp_compras || "").trim() },
    ].filter((d) => d.numero);

    if (destinos.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Nenhum WhatsApp (RH/SEGTRAB/Compras) configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: funcionarios } = await supabase
      .from("funcionarios")
      .select("nome, cargo, nrs");

    type Aviso = { funcionario: string; nr: string; descricao?: string; dias: number; vencimento: string };
    const avisos: Aviso[] = [];

    for (const f of (funcionarios || []) as Array<{ nome: string; nrs?: unknown }>) {
      const nrs = (f.nrs as Array<Record<string, string>>) || [];
      for (const nr of nrs) {
        if (!nr?.dataValidade) continue;
        const dias = daysBetween(today, nr.dataValidade);
        if (!ANTECEDENCIAS.includes(dias)) continue;
        avisos.push({
          funcionario: f.nome,
          nr: nr.numero || "NR",
          descricao: nr.descricao,
          dias,
          vencimento: String(nr.dataValidade).slice(0, 10).split("-").reverse().join("/"),
        });
      }
    }

    if (avisos.length === 0) {
      return new Response(JSON.stringify({ sent: 0, data: today }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blocos = ANTECEDENCIAS.filter((d) => avisos.some((a) => a.dias === d)).map((d) => {
      const linhas = avisos
        .filter((a) => a.dias === d)
        .map((a) => `• *${a.funcionario}* — ${a.nr}${a.descricao ? ` (${a.descricao})` : ""} — vence em ${a.vencimento}`);
      return `*${d} dias para o vencimento*\n${linhas.join("\n")}`;
    });

    const mensagem =
      `⚠️ *Vencimento de NRs — Treinamentos Obrigatórios*\n` +
      `_Aviso automático de ${today.split("-").reverse().join("/")}_\n\n` +
      blocos.join("\n\n") +
      `\n\nProvidencie a reciclagem/renovação dos treinamentos.`;

    const resultados: Array<{ destino: string; ok: boolean; erro?: string }> = [];
    for (const d of destinos) {
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { telefone: d.numero, mensagem },
      });
      resultados.push({ destino: d.nome, ok: !error, erro: error?.message });
    }

    return new Response(JSON.stringify({ sent: avisos.length, data: today, resultados, avisos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notificar-vencimento-nr", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
