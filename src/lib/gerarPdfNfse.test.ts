import { describe, expect, it } from "vitest";
import { numeroFiscalNfse, podeGerarPdfNfse } from "./gerarPdfNfse";

describe("documento PDF da NFS-e", () => {
  it("disponibiliza documento somente para notas emitidas ou canceladas", () => {
    expect(podeGerarPdfNfse({ status: "emitida" })).toBe(true);
    expect(podeGerarPdfNfse({ status: "cancelada" })).toBe(true);
    for (const status of ["rascunho", "processando", "rejeitada"] as const) expect(podeGerarPdfNfse({ status })).toBe(false);
  });
  it("obtém o número fiscal nacional sem confundir com a DPS", () => {
    expect(numeroFiscalNfse('<NFSe><nNFSe>123</nNFSe><DPS><nDPS>118</nDPS></DPS></NFSe>')).toBe("123");
    expect(numeroFiscalNfse('<n:NFSe><n:nNFSe>456</n:nNFSe></n:NFSe>')).toBe("456");
    expect(numeroFiscalNfse('<DPS><nDPS>118</nDPS></DPS>')).toBeNull();
  });
  it("mostra a nota autorizada 601 no lugar da DPS 550 da grade", () => {
    expect(numeroFiscalNfse('<NFSe><infNFSe><nNFSe>601</nNFSe><DPS><infDPS><nDPS>550</nDPS><serie>30000</serie></infDPS></DPS></infNFSe></NFSe>')).toBe("601");
  });
  it("não transforma DPS 550 em número de nota ainda não autorizada", () => {
    expect(numeroFiscalNfse('<DPS><infDPS><nDPS>550</nDPS><serie>30000</serie></infDPS></DPS>')).toBeNull();
  });
  it("extrai o número ABRASF somente de InfNfse", () => {
    expect(numeroFiscalNfse('<Rps><Numero>118</Numero></Rps><InfNfse><Numero>789</Numero></InfNfse>')).toBe("789");
    expect(numeroFiscalNfse(null)).toBeNull();
  });
});