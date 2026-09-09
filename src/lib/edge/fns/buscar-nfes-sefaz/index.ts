import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";
import forge from "node-forge";

// Códigos IBGE das UFs (cUF)
const CUF: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
  ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
  RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
};

const URL_HOM = "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const URL_PROD = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";

function digitsOnly(s: string) { return (s || "").replace(/\D+/g, ""); }

function pickFirst(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function pickAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const { empresaId, ultNSU } = body || {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Carrega dados da empresa
    if (!empresaId) return json({ ok: false, error: "empresaId obrigatório" }, 400);
    const { data: emp, error: empErr } = await admin
      .from("empresa")
      .select("cnpj, certificado_a1_url, nfe_ambiente, nfe_uf_autor")
      .eq("id", empresaId)
      .maybeSingle();
    if (empErr || !emp) return json({ ok: false, error: "Empresa não encontrada" }, 404);

    const { data: cred } = await admin
      .from("empresa_credenciais")
      .select("certificado_a1_senha")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    const certSenha = cred?.certificado_a1_senha as string | null;

    const cnpj = digitsOnly(emp.cnpj || "");
    if (cnpj.length !== 14) return json({ ok: false, error: "CNPJ da empresa inválido (precisa ter 14 dígitos)." }, 400);

    const uf = String(emp.nfe_uf_autor || "").toUpperCase().trim();
    if (!CUF[uf]) return json({ ok: false, error: `UF "${uf}" inválida. Configure UF de autorização nos Dados da Empresa.` }, 400);

    const ambiente = String(emp.nfe_ambiente || "homologacao").toLowerCase();
    const tpAmb = ambiente === "producao" ? "1" : "2";
    const url = ambiente === "producao" ? URL_PROD : URL_HOM;

    if (!emp.certificado_a1_url) return json({ ok: false, error: "Certificado A1 não enviado." }, 400);
    if (!certSenha) return json({ ok: false, error: "Senha do certificado não configurada." }, 400);

    // 2. Baixa e decodifica o .pfx
    const { data: file, error: dlErr } = await admin.storage
      .from("certificados-digitais")
      .download(emp.certificado_a1_url);
    if (dlErr || !file) return json({ ok: false, error: `Falha ao baixar certificado: ${dlErr?.message}` }, 400);

    const buf = new Uint8Array(await file.arrayBuffer());
    const binary = String.fromCharCode(...buf);
    const p12Asn1 = forge.asn1.fromDer(binary, false);

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, certSenha);
    } catch {
      return json({ ok: false, error: "Senha do certificado incorreta." }, 400);
    }

    // 3. Extrai cert + key em PEM
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const keyBags = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])
      .concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []);
    if (!certBags.length || !keyBags.length) {
      return json({ ok: false, error: "Certificado ou chave privada não encontrados no .pfx." }, 400);
    }
    const certPem = forge.pki.certificateToPem(certBags[0].cert!);
    const keyPem = forge.pki.privateKeyToPem(keyBags[0].key!);

    // 4. Monta envelope SOAP NFeDistribuicaoDFe (operação distNSU)
    const ultNSUstr = String(ultNSU ?? "000000000000000").padStart(15, "0");
    const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
  <soap12:Body>
    <nfe:nfeDistDFeInteresse>
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${CUF[uf]}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${ultNSUstr}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfe:nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

    // 5. Cria HTTP client com mTLS (certificado cliente)
    let client: any;
    try {
      // @ts-ignore - createHttpClient está disponível no Supabase Edge Runtime
      client = Deno.createHttpClient({ cert: certPem, key: keyPem });
    } catch (e) {
      return json({
        ok: false,
        error: "Edge Runtime não suporta mTLS com certificado cliente neste ambiente.",
        detail: (e as Error).message,
      }, 500);
    }

    // 6. POST para a SEFAZ
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        // @ts-ignore - opção client é suportada quando há createHttpClient
        client,
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "SOAPAction": "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse",
        },
        body: soap,
      });
    } catch (e) {
      return json({
        ok: false,
        error: `Falha ao conectar na SEFAZ: ${(e as Error).message}`,
        url,
        ambiente,
      }, 502);
    } finally {
      try { client.close?.(); } catch { /* ignore */ }
    }

    const xmlResp = await resp.text();
    const cStat = pickFirst(xmlResp, "cStat");
    const xMotivo = pickFirst(xmlResp, "xMotivo");
    const dhResp = pickFirst(xmlResp, "dhResp");
    const ultNSUret = pickFirst(xmlResp, "ultNSU");
    const maxNSU = pickFirst(xmlResp, "maxNSU");
    const docs = pickAll(xmlResp, "docZip");

    return json({
      ok: resp.ok && cStat !== null,
      httpStatus: resp.status,
      ambiente,
      uf,
      url,
      cStat,
      xMotivo,
      dhResp,
      ultNSU: ultNSUret,
      maxNSU,
      totalDocumentos: docs.length,
      // Amostra do XML (primeiros 4000 chars) para inspeção
      xmlPreview: xmlResp.slice(0, 4000),
    });
  } catch (e) {
    console.error("buscar-nfes-sefaz erro:", e);
    return json({ ok: false, error: (e as Error).message || "Erro inesperado" }, 500);
  }
});

export default __slot.dispatch;
