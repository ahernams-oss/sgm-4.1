import { describe, expect, it } from "vitest";
import { correspondeTomador } from "./buscaTomador";

const tomador = { id: "1", nome: "HOSPITAL DO ANDARAÍ - MANUTENÇÃO PREDIAL", nomeFantasia: "Unidade Saúde", cnpj: "00.394.544/0201-00" };
describe("busca do tomador", () => {
  it("encontra palavras fora de ordem sem acentos", () => {
    expect(correspondeTomador(tomador, "predial andarai")).toBe(true);
    expect(correspondeTomador(tomador, "hospital inexistente")).toBe(false);
  });
  it("encontra CNPJ inteiro ou parcial com ou sem máscara", () => {
    for (const busca of ["00.394.544/0201-00", "00394544020100", "394544", "0201-00"]) {
      expect(correspondeTomador(tomador, busca)).toBe(true);
    }
    expect(correspondeTomador(tomador, "999999")).toBe(false);
  });
  it("encontra CPF sem pontuação", () => {
    expect(correspondeTomador({ id: "2", cpf: "123.456.789-09" }, "12345678909")).toBe(true);
  });
  it("combina nome e documento e pesquisa nome fantasia", () => {
    expect(correspondeTomador(tomador, "saude 020100")).toBe(true);
    expect(correspondeTomador(tomador, "saude 9999")).toBe(false);
    expect(correspondeTomador(tomador, "")).toBe(true);
  });
});