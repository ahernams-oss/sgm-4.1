import { format, isValid } from "date-fns";

export function validarPeriodoExecucaoNfse(inicio?: Date, fim?: Date): string | undefined {
  if (!inicio && !fim) return;
  if (!inicio || !fim) return "Informe o início e o fim do período de execução";
  if (!isValid(inicio) || !isValid(fim)) return "Informe datas válidas para o período de execução";
  if (format(fim, "yyyy-MM-dd") < format(inicio, "yyyy-MM-dd")) return "O fim do período não pode ser anterior ao início";
}

export function preencherPeriodoExecucaoNfse(texto: string, inicio?: Date, fim?: Date): string {
  const data = (valor?: Date) => valor && isValid(valor) ? format(valor, "dd/MM/yyyy") : "      /       /          ";
  const trecho = `PERÍODO DE EXECUÇÃO DE (${data(inicio)}) A (${data(fim)}).`;
  // Replace only the period, never the remaining manually edited description.
  const periodo = /PER[IÍ]ODO\s+DE\s+EXECU[CÇ][AÃ]O\s+DE\s*\([^)]*\)\s*A\s*\([^)]*\)\s*\.?/i;
  if (periodo.test(texto)) return texto.replace(periodo, trecho);
  if (!inicio || !fim || validarPeriodoExecucaoNfse(inicio, fim)) return texto;
  return `${texto.trimEnd()}${texto.trim() ? "\n" : ""}${trecho}`;
}