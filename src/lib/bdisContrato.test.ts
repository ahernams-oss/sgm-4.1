import { describe, expect, it } from "vitest";
import { CAMPOS_BDI_CONTRATO, validarBdisContrato } from "./bdisContrato";

describe("BDIs do contrato", () => {
  for (const { chave } of CAMPOS_BDI_CONTRATO) {
    it(`${chave} aceita percentual de 0 a 100 e vírgula, mas rejeita valores fora da faixa`, () => {
      for (const valor of ["", "0", "100", "25,5"]) {
        expect(validarBdisContrato({ [chave]: valor })).toEqual({});
      }
      for (const valor of ["-0,01", "100,01", "abc", "Infinity"]) {
        expect(validarBdisContrato({ [chave]: valor })[chave]).toBeDefined();
      }
    });
  }
  it("valida os quatro valores independentemente e aceita contratos antigos", () => {
    expect(validarBdisContrato({})).toEqual({});
    const erros = validarBdisContrato({ bdiGeral: "10", bdiMaterial: "101", bdiServicos: "20,5", bdiEspecial: "-1" });
    expect(Object.keys(erros)).toEqual(["bdiMaterial", "bdiEspecial"]);
  });
});