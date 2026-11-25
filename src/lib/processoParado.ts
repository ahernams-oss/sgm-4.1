// Regra: processo seletivo iniciado sem movimento há mais de 72 h gera um único alerta
// ao WhatsApp Seleção, até que haja novo movimento (o banco zera o alerta).
export const HORAS_SEM_MOVIMENTO = 72;

type Proc = { ultimo_movimento_em: string | null; alerta_inatividade_em: string | null; candidatos: unknown };

export function processoEncerrado(candidatos: unknown): boolean {
  return Array.isArray(candidatos) && candidatos.some((c: any) => c?.statusLiberacao === "aprovado");
}

export function precisaAlertaParado(p: Proc, agora: Date): boolean {
  if (p.alerta_inatividade_em || !p.ultimo_movimento_em || processoEncerrado(p.candidatos)) return false;
  const horas = (agora.getTime() - new Date(p.ultimo_movimento_em).getTime()) / 3_600_000;
  return horas > HORAS_SEM_MOVIMENTO;
}
