import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
import { enviarComLog } from '../_shared/transactional-email-templates/log-send.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEMPLATE_NAME = 'mapa-ferias-relatorio'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let recipientEmail = ''
  let idempotencyKey: string | undefined
  let templateData: Record<string, unknown> = {}
  try {
    const body = await req.json()
    recipientEmail = String(body.recipientEmail || '').trim()
    idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey) : undefined
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }

  if (!EMAIL_RE.test(recipientEmail)) {
    return json({ error: 'recipientEmail inválido' }, 400)
  }

  try {
    const result = await enviarComLog(TEMPLATE_NAME, recipientEmail, () =>
      sendTemplateEmail(TEMPLATE_NAME, recipientEmail, { templateData, idempotencyKey })
    )
    return json({ success: result.sent, reason: result.reason })
  } catch (error) {
    console.error('Falha ao enviar relatório de férias', {
      message: error instanceof Error ? error.message : String(error),
    })
    return json({ error: 'Falha ao enviar e-mail' }, 500)
  }
})

export default __slot.dispatch;
