/** Situações que encerram a solicitação: ela deixa de ser prioridade no topo da grade. */
export const SITUACOES_SEM_PRIORIDADE_NO_TOPO = ["Concluída"] as const;

/** Setores críticos lideram toda coluna/direção, exceto quando a solicitação já foi concluída. */
export function compararSetorCritico(
  a: { setorId: string; situacao?: string },
  b: { setorId: string; situacao?: string },
  setoresCriticos: ReadonlySet<string>,
): number {
  const aPesa = setorCriticoPesaNoTopo(a, setoresCriticos);
  const bPesa = setorCriticoPesaNoTopo(b, setoresCriticos);
  return Number(bPesa) - Number(aPesa);
}

/** true quando o setor é crítico e a solicitação ainda não foi concluída. */
export function setorCriticoPesaNoTopo(
  registro: { setorId: string; situacao?: string },
  setoresCriticos: ReadonlySet<string>,
): boolean {
  if (!setoresCriticos.has(registro.setorId)) return false;
  const situacao = String(registro.situacao ?? "").trim();
  return !SITUACOES_SEM_PRIORIDADE_NO_TOPO.includes(
    situacao as (typeof SITUACOES_SEM_PRIORIDADE_NO_TOPO)[number],
  );
}
