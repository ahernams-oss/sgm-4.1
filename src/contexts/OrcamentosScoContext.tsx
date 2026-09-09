import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

export interface ScoServico {
  codigo: string; descricao: string; unidade: string; preco: number;
  capitulo?: string; capitulo_descricao?: string;
  secao?: string; secao_descricao?: string;
  subsecao?: string; subsecao_descricao?: string;
}

export interface ScoElementar {
  codigo: string; descricao: string; unidade: string; grupo: string; preco: number;
}

export interface ScoComposicao {
  servico_codigo: string; elementar_codigo: string;
  elementar_descricao: string; unidade: string; quantidade: number;
}

export interface OrcamentoScoItem {
  servico_codigo: string; descricao: string; unidade: string;
  quantidade: number; preco_unit: number; preco_total: number;
}

export interface OrcamentoSco {
  id: string; numero: number; titulo: string;
  cliente_id?: string | null; cliente_nome?: string;
  obra?: string;
  tipo_analise: "sintetica" | "analitica";
  bdi: number; desconto: number;
  observacoes?: string; referencia?: string;
  itens: OrcamentoScoItem[];
  subtotal: number; valor_total: number;
  status: string; criado_por?: string; created_at: string;
}

interface Ctx {
  orcamentos: OrcamentoSco[];
  loading: boolean;
  reload: () => Promise<void>;
  add: (o: Omit<OrcamentoSco, "id" | "numero" | "created_at">) => Promise<any>;
  update: (id: string, o: Partial<OrcamentoSco>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  searchServicos: (q: string, limit?: number, referencia?: string) => Promise<ScoServico[]>;
  getServico: (codigo: string, referencia?: string) => Promise<ScoServico | null>;
  getComposicao: (servico_codigo: string, referencia?: string) => Promise<(ScoComposicao & { elementar_preco: number })[]>;
  getElementar: (codigo: string, referencia?: string) => Promise<ScoElementar | null>;
  countCatalog: () => Promise<{ elementares: number; servicos: number; composicoes: number }>;
  listReferencias: () => Promise<string[]>;
}

const C = createContext<Ctx | undefined>(undefined);
const QK = ["orcamentos_sco"] as const;

export function OrcamentosScoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("OrcamentosSco");
  const qc = useQueryClient();
  const { data: orcamentos = [], isLoading: loading, refetch } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => {
      const data = await fetchAll("orcamentos_sco", "numero");
      return (data || []).map((r: any) => ({
        ...r,
        bdi: Number(r.bdi || 0),
        desconto: Number(r.desconto || 0),
        subtotal: Number(r.subtotal || 0),
        valor_total: Number(r.valor_total || 0),
        itens: Array.isArray(r.itens) ? r.itens : [],
      })) as OrcamentoSco[];
    },
    staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });
  const reload = async () => { await refetch(); };

  const add: Ctx["add"] = async (o) => {
    const r = await insertRow("orcamentos_sco", o);
    invalidate();
    return r;
  };
  const update: Ctx["update"] = async (id, o) => { await updateRow("orcamentos_sco", id, o); invalidate(); };
  const remove: Ctx["remove"] = async (id) => { await deleteRow("orcamentos_sco", id); invalidate(); };

  const searchServicos: Ctx["searchServicos"] = async (q, limit = 30, referencia) => {
    const t = (q || "").trim();
    let query = (supabase as any).from("sco_servicos").select("codigo,descricao,unidade,preco,capitulo,secao,subsecao,referencia").limit(limit);
    if (referencia) query = query.eq("referencia", referencia);
    if (t) query = query.or(`codigo.ilike.%${t}%,descricao.ilike.%${t}%`);
    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return (data || []) as ScoServico[];
  };

  const getServico: Ctx["getServico"] = async (codigo, referencia) => {
    let q = (supabase as any).from("sco_servicos").select("*").eq("codigo", codigo);
    if (referencia) q = q.eq("referencia", referencia);
    const { data } = await q.maybeSingle();
    return data || null;
  };

  const getComposicao: Ctx["getComposicao"] = async (servico_codigo, referencia) => {
    let cq = (supabase as any).from("sco_composicoes").select("*").eq("servico_codigo", servico_codigo);
    if (referencia) cq = cq.eq("referencia", referencia);
    const { data, error } = await cq;
    if (error || !data) return [];
    const codes = data.map((c: any) => c.elementar_codigo).filter(Boolean);
    let precos: Record<string, number> = {};
    if (codes.length) {
      let eq = (supabase as any).from("sco_elementares").select("codigo,preco").in("codigo", codes);
      if (referencia) eq = eq.eq("referencia", referencia);
      const { data: els } = await eq;
      precos = Object.fromEntries((els || []).map((e: any) => [e.codigo, Number(e.preco || 0)]));
    }
    return data.map((c: any) => ({
      ...c,
      quantidade: Number(c.quantidade || 0),
      elementar_preco: precos[c.elementar_codigo] || 0,
    }));
  };

  const getElementar: Ctx["getElementar"] = async (codigo, referencia) => {
    let q = (supabase as any).from("sco_elementares").select("*").eq("codigo", codigo);
    if (referencia) q = q.eq("referencia", referencia);
    const { data } = await q.maybeSingle();
    return data || null;
  };

  const countCatalog: Ctx["countCatalog"] = async () => {
    const [a, b, c] = await Promise.all([
      (supabase as any).from("sco_elementares").select("codigo", { count: "exact", head: true }),
      (supabase as any).from("sco_servicos").select("codigo", { count: "exact", head: true }),
      (supabase as any).from("sco_composicoes").select("id", { count: "exact", head: true }),
    ]);
    return { elementares: a.count || 0, servicos: b.count || 0, composicoes: c.count || 0 };
  };

  const listReferencias: Ctx["listReferencias"] = async () => {
    const { data } = await (supabase as any).from("sco_servicos").select("referencia").limit(5000);
    const set = new Set<string>();
    (data || []).forEach((r: any) => r.referencia && set.add(r.referencia));
    return Array.from(set).sort().reverse();
  };

  return (
    <C.Provider value={{ orcamentos, loading, reload, add, update, remove, searchServicos, getServico, getComposicao, getElementar, countCatalog, listReferencias }}>
      {children}
    </C.Provider>
  );
}

export function useOrcamentosSco() {
  useActivateProvider("OrcamentosSco");
  const ctx = useContext(C);
  if (!ctx) throw new Error("useOrcamentosSco must be inside OrcamentosScoProvider");
  return ctx;
}
