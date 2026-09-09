import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Proxy compatível com a antiga API do send-whatsapp — encaminha para PlugSend (uazapi).
// Mantido para não quebrar chamadas existentes de módulos que ainda invocam "send-whatsapp".

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("PLUGSEND_TOKEN");
    if (!token) throw new Error("PLUGSEND_TOKEN não configurado");

    const { telefone, mensagem, documentUrl, documentFilename } = await req.json();

    if (!telefone || (!mensagem && !documentUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: "telefone e (mensagem ou documentUrl) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Detecta grupo (JID @g.us) vs número
    const telefoneStr = String(telefone).trim();
    const apenasDigitos = telefoneStr.replace(/\D/g, "");
    const isGrupo =
      telefoneStr.includes("@g.us") || telefoneStr.includes("-") || apenasDigitos.length > 15;
    const destino = isGrupo
      ? (telefoneStr.includes("@g.us") ? telefoneStr : `${apenasDigitos}@g.us`)
      : apenasDigitos;

    const results: unknown[] = [];

    if (mensagem && mensagem.toString().trim()) {
      const r = await fetch("https://plugsend.uazapi.com/send/text", {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({ number: destino, text: mensagem, linkPreview: true }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(`PlugSend text [${r.status}]: ${t}`);
      try { results.push(JSON.parse(t)); } catch { results.push({ raw: t }); }
    }

    if (documentUrl) {
      const r = await fetch("https://plugsend.uazapi.com/send/media", {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({
          number: destino,
          type: "document",
          file: documentUrl,
          docName: documentFilename || "documento.pdf",
        }),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(`PlugSend media [${r.status}]: ${t}`);
      try { results.push(JSON.parse(t)); } catch { results.push({ raw: t }); }
    }

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("send-whatsapp (PlugSend proxy) error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

export default __slot.dispatch;
