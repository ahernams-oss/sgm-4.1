export type PadraoClassificacao = [assinatura: string, categoria: string, servico: string, ocorrencias: number, total: number];

const PALAVRAS_AUXILIARES = new Set(["a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "no", "na", "nos", "nas", "um", "uma", "para", "por", "com", "ao", "aos"]);

export function assinaturaDescricao(texto: string): string {
  const palavras = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(p => p && !PALAVRAS_AUXILIARES.has(p));
  return [...new Set(palavras)].sort().join(" ");
}

export function historicoElegivel(data: string, situacao: number, categoriaAtiva: boolean, servicoAtivo: boolean, vinculoCorreto: boolean): boolean {
  return ["2025", "2026"].includes(data.slice(0, 4)) && situacao === 6 && categoriaAtiva && servicoAtivo && vinculoCorreto;
}

export function encontrarPadrao(descricao: string, padroes: PadraoClassificacao[]): PadraoClassificacao | null {
  const assinatura = assinaturaDescricao(descricao);
  if (assinatura.split(" ").length < 2) return null;
  // An exact lexical signature tolerates accents, punctuation and word order,
  // but does not guess from a single keyword or discard additional information.
  const encontrados = padroes.filter(p => p[0] === assinatura && p[3] >= 3 && p[4] >= p[3] && p[3] / p[4] >= 0.9);
  return encontrados.length === 1 ? encontrados[0] ?? null : null;
}

export interface SugestaoClassificacao {
  categoriaId: string;
  categoria: string;
  servicoId: string;
  servico: string;
  ocorrencias: number;
  total: number;
}

export function associarPadrao(
  padrao: PadraoClassificacao | null,
  categorias: { id: string; nome: string }[],
  servicos: { id: string; nome: string; categoria_id: string | null }[],
): SugestaoClassificacao | null {
  if (!padrao) return null;
  const categoriasEncontradas = categorias.filter(c => c.nome === padrao[1]);
  if (categoriasEncontradas.length !== 1) return null;
  const categoria = categoriasEncontradas[0];
  if (!categoria) return null;
  const servicosEncontrados = servicos.filter(s => s.nome === padrao[2] && s.categoria_id === categoria.id);
  if (servicosEncontrados.length !== 1) return null;
  const servico = servicosEncontrados[0];
  if (!servico) return null;
  return { categoriaId: categoria.id, categoria: categoria.nome, servicoId: servico.id, servico: servico.nome, ocorrencias: padrao[3], total: padrao[4] };
}