import { describe, expect, it } from "vitest";
import { correspondeCodigoTributacao } from "./buscaCodigoTributacao";

const item = { codigo: "07.05.01", descricao: "Reparação de edifícios e congêneres" };
describe("Busca de código de tributação", () => {
  it("busca descrição sem acentos e em qualquer ordem", () => {
    expect(correspondeCodigoTributacao(item, "EDIFICIOS reparacao")).toBe(true);
    expect(correspondeCodigoTributacao(item, "reparacao maquinas")).toBe(false);
  });
  it("aceita código com ou sem pontuação", () => {
    for (const busca of ["07.05.01", "070501", "07 05 01", "07/05/01", "0705"]) expect(correspondeCodigoTributacao(item, busca)).toBe(true);
    expect(correspondeCodigoTributacao(item, "1401")).toBe(false);
  });
  it("combina código e descrição e permite limpar a busca", () => {
    expect(correspondeCodigoTributacao(item, "07.05 edificios")).toBe(true);
    expect(correspondeCodigoTributacao(item, "")).toBe(true);
    expect(correspondeCodigoTributacao(item, "07.05 pontes")).toBe(false);
  });
});