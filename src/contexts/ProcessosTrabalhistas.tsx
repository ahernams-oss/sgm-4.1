import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface ProcessoTrabalhista {
  id: string;
  numero_processo: string;
  vara: string;
  comarca: string;
  estado: string;
  autor_nome: string;
  autor_cpf: string;
  advogado_autor: string;
  advogado_autor_oab: string;
  advogado_empresa: string;
  advogados_empresa: string[];
  preposto: string;
  data_distribuicao: string | null;
  objeto_acao: string;
  valor_causa: number;
  provisao_contabil: number;
  valor_acordo: number;
  valor_condenacao: number;
  honorarios: number;
  risco: string;
  status: string;
  fase_processual: string;
  observacoes: string;
  anexos: any[];
  cliente_id: string;
  cliente_nome: string;
}

export interface Andamento {
  id: string;
  processo_id: string;
  tipo: string;
  data_andamento: string | null;
  descricao: string;
  responsavel: string;
  prazo_limite: string | null;
  status_prazo: string;
}

interface ContextType {
  processos: ProcessoTrabalhista[];
  andamentos: Andamento[];
  loading: boolean;
  addProcesso: (p: Omit<ProcessoTrabalhista, "id">) => Promise<void>;
  updateProcesso: (id: string, data: Partial<ProcessoTrabalhista>) => Promise<void>;
  deleteProcesso: (id: string) => Promise<void>;
  addAndamento: (a: Omit<Andamento, "id">) => Promise<void>;
  updateAndamento: (id: string, data: Partial<Andamento>) => Promise<void>;
  deleteAndamento: (id: string) => Promise<void>;
  loadAndamentos: (processoId: string) => Promise<Andamento[]>;
}

const Ctx = createContext<ContextType | undefined>(undefined);

const QK = ["processos_trabalhistas"] as const;

export function ProcessosTrabalhalistasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("ProcessosTrabalhistas");
  const queryClient = useQueryClient();
  const [andamentos, setAndamentos] = useState<Andamento[]>([]);

  const { data: processos = [], isLoading: loading } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("processos_trabalhistas", "created_at");
      return data.map((r: any) => ({
        id: r.id,
        numero_processo: r.numero_processo ?? "",
        vara: r.vara ?? "",
        comarca: r.comarca ?? "",
        estado: r.estado ?? "",
        autor_nome: r.autor_nome ?? "",
        autor_cpf: r.autor_cpf ?? "",
        advogado_autor: r.advogado_autor ?? "",
        advogado_autor_oab: r.advogado_autor_oab ?? "",
        advogado_empresa: r.advogado_empresa ?? "",
        advogados_empresa: Array.isArray(r.advogados_empresa)
          ? r.advogados_empresa.filter(Boolean)
          : (r.advogado_empresa ? [r.advogado_empresa] : []),
        preposto: r.preposto ?? "",
        data_distribuicao: r.data_distribuicao ?? null,
        objeto_acao: r.objeto_acao ?? "",
        valor_causa: Number(r.valor_causa) || 0,
        provisao_contabil: Number(r.provisao_contabil) || 0,
        valor_acordo: Number(r.valor_acordo) || 0,
        valor_condenacao: Number(r.valor_condenacao) || 0,
        honorarios: Number(r.honorarios) || 0,
        risco: r.risco ?? "Médio",
        status: r.status ?? "Ativo",
        fase_processual: r.fase_processual ?? "Inicial",
        observacoes: r.observacoes ?? "",
        anexos: Array.isArray(r.anexos) ? r.anexos : [],
        cliente_id: r.cliente_id ?? "",
        cliente_nome: r.cliente_nome ?? "",
      })) as ProcessoTrabalhista[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  const addProcesso = async (p: Omit<ProcessoTrabalhista, "id">) => {
    await insertRow("processos_trabalhistas", p);
    await invalidate();
  };
  const updateProcesso = async (id: string, data: Partial<ProcessoTrabalhista>) => {
    await updateRow("processos_trabalhistas", id, data);
    await invalidate();
  };
  const deleteProcesso = async (id: string) => {
    await deleteRow("processos_trabalhistas", id);
    await invalidate();
  };

  const loadAndamentos = useCallback(async (processoId: string): Promise<Andamento[]> => {
    const { data, error } = await (supabase as any)
      .from("processos_trabalhistas_andamentos")
      .select("*")
      .eq("processo_id", processoId)
      .order("data_andamento", { ascending: false });
    if (error) { console.error(error); toast.error("Erro ao carregar andamentos"); return []; }
    const mapped = (data || []).map((r: any) => ({
      id: r.id,
      processo_id: r.processo_id,
      tipo: r.tipo ?? "Outros",
      data_andamento: r.data_andamento ?? null,
      descricao: r.descricao ?? "",
      responsavel: r.responsavel ?? "",
      prazo_limite: r.prazo_limite ?? null,
      status_prazo: r.status_prazo ?? "Pendente",
    }));
    setAndamentos(mapped);
    return mapped;
  }, []);

  const addAndamento = async (a: Omit<Andamento, "id">) => {
    await insertRow("processos_trabalhistas_andamentos", a);
    await loadAndamentos(a.processo_id);
  };
  const updateAndamento = async (id: string, data: Partial<Andamento>) => {
    await updateRow("processos_trabalhistas_andamentos", id, data);
    if (data.processo_id) await loadAndamentos(data.processo_id);
  };
  const deleteAndamento = async (id: string) => {
    const a = andamentos.find(x => x.id === id);
    await deleteRow("processos_trabalhistas_andamentos", id);
    if (a) await loadAndamentos(a.processo_id);
  };

  return (
    <Ctx.Provider value={{ processos, andamentos, loading, addProcesso, updateProcesso, deleteProcesso, addAndamento, updateAndamento, deleteAndamento, loadAndamentos }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProcessosTrabalhistas() {
  useActivateProvider("ProcessosTrabalhistas");
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProcessosTrabalhistas must be used within Provider");
  return ctx;
}
