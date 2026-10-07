import { createClient } from "@supabase/supabase-js";
import { gerarEmbedding } from "@/lib/edge/ai";

export interface ResultadoKB {
  tipo: string;
  id: string;
  titulo: string;
  conteudo: string;
  categoria_nome: string | null;
  similarity: number;
}

function admin() {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
}

/** Busca semântica na Base de Conhecimento (usada por kb-search e pela Duda). */
export async function buscarBaseConhecimento(
  query: string,
  limit = 5,
  threshold = 0.5,
): Promise<ResultadoKB[]> {
  const embedding = await gerarEmbedding(query.slice(0, 4000));
  const { data, error } = await admin().rpc("kb_buscar_semantico", {
    query_embedding: embedding as any,
    match_count: limit,
    match_threshold: threshold,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResultadoKB[];
}

/**
 * Regera os embeddings de todos os artigos e FAQs com o mesmo texto que a tela usa
 * ao salvar (KnowledgeBaseContext). Serve para preencher os que ficaram sem vetor
 * enquanto a IA estava parada.
 */
export async function reindexarBaseConhecimento(): Promise<{ artigos: number; faqs: number; falhas: number }> {
  const supabase = admin();
  let artigos = 0, faqs = 0, falhas = 0;

  const { data: listaArtigos, error: errArt } = await supabase
    .from("kb_artigos").select("id, titulo, resumo, conteudo");
  if (errArt) throw new Error(errArt.message);
  for (const a of listaArtigos ?? []) {
    try {
      const emb = await gerarEmbedding(`${a.titulo ?? ""}\n${a.resumo ?? ""}\n${a.conteudo ?? ""}`.slice(0, 8000));
      const { error } = await supabase.from("kb_artigos").update({ embedding: emb as any }).eq("id", a.id);
      if (error) throw error;
      artigos++;
    } catch (e) {
      falhas++;
      console.error("[kb] reindexar artigo", a.id, e);
    }
  }

  const { data: listaFaqs, error: errFaq } = await supabase
    .from("kb_faq").select("id, pergunta, resposta");
  if (errFaq) throw new Error(errFaq.message);
  for (const f of listaFaqs ?? []) {
    try {
      const emb = await gerarEmbedding(`${f.pergunta ?? ""}\n${f.resposta ?? ""}`.slice(0, 8000));
      const { error } = await supabase.from("kb_faq").update({ embedding: emb as any }).eq("id", f.id);
      if (error) throw error;
      faqs++;
    } catch (e) {
      falhas++;
      console.error("[kb] reindexar faq", f.id, e);
    }
  }

  return { artigos, faqs, falhas };
}
