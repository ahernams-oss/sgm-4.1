import { describe, it, expect } from "vitest";
import { ordenarFornecedores } from "./ordenarFornecedores";

type F = { id: string; codigo?: number | string | null; nome?: string | null };

const lista: F[] = [
  { id: "3", codigo: 10, nome: "zz materiais" },
  { id: "1", codigo: 2, nome: "Água & Cia" },
  { id: "2", codigo: 9, nome: "ação limpeza" },
  { id: "4", codigo: null, nome: "Bola Construções" },
];

describe("ordenarFornecedores", () => {
  it("sem coluna escolhida mantém a ordem original", () => {
    expect(ordenarFornecedores(lista, null).map((f) => f.id)).toEqual(["3", "1", "2", "4"]);
  });

  it("ordena por código como número, não como texto", () => {
    expect(ordenarFornecedores(lista, "codigo", "asc").map((f) => f.id)).toEqual(["1", "2", "3", "4"]);
    expect(ordenarFornecedores(lista, "codigo", "desc").map((f) => f.id)).toEqual(["3", "2", "1", "4"]);
  });

  it("ordena por razão social ignorando acentos e maiúsculas", () => {
    expect(ordenarFornecedores(lista, "nome", "asc").map((f) => f.nome)).toEqual([
      "ação limpeza",
      "Água & Cia",
      "Bola Construções",
      "zz materiais",
    ]);
    expect(ordenarFornecedores(lista, "nome", "desc").map((f) => f.nome)).toEqual([
      "zz materiais",
      "Bola Construções",
      "Água & Cia",
      "ação limpeza",
    ]);
  });

  it("registros sem informação na coluna escolhida ficam sempre por último", () => {
    const comVazios: F[] = [
      { id: "v", codigo: null, nome: "Zeta" },
      { id: "a", codigo: 5, nome: "Alfa" },
    ];
    expect(ordenarFornecedores(comVazios, "codigo", "asc").map((f) => f.id)).toEqual(["a", "v"]);
    expect(ordenarFornecedores(comVazios, "codigo", "desc").map((f) => f.id)).toEqual(["a", "v"]);
    expect(ordenarFornecedores(comVazios, "nome", "desc").map((f) => f.id)).toEqual(["v", "a"]);
  });

  it("não altera a lista original", () => {
    const original = lista.map((f) => f.id);
    ordenarFornecedores(lista, "nome", "desc");
    expect(lista.map((f) => f.id)).toEqual(original);
  });
});
