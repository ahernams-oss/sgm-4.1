import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

// ============ TYPES ============

export type PregaoModalidade = "Aberto" | "Aberto-Fechado" | "Fechado";
export type PregaoTipoDisputa = "Item" | "Lote" | "Misto";
export type PregaoStatus =
  | "Rascunho" | "Publicado" | "Credenciamento" | "Propostas"
  | "Disputa" | "Habilitacao" | "Adjudicado" | "Homologado"
  | "Cancelado" | "Encerrado" | "Suspenso";

export interface Pregao {
  id: string;
  numero: number;
  objeto: string;
  modalidade: PregaoModalidade;
  tipoDisputa: PregaoTipoDisputa;
  valorEstimado: number;
  valorEstimadoSigiloso: boolean;
  decrementoMinimo: number;
  decrementoTipo: "reais" | "percentual";
  tempoDisputaMin: number;
  tempoProrrogacaoMin: number;
  dataPublicacao: string;
  dataAberturaCredenciamento: string;
  dataAberturaPropostas: string;
  dataInicioDisputa: string;
  dataEncerramentoDisputa: string;
  status: PregaoStatus;
  termoParticipacao: string;
  termoHash: string;
  pregoeiroId: string;
  pregoeiroNome: string;
  observacoes: string;
  motivoCancelamento: string;
  resultadoPublico: boolean;
  createdAt: string;
}

export interface PregaoItem {
  id: string;
  pregaoId: string;
  ordem: number;
  agrupamento: "Item" | "Lote";
  loteCodigo: string;
  materialId: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoReferencia: number;
  precoReferenciaSigiloso: boolean;
  status: "Aguardando" | "EmDisputa" | "Suspenso" | "Encerrado" | "Fracassado" | "Deserto";
  iniciadoEm: string;
  encerraEm: string;
  encerradoEm: string;
  vencedorParticipanteId: string;
  vencedorValor: number;
  vencedorValorUnitario: number;
  observacoes: string;
}

export interface PregaoDocumentoExigido {
  id: string;
  pregaoId: string;
  nome: string;
  descricao: string;
  obrigatorio: boolean;
  ordem: number;
}

export interface PregaoParticipante {
  id: string;
  pregaoId: string;
  fornecedorId: string;
  fornecedorNome: string;
  fornecedorCnpj: string;
  apelido: string;
  apelidoSeq: number;
  termoAceitoEm: string;
  termoAceitoIp: string;
  termoHash: string;
  status: "Credenciado" | "Desclassificado" | "Inabilitado" | "Habilitado" | "Vencedor" | "Desistente";
  motivoStatus: string;
  chatAberto: boolean;
}

export interface PregaoLance {
  id: string;
  pregaoId: string;
  itemId: string;
  participanteId: string;
  valor: number;
  ts: string;
  cancelado: boolean;
  motivoCancelamento: string;
}

export interface PregaoMensagem {
  id: string;
  pregaoId: string;
  itemId: string | null;
  autorTipo: "pregoeiro" | "participante" | "sistema";
  autorId: string | null;
  autorNomeExibicao: string;
  mensagem: string;
  ts: string;
}

export interface PregaoPropostaInicial {
  id: string;
  pregaoId: string;
  itemId: string;
  participanteId: string;
  valor: number;
  marca: string;
  modelo: string;
  observacoes: string;
  enviadaEm: string;
}

export interface PregaoHabilitacao {
  id: string;
  pregaoId: string;
  participanteId: string;
  documentoExigidoId: string | null;
  documentoNome: string;
  arquivoUrl: string;
  arquivoNome: string;
  status: "Pendente" | "Aprovado" | "Reprovado";
  observacao: string;
  analisadoEm: string;
  analisadoPor: string;
}

// ============ MAPPERS ============

