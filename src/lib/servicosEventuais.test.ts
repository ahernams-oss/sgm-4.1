import { describe, expect, it } from "vitest";
import { contratoEventualValido, filtrarEventuaisPorNome, numeroEventual, servicoEventualSchema, validarQuantidadeEventual, valoresEventuais } from "./servicosEventuais";

describe("Serviços eventuais por cliente e contrato", () => {
  it("não aceita contrato de outro cliente", () => {
    const clientes = [{ id: "a", contratos: [{ id: "ct-a" }] }, { id: "b", contratos: [{ id: "ct-b" }] }];
    expect(contratoEventualValido("a", "ct-b", clientes)).toBe(false);
    expect(contratoEventualValido("a", "ct-a", clientes)).toBe(true);
    expect(contratoEventualValido("a", "", clientes)).toBe(false);
  });
  it("replica os valores da linha 1.1 da planilha com CITL percentual", () => {
    expect(valoresEventuais(2, 120, 12.89)).toEqual({ unitarioComCitl: 135.47, totalSemCitl: 240, totalComCitl: 270.94 });
  });
  it("replica a linha 1.9 com arredondamento do unitário antes do total", () => {
    expect(valoresEventuais(14, 82.21, 12.89)).toEqual({ unitarioComCitl: 92.81, totalSemCitl: 1150.94, totalComCitl: 1299.34 });
  });
  it("interpreta valores brasileiros", () => {
    expect(numeroEventual("12,89")).toBe(12.89);
    expect(numeroEventual("R$ 1.200,50")).toBe(1200.5);
  });
  it("exige cliente e contrato", () => {
    const base = { cliente_id: "11111111-1111-4111-8111-111111111111", contrato_id: "ct", grupo: "Análises", subgrupo: "", item: "1.1", discriminacao: "FT-IR", unidade: "UNIDADE", quantidade: 2, preco_unitario: 120, citl_percentual: 12.89, referencia: "Pesquisa de mercado" };
    expect(servicoEventualSchema.safeParse(base).success).toBe(true);
    expect(servicoEventualSchema.safeParse({ ...base, contrato_id: "" }).success).toBe(false);
    expect(servicoEventualSchema.safeParse({ ...base, cliente_id: "" }).success).toBe(false);
  });
  it("pesquisa o nome sem distinguir acentos ou caixa", () => {
    const itens = [{ item: "1.1", discriminacao: "Análise de óleo", grupo: "Inspeção", subgrupo: "Predial" }, { item: "2", discriminacao: "Limpeza", grupo: "", subgrupo: "" }];
    expect(filtrarEventuaisPorNome(itens, "ANALISE").map(item => item.item)).toEqual(["1.1"]);
    expect(filtrarEventuaisPorNome(itens, "predial").map(item => item.item)).toEqual(["1.1"]);
    expect(filtrarEventuaisPorNome(itens, "")).toHaveLength(2);
  });
  it("avisa saldo zerado ou negativo", () => {
    expect(validarQuantidadeEventual(0, 1)).toContain("saldo zerado");
    expect(validarQuantidadeEventual(-1, 1)).toContain("negativo");
  });
  it("não aceita quantidade zero, negativa ou acima do disponível", () => {
    expect(validarQuantidadeEventual(5, 0)).toContain("maior que zero");
    expect(validarQuantidadeEventual(5, -1)).toContain("maior que zero");
    expect(validarQuantidadeEventual(5, 6)).toContain("supera o saldo");
    expect(validarQuantidadeEventual(5, 5)).toBeNull();
  });
});