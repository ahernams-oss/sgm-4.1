import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Verifica Ordens de Compra com status "Em Entrega" há mais de 48h e notifica
// o comprador que finalizou a cotação e o solicitante da RCS via WhatsApp (PlugSend).

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fmtMoeda = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const LIMITE_HORAS = 48;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const plugsendToken = Deno.env.get("PLUGSEND_TOKEN");
    if (!plugsendToken) throw new Error("PLUGSEND_TOKEN não configurado");

    const enviarWhatsApp = async (numero: string, mensagem: string) => {
      const alvo = numero.includes("@g.us") ? numero : numero.replace(/\D/g, "");
      if (!alvo) return false;
      const r = await fetch("https://plugsend.uazapi.com/send/text", {
        method: "POST",
        headers: { "Content-Type": "application/json", token: plugsendToken },
        body: JSON.stringify({ number: alvo, text: mensagem, linkPreview: true }),
      });
      return r.ok;
    };

    const telefoneDoUsuario = async (nomeOuEmail?: string | null) => {
      const termo = (nomeOuEmail || "").trim();
      if (!termo) return "";
      const { data } = await supabase
        .from("usuarios")
        .select("nome,email,telefone")
        .or(`nome.eq.${termo},email.eq.${termo}`)
        .limit(1)
        .maybeSingle();
      return (data?.telefone || "").trim();
    };

    const { data: pedidos } = await supabase
      .from("pedidos_compra")
      .select("*")
      .eq("status", "Em Entrega")
      .is("notificado_atraso_entrega", null);

    const agora = Date.now();
    let notificados = 0;
    const atrasadas: number[] = [];

    for (const p of pedidos || []) {
      const hist = Array.isArray(p.historico_status) ? p.historico_status : [];
      const entradas = hist.filter((h: any) => h?.status === "Em Entrega" && h?.dataHora);
      const desde = entradas.length
        ? new Date(entradas[entradas.length - 1].dataHora).getTime()
        : new Date(p.data_criacao || p.created_at).getTime();
      const horas = (agora - desde) / 36e5;
      if (!Number.isFinite(horas) || horas < LIMITE_HORAS) continue;

      atrasadas.push(p.numero);

      const { data: cot } = p.cotacao_id
        ? await supabase.from("cotacoes_compras").select("comprador").eq("id", p.cotacao_id).maybeSingle()
        : { data: null as any };
      const { data: req } = p.requisicao_id
        ? await supabase.from("requisicoes_compras").select("solicitante").eq("id", p.requisicao_id).maybeSingle()
        : { data: null as any };

      const ocNum = `OC-${String(p.numero).padStart(4, "0")}`;
      const msg = [
        "*ALERTA - ENTREGA EM ATRASO*",
        "",
        `Pedido de Compra: ${ocNum}`,
        `RCS: ${p.requisicao_numero ?? "-"}`,
        `Fornecedor: ${p.fornecedor_nome || "-"}`,
        `Valor Total: ${fmtMoeda(p.valor_total)}`,
        p.prazo_entrega ? `Prazo de Entrega: ${p.prazo_entrega}` : "",
        "",
        `Este pedido está com status *Em Entrega* há ${Math.floor(horas)} horas e ainda não foi baixado como *Entregue*.`,
        "Favor verificar junto ao fornecedor e atualizar o status no SGM.",
      ].filter(Boolean).join("\n");

      const destinos = new Set<string>();
      for (const pessoa of [cot?.comprador || p.comprador, req?.solicitante]) {
        const tel = await telefoneDoUsuario(pessoa);
        if (tel) destinos.add(tel);
      }

      let ok = false;
      for (const d of destinos) {
        try { ok = (await enviarWhatsApp(d, msg)) || ok; } catch (e) { console.error("WA fail", d, e); }
      }
      if (ok) notificados++;

      await supabase
        .from("pedidos_compra")
        .update({ notificado_atraso_entrega: new Date().toISOString() })
        .eq("id", p.id);
    }

    return new Response(
      JSON.stringify({ success: true, verificados: pedidos?.length ?? 0, atrasadas, notificados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("check-oc-entrega-atrasada:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
