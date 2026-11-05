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