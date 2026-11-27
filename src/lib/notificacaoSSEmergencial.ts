export function entrouEmAprovacaoEmergencial(
  anterior: { situacao: string; prioridade: string } | undefined,
  alteracao: { situacao?: string; prioridade?: string },
) {
  return alteracao.situacao === "Aprovada"
    && (alteracao.prioridade ?? anterior?.prioridade) === "Emergencial"
    && !(anterior?.situacao === "Aprovada" && anterior.prioridade === "Emergencial");
}