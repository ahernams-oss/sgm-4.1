import { describe, it, expect } from "vitest";
import { codigoCompletoProduto, encontrarPorCodigo, lerCodigoProduto } from "./codigoProduto";

const itens = [
  { codigo: "000123", codigoCompleto: "07.07.01.000123" },
  { codigo: "000500", codigoCompleto: "07.07.02.000500" },
  { codigo: "000900" },
];

describe("codigoProduto", () => {
  it("remove quebra de linha enviada pelo leitor USB", () => {
    expect(lerCodigoProduto(" 000123\r\n")).toBe("000123");
  });
  it("monta o código completo com a categoria", () => {
    expect(codigoCompletoProduto("000123", "07.07.01")).toBe("07.07.01.000123");
  });
  it("sem categoria, mantém o código do cadastro", () => {
    expect(codigoCompletoProduto("000123", "")).toBe("000123");
    expect(codigoCompletoProduto("000123", undefined)).toBe("000123");
  });
  it("não duplica pontos entre categoria e código", () => {
    expect(codigoCompletoProduto("000123", "07.07.01.")).toBe("07.07.01.000123");
    expect(codigoCompletoProduto(".000123", "07.07.01")).toBe("07.07.01.000123");
  });
  it("encontra pelo código completo lido", () => {
    expect(encontrarPorCodigo(itens, "07.07.02.000500")?.codigo).toBe("000500");
  });
  it("encontra pelo código do cadastro quando a etiqueta é antiga", () => {
    expect(encontrarPorCodigo(itens, "000500")?.codigo).toBe("000500");
  });
  it("encontra pelo código completo mesmo sem categoria cadastrada", () => {
    expect(encontrarPorCodigo(itens, "000900")?.codigo).toBe("000900");
  });
  it("encontra ignorando zeros à esquerda", () => {
    expect(encontrarPorCodigo(itens, "123")?.codigo).toBe("000123");
  });
  it("não encontra código inexistente", () => {
    expect(encontrarPorCodigo(itens, "999")).toBeUndefined();
  });
  it("não confunde código completo com código do cadastro de outro item", () => {
    expect(encontrarPorCodigo(itens, "07.07.01.000500")).toBeUndefined();
  });
});
