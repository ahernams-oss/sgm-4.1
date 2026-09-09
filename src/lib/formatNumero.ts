/** Formata número com ano: 03-2026 */
export function formatNumeroAno(numero: number | string | undefined | null, dataRef?: string | Date | null): string {
  const n = Number(numero ?? 0);
  const num = String(n).padStart(2, "0");
  let ano: number;
  if (dataRef) {
    const d = typeof dataRef === "string" ? new Date(dataRef) : dataRef;
    ano = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  } else {
    ano = new Date().getFullYear();
  }
  return `${num}-${ano}`;
}
