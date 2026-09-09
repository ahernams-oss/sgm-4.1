import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const PLUGSEND_TOKEN = Deno.env.get('PLUGSEND_TOKEN');
    if (!PLUGSEND_TOKEN) {
      throw new Error('PLUGSEND_TOKEN não configurado');
    }

    const today = new Date();
    const d15 = new Date(today);
    d15.setDate(d15.getDate() + 15);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const { data: documentos, error } = await supabase
      .from('licitacoes_documentos')
      .select('*')
      .lte('data_validade', formatDate(d15))
      .gte('data_validade', formatDate(today))
      .neq('status', 'Vencido');

    if (error) throw error;

    if (!documentos || documentos.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum documento próximo do vencimento (15 dias).',
        notificados: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: telefones, error: telError } = await supabase
      .from('licitacoes_telefones_notificacao')
      .select('telefone');

    if (telError) throw telError;

    const numbers = (telefones || []).map((t: any) => t.telefone).filter(Boolean);

    if (numbers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum telefone cadastrado para notificação.',
        notificados: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];
    const plugsendUrl = 'https://plugsend.uazapi.com/send/text';

    for (const doc of documentos) {
      const vencimento = new Date(doc.data_validade);
      const diffDays = Math.ceil((vencimento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const vencFormatado = doc.data_validade.split('-').reverse().join('/');

      const mensagem = `⚠️ AVISO - Documento de Licitação\n\nO documento "${doc.nome}" (${doc.categoria || 'Sem categoria'}) vence em ${diffDays} dia(s) (${vencFormatado}).\n\nEmissor: ${doc.orgao_emissor || 'Não informado'}\nStatus atual: ${doc.status}\n\nProvidenciar renovação com urgência.`;

      for (const numero of numbers) {
        const telefoneLimpo = numero.replace(/\D/g, '');
        if (telefoneLimpo.length >= 10) {
          try {
            await fetch(plugsendUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                token: PLUGSEND_TOKEN,
              },
              body: JSON.stringify({ number: telefoneLimpo, text: mensagem, linkPreview: true }),
            });
          } catch (whatsErr) {
            console.error('WhatsApp error:', whatsErr);
          }
        }
      }

      results.push({
        documento: doc.nome,
        categoria: doc.categoria,
        vencimento: vencFormatado,
        diasRestantes: diffDays,
        destinatarios: numbers.length,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      notificados: results.length, 
      detalhes: results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error checking documentos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export default __slot.dispatch;
