import { supabase } from "@/integrations/supabase/client";
import type { RenderOSOptions } from "@/lib/gerarPdfOrdemServico";

type Opcoes = RenderOSOptions & { memoriaCalculo?: any[] };

export function escolherMemoriaImpressao(orcamentos: any[]): any[] {
  const ts = (o: any) => new Date(o.data_aprovacao || o.created_at || o.data_criacao || 0).getTime() || 0;
  const ordenados = [...orcamentos].sort((a, b) => ts(b) - ts(a));
  const temMemoria = (o: any) => Array.isArray(o.memoria_calculo) && o.memoria_calculo.length > 0;
  const aprovados = ordenados.filter(o => String(o.status || "").toLowerCase().includes("aprovad"));
  const escolhido = aprovados.find(temMemoria) || aprovados[0] || ordenados.find(temMemoria);
  return Array.isArray(escolhido?.memoria_calculo) ? escolhido.memoria_calculo : [];
}

/** Busca somente os anexos da OS selecionada e a memória da sua SS, sem depender da grade em cache. */
export async function carregarDadosImpressaoOs(opts: Opcoes, comMemoria: boolean): Promise<Opcoes> {
  const os = { ...opts.os };
  if (os.id) {
    const { data, error } = await supabase.from("ordens_servico")
      .select("fotos, solicitacao_id").eq("id", os.id).single();
    if (error) throw new Error("Não foi possível carregar as fotos da O.S.: " + error.message);
    os.fotos = Array.isArray(data.fotos) ? data.fotos.flatMap(foto => {
      if (!foto || typeof foto !== "object" || Array.isArray(foto) || typeof foto.url !== "string") return [];
      return [{ id: typeof foto.id === "string" ? foto.id : foto.url, url: foto.url,
        observacao: typeof foto.observacao === "string" ? foto.observacao : undefined }];
    }) : [];
    os.solicitacaoId = data.solicitacao_id || os.solicitacaoId;
  }
  let memoriaCalculo = opts.memoriaCalculo;
  if (comMemoria && os.solicitacaoId) {
    const { data, error } = await supabase.from("orcamentos")
      .select("memoria_calculo, status, data_aprovacao, created_at, data_criacao")
      .eq("solicitacao_id", os.solicitacaoId);
    if (error) throw new Error("Não foi possível carregar a memória de cálculo: " + error.message);
    memoriaCalculo = escolherMemoriaImpressao(data || []);
  }
  return { ...opts, os, memoriaCalculo };
}

/** URLs antigas de arquivos privados precisam ser assinadas novamente com a sessão atual. */
export async function resolverImagemImpressaoOs(url: string): Promise<string> {
  if (!url) return url;
  const base = new URL(supabase.storage.from("evidencias-anexos").getPublicUrl("_").data.publicUrl);
  let parsed: URL;
  try { parsed = new URL(url); } catch { return url; }
  if (parsed.origin !== base.origin) return url;
  const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (!match) return url;
  const { data, error } = await supabase.storage.from(decodeURIComponent(match[1]))
    .createSignedUrl(decodeURIComponent(match[2]), 3600);
  if (error || !data?.signedUrl) throw new Error("Não foi possível acessar a foto anexada à O.S.");
  return data.signedUrl;
}