export type AmbienteNfse = 1 | 2;

export function ambienteNfse(valor: unknown): AmbienteNfse {
  return valor === 1 ? 1 : 2;
}

export function validarAmbienteNfse(valor: unknown): AmbienteNfse {
  if (valor !== 1 && valor !== 2) throw new Error("Selecione Homologação ou Produção.");
  return valor;
}