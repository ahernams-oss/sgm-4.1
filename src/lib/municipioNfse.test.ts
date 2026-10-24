import { describe, expect, it, vi } from "vitest";
import { codigoMunicipioNfse, ErroMunicipioNfse, resolverEnderecoMunicipioNfse } from "./municipioNfse";

describe("município da NFS-e", () => {
  it("rejeita o código zero que causou a rejeição do XML", () => {
    expect(codigoMunicipioNfse("0")).toBeNull();
    expect(codigoMunicipioNfse(undefined)).toBeNull();
    expect(codigoMunicipioNfse("3304557")).toBe("3304557");
  });
  it("resolve a cidade do tomador e não a da prestação", async () => {
    const endereco = await resolverEnderecoMunicipioNfse({ municipio: "NITEROI", uf: "rj", codigoMunicipio: "0" }, "tomador");
    expect(endereco.codigoMunicipio).toBe("3303302");
  });
  it("bloqueia endereço incompleto antes de consultar ou emitir", async () => {
    await expect(resolverEnderecoMunicipioNfse({ uf: "RJ" }, "tomador")).rejects.toThrow(ErroMunicipioNfse);
  });
  it("não escolhe outro município quando o nome não corresponde", async () => {
    await expect(resolverEnderecoMunicipioNfse({ municipio: "Cidade inexistente", uf: "RJ" }, "tomador")).rejects.toThrow("não encontrado");
  });
  it("mantém código válido sem depender da consulta externa", async () => {
    expect((await resolverEnderecoMunicipioNfse({ codigoMunicipio: "3303302" }, "tomador")).codigoMunicipio).toBe("3303302");
  });
  it("resolve com IBGE indisponível sem fazer chamadas de rede", async () => {
    const rede = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    try {
      expect((await resolverEnderecoMunicipioNfse({ municipio: "Rio de Janeiro", uf: "RJ" }, "tomador")).codigoMunicipio).toBe("3304557");
      expect(rede).not.toHaveBeenCalled();
    } finally { rede.mockRestore(); }
  });
});