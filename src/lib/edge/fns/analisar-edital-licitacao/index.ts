import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { gerarTexto, modeloAvancado, paraBase64, respostaErroIA } from "@/lib/edge/ai";
// Análise preliminar de edital de licitação via IA
// Recebe múltiplos PDFs (edital, termo de referência, anexos) e gera análise estratégica
// no formato do checklist interno da empresa.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um analista sênior de licitações públicas brasileiras, especialista na Lei nº 14.133/2021 e na Lei nº 8.666/93, atuando para a LASANT CONSTRUÇÕES.

Sua tarefa: realizar ANÁLISE PRELIMINAR DE EDITAL - CHECKLIST ESTRATÉGICO a partir dos documentos PDF anexados (edital, termo de referência, minuta contratual e demais anexos). Use APENAS as informações presentes nos documentos. Se algum item não estiver no material recebido, declare explicitamente "NÃO LOCALIZADO no material recebido" e indique em qual anexo provavelmente está.

Parâmetro interno da LASANT: para Lei 14.133/2021 o desconto-alvo é de 25%; para Lei 8.666/93 é de 15%. Use esse parâmetro para calcular o cenário de lance mínimo.

ESTRUTURA OBRIGATÓRIA DA SAÍDA (markdown, em português, com tabelas markdown):

# ANÁLISE PRELIMINAR DE EDITAL - CHECKLIST ESTRATÉGICO

## [Modalidade] Nº [número] - [Órgão]
[Objeto resumido em uma linha]

### Documentos analisados
Tabela com: Documento recebido | Identificação (incluir nº de páginas de cada arquivo, entidade contratante, processo administrativo). Indicar quais anexos do edital NÃO foram recebidos.

> **ALERTA DE ESCOPO:** [explicitar limitações da análise por falta de anexos, se houver].

## 1. CHECKLIST ESTRATÉGICO INICIAL
Tabela: Item | Resultado confirmado | Local no edital (página/item).
Itens obrigatórios: Lei aplicável; Referência interna de desconto (LASANT); Objeto; Modalidade/forma; Critério de julgamento; Modo de disputa; Valor estimado; Prazo/quantidade; Sessão pública (data/hora); Intervalo mínimo entre lances; Tratamento ME/EPP; Margem de preferência.

## 2. GARANTIA DE PROPOSTA
Tabela: Pergunta | Resposta objetiva | Análise/Risco.
Perguntas: O edital exige garantia da proposta de 1% da estimativa? Há menção a garantia de proposta? É possível calcular o valor da garantia?

## 3. GARANTIA CONTRATUAL
Tabela: Pergunta | Resposta objetiva | Análise/Risco.

## 4. QUALIFICAÇÃO TÉCNICA
Tabela com: atestados de capacidade técnica exigidos, CAT/CREA/CAU, equipe mínima, vistoria/visita técnica, profissionais habilitados. Citar local no edital.

## 5. PARTICIPAÇÃO E IMPEDIMENTOS
Tabela: Item | Regra. Cobrir: ME/EPP; consórcio; cooperativas; MEI; conflitos/impedimentos (art. 14 Lei 14.133).

## 6. HABILITAÇÃO FISCAL, SOCIAL E TRABALHISTA
Tabela: Verificação | Resultado/Documento. SICAF, regularidade fiscal ME/EPP, certidões etc.

## 7. PROPOSTA - DOCUMENTOS E DECLARAÇÕES
Tabela: Documento | Exigência | Observação.

## 8. PROFISSIONAIS E QUANTIDADE DE POSTOS (se aplicável)
Tabela: Função | CBO MTE | Jornada | Postos.

## 9. MATERIAIS, INSUMOS E EQUIPAMENTOS
Tabela: Pergunta | Resposta. Cobrir: verba variável; fornecimento de materiais; valor separado; preço global absorvendo custos.

## 10. PRAZOS, RECURSOS E IMPUGNAÇÕES
Datas-limite de impugnação, esclarecimentos, recursos, contrarrazões.

## 11. SANÇÕES E PENALIDADES
Resumo.

## 12. AÇÕES IMEDIATAS RECOMENDADAS
Tabela: Ação | Prioridade (IMEDIATA / ALTA / MÉDIA).

## 13. CONCLUSÃO PRELIMINAR
Texto corrido com: viabilidade, valor estimado, cenário de lance mínimo aplicando o desconto-alvo LASANT, principais riscos, inconsistências identificadas e recomendação final (Viável / Viável com ressalvas / Inviável / Pendente de documentação).

REGRAS RÍGIDAS:
- Sempre cite página e item do edital onde a informação foi localizada.
- Nunca invente dados. Se não houver informação, escreva "NÃO LOCALIZADO no material recebido".
- Use valores monetários no formato R$ 1.234,56.
- Use datas no formato dd/mm/aaaa.
- Seja objetivo, técnico e direto.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && key.startsWith("file")) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum arquivo PDF enviado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contextoArquivos = files
      .map((f, i) => `${i + 1}. ${f.name} (${(f.size / 1024).toFixed(0)} KB)`)
      .join("\n");

    const texto = `Foram anexados ${files.length} documento(s) PDF desta licitação:\n${contextoArquivos}\n\nRealize a ANÁLISE PRELIMINAR completa seguindo a estrutura obrigatória. Identifique qual arquivo é o edital, qual é o termo de referência, qual é a minuta contratual e quais são os demais anexos.`;

    const arquivos = await Promise.all(
      files.map(async (file) => ({ mimeType: file.type || "application/pdf", base64: await paraBase64(file) })),
    );

    const markdown = await gerarTexto({
      modelo: modeloAvancado(),
      sistema: SYSTEM_PROMPT,
      texto,
      arquivos,
      temperatura: 0.2,
    });

    return new Response(
      JSON.stringify({ markdown, arquivosAnalisados: files.map(f => f.name) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("analisar-edital-licitacao error:", e);
    return respostaErroIA(e, corsHeaders);
  }
});

export default __slot.dispatch;
