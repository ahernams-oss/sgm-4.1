import type { SupabaseClient } from "@supabase/supabase-js";

// Only called with the authenticated user's RLS-scoped client after authorization.
export async function avisarSSEmergencial(db: SupabaseClient, solicitacaoId: string, token: string | undefined) {
  const { data: ss, error } = await db.from("solicitacoes_servicos")
    .select("numero,created_at,cliente_id,cliente_nome,local_descricao,pavimento_descricao,setor_descricao,descricao_servicos,solicitante_nome,situacao,prioridade")
    .eq("id", solicitacaoId).maybeSingle();
  if (error || !ss) throw new Error("Solicitação não encontrada ou sem acesso.");
  if (ss.situacao !== "Aprovada" || ss.prioridade !== "Emergencial") {
    throw new Error("O aviso exige uma solicitação aprovada como Emergencial.");
  }
  const { data: cliente, error: erroCliente } = await db.from("clientes")
    .select("nome,grupo_whatsapp_emergencia").eq("id", ss.cliente_id).maybeSingle();
  if (erroCliente || !cliente) throw new Error("Cliente não encontrado ou sem acesso.");
  const destino = String(cliente.grupo_whatsapp_emergencia ?? "").trim();
  if (!/^\d{8,40}(?:-\d{8,12})?@g\.us$/.test(destino)) {
    throw new Error("Grupo de WhatsApp para Emergência não cadastrado ou JID inválido no cliente.");
  }
  if (!token) throw new Error("Serviço de WhatsApp não configurado.");
  const ano = String(ss.created_at ?? "").slice(0, 4);
  const mensagem = [
    "🚨 *SOLICITAÇÃO DE SERVIÇOS EMERGENCIAL APROVADA*",
    `SS: ${String(ss.numero).padStart(2, "0")}${ano ? `-${ano}` : ""}`,
    `Cliente: ${cliente.nome || ss.cliente_nome || "—"}`,
    `Local: ${ss.local_descricao || "—"}`,
    `Pavimento: ${ss.pavimento_descricao || "—"}`,
    `Setor: ${ss.setor_descricao || "—"}`,
    `Solicitante: ${ss.solicitante_nome || "—"}`,
    "Prioridade: Emergencial — atendimento imediato",
    `Serviço: ${String(ss.descricao_servicos || "—").slice(0, 2500)}`,
    "— SGM Lasant",
  ].join("\n");
  const response = await fetch("https://plugsend.uazapi.com/send/text", {
    method: "POST", headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number: destino, text: mensagem, linkPreview: false }),
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(`SS emergencial WhatsApp [${response.status}]: ${body}`);
    throw new Error(`WhatsApp recusou o aviso [${response.status}]: ${body}`);
  }
  const resultado = JSON.parse(body);
  if (resultado.success === false || resultado.error) {
    throw new Error(`WhatsApp recusou o aviso: ${body}`);
  }
  return { success: true };
}