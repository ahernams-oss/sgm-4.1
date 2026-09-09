import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const today = new Date();
    const d10 = new Date(today); d10.setDate(d10.getDate() + 10);
    const d20 = new Date(today); d20.setDate(d20.getDate() + 20);
    const d30 = new Date(today); d30.setDate(d30.getDate() + 30);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const { data: exames, error } = await supabase
      .from('exames_periodicos')
      .select('*')
      .lte('data_vencimento', formatDate(d30))
      .gte('data_vencimento', formatDate(today));

    if (error) throw error;
    if (!exames || exames.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum exame próximo do vencimento.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const exame of exames) {
      const vencimento = new Date(exame.data_vencimento);
      const diffDays = Math.ceil((vencimento.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      let shouldNotify = false;
      let notifyField = '';
      let diasLabel = '';

      if (diffDays <= 10 && !exame.notificado_10d) {
        shouldNotify = true;
        notifyField = 'notificado_10d';
        diasLabel = '10 dias';
      } else if (diffDays <= 20 && diffDays > 10 && !exame.notificado_20d) {
        shouldNotify = true;
        notifyField = 'notificado_20d';
        diasLabel = '20 dias';
      } else if (diffDays <= 30 && diffDays > 20 && !exame.notificado_30d) {
        shouldNotify = true;
        notifyField = 'notificado_30d';
        diasLabel = '30 dias';
      }

      if (!shouldNotify) continue;

      const vencFormatado = exame.data_vencimento.split('-').reverse().join('/');
      const mensagem = `⚠️ AVISO - Exame Periódico\n\nO exame "${exame.tipo_exame}" do funcionário ${exame.funcionario_nome} vence em ${diasLabel} (${vencFormatado}).\n\nProvidenciar agendamento com urgência.`;

      if (PLUGSEND_TOKEN && exame.funcionario_telefone) {
        const telefoneLimpo = exame.funcionario_telefone.replace(/\D/g, '');
        if (telefoneLimpo.length >= 10) {
          try {
            await fetch('https://plugsend.uazapi.com/send/text', {
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

      if (exame.funcionario_email) {
        try {
          const emailBody = mensagem.replace(/\n/g, '<br>');
          console.log(`Email para ${exame.funcionario_email}: ${emailBody}`);
        } catch (emailErr) {
          console.error('Email error:', emailErr);
        }
      }

      await supabase
        .from('exames_periodicos')
        .update({ [notifyField]: true })
        .eq('id', exame.id);

      results.push({
        funcionario: exame.funcionario_nome,
        exame: exame.tipo_exame,
        vencimento: vencFormatado,
        aviso: diasLabel,
      });
    }

    return new Response(JSON.stringify({ success: true, notificados: results.length, detalhes: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error checking exames:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export default __slot.dispatch;
