import { describe, it, expect } from "vitest";
import { encontrarPorCodigo, lerCodigoProduto } from "./codigoProduto";

const itens = [{ codigo: "000123" }, { codigo: "000500" }];

describe("codigoProduto", () => {
  it("remove quebra de linha enviada pelo leitor USB", () => {
    expect(lerCodigoProduto(" 000123\r\n")).toBe("000123");
  });
  it("encontra pelo código exato", () => {
    expect(encontrarPorCodigo(itens, "000500")?.codigo).toBe("000500");
  });
  it("encontra ignorando zeros à esquerda", () => {
    expect(encontrarPorCodigo(itens, "123")?.codigo).toBe("000123");
  });
  it("não encontra código inexistente", () => {
    expect(encontrarPorCodigo(itens, "999")).toBeUndefined();
  });
});
