import { createContext, useContext, ReactNode } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { toast } from "sonner";
import { useProviderGate, useActivateProvider, gateQueries } from "@/lib/providerGate";

export interface KbAnexo {
  nome: string;
  url: string;
  tipo: string;
  tamanho?: number;
}

export interface KbCategoria {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: string;
  ordem: number;
}

export interface KbArtigo {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  categoria_id: string | null;
  categoria_nome: string;
  tags: string[];
  anexos: KbAnexo[];
  autor_email: string;
  autor_nome: string;
  status: "rascunho" | "publicado" | "arquivado";
  visualizacoes: number;
  uteis: number;
  nao_uteis: number;
  created_at: string;
  updated_at: string;
}

export interface KbFaq {
  id: string;
  pergunta: string;
  resposta: string;
  categoria_id: string | null;
  categoria_nome: string;
  tags: string[];
  ordem: number;
  visualizacoes: number;
  created_at: string;
  updated_at: string;
}

export interface KbVinculoEquipamento {
  id: string;
  artigo_id: string;
  equipamento_id: string;
  equipamento_descricao: string;
}

interface KnowledgeBaseContextType {
  categorias: KbCategoria[];
  artigos: KbArtigo[];
  faqs: KbFaq[];
  vinculosEquip: KbVinculoEquipamento[];
  loading: boolean;
  reload: () => Promise<void>;
  addCategoria: (c: Omit<KbCategoria, "id">) => Promise<void>;
  updateCategoria: (id: string, c: Partial<KbCategoria>) => Promise<void>;
  deleteCategoria: (id: string) => Promise<void>;
  addArtigo: (a: Omit<KbArtigo, "id" | "visualizacoes" | "uteis" | "nao_uteis" | "created_at" | "updated_at">) => Promise<KbArtigo | null>;
  updateArtigo: (id: string, a: Partial<KbArtigo>) => Promise<void>;
  deleteArtigo: (id: string) => Promise<void>;
  incrementarVisualizacao: (id: string, atual: number) => Promise<void>;
  addFaq: (f: Omit<KbFaq, "id" | "visualizacoes" | "created_at" | "updated_at">) => Promise<KbFaq | null>;
  updateFaq: (id: string, f: Partial<KbFaq>) => Promise<void>;
  deleteFaq: (id: string) => Promise<void>;
  setVinculosEquipamento: (artigoId: string, equipamentos: { id: string; descricao: string }[]) => Promise<void>;
  uploadAnexo: (file: File) => Promise<KbAnexo | null>;
  gerarEmbeddingArtigo: (artigoId: string, texto: string) => Promise<void>;
  gerarEmbeddingFaq: (faqId: string, texto: string) => Promise<void>;
}

const Ctx = createContext<KnowledgeBaseContextType | undefined>(undefined);

const rowToArtigo = (r: any): KbArtigo => ({
  id: r.id,
  titulo: r.titulo ?? "",
  resumo: r.resumo ?? "",
  conteudo: r.conteudo ?? "",
  categoria_id: r.categoria_id ?? null,
  categoria_nome: r.categoria_nome ?? "",
  tags: Array.isArray(r.tags) ? r.tags : [],
  anexos: Array.isArray(r.anexos) ? r.anexos : [],
  autor_email: r.autor_email ?? "",
  autor_nome: r.autor_nome ?? "",
  status: r.status ?? "publicado",
  visualizacoes: Number(r.visualizacoes) || 0,
  uteis: Number(r.uteis) || 0,
  nao_uteis: Number(r.nao_uteis) || 0,
  created_at: r.created_at ?? "",
  updated_at: r.updated_at ?? "",
});

const rowToFaq = (r: any): KbFaq => ({
  id: r.id,
  pergunta: r.pergunta ?? "",
  resposta: r.resposta ?? "",
  categoria_id: r.categoria_id ?? null,
  categoria_nome: r.categoria_nome ?? "",
  tags: Array.isArray(r.tags) ? r.tags : [],
  ordem: Number(r.ordem) || 0,
  visualizacoes: Number(r.visualizacoes) || 0,
  created_at: r.created_at ?? "",
  updated_at: r.updated_at ?? "",
});

const QK_CAT = ["kb_categorias"] as const;
const QK_ART = ["kb_artigos"] as const;
const QK_FAQ = ["kb_faq"] as const;
const QK_VIN = ["kb_artigo_equipamentos"] as const;

