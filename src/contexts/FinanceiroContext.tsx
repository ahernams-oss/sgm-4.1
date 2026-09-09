import { createContext, useContext, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

export type StatusPagar = "aberta" | "paga" | "parcial" | "cancelada";
export type StatusReceber = "aberta" | "recebida" | "parcial" | "cancelada";

export interface ContaBancaria {
  id: string;
  nome: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo: "corrente" | "poupanca" | "caixa" | "cartao";
  saldo_inicial: number;
  ativo: boolean;
  observacao?: string;
}

export interface PlanoConta {
  id: string;
  codigo?: string;
  nome: string;
  tipo: "receita" | "despesa";
  parent_id?: string | null;
  ativo: boolean;
}

export interface CentroCusto {
  id: string;
  codigo?: string;
  nome: string;
  cliente_id?: string | null;
  ativo: boolean;
}

export interface ContaPagar {
  id: string;
  descricao: string;
  fornecedor_id?: string | null;
  fornecedor_nome?: string;
  valor_total: number;
  valor_pago: number;
  data_emissao?: string | null;
  data_vencimento: string;
  data_pagamento?: string | null;
  conta_bancaria_id?: string | null;
  plano_conta_id?: string | null;
  centro_custo_id?: string | null;
  status: StatusPagar;
  parcela_num: number;
  parcela_total: number;
  recorrencia?: any;
  anexo_url?: string;
  anexo_nome?: string;
  observacao?: string;
  pedido_compra_id?: string | null;
  origem?: string;
  created_at?: string;
}

export interface ContaReceber {
  id: string;
  descricao: string;
  cliente_id?: string | null;
  cliente_nome?: string;
  valor_total: number;
  valor_recebido: number;
  data_emissao?: string | null;
  data_vencimento: string;
  data_recebimento?: string | null;
  conta_bancaria_id?: string | null;
  plano_conta_id?: string | null;
  centro_custo_id?: string | null;
  status: StatusReceber;
  parcela_num: number;
  parcela_total: number;
  anexo_url?: string;
  anexo_nome?: string;
  observacao?: string;
  contrato_id?: string | null;
  faturamento_id?: string | null;
  origem?: string;
  created_at?: string;
}

export interface Lancamento {
  id: string;
  tipo: "entrada" | "saida" | "transferencia";
  conta_bancaria_id: string;
  conta_destino_id?: string | null;
  valor: number;
  data: string;
  descricao?: string;
  conta_pagar_id?: string | null;
  conta_receber_id?: string | null;
  plano_conta_id?: string | null;
  centro_custo_id?: string | null;
  conciliado: boolean;
  anexos?: { url: string; nome: string }[];
}

export interface MovimentoOfx {
  id: string;
  conta_bancaria_id: string;
  fitid: string;
  data: string;
  valor: number;
  descricao?: string;
  conciliado: boolean;
  lancamento_id?: string | null;
}

interface Ctx {
  loading: boolean;
  contasBancarias: ContaBancaria[];
  planoContas: PlanoConta[];
  centrosCusto: CentroCusto[];
  contasPagar: ContaPagar[];
  contasReceber: ContaReceber[];
  lancamentos: Lancamento[];
  movimentosOfx: MovimentoOfx[];
  reload: () => Promise<void>;
  // CRUD
  addContaBancaria: (c: Omit<ContaBancaria, "id">) => Promise<ContaBancaria | null>;
  updateContaBancaria: (id: string, c: Partial<ContaBancaria>) => Promise<void>;
  deleteContaBancaria: (id: string) => Promise<void>;
  addPlanoConta: (c: Omit<PlanoConta, "id">) => Promise<void>;
  updatePlanoConta: (id: string, c: Partial<PlanoConta>) => Promise<void>;
  deletePlanoConta: (id: string) => Promise<void>;
  addCentroCusto: (c: Omit<CentroCusto, "id">) => Promise<void>;
  updateCentroCusto: (id: string, c: Partial<CentroCusto>) => Promise<void>;
  deleteCentroCusto: (id: string) => Promise<void>;
  addContaPagar: (c: Omit<ContaPagar, "id">) => Promise<ContaPagar | null>;
  updateContaPagar: (id: string, c: Partial<ContaPagar>) => Promise<void>;
  deleteContaPagar: (id: string) => Promise<void>;
  addContaReceber: (c: Omit<ContaReceber, "id">) => Promise<ContaReceber | null>;
  updateContaReceber: (id: string, c: Partial<ContaReceber>) => Promise<void>;
  deleteContaReceber: (id: string) => Promise<void>;
  addLancamento: (c: Omit<Lancamento, "id">) => Promise<Lancamento | null>;
  deleteLancamento: (id: string) => Promise<void>;
  addMovimentoOfx: (m: Omit<MovimentoOfx, "id">) => Promise<void>;
  updateMovimentoOfx: (id: string, m: Partial<MovimentoOfx>) => Promise<void>;
  // helpers
  saldoConta: (contaId: string) => number;
}

const FinanceiroContext = createContext<Ctx | undefined>(undefined);

const QK_CB = ["fin_contas_bancarias"] as const;
const QK_PC = ["fin_plano_contas"] as const;
const QK_CC = ["fin_centros_custo"] as const;
const QK_CP = ["fin_contas_pagar"] as const;
const QK_CR = ["fin_contas_receber"] as const;
const QK_LN = ["fin_lancamentos"] as const;
const QK_OFX = ["fin_movimentos_ofx"] as const;

export function FinanceiroProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Financeiro");
  const qc = useQueryClient();

  const results = useQueries({
    queries: gateQueries([
      { queryKey: QK_CB, queryFn: async () => fetchAll("fin_contas_bancarias", "nome"), staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_PC, queryFn: async () => fetchAll("fin_plano_contas", "codigo"), staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_CC, queryFn: async () => fetchAll("fin_centros_custo", "nome"), staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_CP, queryFn: async () => fetchAll("fin_contas_pagar", "data_vencimento"), staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_CR, queryFn: async () => fetchAll("fin_contas_receber", "data_vencimento"), staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_LN, queryFn: async () => fetchAll("fin_lancamentos", "data"), staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
      { queryKey: QK_OFX, queryFn: async () => fetchAll("fin_movimentos_ofx", "data"), staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
    ], __active),
  });

  const contasBancarias = (results[0].data as ContaBancaria[]) || [];
  const planoContas = (results[1].data as PlanoConta[]) || [];
  const centrosCusto = (results[2].data as CentroCusto[]) || [];
  const contasPagar = (results[3].data as ContaPagar[]) || [];
  const contasReceber = (results[4].data as ContaReceber[]) || [];
  const lancamentos = (results[5].data as Lancamento[]) || [];
  const movimentosOfx = (results[6].data as MovimentoOfx[]) || [];
  const loading = results.some((r) => r.isLoading);

  const invCB = () => qc.invalidateQueries({ queryKey: QK_CB });
  const invPC = () => qc.invalidateQueries({ queryKey: QK_PC });
  const invCC = () => qc.invalidateQueries({ queryKey: QK_CC });
  const invCP = () => qc.invalidateQueries({ queryKey: QK_CP });
  const invCR = () => qc.invalidateQueries({ queryKey: QK_CR });
  const invLN = () => qc.invalidateQueries({ queryKey: QK_LN });
  const invOFX = () => qc.invalidateQueries({ queryKey: QK_OFX });

  const reload = async () => {
    invCB(); invPC(); invCC(); invCP(); invCR(); invLN(); invOFX();
  };

  const saldoConta = (contaId: string) => {
    const conta = contasBancarias.find((c) => c.id === contaId);
    if (!conta) return 0;
    let s = Number(conta.saldo_inicial) || 0;
    lancamentos.forEach((l) => {
      if (l.conta_bancaria_id === contaId) {
        if (l.tipo === "entrada") s += Number(l.valor);
        else if (l.tipo === "saida") s -= Number(l.valor);
        else if (l.tipo === "transferencia") s -= Number(l.valor);
      }
      if (l.tipo === "transferencia" && l.conta_destino_id === contaId) {
        s += Number(l.valor);
      }
    });
    return s;
  };

  return (
    <FinanceiroContext.Provider
      value={{
        loading, contasBancarias, planoContas, centrosCusto,
        contasPagar, contasReceber, lancamentos, movimentosOfx, reload,
        addContaBancaria: async (r) => { const created = await insertRow("fin_contas_bancarias", r); invCB(); return created as ContaBancaria | null; },
        updateContaBancaria: async (id, r) => { await updateRow("fin_contas_bancarias", id, r); invCB(); },
        deleteContaBancaria: async (id) => { await deleteRow("fin_contas_bancarias", id); invCB(); },
        addPlanoConta: async (r) => { await insertRow("fin_plano_contas", r); invPC(); },
        updatePlanoConta: async (id, r) => { await updateRow("fin_plano_contas", id, r); invPC(); },
        deletePlanoConta: async (id) => { await deleteRow("fin_plano_contas", id); invPC(); },
        addCentroCusto: async (r) => { await insertRow("fin_centros_custo", r); invCC(); },
        updateCentroCusto: async (id, r) => { await updateRow("fin_centros_custo", id, r); invCC(); },
        deleteCentroCusto: async (id) => { await deleteRow("fin_centros_custo", id); invCC(); },
        addContaPagar: async (r) => { const created = await insertRow("fin_contas_pagar", r); invCP(); return created as ContaPagar | null; },
        updateContaPagar: async (id, r) => { await updateRow("fin_contas_pagar", id, r); invCP(); },
        deleteContaPagar: async (id) => { await deleteRow("fin_contas_pagar", id); invCP(); },
        addContaReceber: async (r) => { const created = await insertRow("fin_contas_receber", r); invCR(); return created as ContaReceber | null; },
        updateContaReceber: async (id, r) => { await updateRow("fin_contas_receber", id, r); invCR(); },
        deleteContaReceber: async (id) => { await deleteRow("fin_contas_receber", id); invCR(); },
        addLancamento: async (r) => { const created = await insertRow("fin_lancamentos", r); invLN(); return created as Lancamento | null; },
        deleteLancamento: async (id) => { await deleteRow("fin_lancamentos", id); invLN(); },
        addMovimentoOfx: async (r) => { await insertRow("fin_movimentos_ofx", r); invOFX(); },
        updateMovimentoOfx: async (id, r) => { await updateRow("fin_movimentos_ofx", id, r); invOFX(); },
        saldoConta,
      }}
    >
      {children}
    </FinanceiroContext.Provider>
  );
}

export function useFinanceiro() {
  useActivateProvider("Financeiro");
  const ctx = useContext(FinanceiroContext);
  if (!ctx) throw new Error("useFinanceiro deve ser usado dentro de FinanceiroProvider");
  return ctx;
}

export const formatBRL = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export const isVencida = (c: { data_vencimento: string; status: string }) => {
  if (c.status !== "aberta" && c.status !== "parcial") return false;
  return new Date(c.data_vencimento + "T23:59:59") < new Date();
};