import { describe, expect, test } from "vitest";
import { textoContratoNfse } from "./textoContratoNfse";
import { contratoInicialNfse } from "./issContratoNfse";

describe("Texto para NF do tomador", () => {
  test("recupera o texto do contrato único sem alterar o conteúdo", () => {
    const contratos = [{ id: "a", textoNotaFiscal: "Teste NF\nServiço contratado" }];
    expect(textoContratoNfse(contratos, contratoInicialNfse(contratos))).toBe("Teste NF\nServiço contratado");
  });
  test("recupera somente o texto do contrato escolhido quando há vários", () => {
    const contratos = [
      { id: "a", textoNotaFiscal: "Manutenção predial" },
      { id: "b", textoNotaFiscal: "Manutenção de equipamentos" },
    ];
    expect(textoContratoNfse(contratos, contratoInicialNfse(contratos))).toBe("");
    expect(textoContratoNfse(contratos, "b")).toBe("Manutenção de equipamentos");
  });
  test("sem texto ou contrato do novo tomador não reutiliza descrição anterior", () => {
    expect(textoContratoNfse([{ id: "a" }], "a")).toBe("");
    expect(textoContratoNfse([], "a")).toBe("");
    expect(textoContratoNfse([{ id: "b", textoNotaFiscal: "Outro tomador" }], "a")).toBe("");
  });
});