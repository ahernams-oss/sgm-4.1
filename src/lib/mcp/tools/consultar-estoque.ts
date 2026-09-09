import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, requireAuth } from "../supabase";

export default defineTool({
  name: "consultar_estoque",
  title: "Consultar estoque",
  description: "Consulta as movimentações de estoque do SGM e retorna o saldo calculado por material.",
  inputSchema: {
    material: z.string().optional().describe("Nome (parcial) do material a consultar."),
    limite: z.number().int().min(1).max(500).optional().describe("Máximo de movimentações lidas (padrão 300)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ material, limite }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let q = supabaseForUser(ctx)
      .from("estoque_movimentacoes")
      .select("material_nome,tipo,quantidade,local_nome")
      .limit(limite ?? 300);

    if (material) q = q.ilike("material_nome", `%${material}%`);

    const { data, error } = await q;
    if (error) return errorResult(error.message);

    const saldos: Record<string, number> = {};
    for (const m of data ?? []) {
      const chave = (m as { material_nome?: string }).material_nome ?? "—";
      const qtd = Number((m as { quantidade?: number }).quantidade ?? 0);
      const tipo = String((m as { tipo?: string }).tipo ?? "").toLowerCase();
      saldos[chave] = (saldos[chave] ?? 0) + (tipo.includes("said") || tipo.includes("baixa") ? -qtd : qtd);
    }

    return textResult({
      movimentacoes_lidas: data?.length ?? 0,
      saldos: Object.entries(saldos).map(([material_nome, saldo]) => ({ material_nome, saldo })),
    });
  },
});
