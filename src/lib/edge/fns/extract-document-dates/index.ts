import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { gerarTexto, paraBase64 } from "@/lib/edge/ai";
// Extract document dates using AI vision

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base64Data = await paraBase64(file);
    const mimeType = file.type || "application/pdf";

    const content = await gerarTexto({
      texto: `Analise este documento e extraia as seguintes informações:
1. Data de Emissão (data em que o documento foi emitido/expedido)
2. Data de Validade (data de vencimento/expiração do documento)

Retorne APENAS um JSON válido no seguinte formato, sem nenhum texto adicional:
{"dataEmissao": "YYYY-MM-DD", "dataValidade": "YYYY-MM-DD"}

Se não encontrar uma das datas, use null para o campo correspondente.
Considere formatos brasileiros de data (DD/MM/YYYY, DD-MM-YYYY, etc).`,
      arquivos: [{ mimeType, base64: base64Data }],
      temperatura: 0,
    });

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ dataEmissao: null, dataValidade: null, raw: content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dates = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(dates), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, dataEmissao: null, dataValidade: null }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

export default __slot.dispatch;
