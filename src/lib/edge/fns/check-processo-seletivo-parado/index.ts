import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";
import { precisaAlertaParado, HORAS_SEM_MOVIMENTO } from "@/lib/processoParado";
import { destinosRequisicao } from "@/lib/eventosRecrutamento";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

serve(async () => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = Deno.env.get("PLUGSEND_TOKEN");
    if (!token) return json({ success: false, error: "PLUGSEND_TOKEN não configurado" }, 500);
    const { data: empresa } = await db.from("empresa").select("whatsapp_selecao").limit(1).maybeSingle();
    const [grupo] = destinosRequisicao(empresa?.whatsapp_selecao || "", "");
    if (!grupo) return json({ success: false, error: "WhatsApp Seleção não cadastrado" });

    const { data: processos, error } = await db.from("processos_seletivos")
      .select("id, numero, requisicao_id, candidatos, ultimo_movimento_em, alerta_inatividade_em, created_at")
      .is("alerta_inatividade_em", null);
    if (error) throw error;
    const agora = new Date();
    const enviados: string[] = [];
    for (const p of processos ?? []) {
      if (!precisaAlertaParado(p as any, agora)) continue;
      const { data: req } = await db.from("requisicoes").select("cargo, unidade, status").eq("id", p.requisicao_id).maybeSingle();
      const st = String(req?.status || "").toLowerCase();
      if (/cancel|conclu|finaliz|encerr/.test(st)) continue;
      const ano = new Date(p.created_at || agora).getFullYear();
      const num = p.numero ? `PS ${String(p.numero).padStart(2, "0")}-${ano}` : "Processo seletivo";
      const desde = new Date(p.ultimo_movimento_em as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const texto = `⚠️ *Processo seletivo sem movimento*\n\n${num}\nCargo: ${req?.cargo || "-"}\nUnidade: ${req?.unidade || "-"}\nÚltimo movimento: ${desde}\n\nO processo foi iniciado após a aprovação da requisição, mas não houve nenhum movimento há mais de ${HORAS_SEM_MOVIMENTO} horas. Por favor, verifiquem e deem andamento.`;
      const r = await fetch("https://plugsend.uazapi.com/send/text", {
        method: "POST", headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({ number: grupo, text: texto, linkPreview: false }),
        signal: AbortSignal.timeout(12000),
      }).catch(() => null);
      if (!r?.ok) { console.error("Alerta processo parado falhou", r?.status); continue; }
      await db.from("processos_seletivos").update({ alerta_inatividade_em: agora.toISOString() }).eq("id", p.id);
      enviados.push(num);
    }
    return json({ success: true, enviados });
  } catch (e) {
    console.error("check-processo-seletivo-parado", e);
    return json({ success: false, error: e instanceof Error ? e.message : "erro" }, 500);
  }
});

export default __slot.dispatch;
