import { describe, expect, it } from "vitest";
import { deducoesExecucaoNfse, preencherValoresExecucaoNfse, somarValoresExecucaoNfse } from "./valoresExecucaoNfse";

describe("valores de execução da NFS-e", () => {
  it("calcula deduções como material aplicado mais benefícios e insumos, em centavos", () => {
    expect(deducoesExecucaoNfse("765,44", "100,00")).toBe("865,44");
    expect(deducoesExecucaoNfse("0,20", "0,10")).toBe("0,30");
    expect(deducoesExecucaoNfse("4.000,00", "500,00")).toBe("4.500,00");
    expect(deducoesExecucaoNfse("765,44", "")).toBe("765,44");
    expect(deducoesExecucaoNfse("", "")).toBe("0,00");
  });
  it("preenche benefícios e insumos sem alterar retenções ou texto manual", () => {
    const texto = "Texto manual / BENEFÍCIOS E INSUMOS -> R$ ----------- / RETENÇÃO INSS 11% -> R$ -----------";
    expect(preencherValoresExecucaoNfse(texto, "", "", "1.234,56")).toBe("Texto manual / BENEFÍCIOS E INSUMOS -> R$ 1.234,56 / RETENÇÃO INSS 11% -> R$ -----------");
    expect(preencherValoresExecucaoNfse("BENEFÍCIOS E INSUMOS -> R$ 100,00", "", "", "")).toBe("BENEFÍCIOS E INSUMOS -> R$ -------------");
  });
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
import { preencherRetencoesNfse } from "./valoresExecucaoNfse";
describe("preencherRetencoesNfse", () => {
  it("preenche INSS, PIS, COFINS e CSLL", () => {
    const t = "RETENÇÃO INSS 11% -> R$ ----------- / RETENÇÕES: PIS - 0,65% - R$ ----------- / COFINS - 3,00% - R$ ---------- / CSLL - 1,00% - R$ ---------.";
    expect(preencherRetencoesNfse(t, { inss: "110,00", pis: "6,50", cofins: "30,00", csll: "10,00" }))
      .toBe("RETENÇÃO INSS 11% -> R$ 110,00 / RETENÇÕES: PIS - 0,65% - R$ 6,50 / COFINS - 3,00% - R$ 30,00 / CSLL - 1,00% - R$ 10,00.");
  });
});
