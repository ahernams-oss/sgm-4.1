import { describe, expect, it, vi } from "vitest";
import { codigoMunicipioNfse, resolverEnderecoMunicipioNfse } from "./municipioNfse";

describe("município da NFS-e", () => {
  it("rejeita o código zero que causou a rejeição do XML", () => {
    expect(codigoMunicipioNfse("0")).toBeNull();
    expect(codigoMunicipioNfse(undefined)).toBeNull();
    expect(codigoMunicipioNfse("3304557")).toBe("3304557");
  });
  it("resolve a cidade do tomador e não a da prestação", async () => {
    const consultar = vi.fn(async () => Response.json([{ id: 3304557, nome: "Rio de Janeiro" }, { id: 3303302, nome: "Niterói" }]));
    const endereco = await resolverEnderecoMunicipioNfse({ municipio: "NITEROI", uf: "rj", codigoMunicipio: "0" }, "tomador", consultar);
    expect(endereco.codigoMunicipio).toBe("3303302");
    expect(consultar).toHaveBeenCalledOnce();
  });
  it("bloqueia endereço incompleto antes de consultar ou emitir", async () => {
    const consultar = vi.fn();
    await expect(resolverEnderecoMunicipioNfse({ uf: "RJ" }, "tomador", consultar)).rejects.toThrow("Informe cidade e UF");
    expect(consultar).not.toHaveBeenCalled();
  });
  it("não escolhe outro município quando o nome não corresponde", async () => {
    const consultar = vi.fn(async () => Response.json([{ id: 3304557, nome: "Rio de Janeiro" }]));
    await expect(resolverEnderecoMunicipioNfse({ municipio: "Cidade inexistente", uf: "RJ" }, "tomador", consultar)).rejects.toThrow("não encontrado");
  });
  it("mantém código válido sem depender da consulta externa", async () => {
    const consultar = vi.fn();
    expect((await resolverEnderecoMunicipioNfse({ codigoMunicipio: "3303302" }, "tomador", consultar)).codigoMunicipio).toBe("3303302");
    expect(consultar).not.toHaveBeenCalled();
  });
});