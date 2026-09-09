import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createEmailWebhookHandler } from '@lovable.dev/email-js'
import { createClient } from '@supabase/supabase-js'

type Motivo = 'bounce' | 'complaint' | 'unsubscribe'

const STATUS_LOG: Record<Motivo, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const MENSAGEM_LOG: Record<Motivo, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

function client() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing Supabase environment variables')
  return createClient(url, key)
}

// Notification-only: registra o desfecho nas tabelas históricas do sistema.
// A supressão real é aplicada pela entrega gerenciada da Lovable.
async function registrar(recipient: string, motivo: Motivo, eventId: string) {
  const supabase = client()
  const email = String(recipient || '').toLowerCase()
  if (!email) return

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason: motivo, metadata: null }, { onConflict: 'email' })

  if (suppressError) {
    console.error('Falha ao gravar suppressed_emails', {
      code: suppressError.code,
      message: suppressError.message,
      event_id: eventId,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: null,
    template_name: 'system',
    recipient_email: email,
    status: STATUS_LOG[motivo],
    error_message: MENSAGEM_LOG[motivo],
    metadata: null,
  })

  if (logError) {
    console.error('Falha ao gravar email_send_log', {
      code: logError.code,
      message: logError.message,
      event_id: eventId,
    })
    throw new Error('Failed to write email_send_log')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await registrar(event.data.recipient, 'bounce', event.event_id)
    },
    'email.complaint': async (event) => {
      await registrar(event.data.recipient, 'complaint', event.event_id)
    },
    'email.unsubscribed': async (event) => {
      await registrar(event.data.recipient, 'unsubscribe', event.event_id)
    },
  },
})

Deno.serve((req) => handler(req))

export default __slot.dispatch;
