import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, requireAuth } from "../supabase";

export default defineTool({
  name: "listar_clientes",
  title: "Listar clientes",
  description: "Lista os clientes cadastrados no SGM, com filtro opcional por nome ou CNPJ.",
  inputSchema: {
    busca: z.string().optional().describe("Texto para filtrar por nome, nome fantasia ou CNPJ."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let q = supabaseForUser(ctx)
      .from("clientes")
      .select("id,nome,nome_fantasia,cnpj,cidade,uf,email,telefone_celular")
      .limit(limite ?? 25);

    if (busca) q = q.or(`nome.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%,cnpj.ilike.%${busca}%`);

    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult({ total: data?.length ?? 0, clientes: data ?? [] });
  },
});
