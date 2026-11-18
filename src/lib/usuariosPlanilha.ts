import { z } from "zod";

export const colunasUsuarios = ["Nome", "E-mail", "Cargo", "Perfil de Acesso", "Telefone", "Matrícula", "Ramal", "Tipo", "Clientes (IDs)", "Locais (IDs)", "Limite Compras (R$)", "Limite OS/SS (R$)"];
export const linhasUsuariosSchema = z.array(z.record(z.string(), z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.null()]))).min(1).max(500);
export type LinhaUsuario = z.infer<typeof linhasUsuariosSchema>[number];
export type ReferenciaUsuario = { id: string; nome: string };
export type CatalogosUsuarios = { cargos: ReferenciaUsuario[]; perfis: ReferenciaUsuario[]; clientes: { id: string; locais?: { id: string }[] }[] };
export const normalizarColunaUsuario = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const texto = z.string().trim().max(200);
const cadastroSchema = z.object({
  nome: texto.min(1, "Informe o nome"), email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
  cargoId: z.string().uuid(), perfilAcessoId: z.union([z.string().uuid(), z.literal("")]),
  telefone: z.string().max(30).regex(/^[\d\s()+-]*$/, "Telefone inválido"), matricula: texto, ramal: texto,
  destinadoCliente: z.boolean(), clientesPermitidos: z.array(z.string().uuid()).max(500), locaisPermitidos: z.array(z.string().uuid()).max(500),
  limiteAprovacaoCompras: z.number().finite().min(0).max(999999999), limiteAprovacaoOS: z.number().finite().min(0).max(999999999),
});
export type CadastroUsuarioPlanilha = z.infer<typeof cadastroSchema>;
export type ConferenciaUsuario = { linha: number; nome: string; email: string; situacao: "Novo" | "Ignorado" | "Erro"; motivo: string; cadastro?: CadastroUsuarioPlanilha };

export function conferirUsuarios(linhas: LinhaUsuario[], catalogos: CatalogosUsuarios, emailsExistentes: string[]): ConferenciaUsuario[] {
  linhasUsuariosSchema.parse(linhas);
  const usados = new Set(emailsExistentes.map(e => e.trim().toLowerCase()));
  return linhas.map((linha, i) => {
    const valores = new Map(Object.entries(linha).map(([k, v]) => [normalizarColunaUsuario(k), String(v ?? "").trim()]));
    const ler = (coluna: string) => valores.get(normalizarColunaUsuario(coluna)) ?? "";
    const nome = ler("Nome"), email = ler("E-mail").toLowerCase();
    const base = { linha: i + 2, nome, email };
    try {
      if (usados.has(email)) return { ...base, situacao: "Ignorado", motivo: "E-mail já cadastrado ou repetido na planilha" };
      const resolver = (v: string, lista: ReferenciaUsuario[], campo: string, opcional = false) => {
        if (!v && opcional) return "";
        const encontrados = lista.filter(r => r.id === v || normalizarColunaUsuario(r.nome) === normalizarColunaUsuario(v));
        if (encontrados.length !== 1) throw new Error(`${campo} não encontrado ou ambíguo: ${v || "não informado"}`);
        return encontrados[0].id;
      };
      const ids = (v: string) => [...new Set(v.split(/[;,\n]/).map(s => s.trim()).filter(Boolean))];
      const clientesPermitidos = ids(ler("Clientes (IDs)")), locaisPermitidos = ids(ler("Locais (IDs)"));
      if (clientesPermitidos.some(id => !catalogos.clientes.some(c => c.id === id))) throw new Error("Cliente não encontrado");
      if (locaisPermitidos.some(id => !catalogos.clientes.some(c => clientesPermitidos.includes(c.id) && c.locais?.some(l => l.id === id)))) throw new Error("Local não pertence aos clientes selecionados");
      const tipo = normalizarColunaUsuario(ler("Tipo"));
      if (tipo && !["interno", "cliente"].includes(tipo)) throw new Error("Tipo deve ser Interno ou Cliente");
      const valor = (v: string) => !v ? 0 : Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
      const cadastro = cadastroSchema.parse({ nome, email, cargoId: resolver(ler("Cargo"), catalogos.cargos, "Cargo"), perfilAcessoId: resolver(ler("Perfil de Acesso"), catalogos.perfis, "Perfil", true), telefone: ler("Telefone"), matricula: ler("Matrícula"), ramal: ler("Ramal"), destinadoCliente: tipo === "cliente", clientesPermitidos, locaisPermitidos, limiteAprovacaoCompras: valor(ler("Limite Compras (R$)")), limiteAprovacaoOS: valor(ler("Limite OS/SS (R$)")) });
      usados.add(email);
      return { ...base, situacao: "Novo", motivo: "Cadastro sem senha; definir senha após importar", cadastro };
    } catch (e) {
      return { ...base, situacao: "Erro", motivo: e instanceof z.ZodError ? e.errors.map(x => `${x.path.join(".")}: ${x.message}`).join("; ") : e instanceof Error ? e.message : "Dados inválidos" };
    }
  });
}