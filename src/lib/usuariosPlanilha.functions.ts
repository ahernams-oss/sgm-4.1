import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { conferirUsuarios, linhasUsuariosSchema } from "./usuariosPlanilha";

const sessao = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  return next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
});

export const importarUsuariosPlanilha = createServerFn({ method: "POST" })
  .middleware([sessao, requireSupabaseAuth])
  .inputValidator(input => linhasUsuariosSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: permitido, error } = await context.supabase.rpc("has_module", { _modulo: "usuarios.criar" });
    if (error || !permitido) throw new Error("Você não possui permissão para importar usuários.");
    const carregar = async (tabela: "usuarios" | "cargos" | "perfis_acesso" | "clientes", colunas: string) => {
      const resultado: Record<string, unknown>[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data: pagina, error } = await context.supabase.from(tabela).select(colunas).order("id").range(inicio, inicio + 999);
        if (error) throw new Error(`Não foi possível conferir ${tabela}.`);
        const rows = (pagina ?? []) as unknown as Record<string, unknown>[];
        resultado.push(...rows);
        if (rows.length < 1000) return resultado;
      }
    };
    const [usuarios, cargos, perfis, clientes] = await Promise.all([carregar("usuarios", "id,email"), carregar("cargos", "id,nome"), carregar("perfis_acesso", "id,nome"), carregar("clientes", "id,locais")]);
    const refs = (rows: Record<string, unknown>[]) => rows.map(r => ({ id: String(r.id), nome: String(r.nome ?? "") }));
    const conferencia = conferirUsuarios(data, { cargos: refs(cargos), perfis: refs(perfis), clientes: clientes.map(c => ({ id: String(c.id), locais: Array.isArray(c.locais) ? c.locais.map(l => ({ id: String(l?.id ?? "") })) : [] })) }, usuarios.map(u => String(u.email ?? "")));
    const novos = conferencia.flatMap(c => c.cadastro ? [c.cadastro] : []);
    if (novos.length) {
      const { error: erroGravacao } = await context.supabase.from("usuarios").insert(novos.map(u => ({ nome: u.nome, email: u.email, cargo_id: u.cargoId, perfil_acesso_id: u.perfilAcessoId, telefone: u.telefone, matricula: u.matricula, ramal: u.ramal, destinado_cliente: u.destinadoCliente, clientes_permitidos: u.clientesPermitidos, locais_permitidos: u.locaisPermitidos, limite_aprovacao_compras: u.limiteAprovacaoCompras, limite_aprovacao_os: u.limiteAprovacaoOS })));
      if (erroGravacao) throw new Error(`Nenhum usuário foi importado: ${erroGravacao.message}`);
    }
    return { importados: novos.length, conferencia: conferencia.map(({ cadastro: _cadastro, ...linha }) => linha) };
  });