import { describe, it, expect } from "vitest";
import { podeValidarOs } from "./validacaoOsProfissionais";
describe("podeValidarOs", () => {
  it("bloqueia sem profissionais", () => { expect(podeValidarOs([])).toBe(false); expect(podeValidarOs(undefined)).toBe(false); });
  it("libera com um profissional", () => { expect(podeValidarOs([{ funcionarioId: "f1" }])).toBe(true); });
});
