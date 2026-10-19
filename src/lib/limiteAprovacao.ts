export function avaliarLimiteAprovacao(valor: number, limite: number | null | undefined) {
  if (limite == null || !Number.isFinite(limite) || limite <= 0) return "sem_limite";
  if (!Number.isFinite(valor) || valor < 0) return "valor_invalido";
  if (valor > limite) return "excedido";
  return "permitido";
}