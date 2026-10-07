import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { gerarTexto, respostaErroIA } from "@/lib/edge/ai";
// Lê uma proposta de fornecedor em PDF/imagem com IA e devolve preços por item.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, mimeType, fileName, itens } = await req.json();
    if (!fileBase64 || !Array.isArray(itens)) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes (fileBase64, itens)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const listaItens = itens
      .map((i: any, idx: number) => `${idx + 1}. [itemId=${i.itemId}] ${i.descricao} | qtd: ${i.quantidade} ${i.unidadeMedida || ""}`)
      .join("\n");

    const prompt = `Você é um assistente de compras. Analise a PROPOSTA COMERCIAL do fornecedor em anexo (arquivo: ${fileName || "proposta"}) e extraia os preços.

Itens da nossa cotação (faça a correspondência por similaridade de descrição, mesmo que o texto do fornecedor seja diferente):
${listaItens}

Retorne APENAS um JSON válido, sem markdown, no formato:
{
  "fornecedorNome": "razão social ou nome do fornecedor (ou null)",
  "cnpj": "somente dígitos ou null",
  "condicaoPagamento": "ex: 30/60/90 dias (ou null)",
  "prazoEntrega": "ex: 15 dias úteis (ou null)",
  "validadeProposta": "YYYY-MM-DD ou null",
  "observacao": "observações relevantes ou null",
  "itens": [
    { "itemId": "id exato da lista acima", "precoUnitario": 0.00, "descricaoFornecedor": "descrição encontrada no PDF ou null", "confianca": "alta|media|baixa" }
  ]
}

Regras:
- precoUnitario é o PREÇO UNITÁRIO em reais (número decimal com ponto). Se o PDF trouxer apenas o total do item, divida pela quantidade.
- Converta formato brasileiro (1.234,56) para 1234.56.
- Inclua no array apenas itens que você conseguiu localizar. Não invente valores.
- Use "confianca": "baixa" quando a correspondência for incerta.`;

    const content = await gerarTexto({
      texto: prompt,
      arquivos: [{
        mimeType: mimeType || "application/pdf",
        base64: String(fileBase64).replace(/^data:[^;]+;base64,/, ""),
      }],
      temperatura: 0,
    });
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) {
      return new Response(JSON.stringify({ error: "Não foi possível interpretar o documento.", raw: content }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(m[0]);
    const itensOut = Array.isArray(parsed.itens)
      ? parsed.itens
          .filter((i: any) => i && i.itemId)
          .map((i: any) => ({
            itemId: String(i.itemId),
            precoUnitario: i.precoUnitario != null ? Number(i.precoUnitario) : null,
            descricaoFornecedor: i.descricaoFornecedor ?? null,
            confianca: ["alta", "media", "baixa"].includes(i.confianca) ? i.confianca : "media",
          }))
      : [];

    return new Response(JSON.stringify({ ...parsed, itens: itensOut }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return respostaErroIA(e, corsHeaders);
  }
});

export default __slot.dispatch;
