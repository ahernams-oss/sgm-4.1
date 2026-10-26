import { normalizarClassificacaoEpi } from "@/lib/epiClassificacao";

/** Colunas da grade de EPIs que podem ser ordenadas clicando no cabeçalho. */
export type ColunaEpi =
  | "codigo"
  | "descricao"
  | "grupo"
  | "subgrupo"
  | "unidade"
  | "ca"
  | "validadeMeses"
  | "observacao";

export type DirecaoOrdenacao = "asc" | "desc";

type RegistroOrdenavel = Partial<Record<ColunaEpi, string | number | null | undefined>>;

const estaVazio = (valor: string | number | null | undefined) =>
  valor === null || valor === undefined || String(valor).trim() === "";

/** Ordena a lista pela coluna escolhida, sem alterar a lista original.
 *  Textos comparam ignorando acentos e maiúsculas; validade compara como número;
 *  registros sem informação naquela coluna ficam sempre por último. */
export function ordenarEpis<T extends RegistroOrdenavel>(
  epis: T[],
  coluna: ColunaEpi | null,
  direcao: DirecaoOrdenacao = "asc",
): T[] {
  if (!coluna) return epis;
  const fator = direcao === "asc" ? 1 : -1;
  return [...epis].sort((a, b) => {
    const valorA = a[coluna];
    const valorB = b[coluna];
    const vazioA = estaVazio(valorA);
    const vazioB = estaVazio(valorB);
    if (vazioA && vazioB) return 0;
    if (vazioA) return 1;
    if (vazioB) return -1;
    if (coluna === "validadeMeses") return (Number(valorA) - Number(valorB)) * fator;
    return normalizarClassificacaoEpi(String(valorA)).localeCompare(normalizarClassificacaoEpi(String(valorB)), "pt-BR") * fator;
  });
}
