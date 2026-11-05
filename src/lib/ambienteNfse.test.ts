import { describe, expect, test } from "vitest";
import { ambienteNfse, validarAmbienteNfse } from "./ambienteNfse";
import { temPermissaoNoModulo } from "./permissoes";

describe("Ambiente da NFS-e", () => {
  test("produção usa 1", () => {
    expect(validarAmbienteNfse(1)).toBe(1);
    expect(ambienteNfse(1)).toBe(1);
  });
  test("homologação usa 2 e é o padrão sem configuração", () => {
    expect(validarAmbienteNfse(2)).toBe(2);
    expect(ambienteNfse(undefined)).toBe(2);
    expect(ambienteNfse(null)).toBe(2);
  });
  test("não aceita ambientes fora das duas opções", () => {
    for (const valor of [0, 3, "1", undefined]) {
      expect(() => validarAmbienteNfse(valor)).toThrow();
    }
  });
  test("sem acesso ao módulo de emissão não libera o seletor", () => {
    expect(temPermissaoNoModulo(false, {}, "financeiro.nfes_recebidas")).toBe(false);
    expect(temPermissaoNoModulo(false, { "financeiro.nfes_recebidas.visualizar": true }, "financeiro.nfes_recebidas")).toBe(true);
  });
});