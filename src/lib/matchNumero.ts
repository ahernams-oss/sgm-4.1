/**
 * Verifica se um número (ex.: 29) corresponde a uma busca textual
 * tolerando prefixos (RCS-, PC-, OC-, COT-) e zeros à esquerda.
 * Ex.: matchNumero(29, "0029") → true; matchNumero(29, "rcs-0029") → true.
 */
export function matchNumero(numero: number | string | undefined | null, search: string): boolean {
  if (numero === undefined || numero === null) return false;
  const s = String(search).toLowerCase().trim();
  if (!s) return true;
  const sStripped = s.replace(/^(rcs|pc|oc|cot|rc|ss|os)-?/, "");
  const sNoZeros = sStripped.replace(/^0+/, "") || "0";
  const numStr = String(numero);
  const numPad = numStr.padStart(4, "0");
  return (
    numStr.includes(sStripped) ||
    numStr.includes(sNoZeros) ||
    numPad.includes(sStripped) ||
    numPad.includes(s)
  );
}
