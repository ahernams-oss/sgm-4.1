import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import { enviarComLog } from "../_shared/transactional-email-templates/log-send.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const PLUGSEND_TOKEN = Deno.env.get('PLUGSEND_TOKEN');

    const today = new Date();
    const d30 = new Date(today); d30.setDate(d30.getDate() + 30);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    const { data: equipamentos, error } = await supabase
      .from('equipamentos')
      .select('*')
      .eq('requer_calibracao', true)
      .not('validade_calibracao', 'is', null)
      .lte('validade_calibracao', fmt(d30))
      .gte('validade_calibracao', fmt(today));

    if (error) throw error;
    if (!equipamentos || equipamentos.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhuma calibração próxima do vencimento.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: any[] = [];

    for (const eq of equipamentos) {
      const venc = new Date(eq.validade_calibracao);
      const dias = Math.ceil((venc.getTime() - today.getTime()) / 86400000);
      let field = '', label = '';
      if (dias <= 7 && !eq.calibracao_notificado_7d) { field = 'calibracao_notificado_7d'; label = '7 dias'; }
      else if (dias <= 15 && dias > 7 && !eq.calibracao_notificado_15d) { field = 'calibracao_notificado_15d'; label = '15 dias'; }
      else if (dias <= 30 && dias > 15 && !eq.calibracao_notificado_30d) { field = 'calibracao_notificado_30d'; label = '30 dias'; }
      if (!field) continue;

      const vencFmt = eq.validade_calibracao.split('-').reverse().join('/');
      const mensagem = `⚠️ AVISO - Calibração de Equipamento\n\nO equipamento "${eq.equipamento}"${eq.tag ? ` (TAG: ${eq.tag})` : ''} — Cliente ${eq.cliente_nome} — vence a calibração em ${label} (${vencFmt}).\n\n${eq.laboratorio_calibracao ? `Laboratório: ${eq.laboratorio_calibracao}\n` : ''}Providenciar agendamento.`;

      // WhatsApp
      if (PLUGSEND_TOKEN && eq.telefone_responsavel_calibracao) {
        const tel = String(eq.telefone_responsavel_calibracao).replace(/\D/g, '');
        if (tel.length >= 10) {
          try {
            await fetch('https://plugsend.uazapi.com/send/text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', token: PLUGSEND_TOKEN },
              body: JSON.stringify({ number: tel, text: mensagem, linkPreview: true }),
            });
          } catch (e) { console.error('WhatsApp:', e); }
        }
      }

      // Email
      if (eq.email_responsavel_calibracao) {
        try {
          await enviarComLog('calibracao-vencimento', eq.email_responsavel_calibracao, () =>
            sendTemplateEmail('calibracao-vencimento', eq.email_responsavel_calibracao, {
              idempotencyKey: `calib-${eq.id}-${field}`,
              templateData: {
                equipamento: eq.equipamento, tag: eq.tag || '', cliente: eq.cliente_nome,
                vencimento: vencFmt, diasRestantes: label, laboratorio: eq.laboratorio_calibracao || '',
              },
            })
          );
        } catch (e) { console.error('Email:', e); }
      }

      await supabase.from('equipamentos').update({ [field]: true }).eq('id', eq.id);
      results.push({ equipamento: eq.equipamento, vencimento: vencFmt, aviso: label });
    }

    return new Response(JSON.stringify({ success: true, notificados: results.length, detalhes: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

export default __slot.dispatch;
