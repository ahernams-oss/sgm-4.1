import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface FotoMarcador {
  n: number;
  x: number; // 0..1
  y: number; // 0..1
  tipo: "circulo" | "seta";
  legenda: string;
}
export interface FotoLaudo {
  path: string;
  url: string;
  descricao: string;
  marcadores: FotoMarcador[];
}
export interface AnexoLaudo {
  nome: string;
  path: string;
  url: string;
  tamanho: number;
}

export interface LaudoCondenacao {
  id: string;
  numero: number;
  equipamento_id: string;
  equipamento_tag: string;
  equipamento_nome: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  patrimonio: string;
  ano_fabricacao: string;
  data_aquisicao: string;
  localizacao: string;
  estado_conservacao: string;
  data_emissao: string;
  data_inspecao: string;
  local_inspecao: string;
  responsavel_tecnico: string;
  registro_profissional: string;
  historico: string;
  insp_condicoes_fisicas: string;
  insp_condicoes_eletricas: string;
  insp_condicoes_mecanicas: string;
  insp_funcionalidade: string;
  motivos_condenacao: string[];
  custo_reparo: number;
  valor_residual: number;
  valor_novo_equivalente: number;
  parecer: string;
  conclusao_condicoes: string;
  fotos: FotoLaudo[];
  anexos_orcamentos: AnexoLaudo[];
  outros_anexos: AnexoLaudo[];
  observacoes_outros: string;
  created_at: string;
}

interface Ctx {
  laudos: LaudoCondenacao[];
  loading: boolean;
  addLaudo: (l: Partial<LaudoCondenacao>) => Promise<LaudoCondenacao | null>;
  updateLaudo: (id: string, l: Partial<LaudoCondenacao>) => Promise<boolean>;
  deleteLaudo: (id: string) => Promise<boolean>;
  porEquipamento: (equipamentoId: string) => LaudoCondenacao[];
}

const LaudosCtx = createContext<Ctx | undefined>(undefined);
const QK = ["laudos_condenacao"] as const;

const rowToLaudo = (r: any): LaudoCondenacao => ({
  id: r.id,
  numero: r.numero ?? 0,
  equipamento_id: r.equipamento_id ?? "",
  equipamento_tag: r.equipamento_tag ?? "",
  equipamento_nome: r.equipamento_nome ?? "",
  tipo: r.tipo ?? "",
  marca: r.marca ?? "",
  modelo: r.modelo ?? "",
  serie: r.serie ?? "",
  patrimonio: r.patrimonio ?? "",
  ano_fabricacao: r.ano_fabricacao ?? "",
  data_aquisicao: r.data_aquisicao ?? "",
  localizacao: r.localizacao ?? "",
  estado_conservacao: r.estado_conservacao ?? "",
  data_emissao: r.data_emissao ?? "",
  data_inspecao: r.data_inspecao ?? "",
  local_inspecao: r.local_inspecao ?? "",
  responsavel_tecnico: r.responsavel_tecnico ?? "",
  registro_profissional: r.registro_profissional ?? "",
  historico: r.historico ?? "",
  insp_condicoes_fisicas: r.insp_condicoes_fisicas ?? "",
  insp_condicoes_eletricas: r.insp_condicoes_eletricas ?? "",
  insp_condicoes_mecanicas: r.insp_condicoes_mecanicas ?? "",
  insp_funcionalidade: r.insp_funcionalidade ?? "",
  motivos_condenacao: Array.isArray(r.motivos_condenacao) ? r.motivos_condenacao : [],
  custo_reparo: Number(r.custo_reparo) || 0,
  valor_residual: Number(r.valor_residual) || 0,
  valor_novo_equivalente: Number(r.valor_novo_equivalente) || 0,
  parecer: r.parecer ?? "",
  conclusao_condicoes: r.conclusao_condicoes ?? "",
  fotos: Array.isArray(r.fotos) ? r.fotos : [],
  anexos_orcamentos: Array.isArray(r.anexos_orcamentos) ? r.anexos_orcamentos : [],
  outros_anexos: Array.isArray(r.outros_anexos) ? r.outros_anexos : [],
  observacoes_outros: r.observacoes_outros ?? "",
  created_at: r.created_at ?? "",
});

export function LaudosCondenacaoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("LaudosCondenacao");
  const qc = useQueryClient();
  const { data: laudos = [], isLoading: loading } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("equipamentos_laudos_condenacao")).map(rowToLaudo),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const sanitizeDates = (row: any) => {
    ["data_aquisicao", "data_emissao", "data_inspecao"].forEach((k) => {
      if (row[k] === "" || row[k] === undefined) row[k] = null;
    });
    return row;
  };

  const addLaudo = async (l: Partial<LaudoCondenacao>) => {
    const row: any = { ...l };
    delete row.id;
    delete row.numero;
    delete row.created_at;
    sanitizeDates(row);
    const data = await insertRow("equipamentos_laudos_condenacao", row);
    invalidate();
    return data ? rowToLaudo(data) : null;
  };
  const updateLaudo = async (id: string, l: Partial<LaudoCondenacao>) => {
    const row: any = { ...l };
    sanitizeDates(row);
    const ok = await updateRow("equipamentos_laudos_condenacao", id, row);
    if (ok) invalidate();
    return ok;
  };
  const deleteLaudo = async (id: string) => {
    const ok = await deleteRow("equipamentos_laudos_condenacao", id);
    if (ok) invalidate();
    return ok;
  };
  const porEquipamento = (equipamentoId: string) =>
    laudos.filter((l) => l.equipamento_id === equipamentoId).sort((a, b) => b.numero - a.numero);

  return (
    <LaudosCtx.Provider value={{ laudos, loading, addLaudo, updateLaudo, deleteLaudo, porEquipamento }}>
      {children}
    </LaudosCtx.Provider>
  );
}

export function useLaudosCondenacao() {
  useActivateProvider("LaudosCondenacao");
  const ctx = useContext(LaudosCtx);
  if (!ctx) throw new Error("useLaudosCondenacao must be used within LaudosCondenacaoProvider");
  return ctx;
}
