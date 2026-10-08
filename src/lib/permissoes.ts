// Regra de permissão do SGM, a mesma no navegador (usePermissao, AuthContext) e nas
// funções de servidor (src/lib/edge/permissao.ts). Mudou aqui, muda nos dois lados.

export type Permissoes = Record<string, boolean>;

// Cargos com acesso total ao sistema
export const CARGOS_ACESSO_TOTAL = [
  "diretor",
  "gerente executivo",
  "coordenador de departamento",
  "coordenador tecnico",
  "coordenador técnico",
  "coordenador administrativo",
];

export function cargoTemAcessoTotal(nomeCargo: string | null | undefined): boolean {
  return CARGOS_ACESSO_TOTAL.includes((nomeCargo || "").trim().toLowerCase());
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
