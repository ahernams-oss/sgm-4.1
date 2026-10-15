import type { GrupoPermissao } from "@/contexts/PerfisAcessoContext";

// Organização visual: as chaves e as regras de autorização não são alteradas.
const MENUS_PERMISSOES: { grupo: string; chaves: string[] }[] = [
  { grupo: "Gestão de Pessoas", chaves: ["dashboard_gp", "requisicao_colaboradores", "processos_seletivos", "funcionarios", "epi_recebimento_facial", "epis_devolucoes", "mapa_funcionarios", "avaliacoes_desempenho", "rh_treinamentos", "rh_solicitacoes_portal", "rh_relatorios", "rh_holerites"] },
  { grupo: "Patrimônio", chaves: ["ferramentas"] },
  { grupo: "Engenharia e Manutenção", chaves: ["dashboard_ssos", "plano_manutencao", "base_conhecimento"] },
  { grupo: "Solicitações de Serviço", chaves: ["solicitacao_servicos"] },
  { grupo: "Ordens de Serviço", chaves: ["ordem_servico", "os_assinatura"] },
  { grupo: "Obras", chaves: ["dashboard_medicoes", "rdo", "cronograma", "boletim_medicao", "eventograma", "contratos_terceiros", "medicoes", "bim"] },
  { grupo: "Orçamentos", chaves: ["sco"] },
  { grupo: "Compras e Suprimentos", chaves: ["dashboard_compras", "requisicoes_compras", "cotacoes", "pedidos_compra", "pc_assinatura", "inteligencia_compras", "recebimento", "estoque", "relatorios_estoque", "pregao"] },
  { grupo: "Licitações", chaves: ["licitacoes"] },
  { grupo: "Jurídico", chaves: ["juridico"] },
  { grupo: "Comunicação", chaves: ["comunicacao_mensagens", "comunicacao_avisos", "comunicacao_notificacoes", "comunicacao_whatsapp"] },
  { grupo: "PMOC", chaves: ["pmoc", "pmoc_valores"] },
  { grupo: "Qualidade", chaves: ["evidencias", "checklists"] },
  { grupo: "Assistente IA", chaves: ["chat_duda"] },
  { grupo: "Financeiro", chaves: ["financeiro.dashboard", "financeiro.contas_pagar", "financeiro.contas_receber", "financeiro.contas_bancarias", "financeiro.plano_contas", "financeiro.centros_custo", "financeiro.fluxo_caixa", "financeiro.dre", "financeiro.conciliacao", "financeiro.lancamentos", "financeiro.condicoes_pagamento", "financeiro.nfes_recebidas", "financeiro.relatorios"] },
  { grupo: "Faturamento", chaves: ["faturamentos"] },
  { grupo: "Gerencial", chaves: ["monitor_tv", "gerencial_dashboard", "gerencial_relatorios", "gerencial_multidim", "gerencial_mapa_clientes"] },
  { grupo: "Cadastros", chaves: ["empresa", "clientes", "equipamentos", "fornecedores", "cargos", "epis_catalogo", "nrs_catalogo", "categorias_servicos", "servicos", "os_modelos", "responsaveis_tecnicos", "i0", "materiais_servicos", "categorias_compras", "fabricantes"] },
  { grupo: "Administração", chaves: ["usuarios", "perfis_acesso", "auditoria"] },
];

export function organizarPermissoesPorMenu(cadastrados: GrupoPermissao[]): GrupoPermissao[] {
  const modulos = new Map(cadastrados.flatMap(g => g.modulos.map(m => [m.key, m] as const)));
  const utilizados = new Set<string>();
  const resultado: GrupoPermissao[] = MENUS_PERMISSOES.map(menu => ({
    grupo: menu.grupo,
    modulos: menu.chaves.flatMap(chave => {
      const modulo = modulos.get(chave);
      if (!modulo || utilizados.has(chave)) return [];
      utilizados.add(chave);
      return [modulo];
    }),
  })).filter(g => g.modulos.length > 0);

  // Novas opções ainda não mapeadas permanecem visíveis no grupo de origem.
  for (const origem of cadastrados) {
    const restantes = origem.modulos.filter(m => !utilizados.has(m.key));
    if (!restantes.length) continue;
    const existente = resultado.find(g => g.grupo === origem.grupo);
    if (existente) existente.modulos.push(...restantes);
    else resultado.push({ grupo: origem.grupo, modulos: restantes });
    restantes.forEach(m => utilizados.add(m.key));
  }
  return resultado;
}