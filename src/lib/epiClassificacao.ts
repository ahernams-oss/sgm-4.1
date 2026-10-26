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

/** Mantém apenas os registros cujo Grupo/SubGrupo coincidem com o filtro escolhido.
 *  Filtro vazio significa "todos". Acentos, caixa e espaços não importam. */
export function filtrarEpisPorClassificacao<T extends { grupo: string; subgrupo: string }>(
  epis: T[],
  filtro: { grupo?: string; subgrupo?: string },
) {
  const grupo = normalizarClassificacaoEpi(filtro.grupo ?? "");
  const subgrupo = normalizarClassificacaoEpi(filtro.subgrupo ?? "");
  return epis.filter(epi =>
    (!grupo || normalizarClassificacaoEpi(epi.grupo) === grupo) &&
    (!subgrupo || normalizarClassificacaoEpi(epi.subgrupo) === subgrupo)
  );
}
