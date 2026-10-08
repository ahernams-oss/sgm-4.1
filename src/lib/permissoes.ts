// Regra de permissão do SGM, a mesma no navegador (usePermissao, AuthContext) e nas
// funções de servidor (src/lib/edge/permissao.ts). Mudou aqui, muda nos dois lados.

export type Permissoes = Record<string, boolean>;

// Cargos com acesso total ao sistema (o banco usa a mesma lista em sgm_cargo_acesso_total)
export const CARGO_DIRETOR_GERAL = "diretor geral lasant";
export const CARGOS_ACESSO_TOTAL = [
  CARGO_DIRETOR_GERAL,
  "gerente executivo lasant",
  "coordenador administrativo lasant",
  "coordenador técnico lasant",
  "coordenador tecnico lasant",
];

export function normalizarCargo(nomeCargo: string | null | undefined): string {
  return (nomeCargo || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function cargoTemAcessoTotal(nomeCargo: string | null | undefined): boolean {
  return CARGOS_ACESSO_TOTAL.includes(normalizarCargo(nomeCargo));
}

export function cargoEhDiretorGeral(nomeCargo: string | null | undefined): boolean {
  return normalizarCargo(nomeCargo) === CARGO_DIRETOR_GERAL;
}

/** Ação exata do perfil (ex.: "usuarios.editar"). Acesso total libera tudo. */
export function temPermissao(
  acessoTotal: boolean,
  permissoes: Permissoes | null | undefined,
  chave: string,
): boolean {
  if (acessoTotal) return true;
  return !!permissoes?.[chave];
}

/**
 * Qualquer permissão do módulo (chave exata ou qualquer subchave começando com `${prefixo}.`).
 * É o que decide se o item de menu e a rota aparecem.
 */
export function temPermissaoNoModulo(
  acessoTotal: boolean,
  permissoes: Permissoes | null | undefined,
  prefixo: string,
): boolean {
  if (acessoTotal) return true;
  const perms = permissoes || {};
  if (perms[prefixo]) return true;
  const dot = `${prefixo}.`;
  for (const k of Object.keys(perms)) {
    if (perms[k] && k.startsWith(dot)) return true;
  }
  return false;
}
