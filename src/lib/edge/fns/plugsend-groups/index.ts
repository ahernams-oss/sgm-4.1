import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from '@/lib/edge/cors';

const BASE = 'https://plugsend.uazapi.com';

function sanitize(n: string) {
  return String(n || '').replace(/\D/g, '');
}

async function call(path: string, method: 'GET' | 'POST', token: string, body?: any, query?: Record<string, string>) {
  let url = `${BASE}${path}`;
  if (query && Object.keys(query).length) {
    url += '?' + new URLSearchParams(query).toString();
  }
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', token },
  };
  if (body !== undefined && method !== 'GET') init.body = JSON.stringify(body);
  const r = await fetch(url, init);
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* raw */ }
  return { ok: r.ok, status: r.status, body: parsed, raw: text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('PLUGSEND_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'PLUGSEND_TOKEN não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json().catch(() => ({} as any));
    const { action } = payload as { action?: string };
    if (!action) {
      return new Response(JSON.stringify({ success: false, error: 'action obrigatória' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: { ok: boolean; status: number; body: any };

    switch (action) {
      case 'create': {
        const { name, participants } = payload as { name?: string; participants?: string[] };
        if (!name || !Array.isArray(participants) || participants.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'name e participants são obrigatórios' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await call('/group/create', 'POST', token, {
          name: name.slice(0, 100),
          participants: participants.map(sanitize).filter(Boolean),
        });
        break;
      }
      case 'list': {
        const { force, noparticipants } = payload as { force?: boolean; noparticipants?: boolean };
        const q: Record<string, string> = {};
        if (force) q.force = 'true';
        if (noparticipants) q.noparticipants = 'true';
        result = await call('/group/list', 'GET', token, undefined, q);
        break;
      }
      case 'info': {
        const { groupjid, getInviteLink, force } = payload as any;
        if (!groupjid) return new Response(JSON.stringify({ success: false, error: 'groupjid obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        result = await call('/group/info', 'POST', token, { groupjid, getInviteLink: !!getInviteLink, force: !!force });
        break;
      }
      case 'addParticipants':
      case 'removeParticipants':
      case 'promote':
      case 'demote': {
        const map: Record<string, string> = {
          addParticipants: 'add', removeParticipants: 'remove', promote: 'promote', demote: 'demote',
        };
        const { groupjid, participants } = payload as { groupjid?: string; participants?: string[] };
        if (!groupjid || !Array.isArray(participants) || participants.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'groupjid e participants obrigatórios' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        result = await call('/group/updateParticipants', 'POST', token, {
          groupjid, action: map[action], participants: participants.map(sanitize).filter(Boolean),
        });
        break;
      }
      case 'updateName': {
        const { groupjid, name } = payload as any;
        if (!groupjid || !name) return new Response(JSON.stringify({ success: false, error: 'groupjid e name obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        result = await call('/group/updateName', 'POST', token, { groupjid, name: String(name).slice(0, 25) });
        break;
      }
      case 'leave': {
        const { groupjid } = payload as any;
        if (!groupjid) return new Response(JSON.stringify({ success: false, error: 'groupjid obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        result = await call('/group/leave', 'POST', token, { groupjid });
        break;
      }
      default:
        return new Response(JSON.stringify({ success: false, error: `action desconhecida: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (!result.ok) {
      return new Response(JSON.stringify({ success: false, error: `PlugSend [${result.status}]`, details: result.body }), {
        status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true, data: result.body }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

export default __slot.dispatch;
