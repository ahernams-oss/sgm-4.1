import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, requireAuth } from "../supabase";

export default defineTool({
  name: "listar_requisicoes_compras",
  title: "Listar requisições de compras (RCS)",
  description: "Lista Requisições de Compras e Serviços (RCS/RC) do SGM, com filtros opcionais.",
  inputSchema: {
    numero: z.string().optional().describe("Número da RCS."),
    status: z.string().optional().describe("Status da requisição."),
    incluir_itens: z.boolean().optional().describe("Quando verdadeiro, inclui os itens da requisição."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ numero, status, incluir_itens, limite }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    const colunas = incluir_itens
      ? "id,numero,status,urgencia,centro_custo_nome,solicitante,created_at,itens"
      : "id,numero,status,urgencia,centro_custo_nome,solicitante,created_at";

    let q = supabaseForUser(ctx)
      .from("requisicoes_compras")
      .select(colunas)
      .order("created_at", { ascending: false })
      .limit(limite ?? 25);

    if (numero) q = q.eq("numero", numero);
    if (status) q = q.ilike("status", `%${status}%`);

    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult({ total: data?.length ?? 0, requisicoes: data ?? [] });
  },
});
