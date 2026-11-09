export function codigoNbsContrato(
  contratos: { id: string; codigoNbs?: string | null }[],
  contratoId: string,
): string {
  const codigo = contratos.find(contrato => contrato.id === contratoId)?.codigoNbs;
  return codigo ? String(codigo).trim() : "";
}