export function KnowledgeBaseProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("KnowledgeBase");
  const qc = useQueryClient();
  const opts = { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 };
  const results = useQueries({
    queries: gateQueries([
      { queryKey: QK_CAT, queryFn: () => fetchAll("kb_categorias", "ordem"), ...opts },
      { queryKey: QK_ART, queryFn: async () => (await fetchAll("kb_artigos", "updated_at")).map(rowToArtigo).reverse(), ...opts },
      { queryKey: QK_FAQ, queryFn: async () => (await fetchAll("kb_faq", "ordem")).map(rowToFaq), ...opts },
      { queryKey: QK_VIN, queryFn: () => fetchAll("kb_artigo_equipamentos", "created_at"), ...opts },
    ], __active),
  });
  const categorias = (results[0].data as KbCategoria[]) ?? [];
  const artigos = (results[1].data as KbArtigo[]) ?? [];
  const faqs = (results[2].data as KbFaq[]) ?? [];
  const vinculosEquip = (results[3].data as KbVinculoEquipamento[]) ?? [];
  const loading = results.some(r => r.isLoading);

  const invCat = () => qc.invalidateQueries({ queryKey: QK_CAT });
  const invArt = () => qc.invalidateQueries({ queryKey: QK_ART });
  const invFaq = () => qc.invalidateQueries({ queryKey: QK_FAQ });
  const invVin = () => qc.invalidateQueries({ queryKey: QK_VIN });
  const reload = async () => { invCat(); invArt(); invFaq(); invVin(); };

  const addCategoria = async (c: Omit<KbCategoria, "id">) => { await insertRow("kb_categorias", c); invCat(); };
  const updateCategoria = async (id: string, c: Partial<KbCategoria>) => { await updateRow("kb_categorias", id, c); invCat(); };
  const deleteCategoria = async (id: string) => { await deleteRow("kb_categorias", id); invCat(); };

  const callEmbedding = async (text: string): Promise<number[] | null> => {
    try {
      const { data, error } = await (supabase as any).functions.invoke("kb-embedding", { body: { text } });
      if (error) { console.error("kb-embedding error", error); return null; }
      return (data as any)?.embedding ?? null;
    } catch (e) { console.error(e); return null; }
  };
  const gerarEmbeddingArtigo = async (artigoId: string, texto: string) => {
    const emb = await callEmbedding(texto);
    if (emb) await (supabase as any).from("kb_artigos").update({ embedding: emb }).eq("id", artigoId);
  };
  const gerarEmbeddingFaq = async (faqId: string, texto: string) => {
    const emb = await callEmbedding(texto);
    if (emb) await (supabase as any).from("kb_faq").update({ embedding: emb }).eq("id", faqId);
  };

  const addArtigo: KnowledgeBaseContextType["addArtigo"] = async (a) => {
    const inserted = await insertRow("kb_artigos", a);
    if (inserted) {
      const novo = rowToArtigo(inserted);
      gerarEmbeddingArtigo(novo.id, `${novo.titulo}\n${novo.resumo}\n${novo.conteudo}`).catch(() => {});
      invArt();
      return novo;
    }
    return null;
  };
  const updateArtigo = async (id: string, a: Partial<KbArtigo>) => {
    await updateRow("kb_artigos", id, a);
    if (a.titulo || a.conteudo || a.resumo) {
      gerarEmbeddingArtigo(id, `${a.titulo ?? ""}\n${a.resumo ?? ""}\n${a.conteudo ?? ""}`).catch(() => {});
    }
    invArt();
  };
  const deleteArtigo = async (id: string) => { await deleteRow("kb_artigos", id); invArt(); };
  const incrementarVisualizacao = async (id: string, atual: number) => {
    await updateRow("kb_artigos", id, { visualizacoes: atual + 1 });
  };

  const addFaq: KnowledgeBaseContextType["addFaq"] = async (f) => {
    const inserted = await insertRow("kb_faq", f);
    if (inserted) {
      const novo = rowToFaq(inserted);
      gerarEmbeddingFaq(novo.id, `${novo.pergunta}\n${novo.resposta}`).catch(() => {});
      invFaq();
      return novo;
    }
    return null;
  };
  const updateFaq = async (id: string, f: Partial<KbFaq>) => {
    await updateRow("kb_faq", id, f);
    if (f.pergunta || f.resposta) {
      gerarEmbeddingFaq(id, `${f.pergunta ?? ""}\n${f.resposta ?? ""}`).catch(() => {});
    }
    invFaq();
  };
  const deleteFaq = async (id: string) => { await deleteRow("kb_faq", id); invFaq(); };

  const setVinculosEquipamento = async (
    artigoId: string,
    equipamentos: { id: string; descricao: string }[]
  ) => {
    await (supabase as any).from("kb_artigo_equipamentos").delete().eq("artigo_id", artigoId);
    if (equipamentos.length > 0) {
      const rows = equipamentos.map((e) => ({
        artigo_id: artigoId,
        equipamento_id: e.id,
        equipamento_descricao: e.descricao,
      }));
      await (supabase as any).from("kb_artigo_equipamentos").insert(rows);
    }
    invVin();
  };

  const uploadAnexo = async (file: File): Promise<KbAnexo | null> => {
    try {
      const ts = Date.now();
      const safe = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${ts}_${safe}`;
      const { error } = await (supabase as any).storage.from("kb-anexos").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) { console.error(error); toast.error("Erro ao enviar anexo"); return null; }
      const { data: pub } = (supabase as any).storage.from("kb-anexos").getPublicUrl(path);
      return { nome: file.name, url: pub.publicUrl, tipo: file.type, tamanho: file.size };
    } catch (e) {
      console.error(e); toast.error("Erro ao enviar anexo"); return null;
    }
  };

  return (
    <Ctx.Provider value={{
      categorias, artigos, faqs, vinculosEquip, loading, reload,
      addCategoria, updateCategoria, deleteCategoria,
      addArtigo, updateArtigo, deleteArtigo, incrementarVisualizacao,
      addFaq, updateFaq, deleteFaq,
      setVinculosEquipamento, uploadAnexo,
      gerarEmbeddingArtigo, gerarEmbeddingFaq,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useKnowledgeBase() {
  useActivateProvider("KnowledgeBase");
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKnowledgeBase must be used within KnowledgeBaseProvider");
  return ctx;
}
