/** Critical sectors lead every column/direction; secondary sorting stays unchanged. */
export function compararSetorCritico(
  a: { setorId: string }, b: { setorId: string }, setoresCriticos: ReadonlySet<string>,
): number {
  return Number(setoresCriticos.has(b.setorId)) - Number(setoresCriticos.has(a.setorId));
}