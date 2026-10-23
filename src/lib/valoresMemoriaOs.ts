type MaterialComValor = { codigo?: string; valorUnitario?: number | string };

// Referências numéricas antigas podem ter quantidades diferentes de zeros à esquerda.
export function normalizarCodigoMemoria(codigo?: string): string {
  const texto = String(codigo ?? "").trim().toUpperCase();
  return /^\d+$/.test(texto) ? texto.replace(/^0+(?=\d)/, "") : texto;
}

export function criarValoresMemoriaOs(materiais: MaterialComValor[]): Map<string, number> {
  const valores = new Map<string, number>();
  for (const material of materiais) {
    const codigo = normalizarCodigoMemoria(material.codigo);
    const bruto = material.valorUnitario;
    if (!codigo || bruto === undefined || bruto === null || bruto === "") continue;
    const valor = Number(String(bruto).replace(",", "."));
    if (Number.isFinite(valor)) valores.set(codigo, valor);
  }
  return valores;
}

export function valorUnitarioMemoriaOs(valores: Map<string, number>, codigo?: string): number | undefined {
  return valores.get(normalizarCodigoMemoria(codigo));
}