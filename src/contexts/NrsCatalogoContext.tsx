import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface NrCatalogo {
  id: string;
  codigo: string;
  descricao: string;
  validadeDias: number | null;
  anexoUrl?: string | null;
  anexoNome?: string | null;
  observacao?: string | null;
  dataPublicacao?: string | null;
  dataVigencia?: string | null;
  revisoes?: NrRevisao[];
}

export interface NrRevisaoAnexo {
  url: string;
  nome: string;
}

export interface NrRevisao {
  revisao: string;
  dataPublicacao?: string | null;
  dataVigencia?: string | null;
  observacao?: string | null;
  anexos?: NrRevisaoAnexo[];
}

interface Ctx {
  nrs: NrCatalogo[];
  addNr: (n: Omit<NrCatalogo, "id">) => Promise<void>;
  updateNr: (id: string, n: Partial<Omit<NrCatalogo, "id">>) => Promise<void>;
  deleteNr: (id: string) => Promise<void>;
}

const NrsCatalogoContext = createContext<Ctx | undefined>(undefined);

const rowTo = (r: any): NrCatalogo => ({
  id: r.id,
  codigo: r.codigo ?? "",
  descricao: r.descricao ?? "",
  validadeDias: r.validade_dias ?? null,
  anexoUrl: r.anexo_url ?? null,
  anexoNome: r.anexo_nome ?? null,
  observacao: r.observacao ?? null,
  dataPublicacao: r.data_publicacao ?? null,
  dataVigencia: r.data_vigencia ?? null,
  revisoes: Array.isArray(r.revisoes) ? r.revisoes : [],
});

const toRow = (n: Omit<NrCatalogo, "id">) => ({
  codigo: n.codigo,
  descricao: n.descricao,
  validade_dias: n.validadeDias ?? null,
  anexo_url: n.anexoUrl ?? null,
  anexo_nome: n.anexoNome ?? null,
  observacao: n.observacao ?? null,
  data_publicacao: n.dataPublicacao || null,
  data_vigencia: n.dataVigencia || null,
  revisoes: n.revisoes ?? [],
});


const QK = ["nrs_catalogo"] as const;

export function NrsCatalogoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("NrsCatalogo");
  const queryClient = useQueryClient();

  const { data: nrs = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("nrs_catalogo", "codigo");
      return data.map(rowTo) as NrCatalogo[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  const addNr = async (n: Omit<NrCatalogo, "id">) => {
    await insertRow("nrs_catalogo", toRow(n));
    await invalidate();
  };

  const updateNr = async (id: string, n: Partial<Omit<NrCatalogo, "id">>) => {
    const current = nrs.find((x) => x.id === id);
    if (!current) return;
    const { id: _, ...rest } = { ...current, ...n };
    await updateRow("nrs_catalogo", id, toRow(rest));
    await invalidate();
  };

  const deleteNr = async (id: string) => {
    await deleteRow("nrs_catalogo", id);
    await invalidate();
  };

  return (
    <NrsCatalogoContext.Provider value={{ nrs, addNr, updateNr, deleteNr }}>
      {children}
    </NrsCatalogoContext.Provider>
  );
}

export function useNrsCatalogo() {
  useActivateProvider("NrsCatalogo");
  const ctx = useContext(NrsCatalogoContext);
  if (!ctx) throw new Error("useNrsCatalogo must be used within NrsCatalogoProvider");
  return ctx;
}
