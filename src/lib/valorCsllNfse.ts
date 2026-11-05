// Display the existing CSLL calculation independently from withholding.
export function calcularValorCsllNfse(base: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round((base * 0.01 + Number.EPSILON) * 100) / 100;
}