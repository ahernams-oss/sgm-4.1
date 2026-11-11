/** Metadata only: never use this marker to authorize actions or client access. */
export const lerMarcadorCliente = (row: { destinado_cliente?: boolean | null }): boolean =>
  row.destinado_cliente === true;

export const gravarMarcadorCliente = (cadastro: { destinadoCliente?: boolean }) => ({
  destinado_cliente: cadastro.destinadoCliente === true,
});