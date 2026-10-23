/** Busca monetária aceita reais formatados ou valores sem separador de milhar. */
export function matchValorOrcamento(valor: number | null | undefined, busca: string): boolean {
  if (valor == null || !Number.isFinite(valor)) return false;
  const bruto = busca.replace(/r\$/gi, "").replace(/\s/g, "").trim();
  if (!bruto || !/^\d[\d.,]*$/.test(bruto)) return false;

  const brasileiro = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  // Formatos textuais: "1.250,50", "1250,50", "1250.50"
  if ([brasileiro, brasileiro.replace(/\./g, ""), valor.toFixed(2)]
    .some(formato => formato.includes(bruto))) return true;

  // Fallback por dígitos: aceita "235393", "2,353.93" (formato americano),
  // trechos sem separador e prefixos do valor.
  const digitos = (s: string) => s.replace(/\D/g, "");
  const termoDigitos = digitos(bruto);
  return termoDigitos.length > 0 && digitos(brasileiro).includes(termoDigitos);
}
