import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

const digitsOnly = (s: string) => (s || "").replace(/\D+/g, "");
const tag = (xml: string, name: string): string | null => {
  // captura <ns:name>valor</ns:name> ignorando namespaces
  const re = new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
};
const tagNum = (xml: string, name: string): number =>
  Number((tag(xml, name) || "0").replace(",", ".")) || 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { empresaId, xmlBase64, tipo } = await req.json().catch(() => ({}));
    if (!empresaId) return json({ ok: false, error: "empresaId obrigatório" }, 400);
    if (!xmlBase64) return json({ ok: false, error: "xmlBase64 obrigatório" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: emp } = await admin.from("empresa").select("cnpj").eq("id", empresaId).maybeSingle();
    const cnpjEmpresa = digitsOnly(emp?.cnpj || "");

    const bin = atob(xmlBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const xml = new TextDecoder("utf-8").decode(bytes);

    // Detecta tipo automaticamente
    const isNFe = /<(?:\w+:)?infNFe[\s>]/i.test(xml) || /<(?:\w+:)?NFe[\s>]/i.test(xml);
    const isNFSe = /nfse/i.test(xml) || /InfNfse/i.test(xml) || /<(?:\w+:)?Rps[\s>]/i.test(xml);
    const finalTipo = tipo || (isNFe ? "nfe" : isNFSe ? "nfse" : null);
    if (!finalTipo) return json({ ok: false, error: "Não foi possível identificar o tipo (NFe/NFSe) do XML" }, 400);

    if (finalTipo === "nfe") {
      // Extrai dados básicos da NFe (mod 55)
      const chave = (xml.match(/Id="?NFe([0-9]{44})"?/i)?.[1])
        || (tag(xml, "chNFe"))
        || tag(xml, "chave");
      if (!chave || chave.length !== 44) return json({ ok: false, error: "Chave NFe não encontrada (44 dígitos)" }, 400);

      const numero = tag(xml, "nNF");
      const serie = tag(xml, "serie");
      const dEmi = tag(xml, "dhEmi") || tag(xml, "dEmi");
      const emitCNPJ = digitsOnly(tag(xml, "CNPJ") || "");
      // tenta pegar nome do emitente: primeiro xNome dentro de <emit>
      const emitMatch = xml.match(/<emit>[\s\S]*?<xNome>([\s\S]*?)<\/xNome>/i);
      const emitNome = emitMatch ? emitMatch[1].trim() : (tag(xml, "xNome") || "");
      const vNF = tagNum(xml, "vNF");

      const path = `${empresaId}/${chave}.xml`;
      await admin.storage.from("nfes-xml").upload(path, bytes, {
        upsert: true, contentType: "application/xml",
      });

      const row = {
        empresa_id: empresaId,
        chave,
        numero: numero || "",
        serie: serie || "",
        emitente_cnpj: emitCNPJ,
        emitente_nome: emitNome,
        destinatario_cnpj: cnpjEmpresa,
        valor_total: vNF,
        data_emissao: dEmi,
        data_recebimento: new Date().toISOString(),
        ambiente: "manual",
        status: "manual",
        xml_url: path,
        payload: { origem: "upload_manual" },
      };
      const { data: existing } = await admin.from("nfes_recebidas").select("id").eq("chave", chave).maybeSingle();
      if (existing?.id) {
        await admin.from("nfes_recebidas").update(row).eq("id", existing.id);
        return json({ ok: true, tipo: "nfe", chave, acao: "atualizada" });
      }
      await admin.from("nfes_recebidas").insert(row);
      return json({ ok: true, tipo: "nfe", chave, acao: "inserida" });
    }

    // NFS-e
    const chave = tag(xml, "CodigoVerificacao") || tag(xml, "Numero") || tag(xml, "NumeroNfse") || tag(xml, "IdentificacaoRps");
    if (!chave) return json({ ok: false, error: "Identificador da NFS-e não encontrado" }, 400);
    const numero = tag(xml, "Numero") || tag(xml, "NumeroNfse");
    const codigoVerif = tag(xml, "CodigoVerificacao");
    const dEmi = tag(xml, "DataEmissao");
    const prestadorCnpj = digitsOnly(
      (xml.match(/<(?:\w+:)?PrestadorServico>[\s\S]*?<(?:\w+:)?Cnpj>([\s\S]*?)<\/(?:\w+:)?Cnpj>/i)?.[1])
      || (xml.match(/<(?:\w+:)?Prestador>[\s\S]*?<(?:\w+:)?Cnpj>([\s\S]*?)<\/(?:\w+:)?Cnpj>/i)?.[1])
      || ""
    );
    const prestadorNome = tag(xml, "RazaoSocial") || tag(xml, "Nome") || "";
    const valorServicos = tagNum(xml, "ValorServicos");
    const valorIss = tagNum(xml, "ValorIss");
    const baseCalc = tagNum(xml, "BaseCalculo");
    const valorLiq = tagNum(xml, "ValorLiquidoNfse") || valorServicos;
    const discriminacao = tag(xml, "Discriminacao") || "";

    const path = `${empresaId}/nfse/${chave}.xml`;
    await admin.storage.from("nfes-xml").upload(path, bytes, {
      upsert: true, contentType: "application/xml",
    });

    const row = {
      empresa_id: empresaId,
      chave: String(chave),
      numero: numero || "",
      serie: "",
      codigo_verificacao: codigoVerif,
      prestador_cnpj: prestadorCnpj,
      prestador_nome: prestadorNome,
      tomador_cnpj: cnpjEmpresa,
      valor_servicos: valorServicos,
      valor_iss: valorIss,
      base_calculo: baseCalc,
      valor_total: valorLiq,
      discriminacao,
      municipio_prestacao: "",
      data_emissao: dEmi,
      data_recebimento: new Date().toISOString(),
      ambiente: "manual",
      status: "manual",
      origem: "upload",
      xml_url: path,
      payload: { origem: "upload_manual" },
    };
    const { data: existing } = await admin.from("nfses_tomadas").select("id").eq("chave", row.chave).maybeSingle();
    if (existing?.id) {
      await admin.from("nfses_tomadas").update(row).eq("id", existing.id);
      return json({ ok: true, tipo: "nfse", chave, acao: "atualizada" });
    }
    await admin.from("nfses_tomadas").insert(row);
    return json({ ok: true, tipo: "nfse", chave, acao: "inserida" });
  } catch (e) {
    console.error("importar-xml-manual erro:", e);
    return json({ ok: false, error: (e as Error).message || "Erro inesperado" }, 500);
  }
});

export default __slot.dispatch;
