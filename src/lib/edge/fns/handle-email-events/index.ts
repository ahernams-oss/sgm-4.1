import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { assinaturaWebhookValida } from '@/lib/email/resend'
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
// A supressão real é aplicada pelo próprio Resend.
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Webhook do Resend (Dashboard → Webhooks), assinado no padrão Svix com RESEND_WEBHOOK_SECRET.
// Só bounce permanente e reclamação de spam viram supressão; bounce temporário é ignorado.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const segredo = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!segredo) return json({ error: 'RESEND_WEBHOOK_SECRET não configurado' }, 500)

  const corpo = await req.text()
  if (!(await assinaturaWebhookValida(req, corpo, segredo))) {
    return json({ error: 'Assinatura inválida' }, 401)
  }

  let evento: any
  try {
    evento = JSON.parse(corpo)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const eventId = req.headers.get('svix-id') ?? evento?.data?.email_id ?? ''
  const destinatarios: string[] = Array.isArray(evento?.data?.to) ? evento.data.to : [evento?.data?.to]

  let motivo: Motivo | null = null
  if (evento?.type === 'email.bounced' && evento?.data?.bounce?.type !== 'Transient') motivo = 'bounce'
  if (evento?.type === 'email.complained') motivo = 'complaint'
  if (!motivo) return json({ ok: true, ignorado: evento?.type ?? null })

  for (const email of destinatarios) {
    if (email) await registrar(email, motivo, eventId)
  }
  return json({ ok: true })
})

export default __slot.dispatch;
