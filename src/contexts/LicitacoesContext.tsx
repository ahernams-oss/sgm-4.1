import { createContext, useContext, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

// ============ TYPES ============

export interface Licitacao {
  id: string;
  numeroProcesso: string;
  numeroEdital: string;
  modalidade: string;
  orgaoLicitante: string;
  uasg: string;
  objetoResumido: string;
  objetoDetalhado: string;
  cidade: string;
  estado: string;
  dataPublicacao: string;
  dataSessao: string;
  prazoImpugnacao: string;
  prazoEsclarecimento: string;
  portalDisputa: string;
  linkEdital: string;
  valorEstimado: number;
  criterioJulgamento: string;
  regimeExecucao: string;
  prazoContratual: string;
  possibilidadeProrrogacao: boolean;
  exigenciaVisitaTecnica: boolean;
  exigenciaGarantia: boolean;
  status: string;
  responsavelInterno: string;
  grauInteresse: string;
  probabilidadeExito: string;
  observacoes: string;
}

export interface DocumentoLicitacao {
  id: string;
  nome: string;
  tipoDocumental: string;
  categoria: string;
  orgaoEmissor: string;
  dataEmissao: string;
  dataValidade: string;
  status: string;
  arquivoUrl: string;
  arquivoNome: string;
  observacoes: string;
  versao: number;
  licitacoesVinculadas: string[];
}

export interface AnaliseLicitacao {
  id: string;
  licitacaoId: string;
  resumoObjeto: string;
  exigenciasTecnicas: string;
  exigenciasEconomicas: string;
  documentosObrigatorios: string;
  exigenciasEquipe: string;
  exigenciaVistoria: string;
  exigenciaGarantiaProposta: string;
  necessidadeCatCreaCau: string;
  necessidadeCertidoes: string;
  riscosJuridicos: string;
  pontosRestritivos: string;
  oportunidadesImpugnacao: string;
  decisaoParticipar: string;
  analista: string;
  dataAnalise: string;
  observacoes: string;
  analiseIaMarkdown: string;
  analiseIaGeradaEm: string;
}

// ============ MAPPERS ============

const rowToLicitacao = (r: any): Licitacao => ({
  id: r.id,
  numeroProcesso: r.numero_processo ?? "",
  numeroEdital: r.numero_edital ?? "",
  modalidade: r.modalidade ?? "",
  orgaoLicitante: r.orgao_licitante ?? "",
  uasg: r.uasg ?? "",
  objetoResumido: r.objeto_resumido ?? "",
  objetoDetalhado: r.objeto_detalhado ?? "",
  cidade: r.cidade ?? "",
  estado: r.estado ?? "",
  dataPublicacao: r.data_publicacao ?? "",
  dataSessao: r.data_sessao ?? "",
  prazoImpugnacao: r.prazo_impugnacao ?? "",
  prazoEsclarecimento: r.prazo_esclarecimento ?? "",
  portalDisputa: r.portal_disputa ?? "",
  linkEdital: r.link_edital ?? "",
  valorEstimado: r.valor_estimado ?? 0,
  criterioJulgamento: r.criterio_julgamento ?? "",
  regimeExecucao: r.regime_execucao ?? "",
  prazoContratual: r.prazo_contratual ?? "",
  possibilidadeProrrogacao: r.possibilidade_prorrogacao ?? false,
  exigenciaVisitaTecnica: r.exigencia_visita_tecnica ?? false,
  exigenciaGarantia: r.exigencia_garantia ?? false,
  status: r.status ?? "Novo",
  responsavelInterno: r.responsavel_interno ?? "",
  grauInteresse: r.grau_interesse ?? "Médio",
  probabilidadeExito: r.probabilidade_exito ?? "Média",
  observacoes: r.observacoes ?? "",
});

const licitacaoToRow = (l: Omit<Licitacao, "id">) => ({
  numero_processo: l.numeroProcesso,
  numero_edital: l.numeroEdital,
  modalidade: l.modalidade,
  orgao_licitante: l.orgaoLicitante,
  uasg: l.uasg,
  objeto_resumido: l.objetoResumido,
  objeto_detalhado: l.objetoDetalhado,
  cidade: l.cidade,
  estado: l.estado,
  data_publicacao: l.dataPublicacao || null,
  data_sessao: l.dataSessao || null,
  prazo_impugnacao: l.prazoImpugnacao || null,
  prazo_esclarecimento: l.prazoEsclarecimento || null,
  portal_disputa: l.portalDisputa,
  link_edital: l.linkEdital,
  valor_estimado: l.valorEstimado,
  criterio_julgamento: l.criterioJulgamento,
  regime_execucao: l.regimeExecucao,
  prazo_contratual: l.prazoContratual,
  possibilidade_prorrogacao: l.possibilidadeProrrogacao,
  exigencia_visita_tecnica: l.exigenciaVisitaTecnica,
  exigencia_garantia: l.exigenciaGarantia,
  status: l.status,
  responsavel_interno: l.responsavelInterno,
  grau_interesse: l.grauInteresse,
  probabilidade_exito: l.probabilidadeExito,
  observacoes: l.observacoes,
});

const rowToDocumento = (r: any): DocumentoLicitacao => ({
  id: r.id,
  nome: r.nome ?? "",
  tipoDocumental: r.tipo_documental ?? "",
  categoria: r.categoria ?? "",
  orgaoEmissor: r.orgao_emissor ?? "",
  dataEmissao: r.data_emissao ?? "",
  dataValidade: r.data_validade ?? "",
  status: r.status ?? "Válido",
  arquivoUrl: r.arquivo_url ?? "",
  arquivoNome: r.arquivo_nome ?? "",
  observacoes: r.observacoes ?? "",
  versao: r.versao ?? 1,
  licitacoesVinculadas: Array.isArray(r.licitacoes_vinculadas) ? r.licitacoes_vinculadas : [],
});

const documentoToRow = (d: Omit<DocumentoLicitacao, "id">) => ({
  nome: d.nome,
  tipo_documental: d.tipoDocumental,
  categoria: d.categoria,
  orgao_emissor: d.orgaoEmissor,
  data_emissao: d.dataEmissao || null,
  data_validade: d.dataValidade || null,
  status: d.status,
  arquivo_url: d.arquivoUrl,
  arquivo_nome: d.arquivoNome,
  observacoes: d.observacoes,
  versao: d.versao,
  licitacoes_vinculadas: d.licitacoesVinculadas,
});

const rowToAnalise = (r: any): AnaliseLicitacao => ({
  id: r.id,
  licitacaoId: r.licitacao_id ?? "",
  resumoObjeto: r.resumo_objeto ?? "",
  exigenciasTecnicas: r.exigencias_tecnicas ?? "",
  exigenciasEconomicas: r.exigencias_economicas ?? "",
  documentosObrigatorios: r.documentos_obrigatorios ?? "",
  exigenciasEquipe: r.exigencias_equipe ?? "",
  exigenciaVistoria: r.exigencia_vistoria ?? "",
  exigenciaGarantiaProposta: r.exigencia_garantia_proposta ?? "",
  necessidadeCatCreaCau: r.necessidade_cat_crea_cau ?? "",
  necessidadeCertidoes: r.necessidade_certidoes ?? "",
  riscosJuridicos: r.riscos_juridicos ?? "",
  pontosRestritivos: r.pontos_restritivos ?? "",
  oportunidadesImpugnacao: r.oportunidades_impugnacao ?? "",
  decisaoParticipar: r.decisao_participar ?? "Pendente de decisão da diretoria",
  analista: r.analista ?? "",
  dataAnalise: r.data_analise ?? "",
  observacoes: r.observacoes ?? "",
  analiseIaMarkdown: r.analise_ia_markdown ?? "",
  analiseIaGeradaEm: r.analise_ia_gerada_em ?? "",
});

const analiseToRow = (a: Omit<AnaliseLicitacao, "id">) => ({
  licitacao_id: a.licitacaoId,
  resumo_objeto: a.resumoObjeto,
  exigencias_tecnicas: a.exigenciasTecnicas,
  exigencias_economicas: a.exigenciasEconomicas,
  documentos_obrigatorios: a.documentosObrigatorios,
  exigencias_equipe: a.exigenciasEquipe,
  exigencia_vistoria: a.exigenciaVistoria,
  exigencia_garantia_proposta: a.exigenciaGarantiaProposta,
  necessidade_cat_crea_cau: a.necessidadeCatCreaCau,
  necessidade_certidoes: a.necessidadeCertidoes,
  riscos_juridicos: a.riscosJuridicos,
  pontos_restritivos: a.pontosRestritivos,
  oportunidades_impugnacao: a.oportunidadesImpugnacao,
  decisao_participar: a.decisaoParticipar,
  analista: a.analista,
  data_analise: a.dataAnalise || null,
  observacoes: a.observacoes,
  analise_ia_markdown: a.analiseIaMarkdown || null,
  analise_ia_gerada_em: a.analiseIaGeradaEm || null,
});

// ============ CONTEXT ============

interface LicitacoesContextType {
  licitacoes: Licitacao[];
  documentos: DocumentoLicitacao[];
  analises: AnaliseLicitacao[];
  loading: boolean;
  addLicitacao: (data: Omit<Licitacao, "id">) => Promise<Licitacao | null>;
  updateLicitacao: (id: string, data: Omit<Licitacao, "id">) => Promise<boolean>;
  deleteLicitacao: (id: string) => Promise<boolean>;
  addDocumento: (data: Omit<DocumentoLicitacao, "id">) => Promise<DocumentoLicitacao | null>;
  updateDocumento: (id: string, data: Omit<DocumentoLicitacao, "id">) => Promise<boolean>;
  deleteDocumento: (id: string) => Promise<boolean>;
  addAnalise: (data: Omit<AnaliseLicitacao, "id">) => Promise<AnaliseLicitacao | null>;
  updateAnalise: (id: string, data: Omit<AnaliseLicitacao, "id">) => Promise<boolean>;
  deleteAnalise: (id: string) => Promise<boolean>;
  uploadArquivo: (file: File) => Promise<string>;
  reload: () => Promise<void>;
}

const LicitacoesContext = createContext<LicitacoesContextType | undefined>(undefined);

const QK_LIC = ["licitacoes"] as const;
const QK_DOC = ["licitacoes_documentos"] as const;
const QK_ANA = ["licitacoes_analises"] as const;

export function LicitacoesProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Licitacoes");
  const qc = useQueryClient();
  const opts = { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 };
  const results = useQueries({
    queries: gateQueries([
      { queryKey: QK_LIC, queryFn: async () => (await fetchAll("licitacoes", "created_at")).map(rowToLicitacao), ...opts },
      { queryKey: QK_DOC, queryFn: async () => (await fetchAll("licitacoes_documentos", "created_at")).map(rowToDocumento), ...opts },
      { queryKey: QK_ANA, queryFn: async () => (await fetchAll("licitacoes_analises", "created_at")).map(rowToAnalise), ...opts },
    ], __active),
  });
  const licitacoes = (results[0].data as Licitacao[]) ?? [];
  const documentos = (results[1].data as DocumentoLicitacao[]) ?? [];
  const analises = (results[2].data as AnaliseLicitacao[]) ?? [];
  const loading = results.some(r => r.isLoading);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: QK_LIC });
    qc.invalidateQueries({ queryKey: QK_DOC });
    qc.invalidateQueries({ queryKey: QK_ANA });
  };
  const reload = async () => { invalidateAll(); };

  const addLicitacao = async (data: Omit<Licitacao, "id">) => {
    const row = await insertRow("licitacoes", licitacaoToRow(data));
    if (row) { qc.invalidateQueries({ queryKey: QK_LIC }); return rowToLicitacao(row); }
    return null;
  };
  const updateLicitacao = async (id: string, data: Omit<Licitacao, "id">) => {
    const ok = await updateRow("licitacoes", id, licitacaoToRow(data));
    if (ok) qc.invalidateQueries({ queryKey: QK_LIC });
    return ok;
  };
  const deleteLicitacao = async (id: string) => {
    const ok = await deleteRow("licitacoes", id);
    if (ok) qc.invalidateQueries({ queryKey: QK_LIC });
    return ok;
  };

  const addDocumento = async (data: Omit<DocumentoLicitacao, "id">) => {
    const row = await insertRow("licitacoes_documentos", documentoToRow(data));
    if (row) { qc.invalidateQueries({ queryKey: QK_DOC }); return rowToDocumento(row); }
    return null;
  };
  const updateDocumento = async (id: string, data: Omit<DocumentoLicitacao, "id">) => {
    const ok = await updateRow("licitacoes_documentos", id, documentoToRow(data));
    if (ok) qc.invalidateQueries({ queryKey: QK_DOC });
    return ok;
  };
  const deleteDocumento = async (id: string) => {
    const ok = await deleteRow("licitacoes_documentos", id);
    if (ok) qc.invalidateQueries({ queryKey: QK_DOC });
    return ok;
  };

  const addAnalise = async (data: Omit<AnaliseLicitacao, "id">) => {
    const row = await insertRow("licitacoes_analises", analiseToRow(data));
    if (row) { qc.invalidateQueries({ queryKey: QK_ANA }); return rowToAnalise(row); }
    return null;
  };
  const updateAnalise = async (id: string, data: Omit<AnaliseLicitacao, "id">) => {
    const ok = await updateRow("licitacoes_analises", id, analiseToRow(data));
    if (ok) qc.invalidateQueries({ queryKey: QK_ANA });
    return ok;
  };
  const deleteAnalise = async (id: string) => {
    const ok = await deleteRow("licitacoes_analises", id);
    if (ok) qc.invalidateQueries({ queryKey: QK_ANA });
    return ok;
  };

  const uploadArquivo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = `doc_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("licitacoes-documentos")
      .upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("licitacoes-documentos").getPublicUrl(fileName);
    return pub.publicUrl;
  };

  return (
    <LicitacoesContext.Provider value={{
      licitacoes, documentos, analises, loading,
      addLicitacao, updateLicitacao, deleteLicitacao,
      addDocumento, updateDocumento, deleteDocumento,
      addAnalise, updateAnalise, deleteAnalise,
      uploadArquivo, reload,
    }}>
      {children}
    </LicitacoesContext.Provider>
  );
}

export function useLicitacoes() {
  useActivateProvider("Licitacoes");
  const ctx = useContext(LicitacoesContext);
  if (!ctx) throw new Error("useLicitacoes must be used within LicitacoesProvider");
  return ctx;
}
