import { describe, expect, it } from "vitest";
import { ABAS_FUNCIONARIOS, podeAcessarAbaFuncionario } from "./abasFuncionarios";

describe("acesso por aba de Funcionários", () => {
  it.each(ABAS_FUNCIONARIOS)("autoriza somente a aba $value marcada", ({ value }) => {
    const tem = (key: string) => key === `funcionarios.abas.${value}`;
    expect(ABAS_FUNCIONARIOS.filter(aba => podeAcessarAbaFuncionario(tem, aba.value)).map(aba => aba.value)).toEqual([value]);
  });
  it("cadastrar ou editar não libera abas não marcadas", () => {
    const tem = (key: string) => ["funcionarios", "funcionarios.criar", "funcionarios.editar"].includes(key);
    expect(ABAS_FUNCIONARIOS.filter(aba => podeAcessarAbaFuncionario(tem, aba.value))).toEqual([]);
  });
  it("não aceita abas desconhecidas mesmo com acesso total", () => {
    expect(podeAcessarAbaFuncionario(() => true, "inexistente")).toBe(false);
    expect(ABAS_FUNCIONARIOS.filter(aba => podeAcessarAbaFuncionario(() => true, aba.value))).toHaveLength(16);
  });
});