import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { exigirAcesso, podeModulo, pode } from "@/lib/edge/permissao";
import { emailsCadastrados, telefoneCadastrado, sanitizarHtmlEmail, MSG_DESTINO_NAO_CADASTRADO } from "@/lib/edge/fns/_shared/destinatarios";
import { enviarEmail } from "@/lib/email/resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const acesso = await exigirAcesso(req);
  if (!acesso.ok) return acesso.resposta;

  try {
    const { to, subject, htmlBody } = await req.json();

    if (!to || !subject || !htmlBody) {
      return new Response(
        JSON.stringify({ success: false, error: 'to, subject e htmlBody são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!(await emailsCadastrados(to))) return new Response(JSON.stringify({ success: false, error: MSG_DESTINO_NAO_CADASTRADO }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { id } = await enviarEmail({ to, subject: String(subject).slice(0, 300), html: sanitizarHtmlEmail(htmlBody) });

    return new Response(
      JSON.stringify({ success: true, id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

export default __slot.dispatch;
