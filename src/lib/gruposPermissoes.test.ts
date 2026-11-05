import { describe, expect, test } from "vitest";
import { expandirSubmenusFaturamento, organizarPermissoesPorMenu } from "./gruposPermissoes";

describe("organização dos perfis por menu", () => {
  test("os quatro submenus de Faturamento reutilizam as permissões existentes sem alterar o catálogo", () => {
    const clientes = { key: "clientes", label: "Clientes" };
    const notas = { key: "financeiro.nfes_recebidas", label: "NFes Recebidas" };
    const faturamentos = { key: "faturamentos", label: "Faturamentos", acoes: ["criar", "editar", "excluir", "visualizar", "transferir_saldo"].map(a => ({ key: `faturamentos.${a}`, label: a })) };
    const catalogo = organizarPermissoesPorMenu([{ grupo: "Origem", modulos: [clientes, notas, faturamentos] }]);
    const antes = structuredClone(catalogo);
    const resultado = expandirSubmenusFaturamento(catalogo);
    const submenus = resultado.find(g => g.grupo === "Faturamento")?.modulos;
    expect(submenus?.map(m => m.key)).toEqual(["clientes", "faturamentos", "faturamentos", "financeiro.nfes_recebidas"]);
    expect(submenus?.map(m => m.acoes?.map(a => a.key) ?? [])).toEqual([
      ["faturamentos.criar", "faturamentos.editar", "faturamentos.excluir"],
      ["faturamentos.visualizar"], ["faturamentos.transferir_saldo"], [],
    ]);
    expect(catalogo).toEqual(antes);
    expect(resultado.find(g => g.grupo === "Cadastros")?.modulos[0]).toBe(clientes);
    expect(resultado.find(g => g.grupo === "Financeiro")?.modulos[0]).toBe(notas);
  });

  test("modelos de OS pertencem ao menu Cadastros preservando a chave de acesso", () => {
    const modulo = { key: "os_modelos", label: "Modelo de OS" };
    const grupos = organizarPermissoesPorMenu([{ grupo: "Engenharia", modulos: [modulo] }]);
    expect(grupos.find(g => g.grupo === "Cadastros")?.modulos).toEqual([modulo]);
    expect(grupos.flatMap(g => g.modulos).filter(m => m.key === "os_modelos")).toHaveLength(1);
  });

  test("assinatura de ordens de compra pertence a Compras e Suprimentos", () => {
    const assinatura = { key: "pc_assinatura", label: "Assinatura de Ordens de Compra", acoes: [{ key: "pc.assinar", label: "Assinar PC" }] };
    const grupos = organizarPermissoesPorMenu([{ grupo: "Engenharia", modulos: [assinatura] }]);
    expect(grupos.find(g => g.grupo === "Compras e Suprimentos")?.modulos).toEqual([assinatura]);
    expect(grupos.some(g => g.grupo === "Engenharia")).toBe(false);
    expect(grupos[0]?.modulos[0]).toBe(assinatura);
  });

  test("reorganizar preserva todas as opções e suas ações sem duplicar", () => {
    const modulos = ["pmoc", "ordem_servico", "rdo", "responsaveis_tecnicos", "novo_modulo"].map(key => ({ key, label: key, acoes: [{ key: `${key}.editar`, label: "Editar" }] }));
    const grupos = organizarPermissoesPorMenu([{ grupo: "Engenharia", modulos }]);
    expect(grupos.flatMap(g => g.modulos).map(m => m.key).sort()).toEqual(modulos.map(m => m.key).sort());
    for (const modulo of modulos) expect(grupos.flatMap(g => g.modulos).find(m => m.key === modulo.key)).toBe(modulo);
    expect(grupos.find(g => g.grupo === "PMOC")?.modulos.map(m => m.key)).toEqual(["pmoc"]);
    expect(grupos.find(g => g.grupo === "Ordens de Serviço")?.modulos.map(m => m.key)).toEqual(["ordem_servico"]);
    expect(grupos.find(g => g.grupo === "Obras")?.modulos.map(m => m.key)).toEqual(["rdo"]);
    expect(grupos.find(g => g.grupo === "Cadastros")?.modulos.map(m => m.key)).toEqual(["responsaveis_tecnicos"]);
  });
});