const rowToPregao = (r: any): Pregao => ({
  id: r.id,
  numero: r.numero ?? 0,
  objeto: r.objeto ?? "",
  modalidade: r.modalidade ?? "Aberto",
  tipoDisputa: r.tipo_disputa ?? "Item",
  valorEstimado: Number(r.valor_estimado ?? 0),
  valorEstimadoSigiloso: r.valor_estimado_sigiloso ?? true,
  decrementoMinimo: Number(r.decremento_minimo ?? 0),
  decrementoTipo: r.decremento_tipo ?? "reais",
  tempoDisputaMin: r.tempo_disputa_min ?? 10,
  tempoProrrogacaoMin: r.tempo_prorrogacao_min ?? 2,
  dataPublicacao: r.data_publicacao ?? "",
  dataAberturaCredenciamento: r.data_abertura_credenciamento ?? "",
  dataAberturaPropostas: r.data_abertura_propostas ?? "",
  dataInicioDisputa: r.data_inicio_disputa ?? "",
  dataEncerramentoDisputa: r.data_encerramento_disputa ?? "",
  status: r.status ?? "Rascunho",
  termoParticipacao: r.termo_participacao ?? "",
  termoHash: r.termo_hash ?? "",
  pregoeiroId: r.pregoeiro_id ?? "",
  pregoeiroNome: r.pregoeiro_nome ?? "",
  observacoes: r.observacoes ?? "",
  motivoCancelamento: r.motivo_cancelamento ?? "",
  resultadoPublico: r.resultado_publico ?? false,
  createdAt: r.created_at ?? "",
});

const pregaoToRow = (p: Omit<Pregao, "id" | "numero" | "createdAt">) => ({
  objeto: p.objeto,
  modalidade: p.modalidade,
  tipo_disputa: p.tipoDisputa,
  valor_estimado: p.valorEstimado,
  valor_estimado_sigiloso: p.valorEstimadoSigiloso,
  decremento_minimo: p.decrementoMinimo,
  decremento_tipo: p.decrementoTipo,
  tempo_disputa_min: p.tempoDisputaMin,
  tempo_prorrogacao_min: p.tempoProrrogacaoMin,
  data_publicacao: p.dataPublicacao || null,
  data_abertura_credenciamento: p.dataAberturaCredenciamento || null,
  data_abertura_propostas: p.dataAberturaPropostas || null,
  data_inicio_disputa: p.dataInicioDisputa || null,
  data_encerramento_disputa: p.dataEncerramentoDisputa || null,
  status: p.status,
  termo_participacao: p.termoParticipacao,
  termo_hash: p.termoHash,
  pregoeiro_id: p.pregoeiroId || null,
  pregoeiro_nome: p.pregoeiroNome,
  observacoes: p.observacoes,
  motivo_cancelamento: p.motivoCancelamento || null,
  resultado_publico: p.resultadoPublico,
});

const rowToItem = (r: any): PregaoItem => ({
  id: r.id,
  pregaoId: r.pregao_id,
  ordem: r.ordem ?? 1,
  agrupamento: r.agrupamento ?? "Item",
  loteCodigo: r.lote_codigo ?? "",
  materialId: r.material_id ?? "",
  descricao: r.descricao ?? "",
  unidade: r.unidade ?? "UN",
  quantidade: Number(r.quantidade ?? 1),
  precoReferencia: Number(r.preco_referencia ?? 0),
  precoReferenciaSigiloso: r.preco_referencia_sigiloso ?? true,
  status: r.status ?? "Aguardando",
  iniciadoEm: r.iniciado_em ?? "",
  encerraEm: r.encerra_em ?? "",
  encerradoEm: r.encerrado_em ?? "",
  vencedorParticipanteId: r.vencedor_participante_id ?? "",
  vencedorValor: Number(r.vencedor_valor ?? 0),
  vencedorValorUnitario: Number(r.vencedor_valor_unitario ?? 0),
  observacoes: r.observacoes ?? "",
});

const itemToRow = (i: Omit<PregaoItem, "id">) => ({
  pregao_id: i.pregaoId,
  ordem: i.ordem,
  agrupamento: i.agrupamento,
  lote_codigo: i.loteCodigo || null,
  material_id: i.materialId || null,
  descricao: i.descricao,
  unidade: i.unidade,
  quantidade: i.quantidade,
  preco_referencia: i.precoReferencia,
  preco_referencia_sigiloso: i.precoReferenciaSigiloso,
  status: i.status,
  observacoes: i.observacoes,
});

