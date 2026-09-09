import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface MaterialOS {
  id: string; codigo: string; descricao: string;
  unidade: string; valorUnitario: number;
  quantidade: number; valorTotal: number;
  valorVenda?: number;
}

export interface AnexoOS { id: string; titulo: string; url: string; }
export interface FotoOS { id: string; url: string; }
export interface ProfissionalOS { id: string; funcionarioId: string; nome: string; cargo: string; }
export interface ObservacaoOS { id: string; descricao: string; usuario: string; data: string; }
export interface ObservacaoFiscalizacao { id: string; titulo: string; descricao: string; usuario: string; data: string; }
export interface TipoOS { cod: number; descricao: string; sigla: string; }

export const TIPOS_OS: TipoOS[] = [
  { cod: 1, descricao: "Corretiva", sigla: "C" },
  { cod: 2, descricao: "Preventiva", sigla: "P" },
  { cod: 3, descricao: "Preditiva", sigla: "D" },
];

export interface OrdemServico {
  id: string; numero: number;
  solicitacaoId: string; solicitacaoNumero: number;
  nCliente: string; clienteId: string; clienteNome: string;
  situacao: string;
  dataInicio: string; horaInicio: string;
  dataTermino: string; horaTermino: string;
  prioridade: string;
  complexidade: "Baixa" | "Média" | "Alta";
  solicitante: string; matricula: string; ramal: string; telefone: string;
  localId: string; localDescricao: string;
  pavimentoId: string; pavimentoDescricao: string;
  setorId: string; setorDescricao: string;
  categoria: string; servico: string;
  descricaoServicos: string;
  ressalvaAprovacao: string; descricaoConclusao: string;
  materiais: MaterialOS[]; materiaisEstoque: MaterialOS[];
  profissionais: ProfissionalOS[]; anexos: AnexoOS[]; fotos: FotoOS[];
  observacoes: ObservacaoOS[]; observacoesFiscalizacao: ObservacaoFiscalizacao[];
  bdi: number; tipoOs: TipoOS;
  operadorId: string; operadorNome: string;
  createdAt: string;
  historico: { situacao: string; data: string; usuario: string }[];
  avaliacao?: number | null; avaliacaoJustificativa?: string;
  avaliacaoData?: string; avaliacaoUsuario?: string;
  retornoPendente?: RetornoPendenteOS | null;
  impresso: boolean;
  impressoEm: string;
  impressoPor: string;
  dataFaturamento: string;
  faturadoPor: string;
  faturadoEm: string;
}

export interface RetornoPendenteOS {
  motivo: string;
  destino: string;
  origem: string;
  solicitanteId: string;
  solicitanteNome: string;
  solicitanteEmail: string;
  data: string;
}

interface OrdensServicoContextType {
  ordens: OrdemServico[];
  addOrdem: (d: any) => Promise<void>;
  updateOrdem: (id: string, d: any) => Promise<void>;
  deleteOrdem: (id: string) => Promise<void>;
  loading: boolean;
}

const OrdensServicoContext = createContext<OrdensServicoContextType | undefined>(undefined);
const QK = ["ordens_servico"] as const;

