import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function brtToday(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + "T00:00:00Z").getTime();
  const b = new Date(toStr.slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

const ANTECEDENCIAS = [60, 50, 40, 30, 20, 10];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = brtToday();

    const { data: empresa } = await supabase
      .from("empresa")
      .select("whatsapp_rh")
      .limit(1)
      .maybeSingle();

    const numeroRh = String((empresa as Record<string, string> | null)?.whatsapp_rh || "").trim();
    if (!numeroRh) {
      return new Response(JSON.stringify({ skipped: true, reason: "WhatsApp do RH não configurado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: ferias }, { data: funcionarios }, { data: cargos }, { data: clientes }] = await Promise.all([
      supabase.from("ferias").select("*"),
      supabase.from("funcionarios").select("id, nome, cargo_id, cliente_id, status"),
      supabase.from("cargos").select("id, nome"),
      supabase.from("clientes").select("id, nome"),
    ]);

    type Func = { id: string; nome: string; cargo_id: string | null; cliente_id: string | null; status: string | null };
    const funcs = (funcionarios || []) as Func[];
    const cargoNome = new Map((cargos || []).map((c: any) => [c.id, c.nome]));
    const clienteNome = new Map((clientes || []).map((c: any) => [c.id, c.nome]));

    // Funcionários que já estão/estarão de férias no período próximo (indisponíveis para cobertura)
    const indisponiveis = new Set<string>();
    for (const f of (ferias || []) as any[]) {
      const st = String(f.status || "").toLowerCase();
      if (["em gozo", "aprovada", "gozada"].includes(st)) indisponiveis.add(f.funcionario_id);
      const dias = f.data_limite_concessao ? daysBetween(today, f.data_limite_concessao) : 999;
      if (dias <= 60 && !["concluída", "concluida", "gozada", "paga"].includes(st)) indisponiveis.add(f.funcionario_id);
    }

    type Aviso = {
      funcionario: string; cargo: string; cliente: string; dias: number; limite: string;
      substitutos: string[]; contratacaoTemporaria: boolean;
    };
    const avisos: Aviso[] = [];

    for (const f of (ferias || []) as any[]) {
      if (!f.data_limite_concessao) continue;
      const st = String(f.status || "");
      if (["Concluída", "concluída", "concluida", "gozada", "paga"].includes(st)) continue;
      const dias = daysBetween(today, f.data_limite_concessao);
      if (!ANTECEDENCIAS.includes(dias)) continue;

      const func = funcs.find((x) => x.id === f.funcionario_id);
      const substitutos = funcs
        .filter((x) =>
          x.id !== f.funcionario_id &&
          x.cargo_id && func?.cargo_id && x.cargo_id === func.cargo_id &&
          (x.status || "Ativo") === "Ativo" &&
          !indisponiveis.has(x.id))
        .sort((a, b) => (a.cliente_id === func?.cliente_id ? -1 : 1) - (b.cliente_id === func?.cliente_id ? -1 : 1))
        .slice(0, 3)
        .map((x) => `${x.nome}${x.cliente_id && x.cliente_id !== func?.cliente_id ? ` (${clienteNome.get(x.cliente_id) || "outro posto"})` : ""}`);

      avisos.push({
        funcionario: f.funcionario_nome || func?.nome || "—",
        cargo: (func?.cargo_id && cargoNome.get(func.cargo_id)) || "—",
        cliente: (func?.cliente_id && clienteNome.get(func.cliente_id)) || "—",
        dias,
        limite: String(f.data_limite_concessao).slice(0, 10).split("-").reverse().join("/"),
        substitutos,
        contratacaoTemporaria: substitutos.length === 0,
      });
    }

    if (avisos.length === 0) {
      return new Response(JSON.stringify({ sent: 0, data: today }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blocos = ANTECEDENCIAS.filter((d) => avisos.some((a) => a.dias === d)).map((d) => {
      const linhas = avisos.filter((a) => a.dias === d).map((a) => {
        const cobertura = a.contratacaoTemporaria
          ? "⛔ Sem cobertura disponível — *sugerir contratação temporária*"
          : `🔄 Cobertura sugerida: ${a.substitutos.join(", ")}`;
        return `• *${a.funcionario}* — ${a.cargo} — ${a.cliente}\n   Limite: ${a.limite}\n   ${cobertura}`;
      });
      return `*${d} dias para o limite de concessão*\n${linhas.join("\n")}`;
    });

    const mensagem =
      `🏖️ *Vencimento de Férias — Controle RH*\n` +
      `_Aviso automático de ${today.split("-").reverse().join("/")}_\n\n` +
      blocos.join("\n\n") +
      `\n\nProgramar a escala de férias garantindo que nenhum posto fique descoberto (CLT Art. 134).`;

    const { error } = await supabase.functions.invoke("send-whatsapp", {
      body: { telefone: numeroRh, mensagem },
    });

    return new Response(JSON.stringify({ sent: avisos.length, data: today, ok: !error, erro: error?.message, avisos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notificar-vencimento-ferias", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
