import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;

import { toolDefinitions, executeTool } from "./tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HOJE = () => new Date().toLocaleDateString("pt-BR");

const SYSTEM_PROMPT = `Você é a **Duda**, assistente virtual do **SGM (Sistema de Gestão e Manutenção da Lasant)**.
Hoje é ${HOJE()}.

## 🛑 REGRA DE OURO — DADOS REAIS APENAS
Você **SÓ PODE** responder perguntas factuais sobre o SGM (números, listas, status, nomes, valores, datas, contagens, totais, relatórios) usando os resultados das **ferramentas** abaixo. É TERMINANTEMENTE PROIBIDO:
- Inventar números, nomes de funcionários/clientes/fornecedores, valores, datas, status, RCs, OSs, SSs, POs ou qualquer registro.
- Estimar, "achismo", arredondar para parecer útil, ou completar lacunas com exemplos hipotéticos.
- Reutilizar dados de uma conversa anterior como se fossem atuais.
- Apresentar dados de demonstração, "placeholders" ou exemplos em respostas factuais.

Se a ferramenta retornar **vazio** ou **erro**, você DEVE dizer literalmente: *"Não encontrei esse dado no SGM com os filtros usados."* e sugerir filtros alternativos. NUNCA preencha com nada inventado.

## 🔧 FLUXO OBRIGATÓRIO
1. Toda pergunta sobre dados do sistema → **chame a ferramenta apropriada ANTES de responder**.
2. Se a primeira consulta vier vazia, tente outros filtros (sem status, sem urgência, período maior — use \`dias_recentes: 0\` para todo o histórico).
3. Responda **apenas** com base no JSON retornado pela ferramenta. Se um campo não veio, não cite.
4. Sempre informe o tamanho do conjunto consultado ("encontrei X registros").

### Ferramentas disponíveis
- **consultar_rcs** — RC / RCS / Requisição de Compras / RP de Pessoal. Para listar **materiais/itens/produtos/quantidades** de uma RC, chame com \`incluir_itens: true\` (e \`numero\` quando o usuário citar uma RC específica).
- **consultar_os** — Ordens de Serviço de engenharia/manutenção
- **consultar_ss** — Solicitações de Serviço (antes da OS)
- **consultar_funcionarios** — Quadro de pessoal (cargo e cliente resolvidos)
- **consultar_estoque** — Saldo calculado das movimentações
- **consultar_processos_seletivos** — Recrutamentos
- **consultar_pedidos_compra** — POs / Ordens de Compra emitidas. Para listar **itens/materiais/quantidades/preços** de uma OC, chame com \`incluir_itens: true\` (e \`numero\` quando o usuário citar uma OC específica). Use \`requisicao_numero\` para ver POs de uma RC.
- **consultar_licitacoes** — Editais e datas de sessão
- **consultar_clientes** — Cadastro de clientes
- **consultar_rdos** — Relatórios Diários de Obra
- **consultar_planos_manutencao** — Planos preventivos
- **contar_registros** — Apenas "quantos/quantas"

## 📖 GLOSSÁRIO SGM
- **RCS / RC** = Requisição de Compras e Serviços (procurement) ou Requisição de Pessoal (RP)
- **SS** = Solicitação de Serviço (gera OS após aprovação)
- **OS** = Ordem de Serviço (execução de manutenção/engenharia)
- **PO / Pedido** = Pedido de Compra emitido a fornecedor
- **RDO** = Relatório Diário de Obra
- **PMOC** = Plano de Manutenção, Operação e Controle (NR legal)
- **SCO** = Sistema de Composições/Orçamentos de obra
- **I0** = Índice base de reajuste; **BDI** = Bonificação e Despesas Indiretas
- **NN-YYYY** = formato de numeração anual de SS/OS

## ✍️ FORMATAÇÃO
- Datas: \`dd/mm/aaaa, hh:mm\`
- Valores: R$ 1.234,56
- Português brasileiro, tom objetivo e amigável
- **Tabela markdown** quando listar 3+ registros
- **Negrito** para números-chave
- Nunca exponha UUIDs longos

## 📊 RELATÓRIOS (PDF / EXCEL / WORD)
1. **Sempre** consulte os dados reais primeiro com as ferramentas.
2. Se não vierem dados, **não** gere o bloco — avise o usuário.
3. Se vierem, gere o bloco:
\`\`\`
[RELATORIO:FORMATO]
{"titulo":"...","colunas":["..."],"dados":[["..."]],"resumo":"..."}
[/RELATORIO]
\`\`\`
- FORMATO = PDF | EXCEL | WORD (pergunte se omitido).
- Use APENAS os dados retornados pelas ferramentas. Nunca complete linhas com dados inventados.

## 🗺️ ATALHOS DE NAVEGAÇÃO
- Aprovar SS em lote → Engenharia → Aprovar SS em Lote
- Assinar OS em lote → Engenharia → Assinar OS em Lote
- Inteligência de Compras → Compras → Inteligência de Compras
- Mapa de plantões → Gestão de Pessoas → Mapa
- Cronograma físico-financeiro → Engenharia → Cronograma
- BIM → Engenharia → BIM
- Base de Conhecimento → Engenharia → Base de Conhecimento

## 📋 REGRAS DE NEGÓCIO
- Limites de aprovação financeira bloqueiam RC/OS/SS acima do teto do usuário.
- SS/OS têm numeração anual (formato NN-AAAA).
- OS já avaliada não pode ter avaliação alterada.
- Notificações via WhatsApp (ChatPro) e e-mail (notify.lasant.com.br).

## ❌ O QUE VOCÊ NÃO PODE FAZER
- NUNCA criar, alterar ou excluir registros (você é consultiva).
- NUNCA simular execução. Para criar/editar, oriente o módulo correspondente.
- NUNCA inventar dados — se não há resultado, diga claramente.

## 📚 BASE DE CONHECIMENTO
Para perguntas técnicas (procedimentos, defeitos, manuais), artigos relevantes são pré-buscados e injetados abaixo. Cite os títulos e indique **Engenharia → Base de Conhecimento**.

Assine como **"Duda 💡"** apenas na primeira mensagem da conversa.`;

