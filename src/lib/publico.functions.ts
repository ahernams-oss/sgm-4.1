// Leituras/escritas das páginas públicas (QR do equipamento, verificação de
// assinatura, portal do candidato). O banco não libera mais essas tabelas sem
// login; o servidor busca só o registro exato pedido (id/código) e devolve.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const getEquipamentoPublico = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: equip } = await db.from("equipamentos").select("*").eq("id", data.id).maybeSingle();
    if (!equip) return { equip: null, manutencoes: [], atividades: [], execucoes: [] };
    const [ss, ats, exs] = await Promise.all([
      db.from("solicitacoes_servicos")
        .select("id, numero, descricao_servicos, situacao, tipo, prioridade, data_hora_solicitacao, created_at")
        .eq("equipamento_id", data.id).order("created_at", { ascending: false }),
      db.from("pmoc_atividades")
        .select("id, descricao, periodicidade, ultima_execucao, proxima_execucao, ativa")
        .eq("equipamento_id", data.id),
      db.from("pmoc_atividades_execucoes")
        .select("id, atividade_id, atividade_descricao, periodicidade, data_execucao, proxima_execucao, status, data_confirmacao")
        .eq("equipamento_id", data.id).order("data_execucao", { ascending: false }),
    ]);
    return { equip, manutencoes: ss.data ?? [], atividades: ats.data ?? [], execucoes: exs.data ?? [] };
  });

const FONTES = [
  { tipo: "rdo", ass: "rdo_assinaturas", fk: "rdo_id", doc: "rdos" },
  { tipo: "os", ass: "os_assinaturas", fk: "os_id", doc: "ordens_servico" },
  { tipo: "pc", ass: "pc_assinaturas", fk: "pedido_id", doc: "pedidos_compra" },
  { tipo: "laudo", ass: "equipamentos_laudos_assinaturas", fk: "laudo_id", doc: "equipamentos_laudos_condenacao" },
  { tipo: "boletim", ass: "boletim_assinaturas", fk: "boletim_id", doc: "boletins_medicao" },
] as const;

export const verificarAssinaturaPublica = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ codigo: z.string().trim().min(4).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    for (const f of FONTES) {
      const { data: ass } = await db.from(f.ass).select("*").eq("codigo_verificador", data.codigo).maybeSingle();
      if (!ass) continue;
      const docId = ass[f.fk];
      const [{ data: documento }, { data: todas }] = await Promise.all([
        db.from(f.doc).select("*").eq("id", docId).maybeSingle(),
        db.from(f.ass).select("*").eq(f.fk, docId).order("signed_at"),
      ]);
      return { tipo: f.tipo, assinatura: ass, documento: documento ?? null, todas: todas ?? [] };
    }
    return null;
  });

const ids = z.object({ processoId: z.string().uuid(), candidatoId: z.string().min(1).max(100) });

export const getCandidatoPortal = createServerFn({ method: "POST" })
  .inputValidator((d) => ids.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: p } = await db.from("processos_seletivos").select("candidatos").eq("id", data.processoId).maybeSingle();
    const c = ((p?.candidatos as any[]) || []).find((x) => x?.id === data.candidatoId);
    return c ?? null;
  });

// Só os campos que o próprio candidato preenche no portal.
const patchSchema = z.object({
  lgpdAceite: z.boolean().optional(),
  lgpdAceiteData: z.string().max(40).optional(),
  documentos: z.array(z.any()).max(60).optional(),
  dadosBancarios: z.record(z.string(), z.string().max(200)).optional(),
  portalConcluidoEm: z.string().max(40).optional(),
}).strict();

export const salvarCandidatoPortal = createServerFn({ method: "POST" })
  .inputValidator((d) => ids.extend({ patch: patchSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: p } = await db.from("processos_seletivos").select("candidatos").eq("id", data.processoId).maybeSingle();
    const cands: any[] = (p?.candidatos as any[]) || [];
    const idx = cands.findIndex((x) => x?.id === data.candidatoId);
    if (idx < 0) throw new Error("Candidato não encontrado.");
    cands[idx] = { ...cands[idx], ...data.patch };
    const { error } = await db.from("processos_seletivos").update({ candidatos: cands }).eq("id", data.processoId);
    if (error) throw new Error("Erro ao salvar.");
    return { ok: true };
  });
