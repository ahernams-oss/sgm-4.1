// Envio por SMTP (ex.: caixa exclusiva do SkyMail, o e-mail corporativo da Lasant), com nodemailer.
// Ativado quando SMTP_HOST está definido; senão o envio segue pelo Resend (ver resend.ts).
// Variáveis: SMTP_HOST, SMTP_PORT (587 = STARTTLS, 465 = TLS direto), SMTP_USER, SMTP_PASS.
// Server-only: nunca importar de componentes do navegador.

import type { Transporter } from 'nodemailer';
import type { EmailSaida } from './resend';

let transporte: Promise<Transporter> | null = null;

export function smtpConfigurado(): boolean {
  return !!process.env['SMTP_HOST'];
}

function obterTransporte(): Promise<Transporter> {
  if (!transporte) {
    const host = process.env['SMTP_HOST']!;
    const port = Number(process.env['SMTP_PORT'] || 587);
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_PASS'];
    // Import dinâmico: o nodemailer só é carregado no servidor Node que tem SMTP configurado.
    transporte = import('nodemailer').then(({ default: nodemailer }) =>
      nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port !== 465,
        auth: user ? { user, pass } : undefined,
        pool: true,
        maxConnections: 2,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 60_000,
      }),
    );
    transporte.catch(() => {
      transporte = null;
    });
  }
  return transporte;
}

/** Envia e devolve o Message-ID. Erros saem crus; resend.ts converte em ErroEmail. */
export async function enviarPorSmtp(email: EmailSaida, from: string): Promise<string> {
  const t = await obterTransporte();
  const info = await t.sendMail({
    from,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: email.replyTo,
    attachments: email.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: 'base64',
      contentType: a.contentType,
    })),
  });
  if (info.rejected?.length) {
    throw new Error(`Servidor SMTP recusou: ${info.rejected.join(', ')}`);
  }
  return info.messageId;
}
