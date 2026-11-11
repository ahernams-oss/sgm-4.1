import { describe, expect, test } from "vitest";
import { expandirSubmenusFaturamento, expandirSubmenusPmoc, organizarPermissoesPorMenu } from "./gruposPermissoes";

describe("organização dos perfis por menu", () => {
  test("os cinco submenus PMOC preservam as chaves de acesso e todas as ações existentes", () => {
    const pmoc = { key: "pmoc", label: "PMOC", acoes: ["criar", "editar", "excluir", "exportar_pdf", "exportar_excel", "confirmar_execucao"].map(key => ({ key: `pmoc.${key}`, label: key })) };
    const valores = { key: "pmoc_valores", label: "Valores", acoes: [] };
    const grupos = [{ grupo: "PMOC", modulos: [pmoc, valores] }];
    const antes = structuredClone(grupos);
    const resultado = expandirSubmenusPmoc(grupos);
    expect(resultado[0]?.modulos.map(mod => mod.key)).toEqual(["pmoc", "pmoc", "pmoc", "pmoc", "pmoc_valores"]);
    const keys = (modulos: typeof grupos[0]["modulos"]) => [...new Set(modulos.flatMap(mod => [mod.key, ...(mod.acoes?.map(acao => acao.key) ?? [])]))].sort();
    expect(keys(resultado[0]?.modulos ?? [])).toEqual(keys(grupos[0].modulos));
    expect(grupos).toEqual(antes);
  });

  test("confirmação é apresentada na operação gerenciada, não na SMART", () => {
    const acoes = ["criar", "editar", "confirmar_execucao"].map(key => ({ key: `pmoc.${key}`, label: key }));
    const resultado = expandirSubmenusPmoc([{ grupo: "PMOC", modulos: [{ key: "pmoc", label: "PMOC", acoes }] }]);
    expect(resultado[0]?.modulos[1]?.acoes?.map(acao => acao.key)).toEqual(["pmoc.criar", "pmoc.editar", "pmoc.confirmar_execucao"]);
    expect(resultado[0]?.modulos[2]?.acoes?.map(acao => acao.key)).toEqual(["pmoc.criar", "pmoc.editar"]);
  });

  test("catálogo sem PMOC permanece intacto", () => {
    const grupo = { grupo: "Cadastros", modulos: [{ key: "clientes", label: "Clientes" }] };
    expect(expandirSubmenusPmoc([grupo])[0]).toBe(grupo);
  });

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