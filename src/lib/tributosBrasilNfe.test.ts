import { expect, test } from "vitest";
import { configurarTributosBrasilNfe } from "./tributosBrasilNfe";

const federal = { pisCofinsSituacao: "1", aliquotaPis: 0.65, aliquotaCofins: 3,
  basePisCofins: 10, descContribRetidas: "5", contribSociaisRetidas: 0.1, irrf: 0.15 };
test("envia destaque de alíquotas e retenções preenchidas mesmo no serviço de R$10", () => {
  const config = configurarTributosBrasilNfe({ federal }, 10);
  expect(config?.DestacarPisCofins).toBe(true);
  expect(config?.RegimePisCofins).toBe(1);
  expect(config?.ForcarIncidenciaPis).toBe(true);
  expect(config?.ForcarIncidenciaCofins).toBe(true);
  expect(config?.ForcarIncidenciaCsll).toBe(true);
  expect(config?.ForcarIncidenciaIr).toBe(true);
});
test("destaque sem retenção não pede desconto de PIS/COFINS no líquido", () => {
  const config = configurarTributosBrasilNfe({ federal: { ...federal, descContribRetidas: "0", contribSociaisRetidas: 0, irrf: 0 } }, 10);
  expect(config?.DestacarPisCofins).toBe(true);
  expect(config?.ForcarIncidenciaPis).toBe(false);
  expect(config?.ForcarIncidenciaCofins).toBe(false);
});
test("não envia silenciosamente alíquota ou CST sem suporte documentado", () => {
  expect(() => configurarTributosBrasilNfe({ federal: { ...federal, aliquotaPis: 2 } }, 10)).toThrow();
  expect(() => configurarTributosBrasilNfe({ federal: { ...federal, pisCofinsSituacao: "7" } }, 10)).toThrow();
});