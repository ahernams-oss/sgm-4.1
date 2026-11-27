import { expect, it } from "vitest";
import { compararSetorCritico } from "./prioridadeSetorCritico";

const criticos = new Set(["administracao", "uti"]);
const registros = [
  { numero: 100, setorId: "comum", prioridade: "Emergencial" },
  { numero: 91, setorId: "administracao", prioridade: "" },
  { numero: 2, setorId: "uti", prioridade: "Normal" },
];

it.each([1, -1])("setores críticos ficam acima mesmo com número em direção %s", direcao => {
  const ordenados = [...registros].sort((a, b) => compararSetorCritico(a, b, criticos) || direcao * (a.numero - b.numero));
  expect(ordenados.map(s => s.numero)).toEqual(direcao === 1 ? [2, 91, 100] : [91, 2, 100]);
});

it("setor crítico sem prioridade fica acima de emergencial de setor comum", () => {
  const ordenados = [...registros].sort((a, b) => compararSetorCritico(a, b, criticos) || Number(b.prioridade === "Emergencial") - Number(a.prioridade === "Emergencial"));
  expect(ordenados.map(s => s.numero)).toEqual([91, 2, 100]);
});

it("entre setores críticos a coluna escolhida continua decidindo a ordem", () => {
  expect(compararSetorCritico({ setorId: "administracao" }, { setorId: "uti" }, criticos)).toBe(0);
});

it("entre setores comuns a coluna escolhida continua decidindo a ordem", () => {
  expect(compararSetorCritico({ setorId: "comum" }, { setorId: "outro" }, criticos)).toBe(0);
});