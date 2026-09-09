import { createContext, useContext, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

export interface Ferramenta {
  id: string; codigo: string; descricao: string; marca: string; modelo: string;
  numeroSerie: string; estadoConservacao: string; valorAquisicao: number;
  dataAquisicao: string; notaFiscal: string; patrimonio: string; fotoUrl: string;
  observacoes: string; dataCalibracao: string; validadeCalibracao: string;
  certificadoCalibracaoUrl: string; centroCustoAtualId: string;
  centroCustoAtualNome: string; status: string;
}

export interface FerramentaVinculo {
  id: string; ferramentaId: string; ferramentaDescricao: string;
  ferramentasIds: string[]; ferramentasDescricoes: string[];
  funcionarioId: string; funcionarioNome: string;
  dataVinculo: string; dataDevolucao: string; observacoes: string; status: string;
}

export interface FerramentaEmprestimo {
  id: string; ferramentaId: string; ferramentaDescricao: string;
  centroCustoOrigemId: string; centroCustoOrigemNome: string;
  centroCustoDestinoId: string; centroCustoDestinoNome: string;
  solicitante: string; dataSolicitacao: string;
  dataAprovacao: string; aprovadoPor: string;
  dataDevolucaoPrevista: string; dataDevolucaoReal: string;
  status: string; observacoes: string;
}

export interface FerramentaHistorico {
  id: string; ferramentaId: string; ferramentaDescricao: string;
  tipo: string; descricao: string; usuario: string; dataEvento: string;
}

export const emptyFerramentaForm: Omit<Ferramenta, "id"> = {
  codigo: "", descricao: "", marca: "", modelo: "", numeroSerie: "",
  estadoConservacao: "Novo", valorAquisicao: 0, dataAquisicao: "", notaFiscal: "",
  patrimonio: "", fotoUrl: "", observacoes: "", dataCalibracao: "",
  validadeCalibracao: "", certificadoCalibracaoUrl: "", centroCustoAtualId: "",
  centroCustoAtualNome: "", status: "Disponível",
};

const rowToFerramenta = (r: any): Ferramenta => ({
  id: r.id, codigo: r.codigo ?? "", descricao: r.descricao ?? "",
  marca: r.marca ?? "", modelo: r.modelo ?? "", numeroSerie: r.numero_serie ?? "",
  estadoConservacao: r.estado_conservacao ?? "Novo", valorAquisicao: r.valor_aquisicao ?? 0,
  dataAquisicao: r.data_aquisicao ?? "", notaFiscal: r.nota_fiscal ?? "",
  patrimonio: r.patrimonio ?? "", fotoUrl: r.foto_url ?? "", observacoes: r.observacoes ?? "",
  dataCalibracao: r.data_calibracao ?? "", validadeCalibracao: r.validade_calibracao ?? "",
  certificadoCalibracaoUrl: r.certificado_calibracao_url ?? "",
  centroCustoAtualId: r.centro_custo_atual_id ?? "", centroCustoAtualNome: r.centro_custo_atual_nome ?? "",
  status: r.status ?? "Disponível",
});

const ferramentaToRow = (f: Omit<Ferramenta, "id">) => ({
  codigo: f.codigo, descricao: f.descricao, marca: f.marca, modelo: f.modelo,
  numero_serie: f.numeroSerie, estado_conservacao: f.estadoConservacao,
  valor_aquisicao: f.valorAquisicao, data_aquisicao: f.dataAquisicao,
  nota_fiscal: f.notaFiscal, patrimonio: f.patrimonio, foto_url: f.fotoUrl,
  observacoes: f.observacoes, data_calibracao: f.dataCalibracao,
  validade_calibracao: f.validadeCalibracao, certificado_calibracao_url: f.certificadoCalibracaoUrl,
  centro_custo_atual_id: f.centroCustoAtualId, centro_custo_atual_nome: f.centroCustoAtualNome,
  status: f.status,
});

const rowToVinculo = (r: any): FerramentaVinculo => ({
  id: r.id, ferramentaId: r.ferramenta_id ?? "", ferramentaDescricao: r.ferramenta_descricao ?? "",
  ferramentasIds: Array.isArray(r.ferramentas_ids) ? r.ferramentas_ids : (r.ferramenta_id ? [r.ferramenta_id] : []),
  ferramentasDescricoes: Array.isArray(r.ferramentas_descricoes) ? r.ferramentas_descricoes : (r.ferramenta_descricao ? [r.ferramenta_descricao] : []),
  funcionarioId: r.funcionario_id ?? "", funcionarioNome: r.funcionario_nome ?? "",
  dataVinculo: r.data_vinculo ?? "", dataDevolucao: r.data_devolucao ?? "",
  observacoes: r.observacoes ?? "", status: r.status ?? "Ativo",
});

const rowToEmprestimo = (r: any): FerramentaEmprestimo => ({
  id: r.id, ferramentaId: r.ferramenta_id ?? "", ferramentaDescricao: r.ferramenta_descricao ?? "",
  centroCustoOrigemId: r.centro_custo_origem_id ?? "", centroCustoOrigemNome: r.centro_custo_origem_nome ?? "",
  centroCustoDestinoId: r.centro_custo_destino_id ?? "", centroCustoDestinoNome: r.centro_custo_destino_nome ?? "",
  solicitante: r.solicitante ?? "", dataSolicitacao: r.data_solicitacao ?? "",
  dataAprovacao: r.data_aprovacao ?? "", aprovadoPor: r.aprovado_por ?? "",
  dataDevolucaoPrevista: r.data_devolucao_prevista ?? "", dataDevolucaoReal: r.data_devolucao_real ?? "",
  status: r.status ?? "Pendente", observacoes: r.observacoes ?? "",
});

const rowToHistorico = (r: any): FerramentaHistorico => ({
  id: r.id, ferramentaId: r.ferramenta_id ?? "", ferramentaDescricao: r.ferramenta_descricao ?? "",
  tipo: r.tipo ?? "", descricao: r.descricao ?? "", usuario: r.usuario ?? "",
  dataEvento: r.data_evento ?? "",
});

interface FerramentasContextType {
  ferramentas: Ferramenta[];
  vinculos: FerramentaVinculo[];
  emprestimos: FerramentaEmprestimo[];
  historico: FerramentaHistorico[];
  addFerramenta: (f: Omit<Ferramenta, "id">) => Promise<void>;
  updateFerramenta: (id: string, f: Partial<Omit<Ferramenta, "id">>) => Promise<void>;
  deleteFerramenta: (id: string) => Promise<void>;
  addVinculoMulti: (ferramentasIds: string[], ferramentasDescricoes: string[], funcionarioId: string, funcionarioNome: string, dataVinculo: string, observacoes: string) => Promise<void>;
  devolverVinculo: (id: string) => Promise<void>;
  addEmprestimo: (e: Omit<FerramentaEmprestimo, "id">) => Promise<void>;
  aprovarEmprestimo: (id: string, aprovadoPor: string) => Promise<void>;
  rejeitarEmprestimo: (id: string, aprovadoPor: string) => Promise<void>;
  devolverEmprestimo: (id: string) => Promise<void>;
  addHistorico: (h: Omit<FerramentaHistorico, "id">) => Promise<void>;
  refreshAll: () => Promise<void>;
}

const FerramentasContext = createContext<FerramentasContextType | undefined>(undefined);

const QK_F = ["ferramentas"] as const;
const QK_V = ["ferramentas_vinculos"] as const;
const QK_E = ["ferramentas_emprestimos"] as const;
const QK_H = ["ferramentas_historico"] as const;

export function FerramentasProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Ferramentas");
  const qc = useQueryClient();

  const results = useQueries({
    queries: gateQueries([
      {
        queryKey: QK_F,
        queryFn: async () => {
          const { data, error } = await (supabase as any).from("ferramentas").select("*").order("codigo");
          if (error) throw error;
          return (data || []).map(rowToFerramenta);
        },
        staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
      },
      {
        queryKey: QK_V,
        queryFn: async () => {
          const { data, error } = await (supabase as any).from("ferramentas_vinculos").select("*").order("created_at", { ascending: false });
          if (error) throw error;
          return (data || []).map(rowToVinculo);
        },
        staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
      },
      {
        queryKey: QK_E,
        queryFn: async () => {
          const { data, error } = await (supabase as any).from("ferramentas_emprestimos").select("*").order("created_at", { ascending: false });
          if (error) throw error;
          return (data || []).map(rowToEmprestimo);
        },
        staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
      },
      {
        queryKey: QK_H,
        queryFn: async () => {
          const { data, error } = await (supabase as any).from("ferramentas_historico").select("*").order("created_at", { ascending: false });
          if (error) throw error;
          return (data || []).map(rowToHistorico);
        },
        staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
      },
    ], __active),
  });

  const ferramentas = (results[0].data as Ferramenta[]) || [];
  const vinculos = (results[1].data as FerramentaVinculo[]) || [];
  const emprestimos = (results[2].data as FerramentaEmprestimo[]) || [];
  const historico = (results[3].data as FerramentaHistorico[]) || [];

  const invF = () => qc.invalidateQueries({ queryKey: QK_F });
  const invV = () => qc.invalidateQueries({ queryKey: QK_V });
  const invE = () => qc.invalidateQueries({ queryKey: QK_E });
  const invH = () => qc.invalidateQueries({ queryKey: QK_H });
  const refreshAll = async () => { invF(); invV(); invE(); invH(); };

  const addHistorico = async (h: Omit<FerramentaHistorico, "id">) => {
    await (supabase as any).from("ferramentas_historico").insert({
      ferramenta_id: h.ferramentaId, ferramenta_descricao: h.ferramentaDescricao,
      tipo: h.tipo, descricao: h.descricao, usuario: h.usuario, data_evento: h.dataEvento,
    });
    invH();
  };

  const addFerramenta = async (f: Omit<Ferramenta, "id">) => {
    const { error } = await (supabase as any).from("ferramentas").insert(ferramentaToRow(f));
    if (error) { toast.error("Erro ao cadastrar ferramenta."); return; }
    toast.success("Ferramenta cadastrada!");
    await addHistorico({ ferramentaId: "", ferramentaDescricao: f.descricao, tipo: "Cadastro", descricao: `Ferramenta ${f.codigo} - ${f.descricao} cadastrada`, usuario: "", dataEvento: new Date().toISOString().slice(0,10) });
    invF();
  };

  const updateFerramenta = async (id: string, data: Partial<Omit<Ferramenta, "id">>) => {
    const current = ferramentas.find(f => f.id === id);
    const full = { ...emptyFerramentaForm, ...current, ...data };
    const { id: _id, ...rest } = full as Ferramenta;
    const { error } = await (supabase as any).from("ferramentas").update(ferramentaToRow(rest)).eq("id", id);
    if (error) { toast.error("Erro ao atualizar."); return; }
    toast.success("Ferramenta atualizada!");
    invF();
  };

  const deleteFerramenta = async (id: string) => {
    const { error } = await (supabase as any).from("ferramentas").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover."); return; }
    toast.success("Ferramenta removida!");
    invF();
  };

  const addVinculoMulti = async (
    ferramentasIds: string[],
    ferramentasDescricoes: string[],
    funcionarioId: string,
    funcionarioNome: string,
    dataVinculo: string,
    observacoes: string,
  ) => {
    if (ferramentasIds.length === 0) return;
    const { error } = await (supabase as any).from("ferramentas_vinculos").insert({
      ferramenta_id: ferramentasIds[0],
      ferramenta_descricao: ferramentasDescricoes.join(", "),
      ferramentas_ids: ferramentasIds,
      ferramentas_descricoes: ferramentasDescricoes,
      funcionario_id: funcionarioId,
      funcionario_nome: funcionarioNome,
      data_vinculo: dataVinculo,
      observacoes,
      status: "Ativo",
    });
    if (error) { toast.error("Erro ao vincular."); return; }
    for (const fId of ferramentasIds) {
      await (supabase as any).from("ferramentas").update({ status: "Em Uso" }).eq("id", fId);
    }
    await addHistorico({
      ferramentaId: ferramentasIds[0],
      ferramentaDescricao: ferramentasDescricoes.join(", "),
      tipo: "Vínculo",
      descricao: `${ferramentasDescricoes.length} ferramenta(s) vinculada(s) ao funcionário ${funcionarioNome}`,
      usuario: "",
      dataEvento: dataVinculo,
    });
    toast.success("Ferramentas vinculadas!");
    await refreshAll();
  };

  const devolverVinculo = async (id: string) => {
    const v = vinculos.find(x => x.id === id);
    if (!v) return;
    const hoje = new Date().toISOString().slice(0, 10);
    await (supabase as any).from("ferramentas_vinculos").update({ status: "Devolvido", data_devolucao: hoje }).eq("id", id);
    for (const fId of v.ferramentasIds) {
      await (supabase as any).from("ferramentas").update({ status: "Disponível" }).eq("id", fId);
    }
    await addHistorico({
      ferramentaId: v.ferramentasIds[0] || v.ferramentaId,
      ferramentaDescricao: v.ferramentasDescricoes.join(", ") || v.ferramentaDescricao,
      tipo: "Devolução",
      descricao: `${v.ferramentasDescricoes.length || 1} ferramenta(s) devolvida(s) pelo funcionário ${v.funcionarioNome}`,
      usuario: "",
      dataEvento: hoje,
    });
    toast.success("Ferramentas devolvidas!");
    await refreshAll();
  };

  const addEmprestimo = async (e: Omit<FerramentaEmprestimo, "id">) => {
    const { error } = await (supabase as any).from("ferramentas_emprestimos").insert({
      ferramenta_id: e.ferramentaId, ferramenta_descricao: e.ferramentaDescricao,
      centro_custo_origem_id: e.centroCustoOrigemId, centro_custo_origem_nome: e.centroCustoOrigemNome,
      centro_custo_destino_id: e.centroCustoDestinoId, centro_custo_destino_nome: e.centroCustoDestinoNome,
      solicitante: e.solicitante, data_solicitacao: e.dataSolicitacao,
      data_devolucao_prevista: e.dataDevolucaoPrevista, observacoes: e.observacoes, status: "Pendente",
    });
    if (error) { toast.error("Erro ao solicitar empréstimo."); return; }
    await addHistorico({ ferramentaId: e.ferramentaId, ferramentaDescricao: e.ferramentaDescricao, tipo: "Empréstimo Solicitado", descricao: `Empréstimo solicitado de ${e.centroCustoOrigemNome} para ${e.centroCustoDestinoNome}`, usuario: e.solicitante, dataEvento: e.dataSolicitacao });
    toast.success("Empréstimo solicitado! Aguardando aprovação.");
    await refreshAll();
  };

  const aprovarEmprestimo = async (id: string, aprovadoPor: string) => {
    const e = emprestimos.find(x => x.id === id);
    if (!e) return;
    const hoje = new Date().toISOString().slice(0, 10);
    await (supabase as any).from("ferramentas_emprestimos").update({ status: "Aprovado", aprovado_por: aprovadoPor, data_aprovacao: hoje }).eq("id", id);
    await (supabase as any).from("ferramentas").update({ status: "Emprestada", centro_custo_atual_id: e.centroCustoDestinoId, centro_custo_atual_nome: e.centroCustoDestinoNome }).eq("id", e.ferramentaId);
    await addHistorico({ ferramentaId: e.ferramentaId, ferramentaDescricao: e.ferramentaDescricao, tipo: "Empréstimo Aprovado", descricao: `Aprovado por ${aprovadoPor}. Transferida para ${e.centroCustoDestinoNome}`, usuario: aprovadoPor, dataEvento: hoje });
    toast.success("Empréstimo aprovado!");
    await refreshAll();
  };

  const rejeitarEmprestimo = async (id: string, aprovadoPor: string) => {
    const e = emprestimos.find(x => x.id === id);
    if (!e) return;
    const hoje = new Date().toISOString().slice(0, 10);
    await (supabase as any).from("ferramentas_emprestimos").update({ status: "Rejeitado", aprovado_por: aprovadoPor, data_aprovacao: hoje }).eq("id", id);
    await addHistorico({ ferramentaId: e.ferramentaId, ferramentaDescricao: e.ferramentaDescricao, tipo: "Empréstimo Rejeitado", descricao: `Rejeitado por ${aprovadoPor}`, usuario: aprovadoPor, dataEvento: hoje });
    toast.success("Empréstimo rejeitado.");
    await refreshAll();
  };

  const devolverEmprestimo = async (id: string) => {
    const e = emprestimos.find(x => x.id === id);
    if (!e) return;
    const hoje = new Date().toISOString().slice(0, 10);
    await (supabase as any).from("ferramentas_emprestimos").update({ status: "Devolvido", data_devolucao_real: hoje }).eq("id", id);
    await (supabase as any).from("ferramentas").update({ status: "Disponível", centro_custo_atual_id: e.centroCustoOrigemId, centro_custo_atual_nome: e.centroCustoOrigemNome }).eq("id", e.ferramentaId);
    await addHistorico({ ferramentaId: e.ferramentaId, ferramentaDescricao: e.ferramentaDescricao, tipo: "Devolução Empréstimo", descricao: `Devolvida de ${e.centroCustoDestinoNome} para ${e.centroCustoOrigemNome}`, usuario: "", dataEvento: hoje });
    toast.success("Ferramenta devolvida ao centro de custo de origem!");
    await refreshAll();
  };

  return (
    <FerramentasContext.Provider value={{ ferramentas, vinculos, emprestimos, historico, addFerramenta, updateFerramenta, deleteFerramenta, addVinculoMulti, devolverVinculo, addEmprestimo, aprovarEmprestimo, rejeitarEmprestimo, devolverEmprestimo, addHistorico, refreshAll }}>
      {children}
    </FerramentasContext.Provider>
  );
}

export function useFerramentas() {
  useActivateProvider("Ferramentas");
  const ctx = useContext(FerramentasContext);
  if (!ctx) throw new Error("useFerramentas must be used within FerramentasProvider");
  return ctx;
}
