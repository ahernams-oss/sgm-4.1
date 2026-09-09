import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from '@/lib/edge/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('PLUGSEND_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'PLUGSEND_TOKEN não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { telefone, mensagem, documentUrl, documentFilename } = body as {
      telefone?: string;
      mensagem?: string;
      documentUrl?: string;
      documentFilename?: string;
    };

    if (!telefone) {
      return new Response(JSON.stringify({ success: false, error: 'telefone obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const numero = String(telefone).replace(/\D/g, '');
    const results: any[] = [];

    // 1) Envia texto (se houver)
    if (mensagem && mensagem.trim()) {
      const r = await fetch('https://plugsend.uazapi.com/send/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify({ number: numero, text: mensagem, linkPreview: true }),
      });
      const t = await r.text();
      if (!r.ok) {
        return new Response(JSON.stringify({ success: false, error: `PlugSend text [${r.status}]: ${t}` }), {
          status: r.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try { results.push(JSON.parse(t)); } catch { results.push({ raw: t }); }
    }

    // 2) Envia documento (se houver)
    if (documentUrl) {
      const r = await fetch('https://plugsend.uazapi.com/send/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify({
          number: numero,
          type: 'document',
          file: documentUrl,
          docName: documentFilename || 'documento.pdf',
        }),
      });
      const t = await r.text();
      if (!r.ok) {
        return new Response(JSON.stringify({ success: false, error: `PlugSend media [${r.status}]: ${t}` }), {
          status: r.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try { results.push(JSON.parse(t)); } catch { results.push({ raw: t }); }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export default __slot.dispatch;