const rowToDoc = (r: any): PregaoDocumentoExigido => ({
  id: r.id,
  pregaoId: r.pregao_id,
  nome: r.nome ?? "",
  descricao: r.descricao ?? "",
  obrigatorio: r.obrigatorio ?? true,
  ordem: r.ordem ?? 1,
});

const docToRow = (d: Omit<PregaoDocumentoExigido, "id">) => ({
  pregao_id: d.pregaoId,
  nome: d.nome,
  descricao: d.descricao,
  obrigatorio: d.obrigatorio,
  ordem: d.ordem,
});

const rowToPart = (r: any): PregaoParticipante => ({
  id: r.id,
  pregaoId: r.pregao_id,
  fornecedorId: r.fornecedor_id,
  fornecedorNome: r.fornecedor_nome ?? "",
  fornecedorCnpj: r.fornecedor_cnpj ?? "",
  apelido: r.apelido ?? "",
  apelidoSeq: r.apelido_seq ?? 0,
  termoAceitoEm: r.termo_aceito_em ?? "",
  termoAceitoIp: r.termo_aceito_ip ?? "",
  termoHash: r.termo_hash ?? "",
  status: r.status ?? "Credenciado",
  motivoStatus: r.motivo_status ?? "",
  chatAberto: r.chat_aberto ?? false,
});

// ============ HASH ============
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const rowToLance = (r: any): PregaoLance => ({
  id: r.id, pregaoId: r.pregao_id, itemId: r.item_id,
  participanteId: r.participante_id, valor: Number(r.valor ?? 0),
  ts: r.ts ?? "", cancelado: r.cancelado ?? false,
  motivoCancelamento: r.motivo_cancelamento ?? "",
});
const rowToMsg = (r: any): PregaoMensagem => ({
  id: r.id, pregaoId: r.pregao_id, itemId: r.item_id ?? null,
  autorTipo: r.autor_tipo ?? "sistema", autorId: r.autor_id ?? null,
  autorNomeExibicao: r.autor_nome_exibicao ?? "",
  mensagem: r.mensagem ?? "", ts: r.ts ?? "",
});
const rowToPropIni = (r: any): PregaoPropostaInicial => ({
  id: r.id, pregaoId: r.pregao_id, itemId: r.item_id,
  participanteId: r.participante_id, valor: Number(r.valor ?? 0),
  marca: r.marca ?? "", modelo: r.modelo ?? "",
  observacoes: r.observacoes ?? "", enviadaEm: r.enviada_em ?? "",
});

const rowToHab = (r: any): PregaoHabilitacao => ({
  id: r.id, pregaoId: r.pregao_id, participanteId: r.participante_id,
  documentoExigidoId: r.documento_exigido_id ?? null,
  documentoNome: r.documento_nome ?? "",
  arquivoUrl: r.arquivo_url ?? "",
  arquivoNome: r.arquivo_nome ?? "",
  status: r.status ?? "Pendente",
  observacao: r.observacao ?? "",
  analisadoEm: r.analisado_em ?? "",
  analisadoPor: r.analisado_por ?? "",
});

// ============ CONTEXT ============

