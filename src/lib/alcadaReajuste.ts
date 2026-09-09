/**
 * Alçada de tolerância para reajustes de preço pós-aprovação.
 *
 * - Reajustes de até 20% recebem aprovação expressa do Coordenador de Compras/Manutenção.
 * - Divergências superiores exigem notificação e aceite do aditivo de verba pela Diretoria.
 */

export const LIMITE_ALCADA_PERCENTUAL = 20;

export type Alcada = "Sem Reajuste" | "Expressa" | "Diretoria";

/** Classifica a alçada necessária a partir da variação percentual do preço. */
export function classificarAlcada(variacaoPercentual: number): Alcada {
  if (variacaoPercentual <= 0.0001) return "Sem Reajuste";
  return variacaoPercentual <= LIMITE_ALCADA_PERCENTUAL ? "Expressa" : "Diretoria";
}

/** Dias corridos entre a aprovação da cotação e a confirmação de valores. */
export function calcularDiasAtraso(dataAprovacao?: string, referencia: Date = new Date()): number {
  if (!dataAprovacao) return 0;
  const ini = new Date(dataAprovacao).getTime();
  if (Number.isNaN(ini)) return 0;
  const dias = Math.floor((referencia.getTime() - ini) / 86400000);
  return dias > 0 ? dias : 0;
}

/** Impacto financeiro atribuído ao atraso de aprovação (somente reajustes com atraso). */
export function calcularImpactoAtraso(variacaoValor: number, diasAtraso: number): number {
  if (diasAtraso <= 0) return 0;
  return Math.max(0, variacaoValor);
}

export const ALCADA_BADGE: Record<Alcada, string> = {
  "Sem Reajuste": "bg-muted text-muted-foreground border-border",
  "Expressa": "bg-blue-100 text-blue-700 border-blue-200",
  "Diretoria": "bg-red-100 text-red-700 border-red-200",
};
