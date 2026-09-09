import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export type TipoLancamento = "falta" | "hora_extra" | "advertencia" | "atestado";
export type TipoFalta = "justificada" | "injustificada" | "suspensao";
export type TipoAdvertencia = "verbal" | "escrita";

export interface AnexoFalta { nome: string; tipo: string; base64: string; }

export interface Lancamento {
  id: string; funcionarioId: string; tipo: TipoLancamento; data: string;
  tipoFalta?: TipoFalta; diasFalta?: number; anexos?: AnexoFalta[];
  horasExtras?: number; percentual?: number; observacao: string; criadoEm: string;
  tipoAdvertencia?: TipoAdvertencia; motivo?: string;
  dataFim?: string;
}


interface LancamentosContextType {
  lancamentos: Lancamento[];
  addLancamento: (l: Omit<Lancamento, "id" | "criadoEm">) => void;
  updateLancamento: (id: string, l: Partial<Omit<Lancamento, "id" | "criadoEm">>) => void;
  deleteLancamento: (id: string) => void;
}

const LancamentosContext = createContext<LancamentosContextType | undefined>(undefined);
const QK = ["lancamentos"] as const;

const rowToLancamento = (r: any): Lancamento => ({
  id: r.id, funcionarioId: r.funcionario_id ?? "", tipo: r.tipo ?? "falta",
  data: r.data ?? "", tipoFalta: r.tipo_falta || undefined,
  diasFalta: r.dias_falta ? Number(r.dias_falta) : undefined,
  anexos: r.anexos ?? [], horasExtras: r.horas_extras ? Number(r.horas_extras) : undefined,
  percentual: r.percentual ? Number(r.percentual) : undefined,
  observacao: r.observacao ?? "", criadoEm: r.criado_em ?? "",
  tipoAdvertencia: r.tipo_advertencia || undefined, motivo: r.motivo || undefined,
  dataFim: r.data_fim || undefined,
});

const lancamentoToRow = (l: Omit<Lancamento, "id">) => ({
  funcionario_id: l.funcionarioId, tipo: l.tipo, data: l.data,
  tipo_falta: l.tipoFalta ?? "", dias_falta: l.diasFalta ?? 0,
  anexos: (l.anexos ?? []) as any, horas_extras: l.horasExtras ?? 0,
  percentual: l.percentual ?? 0, observacao: l.observacao, criado_em: l.criadoEm,
  tipo_advertencia: l.tipoAdvertencia ?? "", motivo: l.motivo ?? "",
  data_fim: l.dataFim ?? null,
});


export function LancamentosProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Lancamentos");
  const qc = useQueryClient();
  const { data: lancamentos = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("lancamentos", "created_at")).map(rowToLancamento),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addLancamento = async (l: Omit<Lancamento, "id" | "criadoEm">) => {
    const criadoEm = new Date().toISOString();
    await insertRow("lancamentos", lancamentoToRow({ ...l, criadoEm }));
    invalidate();
  };

  const updateLancamento = async (id: string, data: Partial<Omit<Lancamento, "id" | "criadoEm">>) => {
    const current = lancamentos.find(l => l.id === id);
    if (!current) return;
    const merged = { ...current, ...data };
    const { id: _, ...rest } = merged;
    await updateRow("lancamentos", id, lancamentoToRow(rest));
    invalidate();
  };

  const deleteLancamento = async (id: string) => { await deleteRow("lancamentos", id); invalidate(); };

  return (
    <LancamentosContext.Provider value={{ lancamentos, addLancamento, updateLancamento, deleteLancamento }}>
      {children}
    </LancamentosContext.Provider>
  );
}

export function useLancamentos() {
  useActivateProvider("Lancamentos");
  const ctx = useContext(LancamentosContext);
  if (!ctx) throw new Error("useLancamentos must be used within LancamentosProvider");
  return ctx;
}
