import { describe, expect, test } from "vitest";
import base from "./data/os-classificacao-historico.server.json";
import { associarPadrao, encontrarPadrao, historicoElegivel, type PadraoClassificacao } from "./osClassificacao";

const padroes = base.patterns as PadraoClassificacao[];
describe("classificação assistida de OS", () => {
  test("admite apenas o histórico dos anos 2025 e 2026", () => {
    expect(historicoElegivel("2025-01-01", 6, true, true, true)).toBe(true);
    expect(historicoElegivel("2026-10-13", 6, true, true, true)).toBe(true);
    expect(historicoElegivel("2024-12-31", 6, true, true, true)).toBe(false);
    expect(historicoElegivel("2027-01-01", 6, true, true, true)).toBe(false);
    expect(base.anos).toEqual([2025, 2026]);
  });
  test("exige situação 6 validada", () => {
    expect(historicoElegivel("2025-01-01", 5, true, true, true)).toBe(false);
    expect(historicoElegivel("2025-01-01", 6, true, true, true)).toBe(true);
    expect(base.situacao).toBe(6);
  });
  test("exclui categorias ou serviços inativos e vínculos incorretos", () => {
    expect(historicoElegivel("2025-01-01", 6, false, true, true)).toBe(false);
    expect(historicoElegivel("2025-01-01", 6, true, false, true)).toBe(false);
    expect(historicoElegivel("2025-01-01", 6, true, true, false)).toBe(false);
  });
  test("troca de lâmpada sugere a categoria e serviço provenientes do histórico real", () => {
    expect(encontrarPadrao("Troca de lâmpada", padroes)).toEqual(["lampada troca", "EL - ELÉTRICA", "LÂMPADAS E ACESSÓRIOS", 712, 718]);
    expect(encontrarPadrao("TROCA DA LAMPADA!", padroes)?.[1]).toBe("EL - ELÉTRICA");
  });
  test("mantém manual quando não há analogia confiável ou descrição é genérica ou mista", () => {
    expect(encontrarPadrao("vistoria", padroes)).toBeNull();
    expect(encontrarPadrao("troca de equipamento quântico", padroes)).toBeNull();
    expect(encontrarPadrao("troca de lâmpada e reparo de torneira", padroes)).toBeNull();
    expect(encontrarPadrao("troca de lampada", [["lampada troca", "EL", "Lampada", 8, 10]])).toBeNull();
  });
  test("não reutiliza IDs antigos e exige serviço vinculado à categoria atual", () => {
    const p = encontrarPadrao("troca de lampada", padroes);
    const categorias = [{ id: "categoria-atual", nome: "EL - ELÉTRICA" }];
    expect(associarPadrao(p, categorias, [{ id: "servico-atual", nome: "LÂMPADAS E ACESSÓRIOS", categoria_id: "categoria-atual" }])?.servicoId).toBe("servico-atual");
    expect(associarPadrao(p, categorias, [{ id: "servico-atual", nome: "LÂMPADAS E ACESSÓRIOS", categoria_id: "outra-categoria" }])).toBeNull();
    expect(associarPadrao(p, [], [])).toBeNull();
  });
});