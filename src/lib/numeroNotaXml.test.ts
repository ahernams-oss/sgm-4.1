import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { numeroNotaXml } from "./numeroNotaXml";

const extract = (xml: string) => numeroNotaXml(new DOMParser().parseFromString(xml, "text/xml") as unknown as Document);

describe("número fiscal do XML anexado", () => {
  it("lê a nota nacional 592, não a DPS 541 ou um Numero interno", () => {
    expect(extract('<NFSe><infNFSe><DPS><infDPS><nDPS>541</nDPS><Numero>541</Numero></infDPS></DPS><nNFSe>592</nNFSe></infNFSe></NFSe>')).toBe("592");
  });
  it("aceita namespaces na nota nacional", () => {
    expect(extract('<n:NFSe xmlns:n="urn:nfse"><n:infNFSe><n:nNFSe>593</n:nNFSe><n:DPS><n:nDPS>542</n:nDPS></n:DPS></n:infNFSe></n:NFSe>')).toBe("593");
  });
  it("lê o Numero direto de InfNfse ABRASF e ignora RPS anterior", () => {
    expect(extract('<Nfse><InfNfse><Rps><IdentificacaoRps><Numero>118</Numero></IdentificacaoRps></Rps><Numero>123</Numero></InfNfse></Nfse>')).toBe("123");
  });
  it("mantém suporte à NF-e de produto", () => {
    expect(extract('<NFe><infNFe><ide><nNF>456</nNF></ide></infNFe></NFe>')).toBe("456");
  });
  it("não usa DPS, RPS ou Numero genérico quando não há número fiscal", () => {
    expect(extract('<NFSe><infNFSe><DPS><infDPS><nDPS>541</nDPS><Numero>541</Numero></infDPS></DPS></infNFSe></NFSe>')).toBe("");
    expect(extract('<Rps><Numero>118</Numero></Rps>')).toBe("");
    expect(extract('<Documento><Numero>999</Numero></Documento>')).toBe("");
  });
  it("preserva zeros do número municipal explícito", () => {
    expect(extract('<Documento><NumeroNfse>000123</NumeroNfse></Documento>')).toBe("000123");
  });
});