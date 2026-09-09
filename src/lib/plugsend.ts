import { supabase } from "@/integrations/supabase/client";

interface PlugSendOptions {
  telefone: string;
  mensagem?: string;
  documentUrl?: string;
  documentFilename?: string;
}

export async function enviarPlugSend(
  telefone: string,
  mensagem: string
): Promise<{ success: boolean; error?: string }> {
  return enviarPlugSendComOpcoes({ telefone, mensagem });
}

export async function enviarPlugSendComDocumento(
  options: PlugSendOptions
): Promise<{ success: boolean; error?: string }> {
  return enviarPlugSendComOpcoes(options);
}

async function enviarPlugSendComOpcoes(
  options: PlugSendOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-plugsend", {
      body: options,
    });
    if (error) {
      console.error("Erro PlugSend:", error);
      return { success: false, error: error.message };
    }
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { success: false, error: msg };
  }
}
