import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JANELAS: { dias: number; campo: string; titulo: string }[] = [
  { dias: 10, campo: 'notificado_10d', titulo: 'LEMBRETE DE AUDIÊNCIA - 10 DIAS' },
  { dias: 7, campo: 'notificado_7d', titulo: 'LEMBRETE DE AUDIÊNCIA - 7 DIAS' },
  { dias: 5, campo: 'notificado_5d', titulo: 'LEMBRETE DE AUDIÊNCIA - 5 DIAS' },
  { dias: 2, campo: 'notificado_2d', titulo: 'URGENTE - AUDIÊNCIA EM 2 DIAS' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const plugsendToken = Deno.env.get('PLUGSEND_TOKEN');

    if (!plugsendToken) {
      throw new Error('PLUGSEND_TOKEN não configurado');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: contatos, error: errContatos } = await supabase
      .from('juridico_contatos_notificacao')
      .select('*')
      .eq('ativo', true);

    if (errContatos) throw errContatos;
    if (!contatos || contatos.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum contato ativo para notificação' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    let enviados = 0;
    const detalhes: Record<string, number> = {};

    const enviarWhatsApp = async (telefone: string, mensagem: string) => {
      const telefoneLimpo = telefone.replace(/\D/g, '');
      if (!telefoneLimpo) return;
      await fetch('https://plugsend.uazapi.com/send/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: plugsendToken },
        body: JSON.stringify({ number: telefoneLimpo, text: mensagem, linkPreview: true }),
      });
      enviados++;
    };

    for (const j of JANELAS) {
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + j.dias);

      const { data: auds } = await supabase
        .from('juridico_audiencias')
        .select('*')
        .eq('status', 'Agendada')
        .eq(j.campo, false)
        .lte('data_audiencia', fmt(limite))
        .gte('data_audiencia', fmt(hoje));

      detalhes[j.campo] = (auds || []).length;

      for (const aud of (auds || [])) {
        const dataFormatada = new Date(aud.data_audiencia + 'T12:00:00').toLocaleDateString('pt-BR');
        const msg = `⚖️ *${j.titulo}*\n\n` +
          `Processo: *${aud.processo_numero}*\n` +
          `Tipo: ${aud.tipo}\n` +
          `Data: *${dataFormatada}*${aud.hora ? ` às ${aud.hora}` : ''}\n` +
          `Local: ${aud.local || 'Não informado'}\n` +
          `Vara: ${aud.vara || 'Não informada'}\n` +
          `${aud.observacoes ? `Obs: ${aud.observacoes}` : ''}`;

        for (const contato of contatos) {
          if (contato.telefone_whatsapp) {
            await enviarWhatsApp(contato.telefone_whatsapp, msg);
          }
        }

        await supabase
          .from('juridico_audiencias')
          .update({ [j.campo]: true })
          .eq('id', aud.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, enviados, detalhes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Erro ao verificar audiências:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export default __slot.dispatch;
