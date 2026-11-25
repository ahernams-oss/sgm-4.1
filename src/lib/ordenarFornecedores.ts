/** Colunas da grade de Fornecedores que podem ser ordenadas clicando no cabeçalho. */
export type ColunaFornecedor = "codigo" | "nome";

export type DirecaoOrdenacao = "asc" | "desc";

export type RegistroFornecedorOrdenavel = {
  codigo?: number | string | null;
  nome?: string | null;
};

const normalizar = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const estaVazio = (valor: number | string | null | undefined) =>
  valor === null || valor === undefined || String(valor).trim() === "";

/** Ordena a lista pela coluna escolhida, sem alterar a lista original.
 *  Textos comparam ignorando acentos e maiúsculas; código compara como número
 *  quando os dois lados são numéricos; registros sem informação na coluna
 *  escolhida ficam sempre por último. */
export function ordenarFornecedores<T extends RegistroFornecedorOrdenavel>(
  registros: T[],
  coluna: ColunaFornecedor | null,
  direcao: DirecaoOrdenacao = "asc",
): T[] {
  if (!coluna) return registros;
  const fator = direcao === "asc" ? 1 : -1;
  return [...registros].sort((a, b) => {
    const valorA = a[coluna];
    const valorB = b[coluna];
    const vazioA = estaVazio(valorA);
    const vazioB = estaVazio(valorB);
    if (vazioA && vazioB) return 0;
    if (vazioA) return 1;
    if (vazioB) return -1;
    const textoA = String(valorA);
    const textoB = String(valorB);
    if (coluna === "codigo") {
      const numA = Number(textoA);
      const numB = Number(textoB);
      if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
        return (numA - numB) * fator;
      }
    }
    return normalizar(textoA).localeCompare(normalizar(textoB), "pt-BR") * fator;
  });
}
