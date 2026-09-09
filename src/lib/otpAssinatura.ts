import { supabase } from "@/integrations/supabase/client";

/**
 * Token (OTP) enviado por e-mail para assinatura eletrônica avançada.
 * Segundo fator, somado à confirmação de senha do usuário.
 * Base legal: Art. 4º, II da Lei nº 14.063/2020.
 */

export interface OtpResultado {
  success: boolean;
  error?: string;
  email_mascarado?: string;
}

async function chamar(body: Record<string, unknown>): Promise<OtpResultado> {
  try {
    const { data, error } = await supabase.functions.invoke("assinatura-otp", { body });
    if (error) return { success: false, error: error.message };
    return (data || { success: false, error: "Resposta inválida" }) as OtpResultado;
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export const purposeAssinatura = (tipo: string, docId: string, papel: string) =>
  `assinatura:${tipo}:${docId}:${papel}`;

export const enviarTokenAssinatura = (params: {
  usuarioId: string;
  purpose: string;
  documento?: string;
  papel?: string;
}) =>
  chamar({
    action: "send",
    usuario_id: params.usuarioId,
    purpose: params.purpose,
    documento: params.documento,
    papel: params.papel,
  });

export const verificarTokenAssinatura = (params: {
  usuarioId: string;
  purpose: string;
  code: string;
}) =>
  chamar({
    action: "verify",
    usuario_id: params.usuarioId,
    purpose: params.purpose,
    code: params.code,
  });
