import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import { numeroNotaXml, chaveNotaXml } from "./numeroNotaXml";

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

describe("chave fiscal do XML anexado", () => {
  const national = "33045521643295100017000000000000000000000000000592";
  const product = "33261116432951000170550010000005921000000592";
  const extractKey = (xml: string) => chaveNotaXml(new DOMParser().parseFromString(xml, "text/xml") as unknown as Document);

  it("extrai os 50 dígitos de infNFSe@Id, não o identificador da DPS", () => {
    expect(extractKey(`<NFSe><infNFSe Id="NFS${national}"><DPS><infDPS Id="DPS123"/></DPS></infNFSe></NFSe>`)).toBe(national);
    expect(extractKey(`<NFSe><infNFSe Id="NFSe${national}"><DPS><infDPS Id="DPS123"/></DPS></infNFSe></NFSe>`)).toBe(national);
  });
  it("reconhece namespaces e prioriza a chave fiscal sobre código de verificação", () => {
    expect(extractKey(`<n:NFSe xmlns:n="urn:nfse"><n:infNFSe Id="NFSe${national}"><n:CodigoVerificacao>ABC123</n:CodigoVerificacao></n:infNFSe></n:NFSe>`)).toBe(national);
  });
  it("lê chNFSe explícita", () => {
    expect(extractKey(`<NFSe><chNFSe>${national}</chNFSe></NFSe>`)).toBe(national);
  });
  it("mantém os 44 dígitos da NF-e em tag ou atributo", () => {
    expect(extractKey(`<nfeProc><protNFe><infProt><chNFe>${product}</chNFe></infProt></protNFe></nfeProc>`)).toBe(product);
    expect(extractKey(`<NFe><infNFe Id="NFe${product}"/></NFe>`)).toBe(product);
  });
  it("deixa vazio sem chave válida e não usa chave interna da DPS", () => {
    expect(extractKey(`<NFSe><DPS><infDPS><ChaveAcesso>${national}</ChaveAcesso></infDPS></DPS><CodigoVerificacao>ABC123</CodigoVerificacao></NFSe>`)).toBe("");
    expect(extractKey('<NFSe><infNFSe Id="NFSe123"/></NFSe>')).toBe("");
  });
});