type EstadoCandidato = Record<string, unknown>;

/** Compare persisted business steps, not render state or private document contents. */
export function eventosRecrutamento(antes: EstadoCandidato, depois: EstadoCandidato): string[] {
  const campos: Record<string, string> = {
    etapaAtual: "Etapa do processo", statusPsicologico: "Avaliação psicológica",
    statusTecnico: "Avaliação técnica", statusLiberacao: "Liberação",
    contratacaoFinalizada: "Contratação finalizada", documentos: "Documentação atualizada",
    exameAdmissional: "Exame admissional atualizado", dadosBancarios: "Dados de admissão atualizados",
    parecerPsicologo: "Parecer psicológico atualizado", parecerTecnico: "Parecer técnico atualizado",
    portalEnviadoEm: "Acesso ao portal encaminhado", lgpdAceite: "Termo LGPD atualizado",
    agendamentoData: "Agendamento atualizado", agendamentoHora: "Agendamento atualizado",
    agendamentoLocal: "Agendamento atualizado", agendamentoEnviadoEm: "Aviso de agendamento encaminhado",
  };
  return [...new Set(Object.entries(campos)
    .filter(([campo]) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]))
    .map(([campo, evento]) => evento))];
}

export function destinosRequisicao(selecao: string, telefone: string): string[] {
  const normalizar = (valor: string) => {
    const v = valor.trim();
    if (!v) return "";
    if (/^\d{8,20}(?:-\d{8,12})?@g\.us$/.test(v)) return v;
    const d = v.replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) return `55${d}`;
    return /^\d{12,15}$/.test(d) ? d : "";
  };
  return [...new Set([normalizar(selecao), normalizar(telefone)].filter(Boolean))];
}