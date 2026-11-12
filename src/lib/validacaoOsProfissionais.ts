export const MSG_OS_SEM_PROFISSIONAL =
  "Para validar a O.S. é necessário informar ao menos um funcionário na aba Profissionais.";

/** Uma O.S. só pode ficar "Validada" com pelo menos um profissional informado. */
export function podeValidarOs(profissionais: { funcionarioId?: string | null }[] | null | undefined): boolean {
  return (profissionais ?? []).some((p) => !!p?.funcionarioId);
}
