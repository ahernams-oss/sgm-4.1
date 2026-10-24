import { afterEach, describe, expect, it, vi } from "vitest";
import { BRASILNFE_FISCAL_URL, dataFiscalBrasilNfe, montarPayloadBrasilNfe, interpretarRetornoBrasilNfe } from "./nfseBrasilNfe";

describe("emissão Brasil NFe", () => {
  afterEach(() => vi.useRealTimers());
  it.each([
    ["2026-10-24T01:40:00.000Z", "2026-10-23"],
    ["2026-10-24T02:59:59.999Z", "2026-10-23"],
    ["2026-10-24T03:00:00.000Z", "2026-10-24"],
    ["2027-01-01T01:00:00.000Z", "2026-12-31"],
  ])("calcula o dia fiscal brasileiro em %s sem avançar a data", (instante, esperado) => {
    expect(dataFiscalBrasilNfe(new Date(instante))).toBe(esperado);
  });
  it("envia a data documentada da DPS e preserva a competência informada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T01:40:00.000Z"));
    const modelo = {
      dataCompetencia: "2026-09-30", servico: {}, tributos: {},
      prestador: { codigoMunicipio: "3304557" },
      tomador: { endereco: { codigoMunicipio: "3303302" } },
    };
    const nota = montarPayloadBrasilNfe(118, modelo, "nfse-118", 2).nFSInfo[0];
    expect(nota?.DataEmissao).toBe("2026-10-23");
    expect(nota?.DataCompetencia).toBe("2026-09-30");
    expect(montarPayloadBrasilNfe(118, { ...modelo, dataCompetencia: undefined }, "nfse-118", 2).nFSInfo[0]?.DataCompetencia).toBe("2026-10-23");
  });
  it("usa Brasil NFe e preserva ambiente e identificação do pedido", () => {
    const payload = montarPayloadBrasilNfe(118, {
      servico: { descricao: "Manutenção", valorServico: 65, codigoTributacaoMunicipio: "14.01.07" },
      tributos: { aliquotaIss: 5, issRetido: false }, prestador: { codigoMunicipio: "3304557" },
      tomador: { documento: "12.345.678/0001-90", razaoSocial: "Cliente", endereco: { codigoMunicipio: "3303302" } },
    }, "nfse-118", 2);
    expect(BRASILNFE_FISCAL_URL).toBe("https://api.brasilnfe.com.br/services/fiscal");
    expect(payload.TipoAmbiente).toBe(2);
    expect(payload.nFSInfo[0]?.IdentificadorInterno).toBe("nfse-118");
    expect(payload.nFSInfo[0]?.Servico.Valores.ValorServico).toBe(65);
    expect(payload.nFSInfo[0]?.Tomador.Endereco.CodMunicipio).toBe("3303302");
    expect(payload.nFSInfo[0]?.Servico.CodMunicipioPrestacao).toBe("3304557");
  });
  it("bloqueia município ausente antes de montar o XML para envio", () => {
    expect(() => montarPayloadBrasilNfe(0, {
      servico: {}, tributos: {}, prestador: { codigoMunicipio: "3304557" },
      tomador: { endereco: { codigoMunicipio: "0" } },
    }, "validacao", 2)).toThrow("município IBGE válido");
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