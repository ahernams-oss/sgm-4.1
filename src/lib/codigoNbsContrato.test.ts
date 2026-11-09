import { describe, expect, test } from "vitest";
import { codigoNbsContrato } from "./codigoNbsContrato";

describe("Código NBS do contrato na emissão da NFS-e", () => {
  test("recupera o código cadastrado no contrato escolhido", () => {
    const contratos = [
      { id: "a", codigoNbs: "101010100" },
      { id: "b", codigoNbs: "401010000" },
    ];
    expect(codigoNbsContrato(contratos, "b")).toBe("401010000");
  });

  test("contrato sem código cadastrado deixa o campo em branco", () => {
    expect(codigoNbsContrato([{ id: "a", codigoNbs: "" }], "a")).toBe("");
    expect(codigoNbsContrato([{ id: "a", codigoNbs: "   " }], "a")).toBe("");
    expect(codigoNbsContrato([{ id: "a" }], "a")).toBe("");
    expect(codigoNbsContrato([{ id: "a", codigoNbs: null }], "a")).toBe("");
  });

  test("sem contrato escolhido não reutiliza código de outro contrato", () => {
    expect(codigoNbsContrato([], "a")).toBe("");
    expect(codigoNbsContrato([{ id: "b", codigoNbs: "401010000" }], "a")).toBe("");
    expect(codigoNbsContrato([{ id: "b", codigoNbs: "401010000" }], "")).toBe("");
  });
});