const rowToOrdem = (r: any): OrdemServico => ({
  id: r.id, numero: r.numero ?? 0,
  solicitacaoId: r.solicitacao_id ?? "", solicitacaoNumero: r.solicitacao_numero ?? 0,
  nCliente: r.n_cliente ?? "",
  clienteId: r.cliente_id ?? "", clienteNome: r.cliente_nome ?? "",
  situacao: r.situacao ?? "Aberta",
  dataInicio: r.data_inicio ?? "", horaInicio: r.hora_inicio ?? "",
  dataTermino: r.data_termino ?? "", horaTermino: r.hora_termino ?? "",
  prioridade: r.prioridade ?? "C: NORMAL",
  complexidade: (r.complexidade as any) ?? "Baixa",
  solicitante: r.solicitante ?? "", matricula: r.matricula ?? "",
  ramal: r.ramal ?? "", telefone: r.telefone ?? "",
  localId: r.local_id ?? "", localDescricao: r.local_descricao ?? "",
  pavimentoId: r.pavimento_id ?? "", pavimentoDescricao: r.pavimento_descricao ?? "",
  setorId: r.setor_id ?? "", setorDescricao: r.setor_descricao ?? "",
  categoria: r.categoria ?? "", servico: r.servico ?? "",
  descricaoServicos: r.descricao_servicos ?? "",
  ressalvaAprovacao: r.ressalva_aprovacao ?? "",
  descricaoConclusao: r.descricao_conclusao ?? "",
  materiais: Array.isArray(r.materiais) ? r.materiais : [],
  materiaisEstoque: Array.isArray(r.materiais_estoque) ? r.materiais_estoque : [],
  profissionais: Array.isArray(r.profissionais) ? r.profissionais : [],
  anexos: Array.isArray(r.anexos) ? r.anexos : [],
  fotos: Array.isArray(r.fotos) ? r.fotos : [],
  observacoes: Array.isArray(r.observacoes) ? r.observacoes : [],
  observacoesFiscalizacao: Array.isArray(r.observacoes_fiscalizacao) ? r.observacoes_fiscalizacao : [],
  bdi: r.bdi ?? 0,
  tipoOs: r.tipo_os && typeof r.tipo_os === "object" ? r.tipo_os : { cod: 1, descricao: "Corretiva", sigla: "C" },
  operadorId: r.operador_id ?? "", operadorNome: r.operador_nome ?? "",
  createdAt: r.created_at ?? "",
  historico: Array.isArray(r.historico) ? r.historico : [],
  avaliacao: r.avaliacao ?? null,
  avaliacaoJustificativa: r.avaliacao_justificativa ?? "",
  avaliacaoData: r.avaliacao_data ?? "",
  avaliacaoUsuario: r.avaliacao_usuario ?? "",
  retornoPendente: r.retorno_pendente && typeof r.retorno_pendente === "object" ? r.retorno_pendente : null,
  impresso: !!r.impresso,
  impressoEm: r.impresso_em ?? "",
  impressoPor: r.impresso_por ?? "",
  dataFaturamento: r.data_faturamento ?? "",
  faturadoPor: r.faturado_por ?? "",
  faturadoEm: r.faturado_em ?? "",
});

export function OrdensServicoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("OrdensServico");
  const qc = useQueryClient();
  const { data: ordens = [], isLoading: loading } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("ordens_servico", "numero")).map(rowToOrdem),
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addOrdem = async (d: any) => { await insertRow("ordens_servico", d); invalidate(); };
  const updateOrdem = async (id: string, d: any) => { await updateRow("ordens_servico", id, d); invalidate(); };
  const deleteOrdem = async (id: string) => {
    const stored = localStorage.getItem("usuarioLogado") || sessionStorage.getItem("usuarioLogado");
    const userId = stored ? (JSON.parse(stored)?.id ?? null) : null;
    if (!userId) {
      toast.error("Sessão inválida. Faça login novamente.");
      throw new Error("Sem usuário logado");
    }
    const { data, error } = await supabase.functions.invoke("delete-ordem-servico", {
      body: { userId, osId: id },
    });
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error || error?.message || "Erro ao excluir OS.";
      toast.error(msg);
      throw new Error(msg);
    }
    invalidate();
  };

  return (
    <OrdensServicoContext.Provider value={{ ordens, addOrdem, updateOrdem, deleteOrdem, loading }}>
      {children}
    </OrdensServicoContext.Provider>
  );
}

export function useOrdensServico() {
  useActivateProvider("OrdensServico");
  const ctx = useContext(OrdensServicoContext);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!ctx && !warnedRef.current) {
      warnedRef.current = true;
      toast.error("Módulo indisponível", {
        description:
          "O provider de Ordens de Serviço não está ativo. Recarregue a página ou entre em contato com o suporte.",
        duration: 6000,
      });
    }
  }, [ctx]);

  if (!ctx) {
    return {
      ordens: [],
      addOrdem: async () => {},
      updateOrdem: async () => {},
      deleteOrdem: async () => {},
      loading: false,
    } as OrdensServicoContextType;
  }

  return ctx;
}
