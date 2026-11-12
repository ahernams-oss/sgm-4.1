import { notificarRequisicaoPessoal } from "./notificacaoRP.functions";
import { toast } from "sonner";

export async function enviarNotificacaoRP(opts: {
  mensagem: string;
  requisicaoId: string;
}) {
  try {
    const resultado = await notificarRequisicaoPessoal({ data: opts });
    for (const aviso of new Set(resultado.avisos)) toast.warning(`Registro salvo. ${aviso}`);
  } catch {
    toast.warning("Registro salvo, mas não foi possível enviar os avisos de WhatsApp.");
  }
}
