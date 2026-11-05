import { describe, expect, test } from "vitest";
import { formatarDataEmissaoNfse, normalizarDataRetornoNfse } from "./dataNfse";

describe("Data fiscal da NFS-e", () => {
  test("data civil e registros legados não aparecem como ontem", () => {
    for (const valor of ["2026-11-04", "2026-11-04T00:00:00+00:00", "2026-11-04T00:00:00.000Z", "2026-11-04 00:00:00+00"]) {
      expect(formatarDataEmissaoNfse(valor)).toBe("04/11/2026");
    }
  });
  test("retorno só com data é salvo à meia-noite brasileira", () => {
    expect(normalizarDataRetornoNfse("2026-11-04")).toBe("2026-11-04T00:00:00-03:00");
  });
  test("preserva o instante de autorização e exibe o dia brasileiro", () => {
    const valor = "2026-11-05T00:45:00Z";
    expect(normalizarDataRetornoNfse(valor)).toBe(valor);
    expect(formatarDataEmissaoNfse(valor)).toContain("04/11/2026");
    expect(formatarDataEmissaoNfse(valor)).toContain("21:45");
  });
});