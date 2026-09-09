import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface AvaliacaoDesempenho {
  id: string;
  funcionarioId: string;
  dataAvaliacao: string;
  periodoReferencia: string;
  avaliadorId: string;
  avaliadorNome: string;
  notas: Record<string, number>;
  pontuacaoTotal: number;
  mediaPonderada: number;
  observacoes: string;
}

export const QUESITOS_AVALIACAO: { key: string; label: string; descricao: string }[] = [
  { key: "pontualidade", label: "Pontualidade", descricao: "É pontual no dia a dia" },
  { key: "qualidade", label: "Qualidade do trabalho", descricao: "Precisão, organização e atenção aos detalhes" },
  { key: "execucao", label: "Nível de execução", descricao: "Capacidade técnica para realizar as tarefas exigidas" },
  { key: "prazos", label: "Cumprimento de prazos", descricao: "Capacidade de entregar projetos no tempo combinado" },
  { key: "conhecimento", label: "Conhecimento da ferramenta/área", descricao: "Domínio de softwares, máquinas ou processos específicos" },
  { key: "comunicacao", label: "Comunicação", descricao: "Clareza ao transmitir e receber informações" },
  { key: "equipe", label: "Trabalho em equipe", descricao: "Colaboração, empatia e relacionamento com colegas" },
  { key: "proatividade", label: "Proatividade e Iniciativa", descricao: "Capacidade de agir sem precisar de supervisão constante" },
  { key: "adaptabilidade", label: "Adaptabilidade", descricao: "Facilidade em se adaptar a mudanças e novas situações" },
  { key: "resolucao", label: "Resolução de Problemas", descricao: "Criatividade e eficiência em encontrar soluções" },
  { key: "lideranca", label: "Liderança e Gestão", descricao: "Capacidade de guiar (especialmente para cargos de gestão)" },
  { key: "metas", label: "Atingimento de metas", descricao: "Comparação dos resultados atuais com as metas estabelecidas" },
  { key: "produtividade", label: "Produtividade", descricao: "Eficiência na utilização de tempo e recursos" },
  { key: "aprender", label: "Vontade de aprender", descricao: "Abertura para feedbacks e busca por desenvolvimento contínuo" },
  { key: "etica", label: "Postura ética", descricao: "Ética e aderência aos valores da empresa" },
];

const rowToAval = (r: any): AvaliacaoDesempenho => ({
  id: r.id,
  funcionarioId: r.funcionario_id ?? "",
  dataAvaliacao: r.data_avaliacao ?? "",
  periodoReferencia: r.periodo_referencia ?? "",
  avaliadorId: r.avaliador_id ?? "",
  avaliadorNome: r.avaliador_nome ?? "",
  notas: r.notas ?? {},
  pontuacaoTotal: Number(r.pontuacao_total ?? 0),
  mediaPonderada: Number(r.media_ponderada ?? 0),
  observacoes: r.observacoes ?? "",
});

const avalToRow = (a: Omit<AvaliacaoDesempenho, "id">) => ({
  funcionario_id: a.funcionarioId,
  data_avaliacao: a.dataAvaliacao,
  periodo_referencia: a.periodoReferencia,
  avaliador_id: a.avaliadorId || null,
  avaliador_nome: a.avaliadorNome,
  notas: a.notas as any,
  pontuacao_total: a.pontuacaoTotal,
  media_ponderada: a.mediaPonderada,
  observacoes: a.observacoes,
});

interface Ctx {
  avaliacoes: AvaliacaoDesempenho[];
  addAvaliacao: (a: Omit<AvaliacaoDesempenho, "id">) => Promise<void>;
  updateAvaliacao: (id: string, a: Omit<AvaliacaoDesempenho, "id">) => Promise<void>;
  deleteAvaliacao: (id: string) => Promise<void>;
}

const AvaliacoesDesempenhoContext = createContext<Ctx | undefined>(undefined);

const QK = ["avaliacoes_desempenho"] as const;

export function AvaliacoesDesempenhoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("AvaliacoesDesempenho");
  const queryClient = useQueryClient();

  const { data: avaliacoes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("avaliacoes_desempenho", "data_avaliacao");
      return data.map(rowToAval).reverse() as AvaliacaoDesempenho[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  const addAvaliacao = async (a: Omit<AvaliacaoDesempenho, "id">) => {
    await insertRow("avaliacoes_desempenho", avalToRow(a));
    await invalidate();
  };
  const updateAvaliacao = async (id: string, a: Omit<AvaliacaoDesempenho, "id">) => {
    await updateRow("avaliacoes_desempenho", id, avalToRow(a));
    await invalidate();
  };
  const deleteAvaliacao = async (id: string) => {
    await deleteRow("avaliacoes_desempenho", id);
    await invalidate();
  };

  return (
    <AvaliacoesDesempenhoContext.Provider value={{ avaliacoes, addAvaliacao, updateAvaliacao, deleteAvaliacao }}>
      {children}
    </AvaliacoesDesempenhoContext.Provider>
  );
}

export function useAvaliacoesDesempenho() {
  useActivateProvider("AvaliacoesDesempenho");
  const ctx = useContext(AvaliacoesDesempenhoContext);
  if (!ctx) throw new Error("useAvaliacoesDesempenho must be used within AvaliacoesDesempenhoProvider");
  return ctx;
}
