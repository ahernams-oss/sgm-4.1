import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { enviarEmail } from "@/lib/email/resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, htmlBody, pdfBase64, pdfFilename } = await req.json();

    if (!to || !subject || !htmlBody) {
      return new Response(
        JSON.stringify({ success: false, error: 'to, subject e htmlBody são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending email to: ${to}, subject: ${subject}`);
    console.log(`PDF attached: ${pdfFilename || 'none'}`);

    const { id } = await enviarEmail({
      to,
      subject,
      html: htmlBody,
      attachments: pdfBase64 ? [{
        filename: pdfFilename || 'ordem_compra.pdf',
        content: pdfBase64.replace(/^data:application\/pdf;base64,/, ''),
        contentType: 'application/pdf',
      }] : undefined,
    });

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
