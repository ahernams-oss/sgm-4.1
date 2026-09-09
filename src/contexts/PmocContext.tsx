import { createContext, useContext, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

// ---- Interfaces ----
export interface PmocPlano {
  id: string; titulo: string; descricao: string; clienteId: string; clienteNome: string;
  unidade: string; contrato: string; edificio: string; ambienteCritico: string;
  vigenciaInicio: string; vigenciaFim: string; revisao: number; status: string;
  responsavelTecnicoId: string; responsavelTecnicoNome: string; observacoes: string;
  documentosAnexos: any[]; historicoRevisoes: any[];
  procedimentosFalha: string; contingencia: string;
}

export interface PmocAtividade {
  id: string; planoId: string; equipamentoId: string; equipamentoNome: string;
  descricao: string; tipo: string; periodicidade: string; checklistId: string;
  checklistTitulo: string; parametrosTecnicos: string; procedimentoFalha: string;
  prioridade: string; duracaoEstimada: string; materiaisPrevistos: any[];
  ativa: boolean; ultimaExecucao: string; proximaExecucao: string;
}

export interface PmocOrdemServico {
  id: string; numero: number; planoId: string; atividadeId: string;
  equipamentoId: string; equipamentoNome: string; origem: string;
  unidade: string; localDescricao: string; descricao: string; tipo: string;
  prioridade: string; status: string; dataAbertura: string; dataPrazo: string;
  dataInicioExecucao: string; dataConclusao: string; tecnicoResponsavel: string;
  equipe: string; materiaisPrevistos: any[]; materiaisUtilizados: any[];
  checklistId: string; checklistResultado: any[]; evidencias: any[];
  evidenciasObrigatorias: boolean; observacoes: string;
  aprovadoPor: string; dataAprovacao: string;
}

export interface PmocResponsavelTecnico {
  id: string; nome: string; registroProfissional: string; tipoRegistro: string;
  especialidade: string; telefone: string; email: string;
  documentoArtRrt: string; documentoUrl: string;
  vigenciaInicio: string; vigenciaFim: string; status: string;
  clientesVinculados: any[]; observacoes: string;
}

export interface PmocQualidadeArPonto {
  id: string; planoId: string; clienteId: string; descricao: string;
  ambiente: string; edificio: string; pavimento: string; tipoAmbiente: string;
  parametrosMonitorados: any[]; periodicidadeColeta: string; status: string;
}

export interface PmocQualidadeArMedicao {
  id: string; pontoId: string; pontoDescricao: string; dataMedicao: string;
  horaMedicao: string; temperatura: number | null; umidade: number | null;
  co2: number | null; renovacaoAr: number | null; pressaoDiferencial: number | null;
  outrosParametros: any; conforme: boolean; observacoes: string;
  relatorioLaboratorialUrl: string; responsavel: string; planoAcao: string;
  anexos: { nome: string; path: string; url: string; tamanho: number }[];
}

export interface PmocInconformidade {
  id: string; numero: number; planoId: string; osId: string;
  equipamentoId: string; equipamentoNome: string; ambiente: string;
  descricao: string; gravidade: string; causaProvavel: string;
  planoAcao: string; prazo: string; responsavel: string; status: string;
  dataEncerramento: string; reavaliacao: string; reincidencia: number;
  evidencias: any[]; historico: any[];
}

export interface PmocBibliotecaRotina {
  id: string; titulo: string; tipoEquipamento: string; tipoAtividade: string;
  descricao: string; checklistItens: any[]; periodicidadeSugerida: string;
  materiaisSugeridos: any[]; duracaoEstimada: string; versao: number; ativa: boolean;
}

// ---- Mappers ----
const rowToPlano = (r: any): PmocPlano => ({
  id: r.id, titulo: r.titulo ?? "", descricao: r.descricao ?? "",
  clienteId: r.cliente_id ?? "", clienteNome: r.cliente_nome ?? "",
  unidade: r.unidade ?? "", contrato: r.contrato ?? "",
  edificio: r.edificio ?? "", ambienteCritico: r.ambiente_critico ?? "",
  vigenciaInicio: r.vigencia_inicio ?? "", vigenciaFim: r.vigencia_fim ?? "",
  revisao: r.revisao ?? 1, status: r.status ?? "Ativo",
  responsavelTecnicoId: r.responsavel_tecnico_id ?? "",
  responsavelTecnicoNome: r.responsavel_tecnico_nome ?? "",
  observacoes: r.observacoes ?? "",
  documentosAnexos: r.documentos_anexos ?? [],
  historicoRevisoes: r.historico_revisoes ?? [],
  procedimentosFalha: r.procedimentos_falha ?? "",
  contingencia: r.contingencia ?? "",
});

const rowToAtividade = (r: any): PmocAtividade => ({
  id: r.id, planoId: r.plano_id ?? "", equipamentoId: r.equipamento_id ?? "",
  equipamentoNome: r.equipamento_nome ?? "", descricao: r.descricao ?? "",
  tipo: r.tipo ?? "Preventiva", periodicidade: r.periodicidade ?? "Mensal",
  checklistId: r.checklist_id ?? "", checklistTitulo: r.checklist_titulo ?? "",
  parametrosTecnicos: r.parametros_tecnicos ?? "",
  procedimentoFalha: r.procedimento_falha ?? "",
  prioridade: r.prioridade ?? "Normal", duracaoEstimada: r.duracao_estimada ?? "",
  materiaisPrevistos: r.materiais_previstos ?? [], ativa: r.ativa ?? true,
  ultimaExecucao: r.ultima_execucao ?? "", proximaExecucao: r.proxima_execucao ?? "",
});

const rowToOS = (r: any): PmocOrdemServico => ({
  id: r.id, numero: r.numero ?? 0, planoId: r.plano_id ?? "",
  atividadeId: r.atividade_id ?? "", equipamentoId: r.equipamento_id ?? "",
  equipamentoNome: r.equipamento_nome ?? "", origem: r.origem ?? "PMOC",
  unidade: r.unidade ?? "", localDescricao: r.local_descricao ?? "",
  descricao: r.descricao ?? "", tipo: r.tipo ?? "Preventiva",
  prioridade: r.prioridade ?? "Normal", status: r.status ?? "Aberta",
  dataAbertura: r.data_abertura ?? "", dataPrazo: r.data_prazo ?? "",
  dataInicioExecucao: r.data_inicio_execucao ?? "",
  dataConclusao: r.data_conclusao ?? "",
  tecnicoResponsavel: r.tecnico_responsavel ?? "", equipe: r.equipe ?? "",
  materiaisPrevistos: r.materiais_previstos ?? [],
  materiaisUtilizados: r.materiais_utilizados ?? [],
  checklistId: r.checklist_id ?? "", checklistResultado: r.checklist_resultado ?? [],
  evidencias: r.evidencias ?? [],
  evidenciasObrigatorias: r.evidencias_obrigatorias ?? false,
  observacoes: r.observacoes ?? "",
  aprovadoPor: r.aprovado_por ?? "", dataAprovacao: r.data_aprovacao ?? "",
});

const rowToRT = (r: any): PmocResponsavelTecnico => ({
  id: r.id, nome: r.nome ?? "", registroProfissional: r.registro_profissional ?? "",
  tipoRegistro: r.tipo_registro ?? "CREA", especialidade: r.especialidade ?? "",
  telefone: r.telefone ?? "", email: r.email ?? "",
  documentoArtRrt: r.documento_art_rrt ?? "", documentoUrl: r.documento_url ?? "",
  vigenciaInicio: r.vigencia_inicio ?? "", vigenciaFim: r.vigencia_fim ?? "",
  status: r.status ?? "Ativo", clientesVinculados: r.clientes_vinculados ?? [],
  observacoes: r.observacoes ?? "",
});

const rowToPonto = (r: any): PmocQualidadeArPonto => ({
  id: r.id, planoId: r.plano_id ?? "", clienteId: r.cliente_id ?? "",
  descricao: r.descricao ?? "", ambiente: r.ambiente ?? "",
  edificio: r.edificio ?? "", pavimento: r.pavimento ?? "",
  tipoAmbiente: r.tipo_ambiente ?? "",
  parametrosMonitorados: r.parametros_monitorados ?? [],
  periodicidadeColeta: r.periodicidade_coleta ?? "Mensal",
  status: r.status ?? "Ativo",
});

const rowToMedicao = (r: any): PmocQualidadeArMedicao => ({
  id: r.id, pontoId: r.ponto_id ?? "", pontoDescricao: r.ponto_descricao ?? "",
  dataMedicao: r.data_medicao ?? "", horaMedicao: r.hora_medicao ?? "",
  temperatura: r.temperatura, umidade: r.umidade, co2: r.co2,
  renovacaoAr: r.renovacao_ar, pressaoDiferencial: r.pressao_diferencial,
  outrosParametros: r.outros_parametros ?? {},
  conforme: r.conforme ?? true, observacoes: r.observacoes ?? "",
  relatorioLaboratorialUrl: r.relatorio_laboratorial_url ?? "",
  responsavel: r.responsavel ?? "", planoAcao: r.plano_acao ?? "",
  anexos: Array.isArray(r.anexos) ? r.anexos : [],
});

const rowToInconformidade = (r: any): PmocInconformidade => ({
  id: r.id, numero: r.numero ?? 0, planoId: r.plano_id ?? "",
  osId: r.os_id ?? "", equipamentoId: r.equipamento_id ?? "",
  equipamentoNome: r.equipamento_nome ?? "", ambiente: r.ambiente ?? "",
  descricao: r.descricao ?? "", gravidade: r.gravidade ?? "Moderada",
  causaProvavel: r.causa_provavel ?? "", planoAcao: r.plano_acao ?? "",
  prazo: r.prazo ?? "", responsavel: r.responsavel ?? "",
  status: r.status ?? "Aberta", dataEncerramento: r.data_encerramento ?? "",
  reavaliacao: r.reavaliacao ?? "", reincidencia: r.reincidencia ?? 0,
  evidencias: r.evidencias ?? [], historico: r.historico ?? [],
});

const rowToRotina = (r: any): PmocBibliotecaRotina => ({
  id: r.id, titulo: r.titulo ?? "", tipoEquipamento: r.tipo_equipamento ?? "",
  tipoAtividade: r.tipo_atividade ?? "Preventiva", descricao: r.descricao ?? "",
  checklistItens: r.checklist_itens ?? [],
  periodicidadeSugerida: r.periodicidade_sugerida ?? "Mensal",
  materiaisSugeridos: r.materiais_sugeridos ?? [],
  duracaoEstimada: r.duracao_estimada ?? "", versao: r.versao ?? 1,
  ativa: r.ativa ?? true,
});

// ---- Context ----
interface PmocContextType {
  planos: PmocPlano[]; atividades: PmocAtividade[]; ordensServico: PmocOrdemServico[];
  responsaveisTecnicos: PmocResponsavelTecnico[]; pontosQA: PmocQualidadeArPonto[];
  medicoesQA: PmocQualidadeArMedicao[]; inconformidades: PmocInconformidade[];
  biblioteca: PmocBibliotecaRotina[]; loading: boolean;
  addPlano: (d: any) => Promise<void>; updatePlano: (id: string, d: any) => Promise<void>; deletePlano: (id: string) => Promise<void>;
  addAtividade: (d: any) => Promise<void>; updateAtividade: (id: string, d: any) => Promise<void>; deleteAtividade: (id: string) => Promise<void>;
  addOS: (d: any) => Promise<void>; updateOS: (id: string, d: any) => Promise<void>; deleteOS: (id: string) => Promise<void>;
  addRT: (d: any) => Promise<void>; updateRT: (id: string, d: any) => Promise<void>; deleteRT: (id: string) => Promise<void>;
  addPontoQA: (d: any) => Promise<void>; updatePontoQA: (id: string, d: any) => Promise<void>; deletePontoQA: (id: string) => Promise<void>;
  addMedicaoQA: (d: any) => Promise<void>; updateMedicaoQA: (id: string, d: any) => Promise<void>; deleteMedicaoQA: (id: string) => Promise<void>;
  addInconformidade: (d: any) => Promise<void>; updateInconformidade: (id: string, d: any) => Promise<void>; deleteInconformidade: (id: string) => Promise<void>;
  addRotina: (d: any) => Promise<void>; updateRotina: (id: string, d: any) => Promise<void>; deleteRotina: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PmocContext = createContext<PmocContextType>({} as PmocContextType);
export const usePmoc = () => useContext(PmocContext);

const TABLES = [
  { table: "pmoc_planos", order: "titulo", key: ["pmoc_planos"] as const, mapper: rowToPlano },
  { table: "pmoc_atividades", order: "descricao", key: ["pmoc_atividades"] as const, mapper: rowToAtividade },
  { table: "pmoc_ordens_servico", order: "numero", key: ["pmoc_ordens_servico"] as const, mapper: rowToOS },
  { table: "pmoc_responsaveis_tecnicos", order: "nome", key: ["pmoc_responsaveis_tecnicos"] as const, mapper: rowToRT },
  { table: "pmoc_qualidade_ar_pontos", order: "descricao", key: ["pmoc_qualidade_ar_pontos"] as const, mapper: rowToPonto },
  { table: "pmoc_qualidade_ar_medicoes", order: "data_medicao", key: ["pmoc_qualidade_ar_medicoes"] as const, mapper: rowToMedicao },
  { table: "pmoc_inconformidades", order: "numero", key: ["pmoc_inconformidades"] as const, mapper: rowToInconformidade },
  { table: "pmoc_biblioteca_rotinas", order: "titulo", key: ["pmoc_biblioteca_rotinas"] as const, mapper: rowToRotina },
];

export function PmocProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Pmoc");
  const qc = useQueryClient();
  const results = useQueries({
    queries: gateQueries(TABLES.map(t => ({
      queryKey: t.key,
      queryFn: async () => (await fetchAll(t.table, t.order)).map(t.mapper as (r: any) => any),
      staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
    })) as any, __active) as any,
  });
  const [planos, atividades, ordensServico, responsaveisTecnicos, pontosQA, medicoesQA, inconformidades, biblioteca] =
    results.map(r => (r.data ?? []) as any[]);
  const loading = results.some(r => r.isLoading);

  const invalidate = (key: readonly string[]) => qc.invalidateQueries({ queryKey: key });
  const refresh = async () => { TABLES.forEach(t => invalidate(t.key)); };

  const DATE_FIELDS = new Set([
    "vigencia_inicio", "vigencia_fim",
    "proxima_execucao", "ultima_execucao",
    "data_medicao", "data_emissao", "data_validade",
    "data_inicio", "data_fim", "data_prevista", "data_execucao",
    "data_identificacao", "data_resolucao",
  ]);
  const sanitize = (d: any) => {
    if (!d || typeof d !== "object") return d;
    const out: any = Array.isArray(d) ? [...d] : { ...d };
    for (const k of Object.keys(out)) {
      if (DATE_FIELDS.has(k) && out[k] === "") out[k] = null;
    }
    return out;
  };
  const crud = (table: string, key: readonly string[]) => ({
    add: async (d: any) => { await insertRow(table, sanitize(d)); invalidate(key); },
    update: async (id: string, d: any) => { await updateRow(table, id, sanitize(d)); invalidate(key); },
    del: async (id: string) => { await deleteRow(table, id); invalidate(key); },
  });

  const planosCrud = crud("pmoc_planos", TABLES[0].key);
  const atividadesCrud = crud("pmoc_atividades", TABLES[1].key);
  const osCrud = crud("pmoc_ordens_servico", TABLES[2].key);
  const rtCrud = crud("pmoc_responsaveis_tecnicos", TABLES[3].key);
  const pontosCrud = crud("pmoc_qualidade_ar_pontos", TABLES[4].key);
  const medicoesCrud = crud("pmoc_qualidade_ar_medicoes", TABLES[5].key);
  const incCrud = crud("pmoc_inconformidades", TABLES[6].key);
  const bibCrud = crud("pmoc_biblioteca_rotinas", TABLES[7].key);

  return (
    <PmocContext.Provider value={{
      planos, atividades, ordensServico, responsaveisTecnicos,
      pontosQA, medicoesQA, inconformidades, biblioteca, loading,
      addPlano: planosCrud.add, updatePlano: planosCrud.update, deletePlano: planosCrud.del,
      addAtividade: atividadesCrud.add, updateAtividade: atividadesCrud.update, deleteAtividade: atividadesCrud.del,
      addOS: osCrud.add, updateOS: osCrud.update, deleteOS: osCrud.del,
      addRT: rtCrud.add, updateRT: rtCrud.update, deleteRT: rtCrud.del,
      addPontoQA: pontosCrud.add, updatePontoQA: pontosCrud.update, deletePontoQA: pontosCrud.del,
      addMedicaoQA: medicoesCrud.add, updateMedicaoQA: medicoesCrud.update, deleteMedicaoQA: medicoesCrud.del,
      addInconformidade: incCrud.add, updateInconformidade: incCrud.update, deleteInconformidade: incCrud.del,
      addRotina: bibCrud.add, updateRotina: bibCrud.update, deleteRotina: bibCrud.del,
      refresh,
    }}>
      {children}
    </PmocContext.Provider>
  );
}
