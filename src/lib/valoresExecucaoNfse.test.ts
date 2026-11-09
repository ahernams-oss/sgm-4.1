import { describe, expect, it } from "vitest";
import { preencherValoresExecucaoNfse, somarValoresExecucaoNfse } from "./valoresExecucaoNfse";

describe("valores de execução da NFS-e", () => {
  it("transporta a soma de mão de obra e material para o valor do serviço em reais", () => {
    expect(somarValoresExecucaoNfse("1.234,56", "765,44")).toBe("2.000,00");
    expect(somarValoresExecucaoNfse("0,10", "0,20")).toBe("0,30");
    expect(somarValoresExecucaoNfse("", "250,00")).toBe("250,00");
  });
  it("preenche os dois trechos monetários sem alterar datas, benefícios ou retenções", () => {
    const texto = "PERÍODO DE EXECUÇÃO DE (01/11/2026) A (30/11/2026). VALOR MÃO DE OBRA → R$ ------------- / MATERIAL APLICADO E SERVIÇOS EXTRAS -> R$ ------------ / BENEFÍCIOS E INSUMOS -> R$ -------- / RETENÇÃO INSS 11% -> R$ --------.";
    const esperado = "PERÍODO DE EXECUÇÃO DE (01/11/2026) A (30/11/2026). VALOR MÃO DE OBRA → R$ 1.234,56 / MATERIAL APLICADO E SERVIÇOS EXTRAS -> R$ 765,44 / BENEFÍCIOS E INSUMOS -> R$ -------- / RETENÇÃO INSS 11% -> R$ --------.";
    expect(preencherValoresExecucaoNfse(texto, "1.234,56", "765,44")).toBe(esperado);
  });
  it("atualiza valores já preenchidos e preserva ajustes manuais no restante do texto", () => {
    const texto = "Texto ajustado. VALOR MAO DE OBRA: R$ 100,00 / MATERIAL APLICADO: R$ 200,00 / DADOS BANCÁRIOS: mantidos.";
    expect(preencherValoresExecucaoNfse(texto, "300,00", "400,00")).toBe("Texto ajustado. VALOR MAO DE OBRA: R$ 300,00 / MATERIAL APLICADO: R$ 400,00 / DADOS BANCÁRIOS: mantidos.");
  });
  it("restaura o espaço do valor apagado sem zerar o outro campo", () => {
    expect(preencherValoresExecucaoNfse("VALOR MÃO DE OBRA -> R$ 100,00 / MATERIAL APLICADO -> R$ 200,00", "", "200,00")).toBe("VALOR MÃO DE OBRA -> R$ ------------- / MATERIAL APLICADO -> R$ 200,00");
  });
});