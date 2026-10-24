import { describe, expect, it } from "vitest";
import { BRASILNFE_FISCAL_URL, montarPayloadBrasilNfe, interpretarRetornoBrasilNfe } from "./nfseBrasilNfe";

describe("emissão Brasil NFe", () => {
  it("usa Brasil NFe e preserva ambiente e identificação do pedido", () => {
    const payload = montarPayloadBrasilNfe(118, {
      servico: { descricao: "Manutenção", valorServico: 65, codigoTributacaoMunicipio: "14.01.07" },
      tributos: { aliquotaIss: 5, issRetido: false }, prestador: { codigoMunicipio: "3304557" },
      tomador: { documento: "12.345.678/0001-90", razaoSocial: "Cliente" },
    }, "nfse-118", 2);
    expect(BRASILNFE_FISCAL_URL).toBe("https://api.brasilnfe.com.br/services/fiscal");
    expect(payload.TipoAmbiente).toBe(2);
    expect(payload.nFSInfo[0]?.IdentificadorInterno).toBe("nfse-118");
    expect(payload.nFSInfo[0]?.Servico.Valores.ValorServico).toBe(65);
  });
  it("não considera um lote aguardando processamento uma emissão", () => {
    expect(interpretarRetornoBrasilNfe({ StatusLote: 2, Notas: [] }, "x").status).toBe("processando");
  });
  it("só confirma a nota autorizada correspondente", () => {
    const body = { StatusLote: 1, Notas: [{ IdentificadorInterno: "x", NumeroNFSe: "123", Status: 1 }] };
    expect(interpretarRetornoBrasilNfe(body, "x").status).toBe("emitida");
    expect(interpretarRetornoBrasilNfe({ ...body, Error: "Rejeição" }, "x").status).toBe("rejeitada");
  });
});