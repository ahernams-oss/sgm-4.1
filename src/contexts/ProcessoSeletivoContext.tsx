import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { enviarNotificacaoRP } from "@/lib/notificacaoRP";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";


async function notificarEtapaCandidato(requisicaoId: string, candidatoNome: string, evento: string, detalhes?: string) {
  try {
    const { data: req } = await (supabase as any)
      .from("requisicoes")
      .select("numero,cargo_nome,solicitante")
      .eq("id", requisicaoId)
      .maybeSingle();
    if (!req) return;
    const msg =
      `*Processo Seletivo - ${evento}*\n\n` +
      `RP Nº: ${req.numero}\n` +
      `Cargo: ${req.cargo_nome || "-"}\n` +
      `Candidato: ${candidatoNome}\n` +
      (detalhes ? `${detalhes}\n` : "") +
      `Data: ${new Date().toLocaleString("pt-BR")}`;
    await enviarNotificacaoRP({ mensagem: msg, solicitante: req.solicitante });
  } catch (e) {
    console.error("Falha notificação processo seletivo:", e);
  }
}


export type EtapaCandidato = "entrevista_psicologica" | "entrevista_tecnica" | "liberacao" | "contratacao";
export type StatusCandidato = "pendente" | "aprovado" | "neutro" | "reprovado";

export interface AnexoCandidato { nome: string; tipo: string; base64: string; }
export interface DocumentoContratacao { nome: string; entregue: boolean; anexo?: AnexoCandidato; naoPossui?: boolean; }
export interface ExameAdmissional { dataExame: string; resultado: "pendente" | "apto" | "inapto"; observacoes: string; anexo?: AnexoCandidato; }
export interface DadosBancarios { banco: string; agencia: string; conta: string; tipoConta: string; pisPasep: string; pix?: string; }

export const DOCUMENTOS_OBRIGATORIOS = [
  "CNH", "RG", "CPF", "CTPS (Carteira de Trabalho)", "Comprovante de Residência",
  "Certidão de Nascimento/Casamento", "Título de Eleitor", "Certificado de Reservista",
  "PIS/PASEP", "Foto 3x4", "Comprovante de Escolaridade",
  "Diploma ou Certificado de Formação",
  "Certidão de Nascimento dos Filhos", "Cartão de Vacina dos Filhos",
];

export interface Candidato {
  id: string; nome: string; telefone: string; email: string;
  cpf: string; dataNascimento: string;
  idade: string; estadoCivil: string; experienciasAnteriores: string;
  anexos: AnexoCandidato[]; etapaAtual: EtapaCandidato;
  dataEntrevistaPsicologica?: string; dataEntrevistaTecnica?: string;
  dataLiberacao?: string; dataContratacao?: string;
  parecerPsicologo: string; statusPsicologico: StatusCandidato;
  avaliadorTecnico: string; parecerTecnico: string; statusTecnico: StatusCandidato;
  liberadoPor: string; statusLiberacao: StatusCandidato;
  documentos: DocumentoContratacao[]; exameAdmissional: ExameAdmissional;
  dadosBancarios: DadosBancarios; contratacaoFinalizada?: boolean;
  lgpdAceite?: boolean; lgpdAceiteData?: string; portalEnviadoEm?: string;
}

export interface ProcessoSeletivo {
  id: string; numero?: number; requisicaoId: string; dataCriacao: string; candidatos: Candidato[];
}

interface ProcessoSeletivoContextType {
  processos: ProcessoSeletivo[];
  criarProcesso: (requisicaoId: string) => ProcessoSeletivo;
  getProcessoByRequisicao: (requisicaoId: string) => ProcessoSeletivo | undefined;
  /** Carrega o processo completo (com os anexos) e atualiza o cache. */
  carregarProcessoCompleto: (processoId: string) => Promise<ProcessoSeletivo | null>;
  addCandidato: (processoId: string, candidato: Omit<Candidato, "id" | "etapaAtual" | "parecerPsicologo" | "statusPsicologico" | "avaliadorTecnico" | "parecerTecnico" | "statusTecnico" | "liberadoPor" | "statusLiberacao" | "idade" | "estadoCivil" | "experienciasAnteriores" | "anexos" | "documentos" | "exameAdmissional" | "dadosBancarios"> & { anexos?: AnexoCandidato[] }) => void;
  updateCandidato: (processoId: string, candidatoId: string, data: Partial<Candidato>) => void;
  importarCandidatos: (
    processoId: string,
    lista: { nome: string; telefone?: string; email?: string; cpf?: string; dataNascimento?: string; anexos?: AnexoCandidato[] }[],
  ) => Promise<number>;
  avancarEtapa: (processoId: string, candidatoId: string) => void;
}

