// Acesso do fornecedor à sala do pregão sem login no sistema.
// As tabelas do pregão não ficam mais abertas para acesso anônimo: o servidor
// valida que a participação pertence ao fornecedor da sessão e devolve só os
// dados daquele pregão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const salaIds = z.object({
  pregaoId: z.string().uuid(),
  fornecedorId: z.string().min(1).max(100),
});

// Garante que o fornecedor é participante do pregão e devolve a participação.
async function participacaoValida(db: any, pregaoId: string, fornecedorId: string) {
  const { data: part } = await db
    .from("pregao_participantes")
    .select("*")
    .eq("pregao_id", pregaoId)
    .eq("fornecedor_id", fornecedorId)
    .maybeSingle();
  if (!part) throw new Error("Participação não encontrada para este fornecedor.");
  return part;
}

export const getPregaoSalaFornecedor = createServerFn({ method: "POST" })
  .inputValidator((d) => salaIds.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const participante = await participacaoValida(db, data.pregaoId, data.fornecedorId);
    const [{ data: pregao }, { data: itens }] = await Promise.all([
      db.from("pregoes").select("*").eq("id", data.pregaoId).maybeSingle(),
      db.from("pregao_itens").select("*").eq("pregao_id", data.pregaoId).order("ordem", { ascending: true }),
    ]);
    return { pregao: pregao ?? null, itens: itens ?? [], participante };
  });

export const getPregaoDisputaFornecedor = createServerFn({ method: "POST" })
  .inputValidator((d) => salaIds.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const participante = await participacaoValida(db, data.pregaoId, data.fornecedorId);
    const [{ data: lances }, { data: mensagens }, { data: itens }] = await Promise.all([
      db.from("pregao_lances").select("*").eq("pregao_id", data.pregaoId).order("ts", { ascending: true }),
      db.from("pregao_mensagens").select("*").eq("pregao_id", data.pregaoId).order("ts", { ascending: true }),
      db.from("pregao_itens").select("*").eq("pregao_id", data.pregaoId).order("ordem", { ascending: true }),
    ]);
    return { lances: lances ?? [], mensagens: mensagens ?? [], itens: itens ?? [], participante };
  });

export const enviarLancePregao = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    salaIds
      .extend({
        itemId: z.string().uuid(),
        valor: z.number().positive().max(1_000_000_000),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const participante = await participacaoValida(db, data.pregaoId, data.fornecedorId);
    if (participante.status !== "Habilitado" && participante.status !== "Credenciado") {
      throw new Error("Sua participação não está apta a enviar lances.");
    }
    const [{ data: item }, { data: pregao }, { data: lancesItem }] = await Promise.all([
      db.from("pregao_itens").select("*").eq("id", data.itemId).eq("pregao_id", data.pregaoId).maybeSingle(),
      db.from("pregoes").select("decremento_minimo,decremento_tipo,status").eq("id", data.pregaoId).maybeSingle(),
      db.from("pregao_lances").select("valor,cancelado").eq("item_id", data.itemId).eq("cancelado", false),
    ]);
    if (!item) throw new Error("Item não encontrado.");
    if (item.status !== "Em Disputa") throw new Error("Este item não está em disputa.");
    if (pregao?.status !== "Disputa") throw new Error("O pregão não está em disputa.");
    const ativos = (lancesItem ?? []).map((l: any) => Number(l.valor));
    const melhor = ativos.length ? Math.min(...ativos) : Infinity;
    if (data.valor >= melhor) throw new Error("O lance deve ser menor que o melhor lance atual.");
    if (melhor !== Infinity && pregao) {
      const dif = melhor - data.valor;
      const min = Number(pregao.decremento_minimo || 0);
      if (pregao.decremento_tipo === "reais" && dif < min) {
        throw new Error("Decremento mínimo não atingido.");
      }
      if (pregao.decremento_tipo !== "reais" && (dif / melhor) * 100 < min) {
        throw new Error("Decremento mínimo percentual não atingido.");
      }
    }
    const { error } = await db.from("pregao_lances").insert({
      pregao_id: data.pregaoId,
      item_id: data.itemId,
      participante_id: participante.id,
      valor: data.valor,
    });
    if (error) throw new Error("Erro ao enviar lance.");
    return { ok: true };
  });

export const enviarMensagemPregao = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    salaIds.extend({ mensagem: z.string().trim().min(1).max(1000) }).parse(d)
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const participante = await participacaoValida(db, data.pregaoId, data.fornecedorId);
    if (!participante.chat_aberto) {
      throw new Error("O chat está fechado pelo pregoeiro. Aguarde a liberação.");
    }
    const { error } = await db.from("pregao_mensagens").insert({
      pregao_id: data.pregaoId,
      autor_tipo: "participante",
      autor_id: participante.id,
      autor_nome_exibicao: participante.apelido,
      mensagem: data.mensagem,
    });
    if (error) throw new Error("Erro ao enviar mensagem.");
    return { ok: true };
  });

// Lista do portal do fornecedor: pregões abertos + participações do fornecedor.
export const getPregoesPortalFornecedor = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ fornecedorId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const [{ data: pregoes }, { data: partes }] = await Promise.all([
      db
        .from("pregoes")
        .select("id,numero,objeto,modalidade,tipo_disputa,status,data_publicacao,data_abertura_credenciamento,data_inicio_disputa,data_encerramento_disputa,termo_participacao,termo_hash,tempo_disputa_min,decremento_minimo,decremento_tipo,created_at,pregoeiro_nome")
        .in("status", ["Publicado", "Credenciamento", "Propostas", "Disputa", "Habilitacao", "Adjudicado", "Homologado"])
        .order("created_at", { ascending: false }),
      db
        .from("pregao_participantes")
        .select("id,pregao_id,fornecedor_id,apelido,status,termo_aceito_em,motivo_status")
        .eq("fornecedor_id", data.fornecedorId),
    ]);
    return { pregoes: pregoes ?? [], participacoes: partes ?? [] };
  });
