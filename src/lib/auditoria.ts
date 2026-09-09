import { supabase } from "@/integrations/supabase/client";

// Mapeia nome técnico de tabela para módulo amigável exibido no painel.
const MODULOS_LABEL: Record<string, string> = {
  clientes: "Clientes / Fornecedores",
  fornecedores: "Clientes / Fornecedores",
  funcionarios: "Funcionários",
  cargos: "Cargos",
  usuarios: "Usuários",
  usuarios_credenciais: "Credenciais de Usuário",
  perfis_acesso: "Perfis de Acesso",
  equipamentos: "Equipamentos",
  ferramentas: "Ferramentas",
  fabricantes: "Fabricantes",
  materiais_servicos: "Materiais e Serviços",
  categorias_compras: "Categorias de Compras",
  categorias_servicos: "Categorias de Serviços",
  servicos: "Serviços",
  responsaveis_tecnicos: "Responsáveis Técnicos",
  obras: "Obras",
  solicitacoes_servicos: "Solicitações de Serviço (SS)",
  ordens_servico: "Ordens de Serviço (OS)",
  requisicoes: "Requisições",
  requisicao_compras: "Requisição de Compras (RCS)",
  cotacao_compras: "Cotações de Compras",
  pedido_compra: "Ordens de Compra",
  recebimento: "Recebimento de Compras",
  estoque: "Estoque",
  medicoes: "Medições de Serviços",
  orcamentos: "Orçamentos",
  orcamentos_sco: "Orçamentos SCO",
  sco: "SCO",
  i0: "I0 / Índices",
  planos_manutencao: "Planos de Manutenção",
  pmoc: "PMOC",
  rdos: "RDOs",
  cronogramas: "Cronogramas",
  eventogramas: "Eventogramas",
  licitacoes: "Licitações",
  processos_trabalhistas: "Jurídico / Trabalhista",
  processo_seletivo: "Processo Seletivo",
  evidencias: "Qualidade / Evidências",
  checklists: "Checklists",
  contas_receber: "Financeiro - Contas a Receber",
  contas_pagar: "Financeiro - Contas a Pagar",
  lancamentos_financeiros: "Financeiro - Lançamentos",
  contas_bancarias: "Financeiro - Contas Bancárias",
  plano_contas: "Financeiro - Plano de Contas",
  centros_custo: "Financeiro - Centros de Custo",
  condicoes_pagamento: "Financeiro - Condições de Pagamento",
  empresa: "Dados da Empresa",
  comunicacao: "Comunicação",
  avaliacoes_desempenho: "Avaliações de Desempenho",
  kb_artigos: "Base de Conhecimento - Artigos",
  kb_faq: "Base de Conhecimento - FAQ",
  bim: "BIM",
  login_auditoria: "Login",
};

const ACAO_LABEL: Record<string, string> = {
  insert: "Criação",
  update: "Edição",
  delete: "Exclusão",
  login: "Login",
};

export const moduloLabel = (m: string) => MODULOS_LABEL[m] || m;
export const acaoLabel = (a: string) => ACAO_LABEL[a] || a;
export const MODULOS_DISPONIVEIS = Object.entries(MODULOS_LABEL)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

// Lê o usuário logado direto do storage (evita dependência circular do contexto).
function lerUsuarioLogado(): { id?: string; nome?: string; email?: string } | null {
  try {
    const raw = localStorage.getItem("usuarioLogado") || sessionStorage.getItem("usuarioLogado");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return { id: u?.id, nome: u?.nome, email: u?.email };
  } catch {
    return null;
  }
}

// Deriva uma descrição legível a partir dos dados (nome, descrição, número, etc.).
function descreverEntidade(row: any): string | null {
  if (!row || typeof row !== "object") return null;
  const candidatos = [
    row.descricao, row.nome, row.titulo, row.razao_social, row.numero && `Nº ${row.numero}`,
    row.codigo, row.cliente_nome, row.fornecedor_nome,
  ].filter(Boolean);
  return candidatos[0] ? String(candidatos[0]).slice(0, 200) : null;
}

// Remove campos pesados/irrelevantes do snapshot.
const SKIP_KEYS = new Set(["created_at", "updated_at", "embedding"]);
function sanitize(row: any): any {
  if (!row || typeof row !== "object") return row;
  const out: any = {};
  for (const k of Object.keys(row)) {
    if (SKIP_KEYS.has(k)) continue;
    const v = (row as any)[k];
    // Trunca strings muito longas (ex.: base64) para não poluir o histórico
    if (typeof v === "string" && v.length > 2000) out[k] = v.slice(0, 2000) + "…[truncado]";
    else out[k] = v;
  }
  return out;
}

export async function registrarAuditoria(params: {
  modulo: string;
  acao: "insert" | "update" | "delete" | string;
  entidadeId?: string | null;
  entidadeDescricao?: string | null;
  dadosAntes?: any;
  dadosDepois?: any;
}) {
  try {
    const u = lerUsuarioLogado();
    const descricao =
      params.entidadeDescricao ??
      descreverEntidade(params.dadosDepois) ??
      descreverEntidade(params.dadosAntes);

    await (supabase as any).functions.invoke("audit-write", {
      body: {
        usuario_id: u?.id ?? null,
        usuario_nome: u?.nome ?? null,
        usuario_email: u?.email ?? null,
        modulo: params.modulo,
        acao: params.acao,
        entidade_id: params.entidadeId ? String(params.entidadeId) : null,
        entidade_descricao: descricao,
        dados_antes: params.dadosAntes ? sanitize(params.dadosAntes) : null,
        dados_depois: params.dadosDepois ? sanitize(params.dadosDepois) : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
    });
  } catch (e) {
    // Auditoria nunca deve interromper a operação principal.
    console.warn("[auditoria] Falha ao registrar:", e);
  }
}

// Calcula apenas os campos alterados entre dois snapshots (para visualização legível).
export function diffSimples(antes: any, depois: any): Array<{ campo: string; de: any; para: any }> {
  if (!antes || !depois) return [];
  const keys = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  const out: Array<{ campo: string; de: any; para: any }> = [];
  for (const k of keys) {
    const a = antes[k]; const b = depois[k];
    const sa = JSON.stringify(a ?? null);
    const sb = JSON.stringify(b ?? null);
    if (sa !== sb) out.push({ campo: k, de: a ?? null, para: b ?? null });
  }
  return out;
}
