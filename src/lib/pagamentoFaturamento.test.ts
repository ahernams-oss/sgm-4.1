import { describe, expect, it, vi } from "vitest";
import { confirmarLancamentoPagamento, dataCreditoSchema } from "./pagamentoFaturamento";

describe("Pagamento de faturamento", () => {
  it("exige uma data real de crédito em conta", () => {
    expect(dataCreditoSchema.safeParse("").success).toBe(false);
    expect(dataCreditoSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dataCreditoSchema.parse("2026-10-23")).toBe("2026-10-23");
  });
  it("não grava com senha incorreta", async () => {
    const gravar = vi.fn();
    await expect(confirmarLancamentoPagamento("errada", async () => false, gravar)).rejects.toThrow("Senha incorreta");
    expect(gravar).not.toHaveBeenCalled();
  });
  it("não grava sem senha", async () => {
    const gravar = vi.fn();
    await expect(confirmarLancamentoPagamento("", async () => true, gravar)).rejects.toThrow();
    expect(gravar).not.toHaveBeenCalled();
  });
  it("grava apenas após confirmar a senha", async () => {
    const gravar = vi.fn(async () => ({ ok: true }));
    await expect(confirmarLancamentoPagamento("correta", async senha => senha === "correta", gravar)).resolves.toEqual({ ok: true });
    expect(gravar).toHaveBeenCalledTimes(1);
  });
});