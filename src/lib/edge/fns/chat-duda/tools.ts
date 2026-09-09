import { denoEnv } from "@/lib/edge/deno-shim";
const Deno = { env: denoEnv } as any;
// Ferramentas que a Duda pode chamar para consultar dados REAIS do SGM.
// Usadas pela edge function chat-duda via tool-calling OpenAI-compatible.
// ⚠️ Toda informação que a Duda apresentar deve vir destas consultas. Nunca invente.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

// Caches simples por invocação da função (curtos para evitar sobrecarga)
let _cargosMap: Map<string, string> | null = null;
let _clientesMap: Map<string, string> | null = null;

async function getCargosMap() {
  if (_cargosMap) return _cargosMap;
  const { data } = await supa.from("cargos").select("id,nome");
  _cargosMap = new Map((data ?? []).map((c: any) => [c.id, c.nome]));
  return _cargosMap;
}
async function getClientesMap() {
  if (_clientesMap) return _clientesMap;
  const { data } = await supa.from("clientes").select("id,nome,nome_fantasia");
  _clientesMap = new Map((data ?? []).map((c: any) => [c.id, c.nome_fantasia || c.nome]));
  return _clientesMap;
}

// Definições no formato OpenAI tools
export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "consultar_rcs",
      description: "Consulta Requisições de Compras e Serviços (RCS / RC / RP de pessoal) reais. Use SEMPRE que perguntarem sobre requisições, status, contagem ou relatório.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Ex: 'Enviada', 'Aprovada', 'Rejeitada', 'Concluída'" },
          solicitante: { type: "string" },
          centro_custo: { type: "string", description: "Busca parcial pelo nome do centro de custo" },
          urgencia: { type: "string" },
          numero: { type: "number", description: "Buscar por número específico" },
          dias_recentes: { type: "number", description: "Limitar aos últimos N dias (0 = sem limite)", default: 90 },
          limite: { type: "number", default: 50 },
          incluir_itens: { type: "boolean", description: "Se true, retorna a lista detalhada de itens (descrição, quantidade, unidade, especificação) de cada RC. Use SEMPRE que o usuário pedir materiais/itens/produtos das RCs.", default: false },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_os",
      description: "Consulta Ordens de Serviço (OS) reais de engenharia/manutenção.",
      parameters: {
        type: "object",
        properties: {
          situacao: { type: "string" },
          cliente_nome: { type: "string" },
          prioridade: { type: "string" },
          numero: { type: "number" },
          dias_recentes: { type: "number", default: 180 },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_ss",
      description: "Consulta Solicitações de Serviço (SS) reais.",
      parameters: {
        type: "object",
        properties: {
          situacao: { type: "string" },
          cliente_nome: { type: "string" },
          prioridade: { type: "string" },
          numero: { type: "number" },
          dias_recentes: { type: "number", default: 180 },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_funcionarios",
      description: "Consulta funcionários reais cadastrados. Retorna nome, cargo (resolvido), cliente (resolvido), admissão e situação (Ativo se sem data_demissao).",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          cargo: { type: "string", description: "Filtra por nome do cargo (busca parcial)" },
          cliente_nome: { type: "string" },
          apenas_ativos: { type: "boolean", default: true },
          limite: { type: "number", default: 100 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_estoque",
      description: "Calcula saldo de estoque a partir das movimentações reais (entradas - saídas).",
      parameters: {
        type: "object",
        properties: {
          material_nome: { type: "string", description: "Busca parcial pela descrição do material" },
          apenas_zerados: { type: "boolean", default: false },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_processos_seletivos",
      description: "Consulta processos seletivos reais. Resolve cargo e dados da RC de origem.",
      parameters: {
        type: "object",
        properties: {
          cargo: { type: "string", description: "Filtra por nome do cargo da RC" },
          apenas_em_andamento: { type: "boolean", default: false, description: "Apenas processos sem candidato finalizado" },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_pedidos_compra",
      description: "Consulta Pedidos de Compra / Ordens de Compra (PO/OC) reais. Use incluir_itens:true (ou informe numero) para retornar a lista de materiais com descrição, quantidade, unidade, preço unitário e valor total.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Ex.: Emitido, Comprado, Em Entrega, Entregue Parcial, Entregue, Cancelado" },
          fornecedor_nome: { type: "string" },
          numero: { type: "number", description: "Número da PO/OC específica" },
          requisicao_numero: { type: "number", description: "Filtra POs originadas de uma RC específica" },
          incluir_itens: { type: "boolean", default: false, description: "Retorna itens detalhados (descrição, qtd, unidade, preço, total) e observações/condições" },
          dias_recentes: { type: "number", default: 180, description: "0 = todo o histórico" },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_licitacoes",
      description: "Consulta licitações reais cadastradas (com data_sessao, órgão, objeto).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          dias_ate_sessao: { type: "number", description: "Apenas com sessão nos próximos N dias" },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_clientes",
      description: "Lista clientes reais cadastrados.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string" },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_rdos",
      description: "Consulta RDOs (Relatórios Diários de Obra) reais.",
      parameters: {
        type: "object",
        properties: {
          cliente_nome: { type: "string" },
          obra: { type: "string" },
          dias_recentes: { type: "number", default: 90 },
          limite: { type: "number", default: 30 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_planos_manutencao",
      description: "Consulta Planos de Manutenção reais.",
      parameters: {
        type: "object",
        properties: {
          cliente_nome: { type: "string" },
          status: { type: "string" },
          limite: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "contar_registros",
      description: "Conta registros de uma tabela do SGM com filtro opcional por status.",
      parameters: {
        type: "object",
        properties: {
          tabela: {
            type: "string",
            enum: [
              "requisicoes_compras", "ordens_servico", "solicitacoes_servicos",
              "funcionarios", "pedidos_compra", "cotacoes_compras",
              "processos_seletivos", "licitacoes", "clientes", "fabricantes",
              "materiais_servicos", "equipamentos", "rdos", "planos_manutencao",
            ],
          },
          campo_status: { type: "string" },
          valor_status: { type: "string" },
        },
        required: ["tabela"],
      },
    },
  },
];

type ToolArgs = Record<string, unknown>;

const dataLimite = (dias?: number) => {
  if (!dias || dias <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString();
};

const cap = (n: unknown, max = 200) => Math.min(Math.max(Number(n) || 50, 1), max);

export async function executeTool(name: string, args: ToolArgs): Promise<unknown> {
  try {
    switch (name) {
      case "consultar_rcs": {
        const limite = cap(args.limite);
        let q = supa.from("requisicoes_compras")
          .select("numero,data_criacao,solicitante,centro_custo_nome,centro_custo,urgencia,status,itens,justificativa,created_at")
          .order("created_at", { ascending: false }).limit(limite);
        if (args.status) q = q.ilike("status", `%${args.status}%`);
        if (args.urgencia) q = q.ilike("urgencia", `%${args.urgencia}%`);
        if (args.solicitante) q = q.ilike("solicitante", `%${args.solicitante}%`);
        if (args.centro_custo) q = q.ilike("centro_custo_nome", `%${args.centro_custo}%`);
        if (args.numero) q = q.eq("numero", Number(args.numero));
        const dl = dataLimite(Number(args.dias_recentes ?? 90));
        if (dl) q = q.gte("created_at", dl);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        const incluirItens = args.incluir_itens === true || args.numero != null;
        return {
          total: data?.length ?? 0,
          registros: (data ?? []).map((r: any) => {
            const itens = Array.isArray(r.itens) ? r.itens : [];
            const base: any = {
              numero: r.numero,
              data: r.data_criacao || r.created_at,
              solicitante: r.solicitante,
              centro_custo: r.centro_custo_nome || r.centro_custo,
              urgencia: r.urgencia,
              status: r.status,
              qtd_itens: itens.length,
              justificativa: String(r.justificativa || "").slice(0, 160),
            };
            if (incluirItens) {
              base.itens = itens.map((i: any) => ({
                descricao: i.descricao || i.material_descricao || i.cargo_nome || "—",
                quantidade: Number(i.quantidade) || 0,
                unidade: i.unidadeMedida || i.unidade_medida || i.unidade || "",
                especificacao: String(i.especificacaoTecnica || i.especificacao_tecnica || "").slice(0, 200),
                observacao: String(i.observacao || "").slice(0, 160),
              }));
            }
            return base;
          }),
        };
      }

      case "consultar_os": {
        const limite = cap(args.limite);
        let q = supa.from("ordens_servico")
          .select("numero,cliente_nome,situacao,prioridade,data_inicio,data_termino,descricao_servicos,servico,solicitante,created_at")
          .order("created_at", { ascending: false }).limit(limite);
        if (args.situacao) q = q.ilike("situacao", `%${args.situacao}%`);
        if (args.prioridade) q = q.ilike("prioridade", `%${args.prioridade}%`);
        if (args.cliente_nome) q = q.ilike("cliente_nome", `%${args.cliente_nome}%`);
        if (args.numero) q = q.eq("numero", Number(args.numero));
        const dl = dataLimite(Number(args.dias_recentes ?? 180));
        if (dl) q = q.gte("created_at", dl);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        return {
          total: data?.length ?? 0,
          registros: (data ?? []).map((r: any) => ({
            numero: r.numero,
            cliente: r.cliente_nome,
            situacao: r.situacao,
            prioridade: r.prioridade,
            data_inicio: r.data_inicio,
            data_termino: r.data_termino,
            solicitante: r.solicitante,
            servico: String(r.descricao_servicos || r.servico || "").slice(0, 180),
          })),
        };
      }

      case "consultar_ss": {
        const limite = cap(args.limite);
        let q = supa.from("solicitacoes_servicos")
          .select("numero,cliente_nome,situacao,prioridade,data_hora_solicitacao,descricao_servicos,solicitante_nome,tipo,created_at")
          .order("created_at", { ascending: false }).limit(limite);
        if (args.situacao) q = q.ilike("situacao", `%${args.situacao}%`);
        if (args.prioridade) q = q.ilike("prioridade", `%${args.prioridade}%`);
        if (args.cliente_nome) q = q.ilike("cliente_nome", `%${args.cliente_nome}%`);
        if (args.numero) q = q.eq("numero", Number(args.numero));
        const dl = dataLimite(Number(args.dias_recentes ?? 180));
        if (dl) q = q.gte("created_at", dl);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        return {
          total: data?.length ?? 0,
          registros: (data ?? []).map((r: any) => ({
            numero: r.numero,
            cliente: r.cliente_nome,
            situacao: r.situacao,
            prioridade: r.prioridade,
            tipo: r.tipo,
            data: r.data_hora_solicitacao || r.created_at,
            solicitante: r.solicitante_nome,
            descricao: String(r.descricao_servicos || "").slice(0, 180),
          })),
        };
      }

      case "consultar_funcionarios": {
        const limite = cap(args.limite, 300);
        const apenasAtivos = args.apenas_ativos !== false;
        let q = supa.from("funcionarios")
          .select("nome,cpf,cargo_id,cliente_id,data_admissao,data_demissao,telefone,email")
          .limit(limite);
        if (args.nome) q = q.ilike("nome", `%${args.nome}%`);
        if (apenasAtivos) q = q.is("data_demissao", null);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        const [cargos, clientes] = await Promise.all([getCargosMap(), getClientesMap()]);
        let lista = (data ?? []).map((f: any) => ({
          nome: f.nome,
          cpf: f.cpf,
          cargo: cargos.get(f.cargo_id) || "—",
          cliente: clientes.get(f.cliente_id) || "—",
          data_admissao: f.data_admissao,
          situacao: f.data_demissao ? `Demitido em ${f.data_demissao}` : "Ativo",
          telefone: f.telefone,
          email: f.email,
        }));
        if (args.cargo) {
          const t = String(args.cargo).toLowerCase();
          lista = lista.filter((f: any) => f.cargo.toLowerCase().includes(t));
        }
        if (args.cliente_nome) {
          const t = String(args.cliente_nome).toLowerCase();
          lista = lista.filter((f: any) => f.cliente.toLowerCase().includes(t));
        }
        return { total: lista.length, registros: lista };
      }

      case "consultar_estoque": {
        const limite = cap(args.limite);
        const { data: movs, error } = await supa
          .from("estoque_movimentacoes")
          .select("material_id,material_codigo,material_descricao,tipo,quantidade")
          .limit(10000);
        if (error) return { erro: error.message };
        const mapa = new Map<string, any>();
        for (const m of movs ?? []) {
          const key = m.material_id || m.material_descricao;
          if (!key) continue;
          const cur = mapa.get(key) || { codigo: m.material_codigo, material: m.material_descricao, saldo: 0 };
          const qtd = Number(m.quantidade) || 0;
          const tipo = String(m.tipo || "").toLowerCase();
          cur.saldo += tipo.startsWith("entrada") ? qtd : -qtd;
          mapa.set(key, cur);
        }
        let lista = [...mapa.values()];
        if (args.material_nome) {
          const t = String(args.material_nome).toLowerCase();
          lista = lista.filter((i) => String(i.material || "").toLowerCase().includes(t));
        }
        if (args.apenas_zerados) lista = lista.filter((i) => i.saldo <= 0);
        lista.sort((a, b) => b.saldo - a.saldo);
        return { total: lista.length, registros: lista.slice(0, limite) };
      }

      case "consultar_processos_seletivos": {
        const limite = cap(args.limite);
        const { data, error } = await supa.from("processos_seletivos")
          .select("id,requisicao_id,data_criacao,candidatos,created_at")
          .order("created_at", { ascending: false }).limit(limite);
        if (error) return { erro: error.message };
        const rcIds = [...new Set((data ?? []).map((p: any) => p.requisicao_id).filter(Boolean))];
        const cargos = await getCargosMap();
        const { data: rcs } = rcIds.length
          ? await supa.from("requisicoes_compras").select("id,numero,itens,centro_custo_nome,status,solicitante").in("id", rcIds)
          : { data: [] as any[] };
        const rcMap = new Map((rcs ?? []).map((r: any) => [r.id, r]));
        let lista = (data ?? []).map((p: any) => {
          const rc = rcMap.get(p.requisicao_id) as any;
          const itens = Array.isArray(rc?.itens) ? rc.itens : [];
          const cargoNome = itens.map((i: any) => i.cargo_nome || cargos.get(i.cargo_id) || i.descricao).filter(Boolean).join(", ");
          const cands = Array.isArray(p.candidatos) ? p.candidatos : [];
          const finalizado = cands.find((c: any) => String(c.status || "").toLowerCase().includes("contrat") || String(c.status || "").toLowerCase().includes("aprov"));
          return {
            rc_numero: rc?.numero,
            cargo: cargoNome || "—",
            centro_custo: rc?.centro_custo_nome,
            qtd_candidatos: cands.length,
            status: finalizado ? "Concluído" : "Em Andamento",
            criado_em: p.created_at,
          };
        });
        if (args.cargo) {
          const t = String(args.cargo).toLowerCase();
          lista = lista.filter((p) => p.cargo.toLowerCase().includes(t));
        }
        if (args.apenas_em_andamento) lista = lista.filter((p) => p.status === "Em Andamento");
        return { total: lista.length, registros: lista };
      }

      case "consultar_pedidos_compra": {
        const limite = cap(args.limite);
        const incluirItens = args.incluir_itens === true || args.numero != null;
        const cols = incluirItens
          ? "numero,fornecedor_nome,status,valor_total,data_criacao,requisicao_numero,created_at,itens,condicao_pagamento,prazo_entrega,local_entrega,observacoes,comprador,historico_status"
          : "numero,fornecedor_nome,status,valor_total,data_criacao,requisicao_numero,created_at";
        let q = supa.from("pedidos_compra")
          .select(cols)
          .order("created_at", { ascending: false }).limit(limite);
        if (args.status) q = q.ilike("status", `%${args.status}%`);
        if (args.fornecedor_nome) q = q.ilike("fornecedor_nome", `%${args.fornecedor_nome}%`);
        if (args.numero) q = q.eq("numero", Number(args.numero));
        if (args.requisicao_numero) q = q.eq("requisicao_numero", Number(args.requisicao_numero));
        const dl = dataLimite(Number(args.dias_recentes ?? 180));
        if (dl) q = q.gte("created_at", dl);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        return {
          total: data?.length ?? 0,
          registros: (data ?? []).map((r: any) => {
            const base: any = {
              numero: r.numero,
              fornecedor: r.fornecedor_nome,
              status: r.status,
              valor_total: r.valor_total,
              rc_origem: r.requisicao_numero,
              data: r.data_criacao || r.created_at,
            };
            if (incluirItens) {
              base.comprador = r.comprador;
              base.condicao_pagamento = r.condicao_pagamento;
              base.prazo_entrega = r.prazo_entrega;
              base.local_entrega = r.local_entrega;
              base.observacoes = r.observacoes;
              base.itens = Array.isArray(r.itens) ? r.itens.map((it: any) => ({
                descricao: it.descricao,
                quantidade: it.quantidade,
                unidade: it.unidadeMedida || it.unidade,
                preco_unitario: it.precoUnitario ?? it.preco_unitario,
                valor_total: it.valorTotal ?? it.valor_total,
              })) : [];
              base.historico_status = Array.isArray(r.historico_status) ? r.historico_status : [];
            }
            return base;
          }),
        };
      }

      case "consultar_licitacoes": {
        const limite = cap(args.limite);
        let q = supa.from("licitacoes")
          .select("numero_processo,numero_edital,modalidade,orgao_licitante,objeto_resumido,data_sessao,status,valor_estimado,cidade,estado")
          .order("data_sessao", { ascending: true, nullsFirst: false }).limit(limite);
        if (args.status) q = q.ilike("status", `%${args.status}%`);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        let lista = data ?? [];
        if (args.dias_ate_sessao) {
          const dias = Number(args.dias_ate_sessao);
          const fim = new Date();
          fim.setDate(fim.getDate() + dias);
          lista = lista.filter((l: any) => {
            if (!l.data_sessao) return false;
            const d = new Date(l.data_sessao);
            return d >= new Date() && d <= fim;
          });
        }
        return {
          total: lista.length,
          registros: lista.map((r: any) => ({
            processo: r.numero_processo,
            edital: r.numero_edital,
            orgao: r.orgao_licitante,
            objeto: String(r.objeto_resumido || "").slice(0, 180),
            modalidade: r.modalidade,
            status: r.status,
            data_sessao: r.data_sessao,
            valor_estimado: r.valor_estimado,
            local: [r.cidade, r.estado].filter(Boolean).join("/"),
          })),
        };
      }

      case "consultar_clientes": {
        const limite = cap(args.limite);
        let q = supa.from("clientes").select("nome,nome_fantasia,cnpj,cidade,uf,email,telefone_celular").limit(limite);
        if (args.nome) q = q.or(`nome.ilike.%${args.nome}%,nome_fantasia.ilike.%${args.nome}%`);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        return { total: data?.length ?? 0, registros: data ?? [] };
      }

      case "consultar_rdos": {
        const limite = cap(args.limite);
        let q = supa.from("rdos")
          .select("numero,data_rdo,cliente_nome,obra,responsavel,avanco_fisico_geral,created_at")
          .order("data_rdo", { ascending: false }).limit(limite);
        if (args.cliente_nome) q = q.ilike("cliente_nome", `%${args.cliente_nome}%`);
        if (args.obra) q = q.ilike("obra", `%${args.obra}%`);
        const dl = dataLimite(Number(args.dias_recentes ?? 90));
        if (dl) q = q.gte("created_at", dl);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        return { total: data?.length ?? 0, registros: data ?? [] };
      }

      case "consultar_planos_manutencao": {
        const limite = cap(args.limite);
        let q = supa.from("planos_manutencao")
          .select("titulo,cliente_nome,contrato,vigencia_inicio,vigencia_fim,responsavel_tecnico_nome,status")
          .order("created_at", { ascending: false }).limit(limite);
        if (args.cliente_nome) q = q.ilike("cliente_nome", `%${args.cliente_nome}%`);
        if (args.status) q = q.ilike("status", `%${args.status}%`);
        const { data, error } = await q;
        if (error) return { erro: error.message };
        return { total: data?.length ?? 0, registros: data ?? [] };
      }

      case "contar_registros": {
        const tabela = String(args.tabela);
        let q = supa.from(tabela).select("*", { count: "exact", head: true });
        if (args.campo_status && args.valor_status) {
          q = q.ilike(String(args.campo_status), `%${args.valor_status}%`);
        }
        const { count, error } = await q;
        if (error) return { erro: error.message };
        return { tabela, filtro: args.campo_status ? `${args.campo_status}~${args.valor_status}` : "todos", total: count ?? 0 };
      }

      default:
        return { erro: `Ferramenta desconhecida: ${name}` };
    }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}
