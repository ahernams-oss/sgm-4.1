import { describe, it, expect } from "vitest";
import { interpretarCancelamentoBrasilNfe, montarCancelamentoBrasilNfe } from "./cancelamentoNfse";

describe("cancelamento NFS-e Brasil NFe", () => {
  it("envia como NFS-e (TipoDocumento 1) no ambiente da nota", () => {
    expect(montarCancelamentoBrasilNfe("626", 1, 1, "x")).toMatchObject({ TipoAmbiente: 1, TipoDocumento: 1, NumeroNFSe: "626", CodCancelamentoNFSe: 1 });
  });
  it("só confirma cancelamento com Status 1 sem erro", () => {
    expect(interpretarCancelamentoBrasilNfe({ Status: 1, NuProtocolo: "99" }).situacao).toBe("cancelada");
    expect(interpretarCancelamentoBrasilNfe({ Status: 1, Error: "Prazo expirado" }).situacao).toBe("erro");
    expect(interpretarCancelamentoBrasilNfe({ Status: 2 }).situacao).toBe("processando");
    expect(interpretarCancelamentoBrasilNfe({ Status: 3, Error: "Falha" }).situacao).toBe("erro");
  });
});
