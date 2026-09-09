import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";
import forge from "node-forge";

const UFS_VALIDAS = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
]);

function digitsOnly(s: string) { return (s || "").replace(/\D+/g, ""); }

function extractCnpjFromSubject(subjectAttrs: any[]): string | null {
  // CNPJ aparece tipicamente no CN como "NOME:CNPJ" (ICP-Brasil),
  // ou em OIDs específicos. Tentamos várias estratégias.
  for (const a of subjectAttrs || []) {
    const v = String(a?.value || "");
    const m = v.match(/(\d{14})/);
    if (m) return m[1];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { empresaId, storagePath, senha, uf, ambiente } = body || {};

    if (!storagePath || typeof storagePath !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "storagePath obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!senha || typeof senha !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Senha do certificado é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ufNorm = String(uf || "").toUpperCase().trim();
    const ambNorm = String(ambiente || "").toLowerCase().trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Baixa o .pfx do storage privado
    const { data: file, error: dlErr } = await admin.storage
      .from("certificados-digitais")
      .download(storagePath);
    if (dlErr || !file) {
      return new Response(JSON.stringify({ ok: false, error: `Não foi possível baixar o certificado: ${dlErr?.message || "arquivo não encontrado"}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const buf = new Uint8Array(await file.arrayBuffer());

    // 2. Decodifica o PKCS#12
    const binary = String.fromCharCode(...buf);
    const p12Asn1 = forge.asn1.fromDer(binary, false);

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);
    } catch (_e) {
      return new Response(JSON.stringify({ ok: false, error: "Senha do certificado incorreta ou arquivo .pfx inválido." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Extrai certificado titular
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = certBags[forge.pki.oids.certBag] || [];
    if (!certs.length) {
      return new Response(JSON.stringify({ ok: false, error: "Nenhum certificado encontrado dentro do .pfx." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cert = certs[0].cert!;
    const subjectAttrs = cert.subject.attributes as any[];
    const issuerAttrs = cert.issuer.attributes as any[];
    const titular = (subjectAttrs.find((a) => a.shortName === "CN")?.value as string) || "";
    const emissor = (issuerAttrs.find((a) => a.shortName === "CN")?.value as string) || "";
    const validFrom = cert.validity.notBefore;
    const validTo = cert.validity.notAfter;
    const cnpj = extractCnpjFromSubject(subjectAttrs);

    const now = new Date();
    const expirado = validTo.getTime() < now.getTime();
    const naoVigente = validFrom.getTime() > now.getTime();
    const diasRestantes = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // 4. Validações de contexto
    const erros: string[] = [];
    const avisos: string[] = [];

    if (expirado) erros.push(`Certificado expirado em ${validTo.toLocaleDateString("pt-BR")}.`);
    if (naoVigente) erros.push(`Certificado ainda não vigente (válido a partir de ${validFrom.toLocaleDateString("pt-BR")}).`);
    if (!expirado && diasRestantes <= 30) avisos.push(`Certificado expira em ${diasRestantes} dia(s). Providencie a renovação.`);

    if (!ufNorm) erros.push("UF de autorização não informada.");
    else if (!UFS_VALIDAS.has(ufNorm)) erros.push(`UF "${ufNorm}" não é uma UF válida do Brasil.`);

    if (!ambNorm) erros.push("Ambiente SEFAZ não informado.");
    else if (ambNorm !== "homologacao" && ambNorm !== "producao") erros.push(`Ambiente "${ambNorm}" inválido (use homologacao ou producao).`);

    // CNPJ do titular vs CNPJ da empresa cadastrada (quando empresaId fornecido)
    let cnpjEmpresa: string | null = null;
    if (empresaId) {
      const { data: emp } = await admin.from("empresa").select("cnpj").eq("id", empresaId).maybeSingle();
      cnpjEmpresa = digitsOnly(emp?.cnpj || "");
    }
    if (cnpj && cnpjEmpresa && cnpj !== cnpjEmpresa) {
      avisos.push(`CNPJ do certificado (${cnpj}) difere do CNPJ cadastrado em Dados da Empresa (${cnpjEmpresa}). Confirme se é o certificado correto.`);
    }
    if (!cnpj) {
      avisos.push("Não foi possível extrair o CNPJ do certificado automaticamente. Verifique se é um e-CNPJ.");
    }

    const valido = erros.length === 0;
    const status = valido ? (avisos.length ? "valido_com_avisos" : "valido") : "invalido";

    // 5. Persiste resultado
    if (empresaId) {
      await admin.from("empresa").update({
        certificado_a1_validade: validTo.toISOString().slice(0, 10),
        certificado_a1_cnpj: cnpj,
        certificado_a1_titular: titular,
        certificado_a1_emissor: emissor,
        certificado_a1_validado_em: new Date().toISOString(),
        certificado_a1_status: status,
      }).eq("id", empresaId);
    }

    return new Response(JSON.stringify({
      ok: valido,
      status,
      titular,
      emissor,
      cnpj,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      diasRestantes,
      uf: ufNorm,
      ambiente: ambNorm,
      erros,
      avisos,
      podeBuscarSefaz: valido,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("validar-certificado-a1 erro:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message || "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

export default __slot.dispatch;
