import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Lê registros da tabela auditoria com service_role (RLS bypass controlado).
// A listagem NÃO traz os snapshots JSONB (dados_antes/dados_depois) para evitar
// estouro de memória; o detalhe é carregado sob demanda via { id }.
// A paginação é feita no servidor (range) e retorna o total para a UI.
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

const LIST_COLS =
  "id,created_at,usuario_id,usuario_nome,usuario_email,modulo,acao,entidade_id,entidade_descricao";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const { dataIni, dataFim, id, modulo, acao, busca } = body ?? {};
    // Origem: "atual" (tabela de auditoria) ou "historico" (registros arquivados a cada 15 dias)
    const TABELA = body?.origem === "historico" ? "auditoria_historico" : "auditoria";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Detalhe de um único registro (com snapshots completos)
    if (id) {
      const { data, error } = await admin.from(TABELA).select("*").eq("id", id).maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, data });
    }

    const pageSize = Math.min(Math.max(Number(body?.pageSize) || 20, 1), 100);
    const page = Math.max(Number(body?.page) || 1, 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = admin
      .from(TABELA)
      .select(LIST_COLS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (dataIni) q = q.gte("created_at", new Date(dataIni + "T00:00:00").toISOString());
    if (dataFim) q = q.lte("created_at", new Date(dataFim + "T23:59:59").toISOString());
    if (modulo && modulo !== "todos") q = q.eq("modulo", modulo);
    if (acao && acao !== "todos") q = q.eq("acao", acao);
    if (busca && String(busca).trim()) {
      const t = String(busca).trim().replace(/[%,()]/g, " ");
      q = q.or(
        `usuario_nome.ilike.%${t}%,usuario_email.ilike.%${t}%,entidade_descricao.ilike.%${t}%,entidade_id.ilike.%${t}%`,
      );
    }

    const { data, error, count } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);

    // Resumo (contagens por ação) usando HEAD counts — não carrega linhas.
    let resumo: Record<string, number> | undefined;
    if (body?.resumo !== false) {
      const base = () => {
        let c = admin.from(TABELA).select("id", { count: "exact", head: true });
        if (dataIni) c = c.gte("created_at", new Date(dataIni + "T00:00:00").toISOString());
        if (dataFim) c = c.lte("created_at", new Date(dataFim + "T23:59:59").toISOString());
        if (modulo && modulo !== "todos") c = c.eq("modulo", modulo);
        return c;
      };
      const [i, u, d] = await Promise.all([
        base().eq("acao", "insert"),
        base().eq("acao", "update"),
        base().eq("acao", "delete"),
      ]);
      resumo = { insert: i.count ?? 0, update: u.count ?? 0, delete: d.count ?? 0 };
    }

    return json({ ok: true, data, total: count ?? 0, page, pageSize, resumo });

  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

export default __slot.dispatch;