interface PregaoContextType {
  pregoes: Pregao[];
  itens: PregaoItem[];
  documentos: PregaoDocumentoExigido[];
  participantes: PregaoParticipante[];
  lances: PregaoLance[];
  mensagens: PregaoMensagem[];
  propostasIniciais: PregaoPropostaInicial[];
  habilitacoes: PregaoHabilitacao[];
  loading: boolean;
  reload: () => Promise<void>;
  loadDisputa: (pregaoId: string) => Promise<void>;
  loadHabilitacao: (pregaoId: string) => Promise<void>;
  // Pregão
  addPregao: (data: Omit<Pregao, "id" | "numero" | "createdAt">) => Promise<Pregao | null>;
  updatePregao: (id: string, data: Omit<Pregao, "id" | "numero" | "createdAt">) => Promise<boolean>;
  deletePregao: (id: string) => Promise<boolean>;
  publicarPregao: (id: string) => Promise<boolean>;
  cancelarPregao: (id: string, motivo: string) => Promise<boolean>;
  suspenderPregao: (id: string, motivo: string) => Promise<boolean>;
  retomarPregao: (id: string) => Promise<boolean>;
  abrirDisputa: (id: string) => Promise<boolean>;
  encerrarDisputa: (id: string) => Promise<boolean>;
  publicarResultado: (id: string) => Promise<boolean>;
  adjudicarPregao: (id: string) => Promise<boolean>;
  homologarPregao: (id: string) => Promise<boolean>;
  // Itens
  addItem: (data: Omit<PregaoItem, "id">) => Promise<PregaoItem | null>;
  updateItem: (id: string, data: Partial<Omit<PregaoItem, "id">>) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  iniciarItem: (itemId: string, duracaoMin?: number) => Promise<boolean>;
  encerrarItem: (itemId: string) => Promise<boolean>;
  prorrogarItem: (itemId: string, minutos: number) => Promise<boolean>;
  // Documentos exigidos
  addDocumento: (data: Omit<PregaoDocumentoExigido, "id">) => Promise<PregaoDocumentoExigido | null>;
  updateDocumento: (id: string, data: Omit<PregaoDocumentoExigido, "id">) => Promise<boolean>;
  deleteDocumento: (id: string) => Promise<boolean>;
  // Credenciamento
  credenciarFornecedor: (pregaoId: string, fornecedor: { id: string; nome: string; cnpj: string }, ip?: string) => Promise<PregaoParticipante | null>;
  setParticipanteStatus: (participanteId: string, status: PregaoParticipante["status"], motivo?: string) => Promise<boolean>;
  setChatParticipante: (participanteId: string, aberto: boolean) => Promise<boolean>;
  hashTermo: (texto: string) => Promise<string>;
  // Disputa
  enviarLance: (pregaoId: string, itemId: string, participanteId: string, valor: number) => Promise<boolean>;
  enviarMensagem: (pregaoId: string, autorTipo: "pregoeiro" | "participante" | "sistema", autorNome: string, mensagem: string, itemId?: string) => Promise<boolean>;
  cancelarLance: (lanceId: string, motivo: string) => Promise<boolean>;
  // Habilitação
  addHabilitacao: (data: { pregaoId: string; participanteId: string; documentoExigidoId?: string | null; documentoNome: string; arquivoUrl?: string; arquivoNome?: string }) => Promise<PregaoHabilitacao | null>;
  uploadDocumentoHabilitacao: (pregaoId: string, participanteId: string, file: File) => Promise<{ url: string; nome: string } | null>;
  avaliarHabilitacao: (habId: string, status: "Aprovado" | "Reprovado", observacao: string, analisadoPor: string) => Promise<boolean>;
  deleteHabilitacao: (habId: string) => Promise<boolean>;
}

const PregaoContext = createContext<PregaoContextType | undefined>(undefined);

const QK_PREGOES = ["pregoes"] as const;
const QK_ITENS = ["pregao_itens"] as const;
const QK_DOCS = ["pregao_documentos_exigidos"] as const;
const QK_PARTS = ["pregao_participantes"] as const;

