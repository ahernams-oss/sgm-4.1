/** A permissão de módulo ou o cargo nunca substituem a seleção de clientes. */
export function clienteSelecionado(ids: readonly string[], clienteId: string | null | undefined): boolean {
  return !!clienteId && ids.includes(clienteId);
}

export function filtrarClientesPermitidos<T>(registros: readonly T[], ids: readonly string[], clienteId: (registro: T) => string | null | undefined): T[] {
  return registros.filter((registro) => clienteSelecionado(ids, clienteId(registro)));
}