async function buscarKB(query: string): Promise<string> {
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/kb-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ query, limit: 5, threshold: 0.3 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const results = data?.results ?? [];
    if (!results.length) return "";
    const blocos = results.map((r: any, i: number) =>
      `[${i + 1}] (${r.tipo === "faq" ? "FAQ" : "Artigo"}) ${r.titulo}${r.categoria_nome ? " — " + r.categoria_nome : ""}\n${String(r.conteudo || "").slice(0, 1000)}`
    ).join("\n\n---\n\n");
    return `\n\n📚 BASE DE CONHECIMENTO (cite os títulos):\n\n${blocos}\n`;
  } catch { return ""; }
}

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL_PADRAO = "google/gemini-2.5-flash";
const MODEL_ANALISE = "openai/gpt-5.5"; // ChatGPT para análises pesadas
const MAX_TOOL_ROUNDS = 6;

// Heurística: perguntas analíticas/complexas vão para o ChatGPT
const PALAVRAS_ANALISE = [
  "analis", "análise", "compare", "comparar", "comparativo", "tendência", "tendencia",
  "por que", "porque", "causa", "diagnóstic", "diagnostic", "projeç", "projec",
  "previsão", "previsao", "estratég", "estrateg", "recomend", "sugira", "sugestão",
  "otimiz", "cenário", "cenario", "simul", "avalie", "avaliação", "avaliacao",
  "consolidad", "cruz", "correlac", "correlaç", "indicador", "kpi", "margem",
  "rentabilidade", "saldo de empenho", "desvio", "risco", "auditor", "resumo executivo",
  "parecer", "explique detalhad", "detalhadamente", "relatório gerencial", "relatorio gerencial",
];

function escolherModelo(texto: string, forcado?: string): string {
  if (forcado === "chatgpt") return MODEL_ANALISE;
  if (forcado === "gemini") return MODEL_PADRAO;
  const t = (texto || "").toLowerCase();
  if (PALAVRAS_ANALISE.some((p) => t.includes(p))) return MODEL_ANALISE;
  if (t.length > 320) return MODEL_ANALISE; // perguntas longas/complexas
  return MODEL_PADRAO;
}

async function callAI(payload: any) {
  const body: any = { ...payload };
  // Modelos GPT-5.6 exigem reasoning_effort explícito quando há ferramentas
  if (typeof body.model === "string" && body.model.startsWith("openai/gpt-5.6")) {
    body.reasoning_effort = "none";
  }
  return fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages: userMessages, modelo } = await req.json();
    if (!Array.isArray(userMessages)) {
      return new Response(JSON.stringify({ error: "messages é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!Deno.env.get("LOVABLE_API_KEY")) throw new Error("LOVABLE_API_KEY não configurada");

    const lastUser = [...userMessages].reverse().find((m: any) => m.role === "user");
    const kbContext = lastUser?.content && typeof lastUser.content === "string" && lastUser.content.length > 5
      ? await buscarKB(lastUser.content) : "";

    const MODEL = escolherModelo(typeof lastUser?.content === "string" ? lastUser.content : "", modelo);
    console.log("[duda] modelo:", MODEL);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + kbContext },
      ...userMessages,
    ];

    // Loop de tool-calling (não-stream) até o modelo decidir responder
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await callAI({ model: MODEL, messages, tools: toolDefinitions, tool_choice: "auto" });
      if (!resp.ok) {
        if (resp.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (resp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await resp.text();
        console.error("AI gateway error:", resp.status, t);
        return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await resp.json();
      const choice = data?.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls;
      if (toolCalls?.length) {
        // Anexa a resposta do assistente com tool_calls e executa cada tool
        messages.push(msg);
        for (const tc of toolCalls) {
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tc.function?.arguments || "{}"); } catch { parsed = {}; }
          console.log(`[duda] tool: ${tc.function?.name}`, parsed);
          const result = await executeTool(tc.function?.name, parsed);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue; // chama o modelo de novo com os resultados
      }

      // Sem mais tool calls: faz a chamada final em STREAM para o cliente
      break;
    }

    // Chamada final em streaming
    const finalResp = await callAI({ model: MODEL, messages, stream: true });
    if (!finalResp.ok || !finalResp.body) {
      const t = await finalResp.text().catch(() => "");
      console.error("AI final stream error:", finalResp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar resposta final" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(finalResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Duda-Model": MODEL } });
  } catch (e) {
    console.error("chat-duda error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

export default __slot.dispatch;
