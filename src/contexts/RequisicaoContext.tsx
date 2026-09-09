import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow } from "@/lib/supabaseHelper";
import { enviarNotificacaoRP } from "@/lib/notificacaoRP";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface StatusHistorico { status: string; dataHora: string; usuario?: string; observacao?: string; }

export interface IndicadoRP {
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  dataNascimento: string;
  curriculo?: { nome: string; tipo: string; base64: string } | null;
}

export interface Requisicao {
  id: string; numero: number; dataCriacao: string;
  headcount: string; orcamento: string; tipoVaga: string;
  unidade: string;
  cargoNome: string; cargoId: string; jornada: string; cargaHoraria: string;
  tipoContratacao: string[]; tipoContratacaoDetalhe?: string; internoExterno: string; origemVaga: string;
  motivoOutros: string; matricula: string; nomeSubstituido: string;
  cargoSubstituido: string; salarioSubstituido: string; dataDesligamento: string;
  formacao: string[]; formacaoDetalhe: string; experiencia: string;
  conhecimentoInformatica: string; atividadesCargo: string; salarioVaga: string;
  solicitante?: string;
  indicados?: IndicadoRP[];
  status: "Pendente" | "Em Análise" | "Aprovada" | "Reprovada" | "Suspensa" | "Concluída";
  aprovadoPor?: string; historicoStatus: StatusHistorico[];
}

interface RequisicaoContextType {
  requisicoes: Requisicao[];
  addRequisicao: (req: Omit<Requisicao, "id" | "numero" | "dataCriacao" | "status" | "aprovadoPor" | "historicoStatus">) => void;
  updateRequisicao: (id: string, data: Partial<Omit<Requisicao, "id" | "numero" | "dataCriacao" | "status" | "aprovadoPor" | "historicoStatus">>) => void;
  updateStatus: (id: string, status: Requisicao["status"], aprovadoPor?: string, observacao?: string) => void;
}

const RequisicaoContext = createContext<RequisicaoContextType | undefined>(undefined);

const rowToReq = (r: any): Requisicao => ({
  id: r.id, numero: r.numero ?? 0, dataCriacao: r.data_criacao ?? "",
  headcount: r.headcount ?? "", orcamento: r.orcamento ?? "", tipoVaga: r.tipo_vaga ?? "",
  unidade: r.unidade ?? "", cargoNome: r.cargo_nome ?? "", cargoId: r.cargo_id ?? "",
  jornada: r.jornada ?? "", cargaHoraria: r.carga_horaria ?? "",
  tipoContratacao: r.tipo_contratacao ?? [], tipoContratacaoDetalhe: r.tipo_contratacao_detalhe ?? "", internoExterno: r.interno_externo ?? "",
  origemVaga: r.origem_vaga ?? "", motivoOutros: r.motivo_outros ?? "",
  matricula: r.matricula ?? "", nomeSubstituido: r.nome_substituido ?? "",
  cargoSubstituido: r.cargo_substituido ?? "", salarioSubstituido: r.salario_substituido ?? "",
  dataDesligamento: r.data_desligamento ?? "", formacao: r.formacao ?? [],
  formacaoDetalhe: r.formacao_detalhe ?? "", experiencia: r.experiencia ?? "",
  conhecimentoInformatica: r.conhecimento_informatica ?? "",
  atividadesCargo: r.atividades_cargo ?? "", salarioVaga: r.salario_vaga ?? "",
  solicitante: r.solicitante ?? "",
  indicados: r.indicados ?? [],
  status: r.status ?? "Pendente", aprovadoPor: r.aprovado_por ?? "",
  historicoStatus: r.historico_status ?? [],
});

