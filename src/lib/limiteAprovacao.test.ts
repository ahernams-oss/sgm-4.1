import { describe, expect, test } from "vitest";
import { avaliarLimiteAprovacao } from "./limiteAprovacao";

describe("limite de aprovação de orçamento", () => {
  test("usuário sem limite não aprova nem orçamento de valor zero", () => {
    for (const limite of [0, undefined, null, -1, NaN, Infinity]) {
      expect(avaliarLimiteAprovacao(0, limite)).toBe("sem_limite");
      expect(avaliarLimiteAprovacao(100, limite)).toBe("sem_limite");
    }
  });
  test("bloqueia orçamento que excede o limite cadastrado", () => {
    expect(avaliarLimiteAprovacao(100.01, 100)).toBe("excedido");
  });
  test("permite valor igual ou inferior ao limite positivo", () => {
    expect(avaliarLimiteAprovacao(100, 100)).toBe("permitido");
    expect(avaliarLimiteAprovacao(99, 100)).toBe("permitido");
  });
  test("valor inválido não contorna a conferência", () => {
    for (const valor of [NaN, Infinity, -1]) {
      expect(avaliarLimiteAprovacao(valor, 100)).toBe("valor_invalido");
    }
  });
});