import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hoje no fuso de Brasília (UTC-3)
function brtToday(): { dateStr: string; hour: number; minute: number } {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return { dateStr: `${y}-${m}-${d}`, hour: brt.getUTCHours(), minute: brt.getUTCMinutes() };
}

function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + "T00:00:00Z").getTime();
  const b = new Date(toStr.slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

// Antecedências exigidas: 30, 20 e 10 dias
const ANTECEDENCIAS = [30, 20, 10];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { dateStr: today, hour, minute } = brtToday();

    // Permite execução manual (?force=1) para testes
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    // Disparo diário às 09:00 (tolerância de 15 min)
    const hm = hour * 60 + minute;
    if (!force && Math.abs(hm - 9 * 60) > 15) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "fora do horário de disparo (09:00 BRT)", hour, minute }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Destino: WhatsApp SEGTRAB (dados da empresa)
    const { data: empresa } = await supabase
      .from("empresa")
      .select("whatsapp_segtrab")
      .limit(1)
      .maybeSingle();

    const segtrab = String((empresa as { whatsapp_segtrab?: string | null } | null)?.whatsapp_segtrab || "").trim();
    if (!segtrab) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "WhatsApp SEGTRAB não configurado nos dados da empresa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: funcionarios } = await supabase
      .from("funcionarios")
      .select("nome, cargo, epis");

    type Aviso = { funcionario: string; epi: string; ca?: string; dias: number; vencimento: string };
    const avisos: Aviso[] = [];

    for (const f of (funcionarios || []) as Array<{ nome: string; cargo?: string; epis?: unknown }>) {
      const epis = (f.epis as Array<Record<string, string>>) || [];
      for (const epi of epis) {
        if (!epi?.dataVencimento) continue;
        const dias = daysBetween(today, epi.dataVencimento);
        if (!ANTECEDENCIAS.includes(dias)) continue;
        avisos.push({
          funcionario: f.nome,
          epi: epi.descricao || "EPI",
          ca: epi.ca,
          dias,
          vencimento: String(epi.dataVencimento).slice(0, 10).split("-").reverse().join("/"),
        });
      }
    }

    if (avisos.length === 0) {
      return new Response(JSON.stringify({ sent: 0, data: today }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Agrupa por antecedência (30 → 20 → 10)
    const blocos = ANTECEDENCIAS.filter((d) => avisos.some((a) => a.dias === d)).map((d) => {
      const linhas = avisos
        .filter((a) => a.dias === d)
        .map((a) => `• *${a.funcionario}* — ${a.epi}${a.ca ? ` (CA ${a.ca})` : ""} — vence em ${a.vencimento}`);
      return `*${d} dias para o vencimento*\n${linhas.join("\n")}`;
    });

    const mensagem =
      `⚠️ *Vencimento de EPIs — Segurança do Trabalho*\n` +
      `_Aviso automático de ${today.split("-").reverse().join("/")}_\n\n` +
      blocos.join("\n\n") +
      `\n\nProvidencie a renovação/substituição dos EPIs.`;

    const { error: sendErr } = await supabase.functions.invoke("send-whatsapp", {
      body: { telefone: segtrab, mensagem },
    });
    if (sendErr) throw sendErr;

    return new Response(JSON.stringify({ sent: avisos.length, data: today, avisos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notificar-vencimento-epi", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
