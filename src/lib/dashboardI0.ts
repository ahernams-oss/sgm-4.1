type RegistroI0 = { codSco: string; mes: number; ano: number };
type CadastroTabela = { codSco: string; tipo: string };

export interface ResumoI0 {
  tabela: string;
  mes: number;
  ano: number;
  quantidade: number;
}

/** Conta registros de I0, não itens do catálogo; códigos ambíguos não recebem uma tabela arbitrária. */
export function resumirI0(items: readonly RegistroI0[], catalogo: readonly CadastroTabela[]): ResumoI0[] {
  const tabelasPorCodigo = new Map<string, Set<string>>();
  for (const item of catalogo) {
    const codigo = item.codSco.trim().toUpperCase();
    const tabelas = tabelasPorCodigo.get(codigo) ?? new Set<string>();
    if (item.tipo.trim()) tabelas.add(item.tipo.trim().toUpperCase());
    tabelasPorCodigo.set(codigo, tabelas);
  }
  const resumo = new Map<string, ResumoI0>();
  for (const item of items) {
    const tabelas = tabelasPorCodigo.get(item.codSco.trim().toUpperCase());
    const tabela = tabelas?.size === 1 ? [...tabelas][0] : "Tabela não identificada";
    const key = JSON.stringify([tabela, item.mes, item.ano]);
    const linha = resumo.get(key);
    if (linha) linha.quantidade++;
    else resumo.set(key, { tabela, mes: item.mes, ano: item.ano, quantidade: 1 });
  }
  return [...resumo.values()].sort((a, b) => b.ano - a.ano || b.mes - a.mes || a.tabela.localeCompare(b.tabela, "pt-BR"));
}