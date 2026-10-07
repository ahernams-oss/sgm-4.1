import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import * as React from 'react'
import { render } from '@react-email/components'
import { assinaturaWebhookValida, enviarEmail } from '@/lib/email/resend'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

// Hook "Send Email" do Supabase Auth (Authentication → Hooks → Send Email, tipo HTTPS),
// apontando para https://<site>/api/public/edge/auth-email-hook. O Supabase assina cada
// chamada (Standard Webhooks) com o segredo que fica em SEND_EMAIL_HOOK_SECRET
// ("v1,whsec_..."). Os e-mails usam os templates React Email e saem pelo Resend.

const SITE_NAME = "SGM 4.1 - Sistema de Gestão Lasant"
const siteUrl = () => Deno.env.get('APP_BASE_URL') || 'https://lasant.com.br'

interface DadosEmail {
  email: string
  url: string
  token?: string
  old_email?: string
  new_email?: string
}

const EMAILS: Record<string, { subject: string; render: (data: DadosEmail) => React.ReactElement }> = {
  signup: {
    subject: 'Confirme seu e-mail',
    render: (data) =>
      React.createElement(SignupEmail, {
        siteName: SITE_NAME,
        siteUrl: siteUrl(),
        recipient: data.email,
        confirmationUrl: data.url,
      }),
  },
  invite: {
    subject: 'Você recebeu um convite',
    render: (data) =>
      React.createElement(InviteEmail, {
        siteName: SITE_NAME,
        siteUrl: siteUrl(),
        confirmationUrl: data.url,
      }),
  },
  magiclink: {
    subject: 'Seu link de acesso',
    render: (data) =>
      React.createElement(MagicLinkEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  recovery: {
    subject: 'Redefina sua senha',
    render: (data) =>
      React.createElement(RecoveryEmail, {
        siteName: SITE_NAME,
        confirmationUrl: data.url,
      }),
  },
  email_change: {
    subject: 'Confirme seu novo e-mail',
    render: (data) =>
      React.createElement(EmailChangeEmail, {
        siteName: SITE_NAME,
        oldEmail: data.old_email ?? '',
        email: data.email,
        newEmail: data.new_email ?? '',
        confirmationUrl: data.url,
      }),
  },
  reauthentication: {
    subject: 'Seu código de verificação',
    render: (data) =>
      React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
  },
}
// Login por código/link enviado por e-mail (signInWithOtp) usa o mesmo template do link mágico.
EMAILS.email = EMAILS.magiclink

function linkVerificacao(tokenHash: string, tipo: string, redirectTo?: string): string {
  const params = new URLSearchParams({
    token: tokenHash,
    type: tipo,
    redirect_to: redirectTo || siteUrl(),
  })
  return `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?${params}`
}

async function enviar(tipo: string, to: string, data: DadosEmail) {
  const config = EMAILS[tipo]
  const element = config.render(data)
  await enviarEmail({
    to,
    subject: config.subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  })
}

const erro = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return erro(405, 'Method not allowed')

  const segredo = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!segredo) return erro(500, 'SEND_EMAIL_HOOK_SECRET não configurado')

  const corpo = await req.text()
  if (!(await assinaturaWebhookValida(req, corpo, segredo))) {
    return erro(401, 'Assinatura inválida')
  }

  try {
    const { user, email_data: d } = JSON.parse(corpo)
    const tipo: string = d?.email_action_type

    // Avisos (senha alterada, MFA etc.) não têm template no SGM: confirma sem enviar.
    if (!EMAILS[tipo]) {
      console.log('[auth-email-hook] tipo sem template, ignorado:', tipo)
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    }

    if (tipo === 'email_change') {
      const dados = { email: user.email, old_email: user.email, new_email: user.new_email }
      // Troca segura de e-mail: o endereço atual recebe token_hash_new e o novo recebe
      // token_hash (nomes invertidos de propósito na API do Supabase).
      if (d.token_hash_new && user.email) {
        await enviar(tipo, user.email, { ...dados, url: linkVerificacao(d.token_hash_new, tipo, d.redirect_to) })
      }
      if (d.token_hash && user.new_email) {
        await enviar(tipo, user.new_email, { ...dados, url: linkVerificacao(d.token_hash, tipo, d.redirect_to) })
      }
    } else {
      await enviar(tipo, user.email, {
        email: user.email,
        token: d.token,
        url: linkVerificacao(d.token_hash, tipo, d.redirect_to),
      })
    }

    return new Response('{}', { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[auth-email-hook]', e)
    return erro(500, e instanceof Error ? e.message : 'Falha ao enviar e-mail')
  }
})

export default __slot.dispatch;
