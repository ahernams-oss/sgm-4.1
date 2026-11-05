// A fiscal date is not a UTC instant. Legacy date-only responses were
// stored by PostgreSQL as midnight UTC; keep their civil day when displaying.
export function formatarDataEmissaoNfse(valor: string | null | undefined) {
  if (!valor) return "—";
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]00:00:00(?:\.0+)?(?:Z|\+00(?::00)?)?)?$/.test(valor)) {
    return valor.slice(0, 10).split("-").reverse().join("/");
  }
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function normalizarDataRetornoNfse(valor: string | null | undefined) {
  if (!valor) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T00:00:00-03:00` : valor;
}