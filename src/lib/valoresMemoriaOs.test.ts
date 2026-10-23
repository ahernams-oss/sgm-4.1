import { describe, expect, it } from "vitest";
import { criarValoresMemoriaOs, valorUnitarioMemoriaOs } from "./valoresMemoriaOs";

describe("valores da memória de cálculo da OS", () => {
  const valores = criarValoresMemoriaOs([
    { codigo: "000003080", valorUnitario: 84.83 },
    { codigo: "000003103", valorUnitario: 62.78 },
    { codigo: "MAT050000", valorUnitario: 27.31 },
  ]);
  it("recupera preços da OS mesmo com zeros diferentes no código histórico", () => {
    expect(valorUnitarioMemoriaOs(valores, "00003080")).toBe(84.83);
    expect(valorUnitarioMemoriaOs(valores, "00003103")).toBe(62.78);
    expect(valorUnitarioMemoriaOs(valores, "MAT050000")).toBe(27.31);
  });
  it("reproduz o subtotal de R$ 2.353,93 do anexo pelas quantidades da memória", () => {
    const total = (valorUnitarioMemoriaOs(valores, "00003080") ?? 0) * 16
      + (valorUnitarioMemoriaOs(valores, "00003103") ?? 0) * 5
      + (valorUnitarioMemoriaOs(valores, "MAT050000") ?? 0) * 25;
    expect(total).toBeCloseTo(2353.93, 2);
  });
  it("não confunde ausência de preço com preço zero nem altera códigos alfanuméricos", () => {
    const mapa = criarValoresMemoriaOs([{ codigo: "ZERO", valorUnitario: 0 }, { codigo: "SEM" }]);
    expect(valorUnitarioMemoriaOs(mapa, "ZERO")).toBe(0);
    expect(valorUnitarioMemoriaOs(mapa, "SEM")).toBeUndefined();
    expect(valorUnitarioMemoriaOs(valores, "MAT50000")).toBeUndefined();
  });
});