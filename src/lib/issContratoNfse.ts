export function aliquotaIssContratoNfse(iss: string | number | null | undefined, padrao: number | null | undefined): string {
  const texto = String(iss ?? "").trim();
  const numero = Number(texto.replace(",", "."));
  const valor = texto && Number.isFinite(numero) && numero >= 0 && numero <= 100
    ? numero
    : padrao ?? 5;
  // O formulário fiscal interpreta entradas no formato brasileiro.
  return String(valor).replace(".", ",");
}

export function contratoInicialNfse(contratos: { id: string }[]): string {
  return contratos.length === 1 ? contratos[0].id : "";
}