import type { SupabaseClient } from "@supabase/supabase-js";
import { destinosRequisicao } from "./eventosRecrutamento";

// Called only after caller authentication, or by the already-authenticated portal handler.
export async function notificarRpServidor(db: SupabaseClient, requisicaoId: string, mensagem: string) {
  const { data: req, error } = await db.from("requisicoes")
    .select("solicitante_usuario_id").eq("id", requisicaoId).maybeSingle();
  if (error || !req) throw new Error("Requisição não encontrada para notificação.");
  const { data: empresa, error: erroEmpresa } = await db.from("empresa")
    .select("whatsapp_selecao").limit(1).maybeSingle();
  if (erroEmpresa) throw new Error("Não foi possível consultar o WhatsApp Seleção.");
  let telefone = "";
  if (req.solicitante_usuario_id) {
    const { data: usuario, error: erroUsuario } = await db.from("usuarios")
      .select("telefone").eq("id", req.solicitante_usuario_id).maybeSingle();
    if (erroUsuario) throw new Error("Não foi possível consultar o telefone do solicitante.");
    telefone = usuario?.telefone || "";
  }
  const avisos: string[] = [];
  if (!destinosRequisicao(empresa?.whatsapp_selecao || "", "").length)
    avisos.push("WhatsApp Seleção não cadastrado ou inválido.");
  if (!destinosRequisicao("", telefone).length)
    avisos.push("Solicitante sem telefone válido ou sem vínculo identificado com o cadastro de usuários.");
  const token = process.env["PLUGSEND_TOKEN"];
  if (!token) return { success: false, avisos: [...avisos, "Serviço de WhatsApp não configurado."] };
  for (const destino of destinosRequisicao(empresa?.whatsapp_selecao || "", telefone)) {
    try {
      const response = await fetch("https://plugsend.uazapi.com/send/text", {
        method: "POST", headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({ number: destino, text: mensagem, linkPreview: false }),
        signal: AbortSignal.timeout(12000),
      });
      const body = await response.text();
      if (!response.ok) {
        console.error(`RP WhatsApp provider [${response.status}]: ${body}`);
        avisos.push("Não foi possível enviar um dos avisos pelo WhatsApp; confira a conexão do serviço.");
        continue;
      }
      const result = JSON.parse(body);
      if (result.success === false || result.error) avisos.push("O serviço recusou um dos avisos pelo WhatsApp.");
    } catch {
      avisos.push("Envio de um dos avisos não confirmado; não reenviado automaticamente.");
    }
  }
  return { success: avisos.length === 0, avisos };
}