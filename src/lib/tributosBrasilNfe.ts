// Contract: https://brasilnfe.com.br/api/nfs-e — ConfiguracaoImposto.
// The provider computes PIS/COFINS/CSLL; it does not expose arbitrary
// CST, bases or rates. Reject incompatible inputs before consuming a DPS.
export function configurarTributosBrasilNfe(tributos: any, valorServico: number) {
  const f = tributos.federal;
  if (!f) return undefined;
  const perto = (a: number, b: number) => Math.abs(a - b) < 0.00001;
  const pis = Number(f.aliquotaPis ?? 0);
  const cofins = Number(f.aliquotaCofins ?? 0);
  const cumulativo = perto(pis, 0.65) && perto(cofins, 3);
  const naoCumulativo = perto(pis, 1.65) && perto(cofins, 7.6);
  if (String(f.pisCofinsSituacao) !== "1" || (!cumulativo && !naoCumulativo)) {
    throw new Error("A Brasil NFe documenta somente CST 01 com PIS/COFINS de 0,65% / 3% ou 1,65% / 7,60%. Os impostos informados não podem ser enviados por esse contrato.");
  }
  if (!perto(Number(f.basePisCofins), valorServico)) {
    throw new Error("A Brasil NFe não documenta base de PIS/COFINS diferente do valor do serviço. Confira os tributos antes de emitir.");
  }
  const retencao = String(f.descContribRetidas ?? "0");
  const reterPis = ["1", "3", "5"].includes(retencao);
  const reterCofins = ["2", "3", "5"].includes(retencao);
  // Withholding switches use fixed 0.65/3/1% in the provider contract.
  if ((!cumulativo && (reterPis || reterCofins)) ||
      (Number(f.contribSociaisRetidas) > 0 && !perto(Number(f.contribSociaisRetidas), Math.round(valorServico * 0.01 * 100) / 100))) {
    throw new Error("As retenções informadas não correspondem às alíquotas de cálculo documentadas pela Brasil NFe.");
  }
  const csll = Number(f.contribSociaisRetidas ?? 0) > 0;
  const ir = Number(f.irrf ?? 0) > 0;
  return {
    IncidePis: reterPis, IncideCofins: reterCofins, IncideCsll: csll, IncideIr: ir,
    ForcarIncidenciaPis: reterPis, ForcarIncidenciaCofins: reterCofins,
    ForcarIncidenciaCsll: csll, ForcarIncidenciaIr: ir,
    DestacarPisCofins: true, RegimePisCofins: cumulativo ? 1 : 2,
  };
}