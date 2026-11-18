import { describe, expect, it } from "vitest";
import { cabecalhoClientesLocais, conferirUsuarios, linhasClientesLocais, linhasUsuariosSchema } from "./usuariosPlanilha";
const cargo = "11111111-1111-4111-8111-111111111111";
const cliente = "22222222-2222-4222-8222-222222222222";
const local = "33333333-3333-4333-8333-333333333333";
const catalogos = { cargos: [{ id: cargo, nome: "Técnico" }], perfis: [], clientes: [{ id: cliente, nome: "Cliente Alfa", locais: [{ id: local, nome: "Sede Central" }] }] };
const linha = { Nome: "Maria", "E-mail": "maria@example.com", Cargo: "Técnico" };
describe("planilha de usuários", () => {
  it("importa novo cadastro sem senha e sem liberar clientes por padrão", () => {
    const resultado = conferirUsuarios([{ ...linha, Senha: "nunca importar" }], catalogos, [])[0];
    expect(resultado.situacao).toBe("Novo");
    expect(resultado.cadastro?.clientesPermitidos).toEqual([]);
    expect(resultado.cadastro).not.toHaveProperty("senha");
    expect(resultado.cadastro?.limiteAprovacaoOS).toBe(0);
  });
  it("ignora e-mail existente sem sobrescrever e evita repetição no arquivo", () => {
    expect(conferirUsuarios([linha], catalogos, ["MARIA@example.com"])[0].situacao).toBe("Ignorado");
    expect(conferirUsuarios([linha, linha], catalogos, []).map(c => c.situacao)).toEqual(["Novo", "Ignorado"]);
  });
  it("rejeita e-mail inválido, cargo desconhecido e referência ambígua", () => {
    expect(conferirUsuarios([{ ...linha, "E-mail": "errado" }], catalogos, [])[0].situacao).toBe("Erro");
    expect(conferirUsuarios([{ ...linha, Cargo: "Outro" }], catalogos, [])[0].situacao).toBe("Erro");
    expect(conferirUsuarios([linha], { ...catalogos, cargos: [...catalogos.cargos, { id: cliente, nome: "Tecnico" }] }, [])[0].situacao).toBe("Erro");
  });
  it("valida clientes e vínculo dos locais", () => {
    expect(conferirUsuarios([{ ...linha, "Locais (IDs)": local }], catalogos, [])[0].situacao).toBe("Erro");
    expect(conferirUsuarios([{ ...linha, "Clientes (IDs)": cliente, "Locais (IDs)": local }], catalogos, [])[0].cadastro?.locaisPermitidos).toEqual([local]);
    expect(conferirUsuarios([{ ...linha, "Clientes (IDs)": cargo }], catalogos, [])[0].situacao).toBe("Erro");
  });
  it("normaliza valores brasileiros sem aceitar limites negativos", () => {
    expect(conferirUsuarios([{ ...linha, "Limite OS/SS (R$)": "1.234,56" }], catalogos, [])[0].cadastro?.limiteAprovacaoOS).toBe(1234.56);
    expect(conferirUsuarios([{ ...linha, "Limite Compras (R$)": -1 }], catalogos, [])[0].situacao).toBe("Erro");
  });
  it("limita lotes a 500 registros", () => {
    expect(linhasUsuariosSchema.safeParse(Array(501).fill(linha)).success).toBe(false);
    expect(linhasUsuariosSchema.safeParse(Array(500).fill(linha)).success).toBe(true);
  });
  it("mostra o nome do cliente e do local junto dos IDs na aba de referência", () => {
    expect(cabecalhoClientesLocais).toEqual(["Cliente ID", "Cliente", "Local ID", "Local"]);
    expect(linhasClientesLocais(catalogos)).toEqual([
      [cliente, "Cliente Alfa", "", ""],
      [cliente, "Cliente Alfa", local, "Sede Central"],
    ]);
  });
});