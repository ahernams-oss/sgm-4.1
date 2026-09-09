import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JANELAS: { dias: number; campo: string; titulo: string }[] = [
  { dias: 3, campo: "notificado_3d", titulo: "LEMBRETE DE PAGAMENTO - 3 DIAS" },
  { dias: 1, campo: "notificado_1d", titulo: "URGENTE - PAGAMENTO AMANHÃ" },
];

const fmtMoeda = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const plugsendToken = Deno.env.get("PLUGSEND_TOKEN");

    if (!plugsendToken) {
      throw new Error("PLUGSEND_TOKEN não configurado");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pega o destino (grupo WhatsApp RH) da empresa
    const { data: empresa } = await supabase
      .from("empresa_dados")
      .select("whatsapp_rh")
      .limit(1)
      .maybeSingle();

    const destino = (empresa?.whatsapp_rh || "").trim();
    if (!destino) {
      return new Response(
        JSON.stringify({ message: "WhatsApp RH não configurado em Empresa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    let enviados = 0;
    const detalhes: Record<string, number> = {};

    const enviarWhatsApp = async (numero: string, mensagem: string) => {
      // Suporta grupo (id terminando em @g.us) ou número limpo
      const isGrupo = numero.includes("@g.us");
      const number = isGrupo ? numero : numero.replace(/\D/g, "");
      if (!number) return;
      await fetch("https://plugsend.uazapi.com/send/text", {
        method: "POST",
        headers: { "Content-Type": "application/json", token: plugsendToken },
        body: JSON.stringify({ number, text: mensagem, linkPreview: true }),
      });
      enviados++;
    };

    for (const j of JANELAS) {
      const alvo = new Date(hoje);
      alvo.setDate(alvo.getDate() + j.dias);

      const { data: parcelas } = await supabase
        .from("juridico_parcelas")
        .select("*")
        .eq("status", "Pendente")
        .eq(j.campo, false)
        .eq("data_vencimento", fmt(alvo));

      detalhes[j.campo] = (parcelas || []).length;

      for (const p of parcelas || []) {
        const { data: dec } = await supabase
          .from("juridico_decisoes_pagamentos")
          .select("processo_id, processo_numero, patrono_nome, patrono_oab, patrono_telefone, banco, agencia, conta, pix_chave, pix_tipo")
          .eq("id", p.decisao_id)
          .maybeSingle();

        let autorNome = "";
        if (dec?.processo_id) {
          const { data: proc } = await supabase
            .from("processos_trabalhistas")
            .select("autor_nome, advogado_autor")
            .eq("id", dec.processo_id)
            .maybeSingle();
          autorNome = proc?.autor_nome || "";
        }

        const dataVenc = new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR");

        const dadosBancarios = [
          dec?.banco ? `Banco: ${dec.banco}` : "",
          dec?.agencia ? `Ag: ${dec.agencia}` : "",
          dec?.conta ? `Conta: ${dec.conta}` : "",
          dec?.pix_chave ? `PIX (${dec?.pix_tipo || "chave"}): ${dec.pix_chave}` : "",
        ].filter(Boolean).join(" | ");

        const msg =
          `💰 *${j.titulo}*\n\n` +
          `Processo: *${dec?.processo_numero || "-"}*\n` +
          (autorNome ? `Autor: ${autorNome}\n` : "") +
          `Parcela: *${p.numero}*\n` +
          `Vencimento: *${dataVenc}*\n` +
          `Valor: *${fmtMoeda(Number(p.valor))}*\n` +
          (dec?.patrono_nome ? `Patrono: ${dec.patrono_nome}${dec.patrono_oab ? ` (${dec.patrono_oab})` : ""}\n` : "") +
          (dec?.patrono_telefone ? `Tel: ${dec.patrono_telefone}\n` : "") +
          (dadosBancarios ? `\n${dadosBancarios}` : "");

        await enviarWhatsApp(destino, msg);

        await supabase
          .from("juridico_parcelas")
          .update({ [j.campo]: true })
          .eq("id", p.id);
      }
    }

    return new Response(JSON.stringify({ success: true, enviados, detalhes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Erro check-parcelas-vencimento:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
