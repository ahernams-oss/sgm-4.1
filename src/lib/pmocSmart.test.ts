import { describe, it, expect } from "vitest";
import { etapaSmart, podeIniciarSmart, proximaSmart, validarFotoSmart } from "./pmocSmart";
describe("Operação SMART", () => {
  it("em execução não é pendente nem confirmada", () => { expect(etapaSmart("Em execução")).toBe("Em execução"); });
  it("finalizada aguarda confirmação", () => { expect(etapaSmart("Pendente")).toBe("Aguardando Confirmação"); });
  it("só confirmada aparece concluída", () => { expect(etapaSmart("Confirmada")).toBe("Concluída"); });
  it("preserva janela de dois dias antes da execução", () => {
    expect(podeIniciarSmart("2026-11-12", new Date("2026-11-09T12:00:00"))).toBe(false);
    expect(podeIniciarSmart("2026-11-12", new Date("2026-11-10T00:00:00"))).toBe(true);
  });
  it("preserva próxima manutenção semanal", () => { expect(proximaSmart("Semanal", new Date("2026-11-09T12:00:00Z"))).toBe("2026-11-16T12:00:00.000Z"); });
  it("limita a seis fotos", () => { expect(validarFotoSmart("image/jpeg", 1000, 6)).not.toBeNull(); expect(validarFotoSmart("image/jpeg", 1000, 5)).toBeNull(); });
  it("limita cada foto a oito MB", () => { expect(validarFotoSmart("image/jpeg", 8 * 1024 * 1024 + 1, 0)).not.toBeNull(); expect(validarFotoSmart("image/jpeg", 8 * 1024 * 1024, 0)).toBeNull(); });
});