const reqToRow = (r: Requisicao) => ({
  numero: r.numero, data_criacao: r.dataCriacao,
  headcount: r.headcount, orcamento: r.orcamento, tipo_vaga: r.tipoVaga,
  unidade: r.unidade,
  cargo_nome: r.cargoNome, cargo_id: r.cargoId, jornada: r.jornada,
  carga_horaria: r.cargaHoraria, tipo_contratacao: r.tipoContratacao as any,
  tipo_contratacao_detalhe: r.tipoContratacaoDetalhe ?? "",
  interno_externo: r.internoExterno, origem_vaga: r.origemVaga,
  motivo_outros: r.motivoOutros, matricula: r.matricula,
  nome_substituido: r.nomeSubstituido, cargo_substituido: r.cargoSubstituido,
  salario_substituido: r.salarioSubstituido, data_desligamento: r.dataDesligamento,
  formacao: r.formacao as any, formacao_detalhe: r.formacaoDetalhe,
  experiencia: r.experiencia, conhecimento_informatica: r.conhecimentoInformatica,
  atividades_cargo: r.atividadesCargo, salario_vaga: r.salarioVaga,
  solicitante: r.solicitante ?? "",
  indicados: r.indicados ?? [],
  status: r.status, aprovado_por: r.aprovadoPor ?? "",
  historico_status: r.historicoStatus as any,
});

const QK = ["requisicoes_pessoal"] as const;

export function RequisicaoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Requisicao");
  const qc = useQueryClient();
  const { data: requisicoes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("requisicoes", "created_at")).map(rowToReq),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const load = async () => { await qc.invalidateQueries({ queryKey: QK }); };

  const addRequisicao = async (req: Omit<Requisicao, "id" | "numero" | "dataCriacao" | "status" | "historicoStatus">) => {
    const maxNum = requisicoes.length > 0 ? Math.max(...requisicoes.map(r => r.numero)) : 0;
    const agora = new Date().toLocaleString("pt-BR");
    const full: Requisicao = {
      ...req, id: "", numero: maxNum + 1,
      dataCriacao: new Date().toLocaleDateString("pt-BR"),
      status: "Pendente",
      historicoStatus: [{ status: "Pendente", dataHora: agora }],
    };
    await insertRow("requisicoes", reqToRow(full));
    await load();

    const msg =
      `*Nova Requisição de Pessoal*\n\n` +
      `RP Nº: ${full.numero}\n` +
      `Cargo: ${full.cargoNome || "-"}\n` +
      `Unidade: ${full.unidade || "-"}\n` +
      `Solicitante: ${full.solicitante || "-"}\n` +
      `Data: ${full.dataCriacao}\n` +
      `Status: ${full.status}`;
    await enviarNotificacaoRP({ mensagem: msg, solicitante: full.solicitante });
  };

  const updateRequisicao = async (id: string, data: Partial<Omit<Requisicao, "id" | "numero" | "dataCriacao" | "status" | "aprovadoPor" | "historicoStatus">>) => {
    const current = requisicoes.find(r => r.id === id);
    if (!current) return;
    if (["Aprovada", "Reprovada", "Concluída"].includes(current.status)) return;
    const merged = { ...current, ...data };
    await updateRow("requisicoes", id, reqToRow(merged));
    await load();
  };

  const updateStatus = async (id: string, status: Requisicao["status"], aprovadoPor?: string, observacao?: string) => {
    const current = requisicoes.find(r => r.id === id);
    if (!current) return;
    const agora = new Date().toLocaleString("pt-BR");
    const updated = {
      ...current, status, aprovadoPor: aprovadoPor || current.aprovadoPor,
      historicoStatus: [...(current.historicoStatus || []), { status, dataHora: agora, usuario: aprovadoPor, observacao }],
    };
    await updateRow("requisicoes", id, reqToRow(updated));
    await load();

    const msg =
      `*Atualização de Requisição de Pessoal*\n\n` +
      `RP Nº: ${current.numero}\n` +
      `Cargo: ${current.cargoNome || "-"}\n` +
      `Status: ${status}\n` +
      (aprovadoPor ? `Por: ${aprovadoPor}\n` : "") +
      (observacao ? `Justificativa: ${observacao}\n` : "") +
      `Data: ${agora}`;
    await enviarNotificacaoRP({ mensagem: msg, solicitante: current.solicitante });
  };

  return (
    <RequisicaoContext.Provider value={{ requisicoes, addRequisicao, updateRequisicao, updateStatus }}>
      {children}
    </RequisicaoContext.Provider>
  );
}

export function useRequisicoes() {
  useActivateProvider("Requisicao");
  const ctx = useContext(RequisicaoContext);
  if (!ctx) throw new Error("useRequisicoes must be used within RequisicaoProvider");
  return ctx;
}

