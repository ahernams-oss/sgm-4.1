import { describe, expect, it } from "vitest";
import { ordenarEpis } from "./ordenarEpis";

const epis = [
  { id: "1", codigo: "EPI-002", descricao: "luva de raspa", grupo: "proteção das mãos", subgrupo: "", unidade: "PAR", ca: "9", validadeMeses: 6 },
  { id: "2", codigo: "EPI-010", descricao: "capacete de segurança", grupo: "proteção da cabeça", subgrupo: "", unidade: "UN", ca: "12", validadeMeses: 12 },
  { id: "3", codigo: "EPI-001", descricao: "Óculos de proteção", grupo: "PROTEÇÃO DOS OLHOS", subgrupo: "", unidade: "UN", ca: "100", validadeMeses: null },
];

describe("ordenarEpis", () => {
  it("mantém a lista quando nenhuma coluna foi escolhida", () => {
    expect(ordenarEpis(epis, null).map(e => e.id)).toEqual(["1", "2", "3"]);
  });

  it("ordena texto ignorando acentos e maiúsculas", () => {
    expect(ordenarEpis(epis, "descricao", "asc").map(e => e.id)).toEqual(["2", "3", "1"]);
    expect(ordenarEpis(epis, "descricao", "desc").map(e => e.id)).toEqual(["1", "3", "2"]);
  });

  it("ordena grupo como texto e unidade como texto", () => {
    expect(ordenarEpis(epis, "grupo", "asc").map(e => e.grupo)).toEqual([
      "proteção da cabeça",
      "proteção das mãos",
      "PROTEÇÃO DOS OLHOS",
    ]);
  });

  it("ordena validade como número e deixa sem informação por último", () => {
    expect(ordenarEpis(epis, "validadeMeses", "asc").map(e => e.id)).toEqual(["1", "2", "3"]);
    expect(ordenarEpis(epis, "validadeMeses", "desc").map(e => e.id)).toEqual(["2", "1", "3"]);
  });

  it("deixa subgrupo vazio por último nas duas direções", () => {
    expect(ordenarEpis(epis, "subgrupo", "asc").map(e => e.id)).toEqual(["1", "2", "3"]);
    expect(ordenarEpis(epis, "subgrupo", "desc").map(e => e.id)).toEqual(["1", "2", "3"]);
  });

  it("não altera a lista recebida", () => {
    const original = [...epis];
    ordenarEpis(epis, "codigo", "desc");
    expect(epis.map(e => e.id)).toEqual(original.map(e => e.id));
  });
});
