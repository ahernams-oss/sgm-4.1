import { createFileRoute } from '@tanstack/react-router';

// Ponte que mantém as chamadas antigas (supabase.functions.invoke) funcionando:
// cada função de servidor do SGM foi portada para src/lib/edge/fns e é executada aqui.

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, PATCH, DELETE',
};

// Funções que o sistema original expunha sem verificação de credencial.
const SEM_CREDENCIAL = new Set([
  'analisar-edital-licitacao',
  'assinatura-otp',
  'auth-email-hook',
  'check-oc-entrega-atrasada',
  'check-parcelas-vencimento',
  'epi-devolucao-publico',
  'epi-recebimento-publico',
  'kb-embedding',
  'kb-search',
  'preview-transactional-email',
  'send-email-senha-temporaria',
  'send-email-mapa-ferias',
  'send-email-compras',
  'nfe-webhook',
  'handle-email-events',
  'portal-api',
]);

function credencialValida(request: Request): boolean {
  const apikey =
    request.headers.get('apikey') ??
    (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!apikey) return false;
  const publica =
    process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? '';
  if (publica && apikey === publica) return true;
  // Token de usuário autenticado (JWT emitido pelo Supabase).
  return apikey.split('.').length === 3;
}

async function handle({ request, params }: { request: Request; params: { name: string } }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const { edgeFunctions } = await import('@/lib/edge/registry');
  const loader = edgeFunctions[params.name];
  if (!loader) {
    return new Response(JSON.stringify({ error: `Função ${params.name} não encontrada` }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!SEM_CREDENCIAL.has(params.name) && !credencialValida(request)) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const mod = await loader();
    const resposta = await mod.default(request);
    const headers = new Headers(resposta.headers);
    for (const [k, v] of Object.entries(corsHeaders)) if (!headers.has(k)) headers.set(k, v);
    return new Response(resposta.body, { status: resposta.status, headers });
  } catch (error) {
    console.error(`[edge:${params.name}]`, error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export const Route = createFileRoute('/api/public/edge/$name')({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
});
