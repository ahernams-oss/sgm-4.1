import { describe, expect, test } from "vitest";
import { aliquotaIssContratoNfse, contratoInicialNfse } from "./issContratoNfse";

describe("ISS do contrato na emissão", () => {
  test("o ISS cadastrado no contrato prevalece sobre a configuração", () => {
    expect(aliquotaIssContratoNfse("2.5", 5)).toBe("2,5");
    expect(aliquotaIssContratoNfse("3,25", 5)).toBe("3,25");
  });
  test("zero cadastrado é preservado", () => {
    expect(aliquotaIssContratoNfse("0", 5)).toBe("0");
  });
  test("sem ISS cadastrado restaura o padrão em vez do valor de outro contrato", () => {
    expect(aliquotaIssContratoNfse("", 4)).toBe("4");
    expect(aliquotaIssContratoNfse(undefined, null)).toBe("5");
  });
  test("seleciona automaticamente somente quando há um único contrato", () => {
    expect(contratoInicialNfse([{ id: "contrato-a" }])).toBe("contrato-a");
    expect(contratoInicialNfse([{ id: "contrato-a" }, { id: "contrato-b" }])).toBe("");
    expect(contratoInicialNfse([])).toBe("");
  });
});