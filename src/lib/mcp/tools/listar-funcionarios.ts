import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, requireAuth } from "../supabase";

export default defineTool({
  name: "listar_funcionarios",
  title: "Listar funcionários",
  description: "Lista o quadro de funcionários cadastrados no SGM, com busca opcional por nome ou CPF.",
  inputSchema: {
    busca: z.string().optional().describe("Texto para filtrar por nome ou CPF."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let q = supabaseForUser(ctx)
      .from("funcionarios")
      .select("id,nome,cpf,cargo_id,cliente_id,situacao,data_admissao")
      .limit(limite ?? 25);

    if (busca) q = q.or(`nome.ilike.%${busca}%,cpf.ilike.%${busca}%`);

    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult({ total: data?.length ?? 0, funcionarios: data ?? [] });
  },
});
