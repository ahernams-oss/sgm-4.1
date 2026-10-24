import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { confirmarLancamentoPagamento, dataCreditoSchema } from "./pagamentoFaturamento";

const sessaoPagamento = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

const texto = z.string().max(10000);
const faturamentoSchema = z.object({
  id: z.string().uuid(), periodoInicio: dataCreditoSchema, periodoFim: dataCreditoSchema,
  dataEmissaoNf: texto, xmlNfNome: texto, xmlNfConteudo: texto,
  numeroNf: texto, processoNf: texto.optional(), chaveNf: texto, numeroMedicao: texto,
  descricao: texto, valorBruto: texto, valorLiquido: texto, valorFolha: texto,
  valeTransporte: texto.optional(), valeAlimentacao: texto.optional(), custoFixo: texto.optional(),
  foraFolha: texto.optional(), provisaoFerias: texto.optional(), provisao13: texto.optional(), valorVariavel: texto.optional(),
  anexoNfUrl: z.string().max(30000000), anexoNfNome: texto,
  pago: z.literal(true), dataPagamento: dataCreditoSchema,
});

export const registrarPagamentoFaturamento = createServerFn({ method: "POST" })
  .middleware([sessaoPagamento, requireSupabaseAuth])
  .inputValidator(input => z.object({ clienteId: z.string().uuid(), contratoId: z.string().uuid(), senha: z.string().min(1).max(200), faturamento: faturamentoSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { exigirAcesso, pode } = await import("@/lib/edge/permissao");
    const acesso = await exigirAcesso(getRequest(), c => c.tipo === "usuario" && pode(c, "clientes.editar"));
    if (!acesso.ok || acesso.chamador.tipo !== "usuario") throw new Error("Você não possui permissão para registrar este pagamento.");
    const usuarioId = acesso.chamador.usuario.id;
    // Privileged credentials are loaded only after verifying the caller and permission.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { compare } = await import("@/lib/edge/bcrypt");
    return confirmarLancamentoPagamento(data.senha, async senha => {
      const { data: cred, error } = await supabaseAdmin.from("usuarios_credenciais").select("senha").eq("usuario_id", usuarioId).maybeSingle();
      if (error || !cred?.senha) return false;
      const hash = String(cred.senha);
      return /^\$2[aby]\$/.test(hash) ? compare(senha, hash) : senha.trim() === hash.trim();
    }, async () => {
      const { data: cliente, error } = await context.supabase.from("clientes").select("contratos").eq("id", data.clienteId).single();
      if (error || !cliente || !Array.isArray(cliente.contratos)) throw new Error("Não foi possível carregar o contrato.");
      let encontrado = false;
      const contratos = cliente.contratos.map(value => {
        if (!value || typeof value !== "object" || Array.isArray(value) || value.id !== data.contratoId) return value;
        encontrado = true;
        const anteriores = Array.isArray(value.faturamentos) ? value.faturamentos : [];
        const existe = anteriores.some(f => f && typeof f === "object" && !Array.isArray(f) && f.id === data.faturamento.id);
        return { ...value, faturamentos: existe ? anteriores.map(f => f && typeof f === "object" && !Array.isArray(f) && f.id === data.faturamento.id ? data.faturamento : f) : [...anteriores, data.faturamento] };
      });
      if (!encontrado) throw new Error("Contrato não encontrado.");
      const { data: saved, error: saveError } = await context.supabase.from("clientes").update({ contratos }).eq("id", data.clienteId).eq("contratos", JSON.stringify(cliente.contratos)).select("id").maybeSingle();
      if (saveError || !saved) throw new Error("Não foi possível registrar o pagamento. Atualize a tela e tente novamente.");
      return { ok: true };
    });
  });