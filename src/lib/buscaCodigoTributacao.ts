export function normalizarBuscaTributacao(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function correspondeCodigoTributacao(item: { codigo: string; descricao: string }, busca: string): boolean {
  const termos = normalizarBuscaTributacao(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) return true;
  if (/^[\d\s.,/-]+$/.test(busca.trim())) {
    return item.codigo.replace(/\D/g, "").includes(busca.replace(/\D/g, ""));
  }
  const texto = normalizarBuscaTributacao(`${item.codigo} ${item.descricao}`);
  return termos.every(termo => texto.includes(termo));
}