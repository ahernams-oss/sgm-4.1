import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, requireAuth } from "../supabase";

export default defineTool({
  name: "listar_solicitacoes_servico",
  title: "Listar solicitações de serviço",
  description: "Lista Solicitações de Serviço (SS) do SGM, com filtros opcionais por número e status.",
  inputSchema: {
    numero: z.string().optional().describe("Número da SS (ex.: 12 ou 12-2026)."),
    status: z.string().optional().describe("Status/situação da SS."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ numero, status, limite }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let q = supabaseForUser(ctx)
      .from("solicitacoes_servicos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite ?? 25);

    if (numero) q = q.eq("numero", Number(String(numero).split("-")[0]));
    if (status) q = q.ilike("status", `%${status}%`);

    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult({ total: data?.length ?? 0, solicitacoes: data ?? [] });
  },
});
