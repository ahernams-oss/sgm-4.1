import { denoEnv } from "@/lib/edge/deno-shim";
const Deno = { env: denoEnv } as any;
import { createClient } from '@supabase/supabase-js'

/**
 * Registra o resultado de um envio na tabela email_send_log.
 * Mantém o histórico usado pelos relatórios do sistema.
 * Falhas de log nunca alteram o resultado do envio.
 */
export async function registrarEnvioEmail(params: {
  templateName: string
  recipientEmail: string
  status: 'sent' | 'suppressed' | 'failed'
  errorMessage?: string | null
}): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('email_send_log: variáveis de ambiente ausentes')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { error } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: params.templateName,
    recipient_email: params.recipientEmail,
    status: params.status,
    error_message: params.errorMessage ? params.errorMessage.slice(0, 1000) : null,
  })

  if (error) {
    console.error('email_send_log: falha ao gravar registro', {
      code: error.code,
      message: error.message,
    })
  }
}

/**
 * Executa um envio e grava a linha correspondente em email_send_log,
 * reproduzindo os mesmos estados usados anteriormente pelo sistema.
 */
export async function enviarComLog(
  templateName: string,
  recipientEmail: string,
  send: () => Promise<{ sent: boolean; reason?: string }>
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const result = await send()
    if (result.sent) {
      await registrarEnvioEmail({ templateName, recipientEmail, status: 'sent' })
    } else {
      await registrarEnvioEmail({
        templateName,
        recipientEmail,
        status: 'suppressed',
        errorMessage: result.reason ?? 'recipient_suppressed',
      })
    }
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await registrarEnvioEmail({
      templateName,
      recipientEmail,
      status: 'failed',
      errorMessage: message,
    })
    throw error
  }
}
