import { describe, expect, it } from "vitest";
import { opcoesClassificacaoEpi } from "./epiClassificacao";

describe("opções de classificação de EPIs", () => {
  it("reutiliza as opções existentes sem duplicar acentos, caixa ou espaços", () => {
    expect(opcoesClassificacaoEpi([" PROTEÇÃO ", "protecao", "", "Luvas"])).toEqual(["Luvas", "PROTEÇÃO"]);
  });
  it("inclui uma nova opção preservando seu nome", () => {
    expect(opcoesClassificacaoEpi(["Capacetes", "Proteção facial"])).toEqual(["Capacetes", "Proteção facial"]);
  });
});