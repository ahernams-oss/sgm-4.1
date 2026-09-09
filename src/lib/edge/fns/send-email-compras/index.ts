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

/** E-mail que recebe cópia de todos os envios do módulo de Compras. */
const EMAIL_COPIA_COMPRAS = 'compras@lasant.com.br'

const TEMPLATES_PERMITIDOS = new Set([
  'cotacao-confirmation',
  'ordem-compra-confirmation',
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let templateName = ''
  let recipientEmail = ''
  let idempotencyKey = ''
  let templateData: Record<string, unknown> = {}
  try {
    const body = await req.json()
    templateName = String(body.templateName || '')
    recipientEmail = String(body.recipientEmail || '').trim()
    idempotencyKey = String(body.idempotencyKey || crypto.randomUUID())
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }

  if (!TEMPLATES_PERMITIDOS.has(templateName)) {
    return json({ error: 'templateName inválido' }, 400)
  }
  if (!EMAIL_RE.test(recipientEmail)) {
    return json({ error: 'recipientEmail inválido' }, 400)
  }

  let principal: { sent: boolean; reason?: string }
  try {
    principal = await enviarComLog(templateName, recipientEmail, () =>
      sendTemplateEmail(templateName, recipientEmail, { templateData, idempotencyKey })
    )
  } catch (error) {
    console.error('Falha ao enviar e-mail de compras', {
      templateName,
      message: error instanceof Error ? error.message : String(error),
    })
    return json({ error: 'Falha ao enviar e-mail' }, 500)
  }

  // Cópia interna best-effort: falhas não afetam o envio principal.
  if (recipientEmail.toLowerCase() !== EMAIL_COPIA_COMPRAS) {
    try {
      await enviarComLog(templateName, EMAIL_COPIA_COMPRAS, () =>
        sendTemplateEmail(templateName, EMAIL_COPIA_COMPRAS, {
          templateData: {
            ...templateData,
            copiaInterna: true,
            destinatarioOriginal: recipientEmail,
          },
          idempotencyKey: `${idempotencyKey}-copia`,
        })
      )
    } catch (error) {
      console.error('Falha ao enviar cópia para compras', {
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return json({ success: principal.sent, reason: principal.reason })
})

export default __slot.dispatch;
