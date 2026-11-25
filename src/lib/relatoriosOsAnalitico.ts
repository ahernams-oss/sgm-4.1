import type { OrdemServico } from "@/contexts/OrdensServicoContext";

export const SEM_CATEGORIA = "SEM CATEGORIA";

export type AgrupamentoOS = { nome: string; qtd: number; valor: number };

export function percentuaisOsPorLocal(grupos: [string, OrdemServico[]][]) {
  const total = grupos.reduce((soma, [, ordens]) => soma + ordens.length, 0);
  return grupos.map(([nome, ordens]) => ({
    nome, qtd: ordens.length, percentual: total ? ordens.length * 100 / total : 0,
  }));
}

/** Categoria da O.S.; vazia ou só espaços cai em "SEM CATEGORIA". */
export const categoriaDeOS = (o: OrdemServico): string => {
  const categoria = (o.categoria ?? "").trim();
  return categoria === "" ? SEM_CATEGORIA : categoria;
};

/**
 * Agrupa O.S. por CATEGORIA (nunca por serviço), somando quantidade e valor.
 * Ordena por quantidade, depois valor e por nome.
 */
export const agruparPorCategoria = (
  ordens: OrdemServico[],
  totalDe: (o: OrdemServico) => number,
): AgrupamentoOS[] => {
  const mapa = new Map<string, { qtd: number; valor: number }>();
  ordens.forEach(o => {
    const chave = categoriaDeOS(o);
    const atual = mapa.get(chave) || { qtd: 0, valor: 0 };
    atual.qtd += 1;
    atual.valor += totalDe(o);
    mapa.set(chave, atual);
  });
  return Array.from(mapa.entries())
    .map(([nome, v]) => ({ nome, qtd: v.qtd, valor: v.valor }))
    .sort(
      (a, b) =>
        b.qtd - a.qtd ||
        b.valor - a.valor ||
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );
};
