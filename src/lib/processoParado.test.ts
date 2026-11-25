import { describe, it, expect } from "vitest";
import { precisaAlertaParado } from "./processoParado";
const agora = new Date("2026-11-25T20:00:00Z");
const base = { alerta_inatividade_em: null, candidatos: [] };
describe("processo parado", () => {
  it("alerta após mais de 72 h sem movimento", () => {
    expect(precisaAlertaParado({ ...base, ultimo_movimento_em: "2026-11-22T19:00:00Z" }, agora)).toBe(true);
  });
  it("não alerta com 72 h ou menos", () => {
    expect(precisaAlertaParado({ ...base, ultimo_movimento_em: "2026-11-22T20:00:00Z" }, agora)).toBe(false);
  });
  it("não repete alerta já enviado", () => {
    expect(precisaAlertaParado({ ...base, ultimo_movimento_em: "2026-11-01T00:00:00Z", alerta_inatividade_em: "2026-11-05T00:00:00Z" }, agora)).toBe(false);
  });
  it("não alerta processo com candidato liberado", () => {
    expect(precisaAlertaParado({ ...base, ultimo_movimento_em: "2026-11-01T00:00:00Z", candidatos: [{ statusLiberacao: "aprovado" }] }, agora)).toBe(false);
  });
});
