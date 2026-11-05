import { expect, test } from "vitest";
import { calcularValorCsllNfse } from "./valorCsllNfse";
import { configurarTributosBrasilNfe } from "./tributosBrasilNfe";

test("CSLL mantém o valor calculado mesmo sem retenção", () => {
  const valor = calcularValorCsllNfse(100);
  expect(valor).toBe(1);
  const config = configurarTributosBrasilNfe({ federal: {
    pisCofinsSituacao: "1", basePisCofins: 100, aliquotaPis: 0.65,
    aliquotaCofins: 3, descContribRetidas: "0", contribSociaisRetidas: valor, irrf: 0,
  } }, 100);
  expect(config?.IncideCsll).toBe(false);
  expect(config?.ForcarIncidenciaCsll).toBe(false);
});

test("valor exibido da CSLL não ativa retenção na opção PIS/COFINS", () => {
  const valor = calcularValorCsllNfse(100);
  const config = configurarTributosBrasilNfe({ federal: {
    pisCofinsSituacao: "1", basePisCofins: 100, aliquotaPis: 0.65,
    aliquotaCofins: 3, descContribRetidas: "5", contribSociaisRetidas: valor, irrf: 0,
  } }, 100);
  expect(valor).toBe(1);
  expect(config?.IncidePis).toBe(true);
  expect(config?.IncideCofins).toBe(true);
  expect(config?.IncideCsll).toBe(false);
  expect(config?.ForcarIncidenciaCsll).toBe(false);
});