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
    const d10 = new Date(today);
    d10.setDate(d10.getDate() + 10);

    const { data: funcionarios, error } = await supabase
      .from('funcionarios')
      .select('*')
      .eq('status', 'Ativo')
      .not('experiencia_fim', 'is', null);

    if (error) throw error;
    if (!funcionarios || funcionarios.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum funcionário em experiência.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const func of funcionarios) {
      if (func.experiencia_primeira_etapa && !func.experiencia_notificado_10d_primeira) {
        const fim1 = new Date(func.experiencia_primeira_etapa);
        const diff1 = Math.ceil((fim1.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diff1 >= 0 && diff1 <= 10) {
          const vencFormatado = func.experiencia_primeira_etapa.split('-').reverse().join('/');
          const mensagem = `⚠️ AVISO - Período de Experiência\n\nO 1º período de experiência (45 dias) do funcionário ${func.nome} vence em ${diff1} dias (${vencFormatado}).\n\nProvidenciar avaliação e decisão sobre renovação.`;

          await sendWhatsApp(PLUGSEND_TOKEN, func.telefone, mensagem);

          await supabase
            .from('funcionarios')
            .update({ experiencia_notificado_10d_primeira: true })
            .eq('id', func.id);

          results.push({ funcionario: func.nome, etapa: '1ª etapa', dias: diff1 });
        }
      }

      if (func.experiencia_renovado && func.experiencia_fim && !func.experiencia_notificado_10d_final) {
        const fimFinal = new Date(func.experiencia_fim);
        const diffFinal = Math.ceil((fimFinal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffFinal >= 0 && diffFinal <= 10) {
          const vencFormatado = func.experiencia_fim.split('-').reverse().join('/');
          const mensagem = `⚠️ AVISO - Período de Experiência\n\nO 2º período de experiência (90 dias) do funcionário ${func.nome} vence em ${diffFinal} dias (${vencFormatado}).\n\nProvidenciar efetivação ou desligamento.`;

          await sendWhatsApp(PLUGSEND_TOKEN, func.telefone, mensagem);

          await supabase
            .from('funcionarios')
            .update({ experiencia_notificado_10d_final: true })
            .eq('id', func.id);

          results.push({ funcionario: func.nome, etapa: '2ª etapa', dias: diffFinal });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notificados: results.length, detalhes: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error checking experiência:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendWhatsApp(token: string | undefined, telefone: string | null, mensagem: string) {
  if (!token || !telefone) return;
  const telefoneLimpo = telefone.replace(/\D/g, '');
  if (telefoneLimpo.length < 10) return;
  try {
    await fetch('https://plugsend.uazapi.com/send/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify({ number: telefoneLimpo, text: mensagem, linkPreview: true }),
    });
  } catch (err) {
    console.error('WhatsApp error:', err);
  }
}

export default __slot.dispatch;