const ProcessoSeletivoContext = createContext<ProcessoSeletivoContextType | undefined>(undefined);

const rowToProcesso = (r: any): ProcessoSeletivo => ({
  id: r.id, numero: r.numero ?? undefined, requisicaoId: r.requisicao_id ?? "", dataCriacao: r.data_criacao ?? "",
  candidatos: r.candidatos ?? [],
});

const processoToRow = (p: ProcessoSeletivo) => ({
  requisicao_id: p.requisicaoId, data_criacao: p.dataCriacao, candidatos: p.candidatos as any,
});

const QK = ["processos_seletivos"] as const;
const criandoProcessos = new Set<string>();
// mapeia id local recém-gerado -> requisicao_id (para resolver processos ainda não carregados)
const criandoIds = new Map<string, string>();

export function ProcessoSeletivoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("ProcessoSeletivo");
  const queryClient = useQueryClient();

  const { data: processos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      // Lista "leve": os anexos (base64) não trafegam aqui — são carregados
      // sob demanda ao abrir um processo específico.
      const { data, error } = await (supabase as any).rpc("processos_seletivos_leves");
      if (error) {
        const fallback = await fetchAll("processos_seletivos", "created_at");
        return fallback.map(rowToProcesso) as ProcessoSeletivo[];
      }
      return (data || []).map(rowToProcesso) as ProcessoSeletivo[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  // Resolve um processo SEMPRE a partir do banco (dados completos, com anexos),
  // pois a lista em cache não contém o conteúdo dos arquivos.
  const resolveProcesso = async (processoId: string): Promise<ProcessoSeletivo | null> => {
    const { data } = await (supabase as any)
      .from("processos_seletivos")
      .select("*")
      .eq("id", processoId)
      .maybeSingle();
    if (data) return rowToProcesso(data);
    // pode ter sido criado com outro id (upsert por requisicao_id)
    const reqId = criandoIds.get(processoId);
    if (reqId) {
      const { data: byReq } = await (supabase as any)
        .from("processos_seletivos")
        .select("*")
        .eq("requisicao_id", reqId)
        .maybeSingle();
      if (byReq) return rowToProcesso(byReq);
      // ainda não existe no banco: cria agora para não perder o candidato
      const { data: criado, error } = await (supabase as any)
        .from("processos_seletivos")
        .insert({ id: processoId, requisicao_id: reqId, data_criacao: new Date().toLocaleDateString("pt-BR"), candidatos: [] })
        .select()
        .maybeSingle();
      if (criado) { invalidate(); return rowToProcesso(criado); }
      console.error("Falha ao criar processo seletivo:", error);
    }
    return null;
  };


  // Aplica um patch otimista no cache do React Query e persiste em background.
  const applyPatch = async (
    id: string,
    patch: (p: ProcessoSeletivo) => ProcessoSeletivo,
  ): Promise<ProcessoSeletivo | null> => {
    const base = await resolveProcesso(id);
    if (!base) return null;
    const updated = patch(base);
    queryClient.setQueryData<ProcessoSeletivo[]>(QK, (prev = []) =>
      prev.some((p) => p.id === updated.id)
        ? prev.map((p) => (p.id === updated.id ? updated : p))
        : [...prev, updated]
    );
    try {
      const { error } = await (supabase as any)
        .from("processos_seletivos")
        .upsert({ id: updated.id, ...processoToRow(updated) }, { onConflict: "id" });
      if (error) throw error;
    } catch (e) {
      console.error("Falha ao salvar processo seletivo, recarregando...", e);
      toast.error("Não foi possível salvar. Tente novamente.");
      await invalidate();
    }
    return updated;

  };

  const saveAndReload = async (id: string, updated: ProcessoSeletivo) => {
    await applyPatch(id, () => updated);
  };



  // criandoProcessos (módulo) evita que renders concorrentes gerem
  // processos duplicados para a mesma requisição.


  const criarProcesso = (requisicaoId: string): ProcessoSeletivo => {
    const existing = processos.find(p => p.requisicaoId === requisicaoId);
    if (existing) return existing;
    const novo: ProcessoSeletivo = {
      id: crypto.randomUUID(), requisicaoId,
      dataCriacao: new Date().toLocaleDateString("pt-BR"), candidatos: [],
    };
    criandoIds.set(novo.id, requisicaoId);
    if (criandoProcessos.has(requisicaoId)) return novo;
    criandoProcessos.add(requisicaoId);
    // upsert com ignoreDuplicates: se já existir processo para a RP, nada é criado
    (supabase as any)
      .from("processos_seletivos")
      .upsert({ id: novo.id, ...processoToRow(novo) }, { onConflict: "requisicao_id", ignoreDuplicates: true })
      .then(() => invalidate())
      .catch(() => invalidate());
    return novo;
  };


  const getProcessoByRequisicao = (requisicaoId: string) =>
    processos.find(p => p.requisicaoId === requisicaoId);

  const carregarProcessoCompleto = async (processoId: string) => {
    const full = await resolveProcesso(processoId);
    if (full) {
      queryClient.setQueryData<ProcessoSeletivo[]>(QK, (prev = []) =>
        prev.some((p) => p.id === full.id)
          ? prev.map((p) => (p.id === full.id ? full : p))
          : [...prev, full]
      );
    }
    return full;
  };

  const addCandidato = async (
    processoId: string,
    candidato: Omit<Candidato, "id" | "etapaAtual" | "parecerPsicologo" | "statusPsicologico" | "avaliadorTecnico" | "parecerTecnico" | "statusTecnico" | "liberadoPor" | "statusLiberacao" | "idade" | "estadoCivil" | "experienciasAnteriores" | "anexos" | "documentos" | "exameAdmissional" | "dadosBancarios"> & { anexos?: AnexoCandidato[] }
  ) => {
    const p = await resolveProcesso(processoId);
    if (!p || p.candidatos.length >= 5) return;
    const novoCandidato: Candidato = {
      ...candidato, id: crypto.randomUUID(),
      etapaAtual: "entrevista_psicologica", idade: "", estadoCivil: "",
      experienciasAnteriores: "", anexos: candidato.anexos || [],
      dataEntrevistaPsicologica: new Date().toLocaleDateString("pt-BR"),
      parecerPsicologo: "", statusPsicologico: "pendente",
      avaliadorTecnico: "", parecerTecnico: "", statusTecnico: "pendente",
      liberadoPor: "", statusLiberacao: "pendente",
      documentos: DOCUMENTOS_OBRIGATORIOS.map(nome => ({ nome, entregue: false })),
      exameAdmissional: { dataExame: "", resultado: "pendente", observacoes: "" },
      dadosBancarios: { banco: "", agencia: "", conta: "", tipoConta: "", pisPasep: "", pix: "" },
    };
    await saveAndReload(p.id, { ...p, candidatos: [...p.candidatos, novoCandidato] });
  };

  // Importa vários candidatos de uma só vez (ex.: indicados da requisição)
  const importarCandidatos = async (
    processoId: string,
    lista: { nome: string; telefone?: string; email?: string; cpf?: string; dataNascimento?: string; anexos?: AnexoCandidato[] }[],
  ) => {
    const p = await resolveProcesso(processoId);
    if (!p) return 0;
    // Chave composta: CPF + nome — evita descartar indicados distintos
    // que tenham sido cadastrados com o mesmo CPF por engano.
    const chaveDe = (cpf?: string, nome?: string) =>
      `${(cpf || "").replace(/\D/g, "")}|${(nome || "").trim().toLowerCase()}`;
    const existentes = new Set(p.candidatos.map(c => chaveDe(c.cpf, c.nome)));
    const novos: Candidato[] = [];
    for (const item of lista) {
      if (!item.nome?.trim()) continue;
      const chave = chaveDe(item.cpf, item.nome);
      if (existentes.has(chave)) continue;
      if (p.candidatos.length + novos.length >= 5) break;
      existentes.add(chave);
      novos.push({
        id: crypto.randomUUID(),
        nome: item.nome,
        telefone: item.telefone || "",
        email: item.email || "",
        cpf: (item.cpf || "").replace(/\D/g, ""),
        dataNascimento: item.dataNascimento || "",
        etapaAtual: "entrevista_psicologica", idade: "", estadoCivil: "",
        experienciasAnteriores: "", anexos: item.anexos || [],
        dataEntrevistaPsicologica: new Date().toLocaleDateString("pt-BR"),
        parecerPsicologo: "", statusPsicologico: "pendente",
        avaliadorTecnico: "", parecerTecnico: "", statusTecnico: "pendente",
        liberadoPor: "", statusLiberacao: "pendente",
        documentos: DOCUMENTOS_OBRIGATORIOS.map(nome => ({ nome, entregue: false })),
        exameAdmissional: { dataExame: "", resultado: "pendente", observacoes: "" },
        dadosBancarios: { banco: "", agencia: "", conta: "", tipoConta: "", pisPasep: "", pix: "" },
      });
    }
    if (novos.length === 0) return 0;
    await saveAndReload(p.id, { ...p, candidatos: [...p.candidatos, ...novos] });
    return novos.length;
  };

  const updateCandidato = async (processoId: string, candidatoId: string, data: Partial<Candidato>) => {
    let before: Candidato | undefined;
    let after: Candidato | undefined;
    let requisicaoIdRef: string | undefined;
    await applyPatch(processoId, (p) => {
      requisicaoIdRef = p.requisicaoId;
      before = p.candidatos.find(c => c.id === candidatoId);
      const novosCandidatos = p.candidatos.map(c => {
        if (c.id !== candidatoId) return c;
        const merged = { ...c, ...data };
        after = merged;
        return merged;
      });
      return { ...p, candidatos: novosCandidatos };
    });
    if (!before || !after || !requisicaoIdRef) return;
    const eventos: { evento: string; detalhes?: string }[] = [];
    if (data.statusPsicologico && data.statusPsicologico !== before.statusPsicologico) {
      eventos.push({ evento: "Avaliação Psicológica", detalhes: `Status: ${data.statusPsicologico}` });
    }
    if (data.statusTecnico && data.statusTecnico !== before.statusTecnico) {
      eventos.push({ evento: "Avaliação Técnica", detalhes: `Status: ${data.statusTecnico}${after.avaliadorTecnico ? ` | Avaliador: ${after.avaliadorTecnico}` : ""}` });
    }
    if (data.statusLiberacao && data.statusLiberacao !== before.statusLiberacao) {
      eventos.push({ evento: "Liberação", detalhes: `Status: ${data.statusLiberacao}${after.liberadoPor ? ` | Por: ${after.liberadoPor}` : ""}` });
    }
    if (data.contratacaoFinalizada && !before.contratacaoFinalizada) {
      eventos.push({ evento: "Contratação Finalizada" });
    }
    for (const ev of eventos) {
      await notificarEtapaCandidato(requisicaoIdRef, after.nome, ev.evento, ev.detalhes);
    }
  };

  const avancarEtapa = async (processoId: string, candidatoId: string) => {
    const etapas: EtapaCandidato[] = ["entrevista_psicologica", "entrevista_tecnica", "liberacao", "contratacao"];
    const p = await resolveProcesso(processoId);
    if (!p) return;
    let candidatoNotif: { nome: string; nextEtapa: EtapaCandidato } | null = null;
    await saveAndReload(p.id, {
      ...p, candidatos: p.candidatos.map(c => {
        if (c.id !== candidatoId) return c;
        const idx = etapas.indexOf(c.etapaAtual);
        if (idx < etapas.length - 1) {
          const nextEtapa = etapas[idx + 1];
          candidatoNotif = { nome: c.nome, nextEtapa };
          const dateNow = new Date().toLocaleDateString("pt-BR");
          const dateField =
            nextEtapa === "entrevista_tecnica" ? "dataEntrevistaTecnica" :
            nextEtapa === "liberacao" ? "dataLiberacao" :
            nextEtapa === "contratacao" ? "dataContratacao" : undefined;
          return { ...c, etapaAtual: nextEtapa, ...(dateField ? { [dateField]: dateNow } : {}) };
        }
        return c;
      }),
    });
    if (candidatoNotif) {
      const labels: Record<EtapaCandidato, string> = {
        entrevista_psicologica: "Entrevista Psicológica",
        entrevista_tecnica: "Entrevista Técnica",
        liberacao: "Liberação",
        contratacao: "Contratação",
      };
      await notificarEtapaCandidato(p.requisicaoId, candidatoNotif.nome, `Avanço de Etapa → ${labels[candidatoNotif.nextEtapa]}`);
    }
  };

  return (
    <ProcessoSeletivoContext.Provider value={{ processos, criarProcesso, getProcessoByRequisicao, carregarProcessoCompleto, addCandidato, updateCandidato, importarCandidatos, avancarEtapa }}>
      {children}
    </ProcessoSeletivoContext.Provider>
  );
}

const fallbackCtx: ProcessoSeletivoContextType = {
  processos: [],
  criarProcesso: (() => null) as any,
  getProcessoByRequisicao: () => undefined,
  carregarProcessoCompleto: async () => null,
  addCandidato: () => {},
  updateCandidato: () => {},
  importarCandidatos: async () => 0,
  avancarEtapa: () => {},
};

export function useProcessoSeletivo() {
  useActivateProvider("ProcessoSeletivo");
  const ctx = useContext(ProcessoSeletivoContext);
  if (!ctx) {
    console.warn("useProcessoSeletivo usado fora do ProcessoSeletivoProvider — usando fallback vazio.");
    return fallbackCtx;
  }
  return ctx;
}
