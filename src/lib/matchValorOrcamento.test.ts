import { describe, expect, it } from "vitest";
import { matchValorOrcamento } from "./matchValorOrcamento";

describe("busca por valor do orçamento", () => {
  it.each(["R$ 1.250,50", "1.250,50", "1250,50", "1250.50", "1250", "250,50", "125050", "1,250.50"])(
    "encontra o valor na busca %s", busca => {
      expect(matchValorOrcamento(1250.5, busca)).toBe(true);
      expect(matchValorOrcamento(960.3, busca)).toBe(false);
    },
  );
  it("não confunde ausência de orçamento com valor zero", () => {
    expect(matchValorOrcamento(undefined, "0,00")).toBe(false);
    expect(matchValorOrcamento(null, "0,00")).toBe(false);
    expect(matchValorOrcamento(0, "R$ 0,00")).toBe(true);
  });
  it.each(["", "R$", "Orçamento", "   "])("ignora busca não monetária %s", busca => {
    expect(matchValorOrcamento(1250.5, busca)).toBe(false);
  });
});