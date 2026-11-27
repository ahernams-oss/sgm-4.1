export function entrouEmAprovacaoEmergencial(
  anterior: { situacao: string; prioridade: string } | undefined,
  alteracao: { situacao?: string; prioridade?: string },
) {
  return alteracao.situacao === "Aprovada"
    && (alteracao.prioridade ?? anterior?.prioridade) === "Emergencial"
    && !(anterior?.situacao === "Aprovada" && anterior.prioridade === "Emergencial");
}

/** Resolve the exact hierarchy; a critical sector elsewhere must never match. */
export function setorDaSolicitacaoEhCritico(locais: unknown, ss: { local_id: string | null; pavimento_id: string | null; setor_id: string | null }) {
  const porId = (lista: unknown, id: string | null): Record<string, unknown> | undefined => {
    if (!id || !Array.isArray(lista)) return undefined;
    return lista.find((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item) && item["id"] === id);
  };
  const local = porId(locais, ss.local_id);
  const pavimento = porId(local?.["pavimentos"], ss.pavimento_id);
  const setor = porId(pavimento?.["setores"], ss.setor_id);
  return setor?.["critico"] === true;
}