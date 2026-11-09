import { describe, expect, it } from "vitest";
import { clienteSelecionado, filtrarClientesPermitidos } from "./acessoClientes";

describe("acesso aos clientes selecionados", () => {
  it("selecionar apenas dois clientes não libera os demais", () => {
    const registros = [{ id: "fleming" }, { id: "leila" }, { id: "outro" }];
    expect(filtrarClientesPermitidos(registros, ["fleming", "leila"], (r) => r.id)).toEqual(registros.slice(0, 2));
  });
  it("nenhuma seleção não significa acesso total", () => {
    expect(clienteSelecionado([], "fleming")).toBe(false);
  });
  it("registros sem cliente não são liberados", () => {
    expect(clienteSelecionado(["fleming", "leila"], null)).toBe(false);
  });
  it("remover uma seleção retira os registros correspondentes", () => {
    expect(filtrarClientesPermitidos([{ cliente: "fleming" }, { cliente: "leila" }], ["leila"], (r) => r.cliente)).toEqual([{ cliente: "leila" }]);
  });
});