export function textoContratoNfse(
  contratos: { id: string; textoNotaFiscal?: string | null }[],
  contratoId: string,
): string {
  return contratos.find(contrato => contrato.id === contratoId)?.textoNotaFiscal ?? "";
}