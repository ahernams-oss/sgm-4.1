import { describe, expect, test } from "bun:test";
import { organizarPermissoesPorMenu } from "./gruposPermissoes";

describe("organização dos perfis por menu", () => {
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