// Envio de e-mails do servidor. Substitui o serviço de e-mail da Lovable, que só funcionava
// dentro da hospedagem dela. Dois caminhos, escolhidos pelas variáveis do servidor:
//   - SMTP_HOST definido: SMTP (caixa exclusiva no SkyMail, o e-mail corporativo), ver smtp.ts;
//   - senão: Resend (https://resend.com), com a chave RESEND_API_KEY.
// Remetente padrão em EMAIL_FROM (ex.: "SGM Lasant <sgm@lasant.com.br>"). No SMTP ele deve ser a
// própria caixa autenticada; no Resend, o domínio precisa estar verificado lá.
// Server-only: nunca importar de componentes do navegador.

import { enviarPorSmtp, smtpConfigurado } from './smtp';

export interface EmailSaida {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** Anexos com conteúdo em base64 (sem o prefixo "data:...;base64,"). */
  attachments?: { filename: string; content: string; contentType?: string }[];
  /** Evita envio duplicado em novas tentativas (o Resend guarda a chave por 24 h; o SMTP ignora). */
  idempotencyKey?: string;
}

export class ErroEmail extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function remetentePadrao(): string {
  const from = process.env['EMAIL_FROM'] || process.env['SMTP_USER'];
  if (!from) throw new ErroEmail(500, 'EMAIL_FROM não configurado');
  return from;
}

export async function enviarEmail(email: EmailSaida): Promise<{ id: string }> {
  if (smtpConfigurado()) {
    try {
      return { id: await enviarPorSmtp(email, email.from ?? remetentePadrao()) };
    } catch (e: any) {
      if (e instanceof ErroEmail) throw e;
      console.error('[email] SMTP recusou o envio:', e?.code, e?.response ?? e?.message);
      const msg =
        e?.code === 'EAUTH'
          ? 'Usuário ou senha do SMTP recusados (SMTP_USER/SMTP_PASS)'
          : e?.code === 'ECONNECTION' || e?.code === 'ETIMEDOUT' || e?.code === 'ESOCKET'
            ? `Sem conexão com o servidor SMTP (${process.env['SMTP_HOST']})`
            : e?.response || e?.message || 'Falha no envio por SMTP';
      throw new ErroEmail(502, msg);
    }
  }

  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) throw new ErroEmail(500, 'E-mail não configurado: defina SMTP_HOST ou RESEND_API_KEY');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (email.idempotencyKey) headers['Idempotency-Key'] = email.idempotencyKey.slice(0, 256);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: email.from ?? remetentePadrao(),
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      reply_to: email.replyTo,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType,
      })),
    }),
  });

  const corpo: any = await resp.json().catch(() => null);
  if (!resp.ok) {
    console.error('[email] Resend recusou o envio:', resp.status, corpo);
    throw new ErroEmail(resp.status, corpo?.message || `Resend retornou ${resp.status}`);
  }
  return { id: corpo?.id };
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Confere a assinatura de um webhook no padrão Standard Webhooks/Svix, usado pelo Resend
 * (cabeçalhos svix-*) e pelo hook de envio de e-mail do Supabase Auth (cabeçalhos webhook-*).
 * O segredo vem como "whsec_<base64>" (Resend) ou "v1,whsec_<base64>" (Supabase).
 * `corpo` é o texto cru da requisição, antes de qualquer JSON.parse.
 */
export async function assinaturaWebhookValida(
  req: Request,
  corpo: string,
  segredo: string,
): Promise<boolean> {
  const cabecalho = (nome: string) =>
    req.headers.get(`webhook-${nome}`) ?? req.headers.get(`svix-${nome}`);
  const id = cabecalho('id');
  const timestamp = cabecalho('timestamp');
  const assinaturas = cabecalho('signature');
  if (!id || !timestamp || !assinaturas) return false;
  // Rejeita mensagens com mais de 5 minutos de diferença (reenvio de requisição capturada).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const base64 = segredo.replace(/^v1,/, '').replace(/^whsec_/, '');
  const chave = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const assinatura = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${corpo}`),
  );
  const esperado = btoa(String.fromCharCode(...new Uint8Array(assinatura)));
  return assinaturas.split(' ').some((s) => iguais(s.split(',')[1] ?? '', esperado));
}
