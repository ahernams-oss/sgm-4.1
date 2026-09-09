import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface EpiDevolucao {
  id: string;
  funcionarioId: string;
  epiItemId: string;
  codigo: string;
  descricao: string;
  ca: string;
  quantidade: number;
  dataEntrega: string;
  dataDevolucao: string;
  motivo: string;
  condicao: string;
  destino: string;
  observacao: string;
  anexoPath: string;
  registradoPor: string;
  token: string;
  status: string;
  telefoneEnvio: string;
  confirmadoEm: string;
  selfiePath: string;
  selfiePath2: string;
  createdAt: string;
}

export const MOTIVOS_DEVOLUCAO = [
  "Desgaste",
  "Danificado",
  "Troca / Substituição",
  "Vencimento do CA",
  "Desligamento",
  "Transferência",
  "Extravio",
  "Outro",
];

export const CONDICOES_EPI = ["Desgastado", "Danificado", "Bom estado", "Inservível"];

export const DESTINOS_EPI = ["Descarte", "Higienização", "Reutilização", "Devolução ao estoque"];

interface Ctx {
  devolucoes: EpiDevolucao[];
  addDevolucao: (d: Omit<EpiDevolucao, "id" | "createdAt">) => Promise<void>;
  updateDevolucao: (id: string, d: Partial<Omit<EpiDevolucao, "id" | "createdAt">>) => Promise<void>;
  deleteDevolucao: (id: string) => Promise<void>;
}

const EpisDevolucoesContext = createContext<Ctx | undefined>(undefined);

const rowTo = (r: any): EpiDevolucao => ({
  id: r.id,
  funcionarioId: r.funcionario_id,
  epiItemId: r.epi_item_id ?? "",
  codigo: r.codigo ?? "",
  descricao: r.descricao ?? "",
  ca: r.ca ?? "",
  quantidade: Number(r.quantidade ?? 1),
  dataEntrega: r.data_entrega ?? "",
  dataDevolucao: r.data_devolucao ?? "",
  motivo: r.motivo ?? "",
  condicao: r.condicao ?? "",
  destino: r.destino ?? "",
  observacao: r.observacao ?? "",
  anexoPath: r.anexo_path ?? "",
  registradoPor: r.registrado_por ?? "",
  token: r.token ?? "",
  status: r.status ?? "registrado",
  telefoneEnvio: r.telefone_envio ?? "",
  confirmadoEm: r.confirmado_em ?? "",
  selfiePath: r.selfie_path ?? "",
  selfiePath2: r.selfie_path_2 ?? "",
  createdAt: r.created_at ?? "",
});

const toRow = (d: Partial<Omit<EpiDevolucao, "id" | "createdAt">>) => ({
  funcionario_id: d.funcionarioId,
  epi_item_id: d.epiItemId || null,
  codigo: d.codigo || null,
  descricao: d.descricao,
  ca: d.ca || null,
  quantidade: d.quantidade ?? 1,
  data_entrega: d.dataEntrega || null,
  data_devolucao: d.dataDevolucao || new Date().toISOString().slice(0, 10),
  motivo: d.motivo || "Desgaste",
  condicao: d.condicao || null,
  destino: d.destino || null,
  observacao: d.observacao || null,
  anexo_path: d.anexoPath || null,
  registrado_por: d.registradoPor || null,
  ...(d.token !== undefined ? { token: d.token || null } : {}),
  ...(d.status !== undefined ? { status: d.status || "registrado" } : {}),
  ...(d.telefoneEnvio !== undefined ? { telefone_envio: d.telefoneEnvio || null } : {}),
});

const QK = ["epis_devolucoes"] as const;

export function EpisDevolucoesProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("EpisDevolucoes");
  const queryClient = useQueryClient();

  const { data: devolucoes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("epis_devolucoes", "created_at");
      return data.map(rowTo) as EpiDevolucao[];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  const addDevolucao = async (d: Omit<EpiDevolucao, "id" | "createdAt">) => {
    await insertRow("epis_devolucoes", toRow(d));
    await invalidate();
  };

  const updateDevolucao = async (id: string, d: Partial<Omit<EpiDevolucao, "id" | "createdAt">>) => {
    const current = devolucoes.find((x) => x.id === id);
    if (!current) return;
    await updateRow("epis_devolucoes", id, toRow({ ...current, ...d }));
    await invalidate();
  };

  const deleteDevolucao = async (id: string) => {
    await deleteRow("epis_devolucoes", id);
    await invalidate();
  };

  return (
    <EpisDevolucoesContext.Provider value={{ devolucoes, addDevolucao, updateDevolucao, deleteDevolucao }}>
      {children}
    </EpisDevolucoesContext.Provider>
  );
}

export function useEpisDevolucoes() {
  useActivateProvider("EpisDevolucoes");
  const ctx = useContext(EpisDevolucoesContext);
  if (!ctx) throw new Error("useEpisDevolucoes must be used within EpisDevolucoesProvider");
  return ctx;
}
