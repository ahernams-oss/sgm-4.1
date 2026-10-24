import { z } from "zod";

export const dataCreditoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do crédito em conta.").refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Informe uma data válida.");

export async function confirmarLancamentoPagamento<T>(senha: string, verificar: (senha: string) => Promise<boolean>, gravar: () => Promise<T>): Promise<T> {
  if (!senha || !(await verificar(senha))) throw new Error("Senha incorreta. O pagamento não foi registrado.");
  return gravar();
}