import { supabase } from "@/integrations/supabase/client";

/** E-mail que recebe cópia de todos os envios do módulo de Compras. */
export const EMAIL_COPIA_COMPRAS = "compras@lasant.com.br";

interface EnvioComprasBody {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData: Record<string, any>;
}

/**
 * Envia um e-mail do módulo de Compras para o destinatário. A cópia interna
 * para EMAIL_COPIA_COMPRAS é disparada no servidor, de forma best-effort.
 */
export async function enviarEmailCompras({ body }: { body: EnvioComprasBody }): Promise<{ error: any }> {
  const { templateName, recipientEmail, idempotencyKey, templateData } = body;

  const { error } = await supabase.functions.invoke("send-email-compras", {
    body: { templateName, recipientEmail, idempotencyKey, templateData },
  });

  return { error };
}
