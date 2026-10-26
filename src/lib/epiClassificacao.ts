export const normalizarClassificacaoEpi = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function opcoesClassificacaoEpi(values: string[]) {
  const unique = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizarClassificacaoEpi(trimmed);
    if (key && !unique.has(key)) unique.set(key, trimmed);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}