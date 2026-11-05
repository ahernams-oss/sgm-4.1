import { describe, expect, it } from "vitest";
import { decodificarPdfDanfse, extrairDanfseOficial } from "./danfseOficial";

const nota = { id: "x", numero_dps: 539, ambiente: 1, prestador: { cnpj: "16.432.951/0001-70" } };
const pdf = btoa("%PDF-1.4\noriginal\n%%EOF");
const autorizado = { StatusLote: 1, CodTipoAmbiente: 1, Notas: [{
  IdentificadorInterno: "nfse-x", NumeroRPS: 539, NumeroNFSe: "590",
  CpfCnpjPrestador: "16432951000170", Status: 1, Base64Doc: pdf,
}] };
describe("DANFSe oficial", () => {
  it("preserva o PDF original da nota 590 sem confundir com a DPS 539", () => {
    expect(extrairDanfseOficial(autorizado, nota)).toMatchObject({ base64: pdf, numero: "590" });
    expect(new TextDecoder().decode(decodificarPdfDanfse(pdf))).toBe("%PDF-1.4\noriginal\n%%EOF");
  });
  it("não reutiliza o PDF de outra nota", () => {
    expect(() => extrairDanfseOficial(autorizado, { ...nota, id: "outra" })).toThrow("identificar");
  });
  it("não troca os ambientes de homologação e produção", () => {
    expect(() => extrairDanfseOficial(autorizado, { ...nota, ambiente: 2 })).toThrow("ambiente");
  });
  it("recusa documento de outro prestador", () => {
    expect(() => extrairDanfseOficial(autorizado, { ...nota, prestador: { cnpj: "00000000000000" } })).toThrow("corresponde");
  });
  it("valida o prestador no XML autorizado quando a Brasil NFe omite o CNPJ no JSON", () => {
    const Base64Xml = btoa('<NFSe><infNFSe><nNFSe>592</nNFSe><emit><CNPJ>16432951000170</CNPJ></emit><DPS><infDPS><tpAmb>1</tpAmb><nDPS>541</nDPS></infDPS></DPS></infNFSe></NFSe>');
    const body = { ...autorizado, Notas: [{ ...autorizado.Notas[0], NumeroRPS: 541, NumeroNFSe: "592", CpfCnpjPrestador: null, Base64Xml }] };
    expect(extrairDanfseOficial(body, { ...nota, numero_dps: 541 }).numero).toBe("592");
    expect(() => extrairDanfseOficial({ ...body, Notas: [{ ...body.Notas[0], NumeroNFSe: "593" }] }, { ...nota, numero_dps: 541 })).toThrow("corresponde");
  });
  it("não usa CNPJ do tomador nem aceita prestador ausente no JSON e XML", () => {
    const body = { ...autorizado, Notas: [{ ...autorizado.Notas[0], CpfCnpjPrestador: null, Base64Xml: btoa('<NFSe><toma><CNPJ>16432951000170</CNPJ></toma></NFSe>') }] };
    expect(() => extrairDanfseOficial(body, nota)).toThrow("corresponde");
  });
  it("não substitui PDF oficial ausente por representação local", () => {
    expect(() => extrairDanfseOficial({ ...autorizado, Notas: [{ ...autorizado.Notas[0], Base64Doc: null }] }, nota)).toThrow("disponibilizou");
  });
  it("recusa base64 inválido ou conteúdo que não seja PDF", () => {
    expect(() => decodificarPdfDanfse("@inválido")).toThrow("PDF válido");
    expect(() => decodificarPdfDanfse(btoa("<html>erro</html>"))).toThrow("PDF válido");
  });
  it("recusa documentos de notas sem autorização", () => {
    expect(() => extrairDanfseOficial({ ...autorizado, Notas: [{ ...autorizado.Notas[0], Status: 2 }] }, nota)).toThrow("autorizada");
  });
});