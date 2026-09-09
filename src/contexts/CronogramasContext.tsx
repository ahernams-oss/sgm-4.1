import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface CronogramaPeriodo { rotulo: string; inicio: string; fim: string; }

export interface CronogramaAtividadeValor {
  previsto_fisico: number; previsto_financeiro: number;
  realizado_fisico: number; realizado_financeiro: number;
}

export interface CronogramaAtividade {
  id: string; ordem: number; descricao: string;
  unidade: string; quantidade: number; peso: number;
  valor_total: number; modo_financeiro: "distribuido" | "manual";
  valores: Record<string, CronogramaAtividadeValor>;
  vincular_rdo: boolean;
}

export interface Cronograma {
  id: string; numero: number;
  cliente_id: string; cliente_nome: string;
  obra: string; descricao: string; responsavel: string;
  data_inicio: string; data_fim: string;
  granularidade: "mensal" | "quinzenal" | "semanal";
  valor_total: number;
  atividades: CronogramaAtividade[];
  periodos: CronogramaPeriodo[];
  status: string; observacoes: string;
  created_at: string; updated_at: string;
}

interface CronogramasContextType {
  cronogramas: Cronograma[]; loading: boolean;
  addCronograma: (c: Partial<Cronograma>) => Promise<Cronograma | null>;
  updateCronograma: (id: string, c: Partial<Cronograma>) => Promise<boolean>;
  deleteCronograma: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const CronogramasContext = createContext<CronogramasContextType>({} as CronogramasContextType);
export const useCronogramas = () => useContext(CronogramasContext);
const QK = ["cronogramas"] as const;

export function CronogramasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Cronogramas");
  const qc = useQueryClient();
  const { data: cronogramas = [], isLoading: loading, refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("cronogramas", "created_at");
      return (data as Cronograma[]).reverse();
    },
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addCronograma = async (c: Partial<Cronograma>) => {
    const data = await insertRow("cronogramas", c);
    if (data) { invalidate(); toast.success("Cronograma criado!"); }
    return data;
  };
  const updateCronograma = async (id: string, c: Partial<Cronograma>) => {
    const ok = await updateRow("cronogramas", id, { ...c, updated_at: new Date().toISOString() });
    if (ok) { invalidate(); toast.success("Cronograma atualizado!"); }
    return ok;
  };
  const deleteCronograma = async (id: string) => {
    const ok = await deleteRow("cronogramas", id);
    if (ok) { invalidate(); toast.success("Cronograma removido!"); }
    return ok;
  };
  const refresh = async () => { await refetch(); };

  return (
    <CronogramasContext.Provider value={{ cronogramas, loading, addCronograma, updateCronograma, deleteCronograma, refresh }}>
      {children}
    </CronogramasContext.Provider>
  );
}

// ===== Helpers =====
export function gerarPeriodos(inicio: string, fim: string, granularidade: "mensal" | "quinzenal" | "semanal"): CronogramaPeriodo[] {
  if (!inicio || !fim) return [];
  const dIni = new Date(inicio + "T00:00:00");
  const dFim = new Date(fim + "T00:00:00");
  if (isNaN(dIni.getTime()) || isNaN(dFim.getTime()) || dFim < dIni) return [];

  const periodos: CronogramaPeriodo[] = [];
  if (granularidade === "mensal") {
    const cur = new Date(dIni.getFullYear(), dIni.getMonth(), 1);
    const last = new Date(dFim.getFullYear(), dFim.getMonth(), 1);
    while (cur <= last) {
      const ini = new Date(cur);
      const fimMes = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      periodos.push({
        rotulo: `${meses[cur.getMonth()]}/${String(cur.getFullYear()).slice(-2)}`,
        inicio: ini.toISOString().slice(0, 10),
        fim: fimMes.toISOString().slice(0, 10),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    const passo = granularidade === "quinzenal" ? 15 : 7;
    const prefixo = granularidade === "quinzenal" ? "Q" : "S";
    const cur = new Date(dIni);
    let n = 1;
    while (cur <= dFim) {
      const ini = new Date(cur);
      const fimPer = new Date(cur);
      fimPer.setDate(fimPer.getDate() + (passo - 1));
      periodos.push({
        rotulo: `${prefixo}${n}`,
        inicio: ini.toISOString().slice(0, 10),
        fim: (fimPer > dFim ? dFim : fimPer).toISOString().slice(0, 10),
      });
      cur.setDate(cur.getDate() + passo);
      n++;
    }
  }
  return periodos;
}
