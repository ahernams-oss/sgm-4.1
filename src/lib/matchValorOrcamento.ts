/** Busca monetária aceita reais formatados ou valores sem separador de milhar. */
export function matchValorOrcamento(valor: number | null | undefined, busca: string): boolean {
  if (valor == null || !Number.isFinite(valor)) return false;
  const termo = busca.replace(/r\$/gi, "").replace(/\s/g, "").trim();
  if (!termo || !/^\d[\d.,]*$/.test(termo)) return false;

  const brasileiro = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return [brasileiro, brasileiro.replace(/\./g, ""), valor.toFixed(2)]
    .some(formato => formato.includes(termo));
}