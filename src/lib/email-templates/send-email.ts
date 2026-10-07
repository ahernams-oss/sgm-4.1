import * as React from 'react'
import { render } from '@react-email/render'
import { enviarEmail } from '@/lib/email/resend'
import { TEMPLATES } from './registry'

// Server-only: envia por enviarEmail (SMTP se SMTP_HOST, senão Resend; remetente EMAIL_FROM). Never import
// from client components.

export type SendTemplateEmailResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Dedupes retries of the same logical send (Resend keeps the key for 24h; SMTP ignores it). */
  idempotencyKey?: string
  replyTo?: string
}

/**
 * Renders a registered template and sends it through enviarEmail (SMTP or Resend).
 * With Resend, bounces and spam complaints are suppressed by Resend itself and reported
 * to handle-email-events; with SMTP, bounces come back to the sending mailbox.
 * Any failure throws — ErroEmail exposes .status for branching.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  const { id } = await enviarEmail({
    to: recipient,
    subject,
    html,
    text,
    replyTo: options.replyTo,
    idempotencyKey: options.idempotencyKey,
  })

  return { sent: true, messageId: id }
}
