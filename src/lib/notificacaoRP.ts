import { supabase } from "@/integrations/supabase/client";
import { enviarWhatsApp } from "@/lib/whatsapp";

async function getWhatsappRH(): Promise<string> {
  const { data } = await (supabase as any)
    .from("empresa")
    .select("whatsapp_rh")
    .limit(1)
    .maybeSingle();
  return (data?.whatsapp_rh || "").trim();
}

async function getWhatsappSolicitante(nomeOuEmail?: string): Promise<string> {
  if (!nomeOuEmail) return "";
  const term = nomeOuEmail.trim();
  if (!term) return "";
  const { data } = await (supabase as any)
    .from("usuarios")
    .select("nome,email,telefone")
    .or(`nome.eq.${term},email.eq.${term}`)
    .limit(1)
    .maybeSingle();
  return (data?.telefone || "").trim();
}

export async function enviarNotificacaoRP(opts: {
  mensagem: string;
  solicitante?: string;
}) {
  const { mensagem, solicitante } = opts;
  const destinos = new Set<string>();
  try {
    const rh = await getWhatsappRH();
    if (rh) destinos.add(rh);
    const sol = await getWhatsappSolicitante(solicitante);
    if (sol) destinos.add(sol);
    for (const d of destinos) {
      try { await enviarWhatsApp(d, mensagem); } catch (e) { console.error("WA fail", d, e); }
    }
  } catch (e) {
    console.error("Falha ao notificar RP via WhatsApp:", e);
  }
}
