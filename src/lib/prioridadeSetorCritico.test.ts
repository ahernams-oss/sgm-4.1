import { expect, it } from "vitest";
import { compararSetorCritico, setorCriticoPesaNoTopo } from "./prioridadeSetorCritico";

const criticos = new Set(["administracao", "uti"]);
const registros = [
  { numero: 100, setorId: "comum", prioridade: "Emergencial", situacao: "Aprovada" },
  { numero: 91, setorId: "administracao", prioridade: "", situacao: "Aguardando aprovação" },
  { numero: 2, setorId: "uti", prioridade: "Normal", situacao: "Em execução" },
];

it.each([1, -1])("setores críticos ficam acima mesmo com número em direção %s", direcao => {
  const ordenados = [...registros].sort((a, b) => compararSetorCritico(a, b, criticos) || direcao * (a.numero - b.numero));
  expect(ordenados.map(s => s.numero)).toEqual(direcao === 1 ? [2, 91, 100] : [91, 2, 100]);
});

it("setor crítico sem prioridade fica acima de emergencial de setor comum", () => {
  const ordenados = [...registros].sort((a, b) => compararSetorCritico(a, b, criticos) || Number(b.prioridade === "Emergencial") - Number(a.prioridade === "Emergencial"));
  expect(ordenados.map(s => s.numero)).toEqual([91, 2, 100]);
});

it("setor crítico concluído sai do topo e segue a coluna escolhida", () => {
  const comConcluida = [
    { numero: 5, setorId: "comum", situacao: "Aprovada" },
    { numero: 7, setorId: "administracao", situacao: "Concluída" },
  ];
  const ordenados = [...comConcluida].sort((a, b) => compararSetorCritico(a, b, criticos) || a.numero - b.numero);
  expect(ordenados.map(s => s.numero)).toEqual([5, 7]);
});

it("concluída de setor crítico perde para pendente de setor crítico na mesma coluna", () => {
  const comConcluida = [
    { numero: 7, setorId: "administracao", situacao: "Concluída" },
    { numero: 8, setorId: "uti", situacao: "Em execução" },
  ];
  const ordenados = [...comConcluida].sort((a, b) => compararSetorCritico(a, b, criticos) || b.numero - a.numero);
  expect(ordenados.map(s => s.numero)).toEqual([8, 7]);
});

it("concluída em setor comum continua sem peso no topo", () => {
  expect(setorCriticoPesaNoTopo({ setorId: "comum", situacao: "Concluída" }, criticos)).toBe(false);
});

it("situação vazia em setor crítico continua pesando no topo", () => {
  expect(setorCriticoPesaNoTopo({ setorId: "uti", situacao: "" }, criticos)).toBe(true);
  expect(setorCriticoPesaNoTopo({ setorId: "uti" }, criticos)).toBe(true);
});

it("entre setores críticos a coluna escolhida continua decidindo a ordem", () => {
  expect(compararSetorCritico({ setorId: "administracao" }, { setorId: "uti" }, criticos)).toBe(0);
});

it("entre setores comuns a coluna escolhida continua decidindo a ordem", () => {
  expect(compararSetorCritico({ setorId: "comum" }, { setorId: "outro" }, criticos)).toBe(0);
});
