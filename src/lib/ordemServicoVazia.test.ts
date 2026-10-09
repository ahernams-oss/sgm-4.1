import { describe, expect, it } from "vitest";
import { criarOrdemServicoVazia } from "./ordemServicoVazia";

describe("O.S. em branco", () => {
  it("não possui identificação, datas, descrições ou materiais de uma ordem real", () => {
    const os = criarOrdemServicoVazia();
    expect(os.id).toBe("");
    expect(os.numero).toBe(0);
    expect(os.createdAt).toBe("");
    expect(os.descricaoServicos).toBe("");
    expect(os.materiais).toEqual([]);
    expect(os.historico).toEqual([]);
    expect(os.impresso).toBe(false);
  });
});