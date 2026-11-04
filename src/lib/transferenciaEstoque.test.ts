import { describe, it, expect } from "vitest";
import { validarTransferencia, type ItemTransferencia } from "./transferenciaEstoque";

const item = (q: number, origem = "Central"): ItemTransferencia => ({
  materialId: "m1", materialCodigo: "1", materialDescricao: "Cabo", unidadeMedida: "UN", localOrigem: origem, quantidade: q,
});
const saldo = () => 10;

describe("validarTransferencia", () => {
  it("aceita quantidade dentro do saldo", () => {
    expect(validarTransferencia([item(10)], "Obra", saldo)).toEqual([]);
  });
  it("bloqueia quantidade acima do saldo", () => {
    expect(validarTransferencia([item(11)], "Obra", saldo)).toHaveLength(1);
  });
  it("bloqueia origem igual ao destino", () => {
    expect(validarTransferencia([item(1, "Obra")], "Obra", saldo)).toHaveLength(1);
  });
  it("soma itens repetidos do mesmo local", () => {
    expect(validarTransferencia([item(6), item(6)], "Obra", saldo)).toHaveLength(1);
  });
});
