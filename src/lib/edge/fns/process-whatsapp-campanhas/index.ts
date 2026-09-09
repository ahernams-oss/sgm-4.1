import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function calcularProximoEnvio(modo: string, recorrencia: string | null, dias: number[], hora: string | null): string | null {
  if (modo !== 'recorrente' || !hora) return null;
  const [h, m] = hora.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const cand = new Date(now);
    cand.setDate(now.getDate() + i);
    cand.setHours(h, m, 0, 0);
    if (recorrencia === 'diaria') return cand.toISOString();
    if (recorrencia === 'semanal' && dias.includes(cand.getDay())) return cand.toISOString();
  }
  return null;
}

async function enviarParaCampanha(supabase: any, campanha: any) {
  const { data: funcionarios } = await supabase
    .from('funcionarios')
    .select('id,nome,telefone_whatsapp,status')
    .neq('status', 'Inativo');

  const destinatarios = (funcionarios || []).filter((f: any) => {
    const t = (f.telefone_whatsapp || '').replace(/\D/g, '');
    return t.length >= 10;
  });

  let sucesso = 0, erro = 0;
  for (const f of destinatarios) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ telefone: f.telefone_whatsapp, mensagem: campanha.mensagem }),
      });
      const json = await resp.json();
      const ok = !!json.success;
      await supabase.from('whatsapp_envios').insert({
        campanha_id: campanha.id, funcionario_id: f.id, funcionario_nome: f.nome,
        telefone: f.telefone_whatsapp, sucesso: ok, erro: ok ? null : (json.error || 'Erro desconhecido'),
      });
      if (ok) sucesso++; else erro++;
    } catch (e: any) {
      erro++;
      await supabase.from('whatsapp_envios').insert({
        campanha_id: campanha.id, funcionario_id: f.id, funcionario_nome: f.nome,
        telefone: f.telefone_whatsapp, sucesso: false, erro: String(e?.message || e),
      });
    }
  }

  const proximo = calcularProximoEnvio(campanha.modo, campanha.recorrencia, campanha.dias_semana || [], campanha.hora_envio);
  await supabase.from('whatsapp_campanhas').update({
    ultimo_envio_em: new Date().toISOString(),
    total_destinatarios: destinatarios.length,
    total_sucesso: sucesso,
    total_erro: erro,
    proximo_envio: proximo,
    ativo: campanha.modo === 'recorrente' ? campanha.ativo : false,
  }).eq('id', campanha.id);

  return { destinatarios: destinatarios.length, sucesso, erro };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const campanhaId: string | undefined = body.campanha_id;

    if (campanhaId) {
      const { data: c, error } = await supabase.from('whatsapp_campanhas').select('*').eq('id', campanhaId).single();
      if (error || !c) throw new Error('Campanha não encontrada');
      const r = await enviarParaCampanha(supabase, c);
      return new Response(JSON.stringify({ success: true, ...r }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cron: roda todas devidas
    const nowIso = new Date().toISOString();
    const { data: pendentes } = await supabase
      .from('whatsapp_campanhas')
      .select('*')
      .eq('ativo', true)
      .not('proximo_envio', 'is', null)
      .lte('proximo_envio', nowIso);

    const results: any[] = [];
    for (const c of pendentes || []) {
      const r = await enviarParaCampanha(supabase, c);
      results.push({ id: c.id, ...r });
    }
    return new Response(JSON.stringify({ success: true, processadas: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export default __slot.dispatch;
