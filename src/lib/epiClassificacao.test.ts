import { describe, expect, it } from "vitest";
import { filtrarEpisPorClassificacao, opcoesClassificacaoEpi } from "./epiClassificacao";

const base = [
  { grupo: "Proteção respiratória", subgrupo: "Máscaras" },
  { grupo: "protecao respiratoria", subgrupo: "Respiradores" },
  { grupo: "Proteção da cabeça", subgrupo: "Capacetes" },
  { grupo: "", subgrupo: "" },
];

describe("opções de classificação de EPIs", () => {
  it("reutiliza as opções existentes sem duplicar acentos, caixa ou espaços", () => {
    expect(opcoesClassificacaoEpi([" PROTEÇÃO ", "protecao", "", "Luvas"])).toEqual(["Luvas", "PROTEÇÃO"]);
  });
  it("inclui uma nova opção preservando seu nome", () => {
    expect(opcoesClassificacaoEpi(["Capacetes", "Proteção facial"])).toEqual(["Capacetes", "Proteção facial"]);
  });
});

describe("filtro de classificação de EPIs", () => {
  it("mantém todos os registros quando nenhum filtro é escolhido", () => {
    expect(filtrarEpisPorClassificacao(base, {})).toHaveLength(4);
    expect(filtrarEpisPorClassificacao(base, { grupo: "", subgrupo: "" })).toHaveLength(4);
  });
  it("filtra por grupo ignorando acentos e caixa", () => {
    const resultado = filtrarEpisPorClassificacao(base, { grupo: "PROTECAO RESPIRATORIA" });
    expect(resultado.map(epi => epi.subgrupo)).toEqual(["Máscaras", "Respiradores"]);
  });
  it("filtra por subgrupo dentro do grupo escolhido", () => {
    expect(filtrarEpisPorClassificacao(base, { grupo: "Proteção respiratória", subgrupo: "respiradores" })).toEqual([
      { grupo: "protecao respiratoria", subgrupo: "Respiradores" },
    ]);
  });
  it("não mostra registros quando o subgrupo não pertence ao grupo escolhido", () => {
    expect(filtrarEpisPorClassificacao(base, { grupo: "Proteção da cabeça", subgrupo: "Máscaras" })).toEqual([]);
  });
});