export function PregaoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Pregao");
  const qc = useQueryClient();
  const [lances, setLances] = useState<PregaoLance[]>([]);
  const [mensagens, setMensagens] = useState<PregaoMensagem[]>([]);
  const [propostasIniciais, setPropostasIniciais] = useState<PregaoPropostaInicial[]>([]);
  const [habilitacoes, setHabilitacoes] = useState<PregaoHabilitacao[]>([]);

  const opts = { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 };
  const results = useQueries({
    queries: gateQueries([
      { queryKey: QK_PREGOES, queryFn: async () => (await fetchAll("pregoes", "created_at")).map(rowToPregao), ...opts },
      { queryKey: QK_ITENS, queryFn: async () => (await fetchAll("pregao_itens", "ordem")).map(rowToItem), ...opts },
      { queryKey: QK_DOCS, queryFn: async () => (await fetchAll("pregao_documentos_exigidos", "ordem")).map(rowToDoc), ...opts },
      { queryKey: QK_PARTS, queryFn: async () => (await fetchAll("pregao_participantes", "created_at")).map(rowToPart), ...opts },
    ], __active),
  });
  const pregoes = (results[0].data as Pregao[]) ?? [];
  const itens = (results[1].data as PregaoItem[]) ?? [];
  const documentos = (results[2].data as PregaoDocumentoExigido[]) ?? [];
  const participantes = (results[3].data as PregaoParticipante[]) ?? [];
  const loading = results.some(r => r.isLoading);

  const invAll = () => {
    qc.invalidateQueries({ queryKey: QK_PREGOES });
    qc.invalidateQueries({ queryKey: QK_ITENS });
    qc.invalidateQueries({ queryKey: QK_DOCS });
    qc.invalidateQueries({ queryKey: QK_PARTS });
  };
  const load = useCallback(async () => { invAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDisputa = useCallback(async (pregaoId: string) => {
    const [{ data: ll }, { data: mm }, { data: pi }] = await Promise.all([
      (supabase as any).from("pregao_lances").select("*").eq("pregao_id", pregaoId).order("ts", { ascending: true }),
      (supabase as any).from("pregao_mensagens").select("*").eq("pregao_id", pregaoId).order("ts", { ascending: true }),
      (supabase as any).from("pregao_propostas_iniciais").select("*").eq("pregao_id", pregaoId),
    ]);
    setLances((ll ?? []).map(rowToLance));
    setMensagens((mm ?? []).map(rowToMsg));
    setPropostasIniciais((pi ?? []).map(rowToPropIni));
  }, []);

  // Realtime global para tabelas de disputa
  useEffect(() => {
    const ch = supabase
      .channel("pregao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pregao_lances" }, (payload: any) => {
        if (payload.eventType === "INSERT") setLances(prev => [...prev, rowToLance(payload.new)]);
        else if (payload.eventType === "UPDATE") setLances(prev => prev.map(l => l.id === payload.new.id ? rowToLance(payload.new) : l));
        else if (payload.eventType === "DELETE") setLances(prev => prev.filter(l => l.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pregao_mensagens" }, (payload: any) => {
        if (payload.eventType === "INSERT") setMensagens(prev => [...prev, rowToMsg(payload.new)]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pregao_itens" }, (payload: any) => {
        qc.setQueryData<PregaoItem[]>(QK_ITENS, (prev = []) => prev.map(i => i.id === payload.new.id ? rowToItem(payload.new) : i));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pregao_participantes" }, () => {
        qc.invalidateQueries({ queryKey: QK_PARTS });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pregoes" }, (payload: any) => {
        qc.setQueryData<Pregao[]>(QK_PREGOES, (prev = []) => prev.map(p => p.id === payload.new.id ? rowToPregao(payload.new) : p));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const addPregao = async (data: Omit<Pregao, "id" | "numero" | "createdAt">) => {
    const hash = data.termoParticipacao ? await sha256(data.termoParticipacao) : "";
    const row = await insertRow("pregoes", { ...pregaoToRow(data), termo_hash: hash });
    if (row) { await load(); return rowToPregao(row); }
    return null;
  };

  const updatePregao = async (id: string, data: Omit<Pregao, "id" | "numero" | "createdAt">) => {
    const hash = data.termoParticipacao ? await sha256(data.termoParticipacao) : "";
    const ok = await updateRow("pregoes", id, { ...pregaoToRow(data), termo_hash: hash });
    if (ok) await load();
    return ok;
  };

  const deletePregao = async (id: string) => {
    const p = pregoes.find(x => x.id === id);
    if (p && p.status !== "Rascunho") return false;
    const ok = await deleteRow("pregoes", id);
    if (ok) await load();
    return ok;
  };

  const publicarPregao = async (id: string) => {
    const ok = await updateRow("pregoes", id, {
      status: "Publicado",
      data_publicacao: new Date().toISOString(),
    });
    if (ok) await load();
    return ok;
  };

  const cancelarPregao = async (id: string, motivo: string) => {
    const ok = await updateRow("pregoes", id, { status: "Cancelado", motivo_cancelamento: motivo });
    if (ok) await load();
    return ok;
  };

  const addItem = async (data: Omit<PregaoItem, "id">) => {
    const row = await insertRow("pregao_itens", itemToRow(data));
    if (row) { await load(); return rowToItem(row); }
    return null;
  };
  const updateItem = async (id: string, data: Partial<Omit<PregaoItem, "id">>) => {
    const row: any = {};
    if (data.pregaoId !== undefined) row.pregao_id = data.pregaoId;
    if (data.ordem !== undefined) row.ordem = data.ordem;
    if (data.agrupamento !== undefined) row.agrupamento = data.agrupamento;
    if (data.loteCodigo !== undefined) row.lote_codigo = data.loteCodigo || null;
    if (data.materialId !== undefined) row.material_id = data.materialId || null;
    if (data.descricao !== undefined) row.descricao = data.descricao;
    if (data.unidade !== undefined) row.unidade = data.unidade;
    if (data.quantidade !== undefined) row.quantidade = data.quantidade;
    if (data.precoReferencia !== undefined) row.preco_referencia = data.precoReferencia;
    if (data.precoReferenciaSigiloso !== undefined) row.preco_referencia_sigiloso = data.precoReferenciaSigiloso;
    if (data.status !== undefined) row.status = data.status;
    if (data.observacoes !== undefined) row.observacoes = data.observacoes;
    const ok = await updateRow("pregao_itens", id, row);
    if (ok) await load();
    return ok;
  };
  const deleteItem = async (id: string) => {
    const ok = await deleteRow("pregao_itens", id);
    if (ok) await load();
    return ok;
  };

  const addDocumento = async (data: Omit<PregaoDocumentoExigido, "id">) => {
    const row = await insertRow("pregao_documentos_exigidos", docToRow(data));
    if (row) { await load(); return rowToDoc(row); }
    return null;
  };
  const updateDocumento = async (id: string, data: Omit<PregaoDocumentoExigido, "id">) => {
    const ok = await updateRow("pregao_documentos_exigidos", id, docToRow(data));
    if (ok) await load();
    return ok;
  };
  const deleteDocumento = async (id: string) => {
    const ok = await deleteRow("pregao_documentos_exigidos", id);
    if (ok) await load();
    return ok;
  };

  const credenciarFornecedor = async (
    pregaoId: string,
    fornecedor: { id: string; nome: string; cnpj: string },
    ip?: string
  ) => {
    const pregao = pregoes.find(p => p.id === pregaoId);
    if (!pregao) return null;
    const seq = participantes.filter(p => p.pregaoId === pregaoId).length + 1;
    const apelido = `Licitante ${String(seq).padStart(2, "0")}`;
    const hash = await sha256(pregao.termoParticipacao || "");
    const row = await insertRow("pregao_participantes", {
      pregao_id: pregaoId,
      fornecedor_id: fornecedor.id,
      fornecedor_nome: fornecedor.nome,
      fornecedor_cnpj: fornecedor.cnpj,
      apelido,
      apelido_seq: seq,
      termo_aceito_em: new Date().toISOString(),
      termo_aceito_ip: ip ?? "",
      termo_hash: hash,
      status: "Credenciado",
    });
    if (row) { await load(); return rowToPart(row); }
    return null;
  };

  // ============ Disputa ============
  const abrirDisputa = async (id: string) => {
    const ok = await updateRow("pregoes", id, { status: "Disputa", data_inicio_disputa: new Date().toISOString() });
    if (ok) await load();
    return ok;
  };
  const encerrarDisputa = async (id: string) => {
    // Encerra todos os itens ainda em disputa antes de mudar a fase
    const itensAbertos = itens.filter(i => i.pregaoId === id && (i.status === "EmDisputa" || i.status === "Aguardando"));
    for (const it of itensAbertos) {
      if (it.status === "EmDisputa") {
        await encerrarItem(it.id);
      } else {
        await updateRow("pregao_itens", it.id, { status: "Deserto", encerrado_em: new Date().toISOString() });
      }
    }
    const ok = await updateRow("pregoes", id, { status: "Habilitacao", data_encerramento_disputa: new Date().toISOString() });
    if (ok) await load();
    return ok;
  };
  const publicarResultado = async (id: string) => {
    const ok = await updateRow("pregoes", id, { resultado_publico: true });
    if (ok) await load();
    return ok;
  };

  const iniciarItem = async (itemId: string, duracaoMin?: number) => {
    const item = itens.find(i => i.id === itemId);
    if (!item) return false;
    const pregao = pregoes.find(p => p.id === item.pregaoId);
    const dur = duracaoMin ?? pregao?.tempoDisputaMin ?? 10;
    const agora = new Date();
    const encerra = new Date(agora.getTime() + dur * 60_000);
    const ok = await updateRow("pregao_itens", itemId, {
      status: "EmDisputa",
      iniciado_em: agora.toISOString(),
      encerra_em: encerra.toISOString(),
    });
    return ok;
  };

  const encerrarItem = async (itemId: string) => {
    const item = itens.find(i => i.id === itemId);
    if (!item) return false;
    // calcula vencedor: menor lance não cancelado
    const lancesItem = lances.filter(l => l.itemId === itemId && !l.cancelado);
    let vencedorParticipanteId: string | null = null;
    let vencedorValor = 0;
    if (lancesItem.length) {
      const menor = [...lancesItem].sort((a, b) => a.valor - b.valor)[0];
      vencedorParticipanteId = menor.participanteId;
      vencedorValor = menor.valor;
    }
    const novoStatus = lancesItem.length ? "Encerrado" : "Deserto";
    const ok = await updateRow("pregao_itens", itemId, {
      status: novoStatus,
      encerrado_em: new Date().toISOString(),
      vencedor_participante_id: vencedorParticipanteId,
      vencedor_valor: vencedorValor,
      vencedor_valor_unitario: item.quantidade > 0 ? vencedorValor / item.quantidade : 0,
    });
    return ok;
  };

  const prorrogarItem = async (itemId: string, minutos: number) => {
    const item = itens.find(i => i.id === itemId);
    if (!item) return false;
    const base = item.encerraEm ? new Date(item.encerraEm) : new Date();
    const nova = new Date(base.getTime() + minutos * 60_000);
    return await updateRow("pregao_itens", itemId, { encerra_em: nova.toISOString() });
  };

  const enviarLance = async (pregaoId: string, itemId: string, participanteId: string, valor: number) => {
    const item = itens.find(i => i.id === itemId);
    if (!item || item.status !== "EmDisputa") return false;
    // valida menor que melhor lance atual
    const lancesItem = lances.filter(l => l.itemId === itemId && !l.cancelado);
    const melhor = lancesItem.length ? Math.min(...lancesItem.map(l => l.valor)) : Infinity;
    if (valor >= melhor && melhor !== Infinity) return false;
    const row = await insertRow("pregao_lances", {
      pregao_id: pregaoId, item_id: itemId,
      participante_id: participanteId, valor,
    });
    if (!row) return false;
    // prorrogação automática se faltar < tempoProrrogacaoMin
    const pregao = pregoes.find(p => p.id === pregaoId);
    if (pregao && item.encerraEm) {
      const restante = new Date(item.encerraEm).getTime() - Date.now();
      if (restante < pregao.tempoProrrogacaoMin * 60_000) {
        const nova = new Date(Date.now() + pregao.tempoProrrogacaoMin * 60_000);
        await updateRow("pregao_itens", itemId, { encerra_em: nova.toISOString() });
      }
    }
    return true;
  };

  const cancelarLance = async (lanceId: string, motivo: string) => {
    return await updateRow("pregao_lances", lanceId, { cancelado: true, motivo_cancelamento: motivo });
  };

  const enviarMensagem = async (pregaoId: string, autorTipo: "pregoeiro" | "participante" | "sistema", autorNome: string, mensagem: string, itemId?: string) => {
    const row = await insertRow("pregao_mensagens", {
      pregao_id: pregaoId,
      item_id: itemId ?? null,
      autor_tipo: autorTipo,
      autor_nome_exibicao: autorNome,
      mensagem,
    });
    return !!row;
  };

  // ============ Fase 3 ============
  const loadHabilitacao = useCallback(async (pregaoId: string) => {
    const { data } = await (supabase as any).from("pregao_habilitacao").select("*").eq("pregao_id", pregaoId).order("created_at", { ascending: true });
    setHabilitacoes((data ?? []).map(rowToHab));
  }, []);

  const addHabilitacao = async (data: { pregaoId: string; participanteId: string; documentoExigidoId?: string | null; documentoNome: string; arquivoUrl?: string; arquivoNome?: string }) => {
    const row = await insertRow("pregao_habilitacao", {
      pregao_id: data.pregaoId,
      participante_id: data.participanteId,
      documento_exigido_id: data.documentoExigidoId ?? null,
      documento_nome: data.documentoNome,
      arquivo_url: data.arquivoUrl ?? "",
      arquivo_nome: data.arquivoNome ?? "",
      status: "Pendente",
    });
    if (!row) return null;
    await loadHabilitacao(data.pregaoId);
    return rowToHab(row);
  };

  const uploadDocumentoHabilitacao = async (pregaoId: string, participanteId: string, file: File) => {
    const path = `${pregaoId}/${participanteId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("pregao-documentos").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("pregao-documentos").getPublicUrl(path);
    return { url: data.publicUrl, nome: file.name };
  };

  const avaliarHabilitacao = async (habId: string, status: "Aprovado" | "Reprovado", observacao: string, analisadoPor: string) => {
    const hab = habilitacoes.find(h => h.id === habId);
    const ok = await updateRow("pregao_habilitacao", habId, {
      status, observacao,
      analisado_em: new Date().toISOString(),
      analisado_por: analisadoPor,
    });
    if (ok && hab) await loadHabilitacao(hab.pregaoId);
    return ok;
  };

  const deleteHabilitacao = async (habId: string) => {
    const hab = habilitacoes.find(h => h.id === habId);
    const ok = await deleteRow("pregao_habilitacao", habId);
    if (ok && hab) await loadHabilitacao(hab.pregaoId);
    return ok;
  };

  const setParticipanteStatus = async (participanteId: string, status: PregaoParticipante["status"], motivo?: string) => {
    const ok = await updateRow("pregao_participantes", participanteId, { status, motivo_status: motivo ?? "" });
    if (ok) await load();
    return ok;
  };

  const setChatParticipante = async (participanteId: string, aberto: boolean) => {
    const ok = await updateRow("pregao_participantes", participanteId, { chat_aberto: aberto });
    if (ok) {
      qc.setQueryData<PregaoParticipante[]>(QK_PARTS, (prev = []) =>
        prev.map(p => p.id === participanteId ? { ...p, chatAberto: aberto } : p)
      );
    }
    return ok;
  };

  const adjudicarPregao = async (id: string) => {
    const ok = await updateRow("pregoes", id, { status: "Adjudicado" });
    if (ok) await load();
    return ok;
  };

  const homologarPregao = async (id: string) => {
    const ok = await updateRow("pregoes", id, { status: "Homologado", resultado_publico: true });
    if (ok) await load();
    return ok;
  };

  const suspenderPregao = async (id: string, motivo: string) => {
    const ok = await updateRow("pregoes", id, { status: "Suspenso", motivo_cancelamento: motivo });
    if (ok) await load();
    return ok;
  };

  const retomarPregao = async (id: string) => {
    const ok = await updateRow("pregoes", id, { status: "Publicado", motivo_cancelamento: null });
    if (ok) await load();
    return ok;
  };

  return (
    <PregaoContext.Provider value={{
      pregoes, itens, documentos, participantes, lances, mensagens, propostasIniciais, habilitacoes,
      loading, reload: load, loadDisputa, loadHabilitacao,
      addPregao, updatePregao, deletePregao, publicarPregao, cancelarPregao, suspenderPregao, retomarPregao,
      abrirDisputa, encerrarDisputa, publicarResultado, adjudicarPregao, homologarPregao,
      addItem, updateItem, deleteItem,
      iniciarItem, encerrarItem, prorrogarItem,
      addDocumento, updateDocumento, deleteDocumento,
      credenciarFornecedor, setParticipanteStatus, setChatParticipante, hashTermo: sha256,
      enviarLance, cancelarLance, enviarMensagem,
      addHabilitacao, uploadDocumentoHabilitacao, avaliarHabilitacao, deleteHabilitacao,
    }}>
      {children}
    </PregaoContext.Provider>
  );
}

export function usePregao() {
  useActivateProvider("Pregao");
  const ctx = useContext(PregaoContext);
  if (!ctx) throw new Error("usePregao must be used within PregaoProvider");
  return ctx;
}
