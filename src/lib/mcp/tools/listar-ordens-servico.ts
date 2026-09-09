import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, textResult, errorResult, requireAuth } from "../supabase";

export default defineTool({
  name: "listar_ordens_servico",
  title: "Listar ordens de serviço",
  description: "Lista Ordens de Serviço (OS) do SGM, com filtros opcionais por número e status.",
  inputSchema: {
    numero: z.string().optional().describe("Número da OS (ex.: 16 ou 16-2026)."),
    status: z.string().optional().describe("Status/situação da OS."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ numero, status, limite }, ctx) => {
    const unauth = requireAuth(ctx);
    if (unauth) return unauth;

    let q = supabaseForUser(ctx)
      .from("ordens_servico")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limite ?? 25);

    if (numero) q = q.eq("numero", Number(String(numero).split("-")[0]));
    if (status) q = q.ilike("status", `%${status}%`);

    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return textResult({ total: data?.length ?? 0, ordens: data ?? [] });
  },
});
