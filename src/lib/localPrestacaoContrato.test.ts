import { describe, expect, it } from "vitest";
import { municipiosPrestacaoContrato, trocarUfPrestacaoContrato } from "./localPrestacaoContrato";

describe("Local de prestação do contrato", () => {
  it("oferece municípios somente da UF selecionada", () => {
    expect(municipiosPrestacaoContrato("RJ")).toContainEqual({ codigo: "3304557", nome: "Rio de Janeiro" });
    expect(municipiosPrestacaoContrato("SP")).not.toContainEqual({ codigo: "3304557", nome: "Rio de Janeiro" });
  });
  it("limpa o município anterior ao trocar a UF", () => {
    const anterior = { ufPrestacao: "RJ", codigoMunicipioPrestacao: "3304557", municipioPrestacao: "Rio de Janeiro", codigoTributacaoNacional: "07.05.01" };
    expect({ ...anterior, ...trocarUfPrestacaoContrato("SP") }).toEqual({ ufPrestacao: "SP", codigoMunicipioPrestacao: "", municipioPrestacao: "", codigoTributacaoNacional: "07.05.01" });
  });
});