import { describe, expect, it } from "vitest";
import { gravarMarcadorCliente, lerMarcadorCliente } from "./marcadorCliente";

describe("marcador de cadastros destinados a clientes", () => {
  it("preserva a marcação e permite desmarcar no salvamento", () => {
    expect(lerMarcadorCliente(gravarMarcadorCliente({ destinadoCliente: true }))).toBe(true);
    expect(lerMarcadorCliente(gravarMarcadorCliente({ destinadoCliente: false }))).toBe(false);
  });
  it("não classifica automaticamente cadastros existentes", () => {
    expect(lerMarcadorCliente({})).toBe(false);
    expect(lerMarcadorCliente({ destinado_cliente: null })).toBe(false);
    expect(gravarMarcadorCliente({})).toEqual({ destinado_cliente: false });
  });
  it("grava somente o marcador, sem permissões ou clientes liberados", () => {
    const cadastro = { destinadoCliente: true, permissoes: { "ss.criar": false }, clientesPermitidos: ["cliente-1"] };
    expect(gravarMarcadorCliente(cadastro)).toEqual({ destinado_cliente: true });
    expect(cadastro.permissoes["ss.criar"]).toBe(false);
    expect(cadastro.clientesPermitidos).toEqual(["cliente-1"]);
  });
});