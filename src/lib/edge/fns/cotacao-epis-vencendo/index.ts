import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTECEDENCIA_DIAS = 50;
const MAX_FORNECEDORES = 5;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://app.lasant.com.br";

function brtToday(): { dateStr: string; hour: number; minute: number } {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return { dateStr: `${y}-${m}-${d}`, hour: brt.getUTCHours(), minute: brt.getUTCMinutes() };
}

function daysBetween(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + "T00:00:00Z").getTime();
  const b = new Date(String(toStr).slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function ehLinhaEpi(linhas: unknown): boolean {
  const arr = Array.isArray(linhas) ? linhas : [];
  return arr.some((l) => {
    const txt = norm(`${(l as Record<string, unknown>)?.descricao ?? ""} ${(l as Record<string, unknown>)?.codigo ?? ""} ${(l as Record<string, unknown>)?.observacao ?? ""}`);
    return (
      txt.includes("epi") ||
      txt.includes("equipamento de protecao") ||
      txt.includes("protecao individual") ||
      txt.includes("seguranca do trabalho")
    );
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { dateStr: today, hour, minute } = brtToday();
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    const hm = hour * 60 + minute;
    if (!force && Math.abs(hm - 9 * 60) > 15) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "fora do horário de disparo (09:00 BRT)", hour, minute }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) EPIs que vencem em exatamente 50 dias
    const { data: funcionarios } = await supabase
      .from("funcionarios")
      .select("nome, cargo, epis");

    type Item = { descricao: string; ca: string; quantidade: number; funcionarios: string[]; vencimentos: string[] };
    const mapa = new Map<string, Item>();

    for (const f of (funcionarios || []) as Array<{ nome: string; epis?: unknown }>) {
      const epis = (f.epis as Array<Record<string, string>>) || [];
      for (const epi of epis) {
        if (!epi?.dataVencimento) continue;
        if (daysBetween(today, epi.dataVencimento) !== ANTECEDENCIA_DIAS) continue;
        const descricao = epi.descricao || "EPI";
        const ca = epi.ca || "";
        const key = `${norm(descricao)}|${ca}`;
        const atual = mapa.get(key) || { descricao, ca, quantidade: 0, funcionarios: [], vencimentos: [] };
        atual.quantidade += 1;
        atual.funcionarios.push(f.nome);
        atual.vencimentos.push(String(epi.dataVencimento).slice(0, 10));
        mapa.set(key, atual);
      }
    }

    const itensEpi = [...mapa.values()];
    if (itensEpi.length === 0) {
      return new Response(JSON.stringify({ data: today, itens: 0, cotacao: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Fornecedores com linha de fornecimento de EPI (até 5)
    const { data: cadastros } = await supabase
      .from("clientes")
      .select("id, nome, email, email_compras, telefone, telefone_celular, celulares, grupo_whatsapp, linhas_fornecimento, tipo")
      .eq("tipo", "Fornecedor");

    const fornecedores = ((cadastros || []) as Array<Record<string, unknown>>)
      .filter((c) => ehLinhaEpi(c.linhas_fornecimento))
      .slice(0, MAX_FORNECEDORES);

    if (fornecedores.length === 0) {
      return new Response(
        JSON.stringify({ data: today, itens: itensEpi.length, cotacao: null, aviso: "Nenhum fornecedor com linha de fornecimento de EPI" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Requisição de compras automática
    const { data: ultReq } = await supabase
      .from("requisicoes_compras").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
    const numeroReq = ((ultReq as { numero?: number } | null)?.numero || 0) + 1;

    const dataVencMin = itensEpi.flatMap((i) => i.vencimentos).sort()[0];
    const itensReq = itensEpi.map((i) => ({
      id: crypto.randomUUID(),
      materialId: "",
      descricao: `${i.descricao}${i.ca ? ` (CA ${i.ca})` : ""}`,
      especificacaoTecnica: "",
      observacao: `Reposição — vencimento em ${ANTECEDENCIA_DIAS} dias. Colaboradores: ${[...new Set(i.funcionarios)].join(", ")}`,
      quantidade: i.quantidade,
      unidadeMedida: "UN",
      anexo: null,
    }));

    const nowIso = new Date().toISOString();
    const solicitante = "Sistema — Segurança do Trabalho";

    const { data: reqRow, error: reqErr } = await supabase
      .from("requisicoes_compras")
      .insert({
        numero: numeroReq,
        data_criacao: nowIso,
        solicitante,
        centro_custo: "",
        centro_custo_nome: "Segurança do Trabalho",
        local_entrega: "",
        justificativa: `Reposição automática de EPIs com vencimento em ${ANTECEDENCIA_DIAS} dias (a partir de ${dataVencMin?.split("-").reverse().join("/")}).`,
        urgencia: "Alta",
        prazo_desejado: dataVencMin || "",
        status: "Em Cotação",
        itens: itensReq,
        anexos: [],
        historico_status: [
          { status: "Enviada", dataHora: nowIso, usuario: solicitante, observacao: "Requisição gerada automaticamente (EPIs a vencer em 50 dias)" },
          { status: "Em Cotação", dataHora: nowIso, usuario: solicitante, observacao: "Cotação automática enviada aos fornecedores de EPI" },
        ],
      })
      .select("id, numero")
      .single();
    if (reqErr) throw reqErr;

    // 4) Cotação
    const { data: ultCot } = await supabase
      .from("cotacoes_compras").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
    const numeroCot = ((ultCot as { numero?: number } | null)?.numero || 0) + 1;

    const { data: cotRow, error: cotErr } = await supabase
      .from("cotacoes_compras")
      .insert({
        requisicao_id: reqRow!.id,
        requisicao_numero: reqRow!.numero,
        numero: numeroCot,
        data_criacao: nowIso,
        comprador: solicitante,
        status: "Em Andamento",
        propostas: [],
        fornecedor_vencedor_id: "",
        justificativa_escolha: "",
        itens_vencedores: [],
      })
      .select("id, numero")
      .single();
    if (cotErr) throw cotErr;

    // 5) Convites + envio por e-mail/WhatsApp
    const itensConvite = itensReq.map((i) => ({
      itemId: i.id, descricao: i.descricao, quantidade: i.quantidade, unidadeMedida: i.unidadeMedida,
    }));

    const enviados: Array<{ fornecedor: string; email: string; link: string; emailEnviado: boolean; whatsappEnviado: boolean; erro?: string }> = [];

    for (const f of fornecedores) {
      const nome = String(f.nome || "Fornecedor");
      const email = String(f.email_compras || f.email || "").trim();
      try {
        const { data: convite, error: convErr } = await supabase
          .from("cotacao_convites")
          .insert({
            cotacao_id: cotRow!.id,
            cotacao_numero: cotRow!.numero,
            fornecedor_id: String(f.id),
            fornecedor_nome: nome,
            fornecedor_email: email,
            comprador: solicitante,
            itens: itensConvite,
          })
          .select("token")
          .single();
        if (convErr) throw convErr;

        const link = `${APP_BASE_URL}/cotacao/proposta/${convite!.token}`;

        const linhasHtml = itensConvite
          .map((i) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.descricao}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${i.quantidade}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${i.unidadeMedida}</td></tr>`)
          .join("");

        let emailEnviado = false;
        if (email) {
          const { error: mailErr } = await supabase.functions.invoke("send-email-cotacao", {
            body: {
              to: email,
              subject: `Pedido de Cotação COT-${String(cotRow!.numero).padStart(4, "0")} — EPIs`,
              htmlBody: `
                <div style="font-family:Arial,sans-serif;color:#1f2937">
                  <h2 style="color:#1e3a5f">Pedido de Cotação — EPIs</h2>
                  <p>Prezado(a) <strong>${nome}</strong>,</p>
                  <p>Solicitamos proposta comercial para os EPIs abaixo, cuja substituição está prevista por vencimento em ${ANTECEDENCIA_DIAS} dias.</p>
                  <table style="border-collapse:collapse;width:100%;font-size:14px">
                    <thead><tr style="background:#1e3a5f;color:#fff">
                      <th style="padding:8px 10px;text-align:left">Item</th>
                      <th style="padding:8px 10px">Qtd.</th>
                      <th style="padding:8px 10px">Un.</th>
                    </tr></thead>
                    <tbody>${linhasHtml}</tbody>
                  </table>
                  <p style="margin-top:20px">
                    <a href="${link}" style="background:#673ab7;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Enviar minha proposta</a>
                  </p>
                  <p style="font-size:12px;color:#6b7280">Ou acesse: ${link}</p>
                </div>`,
            },
          });
          emailEnviado = !mailErr;
        }

        const telefone = String(f.telefone_celular || f.celulares || f.telefone || "").trim();
        let whatsappEnviado = false;
        if (telefone) {
          const { error: waErr } = await supabase.functions.invoke("send-whatsapp", {
            body: {
              telefone,
              mensagem:
                `🦺 *Pedido de Cotação COT-${String(cotRow!.numero).padStart(4, "0")} — EPIs*\n\n` +
                `Prezado(a) ${nome}, solicitamos proposta para os EPIs abaixo:\n` +
                itensConvite.map((i) => `• ${i.descricao} — ${i.quantidade} ${i.unidadeMedida}`).join("\n") +
                `\n\nEnvie sua proposta em: ${link}`,
            },
          });
          whatsappEnviado = !waErr;
        }

        enviados.push({ fornecedor: nome, email, link, emailEnviado, whatsappEnviado });
      } catch (e) {
        enviados.push({ fornecedor: nome, email, link: "", emailEnviado: false, whatsappEnviado: false, erro: e instanceof Error ? e.message : String(e) });
      }
    }

    // 6) Aviso interno ao SEGTRAB
    const { data: empresa } = await supabase.from("empresa").select("whatsapp_segtrab").limit(1).maybeSingle();
    const segtrab = String((empresa as { whatsapp_segtrab?: string | null } | null)?.whatsapp_segtrab || "").trim();
    if (segtrab) {
      await supabase.functions.invoke("send-whatsapp", {
        body: {
          telefone: segtrab,
          mensagem:
            `🦺 *Cotação automática de EPIs gerada*\n` +
            `RC nº ${reqRow!.numero} • COT-${String(cotRow!.numero).padStart(4, "0")}\n\n` +
            itensConvite.map((i) => `• ${i.descricao} — ${i.quantidade} ${i.unidadeMedida}`).join("\n") +
            `\n\nEnviada a ${enviados.length} fornecedor(es) com linha de fornecimento de EPI.`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        data: today,
        requisicao: reqRow!.numero,
        cotacao: cotRow!.numero,
        itens: itensConvite,
        fornecedores: enviados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("cotacao-epis-vencendo", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
