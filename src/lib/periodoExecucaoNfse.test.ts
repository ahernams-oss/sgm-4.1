import { describe, expect, test } from "vitest";
import { preencherPeriodoExecucaoNfse, validarPeriodoExecucaoNfse } from "./periodoExecucaoNfse";

const inicio = new Date(2026, 9, 1);
const fim = new Date(2026, 9, 31);

describe("Período de execução da NFS-e", () => {
  test("preenche o espaço do contrato sem alterar os demais dados", () => {
    const texto = "MANUTENÇÃO – UPA. PERÍODO DE EXECUÇÃO DE (      /       /          )  A (       /       /           ). CONTRATO Nº 121/2023";
    expect(preencherPeriodoExecucaoNfse(texto, inicio, fim)).toBe("MANUTENÇÃO – UPA. PERÍODO DE EXECUÇÃO DE (01/10/2026) A (31/10/2026). CONTRATO Nº 121/2023");
  });
  test("trocar datas preserva ajustes manuais e não duplica o período", () => {
    const texto = preencherPeriodoExecucaoNfse("Texto ajustado\nPERÍODO DE EXECUÇÃO DE ( / / ) A ( / / ). Dados bancários", inicio, fim);
    expect(preencherPeriodoExecucaoNfse(texto, inicio, new Date(2026, 10, 9))).toBe("Texto ajustado\nPERÍODO DE EXECUÇÃO DE (01/10/2026) A (09/11/2026). Dados bancários");
  });
  test("acrescenta o período quando não existe espaço no texto", () => {
    expect(preencherPeriodoExecucaoNfse("Manutenção", inicio, fim)).toBe("Manutenção\nPERÍODO DE EXECUÇÃO DE (01/10/2026) A (31/10/2026).");
  });
  test("não inventa datas quando o período não foi informado", () => {
    expect(preencherPeriodoExecucaoNfse("Manutenção")).toBe("Manutenção");
    expect(validarPeriodoExecucaoNfse()).toBeUndefined();
  });
  test("exige as duas datas quando o usuário informa uma", () => {
    expect(validarPeriodoExecucaoNfse(inicio)).toBe("Informe o início e o fim do período de execução");
  });
  test("rejeita fim anterior ao início e aceita o mesmo dia", () => {
    expect(validarPeriodoExecucaoNfse(fim, inicio)).toBe("O fim do período não pode ser anterior ao início");
    expect(validarPeriodoExecucaoNfse(inicio, inicio)).toBeUndefined();
  });
});