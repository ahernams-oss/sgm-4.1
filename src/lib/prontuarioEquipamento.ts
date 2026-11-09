/** Dados do prontuário: histórico de O.S. PMOC de um equipamento, em ordem cronológica. */
export interface OsProntuario {
  id: string;
  numero: number;
  equipamento_id: string;
  descricao?: string | null;
  tipo?: string | null;
  status?: string | null;
  data_abertura?: string | null;
  data_conclusao?: string | null;
  tecnico_responsavel?: string | null;
  aprovado_por?: string | null;
  observacoes?: string | null;
  evidencias?: unknown;
}

export const dataOsProntuario = (o: OsProntuario) => (o.data_conclusao || o.data_abertura || "").slice(0, 10);

export function fotosOsProntuario(o: OsProntuario): string[] {
  return Array.isArray(o.evidencias) ? o.evidencias.filter((x): x is string => typeof x === "string" && !!x) : [];
}

/** Só O.S. do equipamento informado, da mais antiga para a mais recente (empate pelo número). */
export function historicoProntuario(ordens: OsProntuario[], equipamentoId: string): OsProntuario[] {
  return ordens
    .filter((o) => o.equipamento_id === equipamentoId)
    .sort((a, b) => dataOsProntuario(a).localeCompare(dataOsProntuario(b)) || (a.numero || 0) - (b.numero || 0));
}

export function resumoProntuario(hist: OsProntuario[]) {
  return {
    total: hist.length,
    concluidas: hist.filter((o) => o.status === "Concluída").length,
    fotos: hist.reduce((n, o) => n + fotosOsProntuario(o).length, 0),
    primeira: hist[0] ? dataOsProntuario(hist[0]) : "",
    ultima: hist.length ? dataOsProntuario(hist[hist.length - 1]) : "",
  };
}
