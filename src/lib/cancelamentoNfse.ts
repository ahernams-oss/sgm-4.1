// Contract: https://brasilnfe.com.br/api/nfs-e#cancelamento-2 (POST /CancelarNotaFiscal)
export const MOTIVOS_CANCELAMENTO_NFSE = [
  { codigo: 1, label: "Erro na emissão" },
  { codigo: 2, label: "Serviço não prestado" },
  { codigo: 3, label: "Duplicidade da nota" },
  { codigo: 9, label: "Outros" },
] as const;

export function montarCancelamentoBrasilNfe(numeroNfse: string, ambiente: number, codigo: number, justificativa: string) {
  return { TipoAmbiente: ambiente === 1 ? 1 : 2, TipoDocumento: 1, NumeroNFSe: numeroNfse, CodCancelamentoNFSe: codigo, Justificativa: justificativa.slice(0, 1000) };
}

export type ResultadoCancelamento =
  | { situacao: "cancelada"; protocolo: string | null; mensagem: string }
  | { situacao: "processando"; mensagem: string }
  | { situacao: "erro"; mensagem: string };

/** Only Status 1 without an error is a confirmed cancellation. */
export function interpretarCancelamentoBrasilNfe(body: any): ResultadoCancelamento {
  const erro = typeof body?.Error === "string" ? body.Error.trim() : "";
  const motivo = String(body?.DsMotivo || "").trim();
  if (Number(body?.Status) === 1 && !erro) return { situacao: "cancelada", protocolo: body?.NuProtocolo ? String(body.NuProtocolo) : null, mensagem: motivo || "Cancelamento autorizado" };
  if (Number(body?.Status) === 2 && !erro) return { situacao: "processando", mensagem: motivo || "Cancelamento em processamento" };
  return { situacao: "erro", mensagem: erro || motivo || "Cancelamento recusado pela Brasil NFe" };
}
