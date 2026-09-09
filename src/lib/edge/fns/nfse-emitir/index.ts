import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Emissão NFS-e via Focus NFE
// Docs: https://focusnfe.com.br/doc/#nfse
// - POST /v2/nfse?ref={ref}  -> dispara emissão (assíncrona)
// - GET  /v2/nfse/{ref}      -> consulta status
//
// Ambiente: empresa.nfe_ambiente ("homologacao" | "producao") OU modelo.ambiente (2=hom, 1=prod)
// Token: FOCUS_NFE_TOKEN_HOMOLOGACAO / FOCUS_NFE_TOKEN_PRODUCAO (Basic auth com token como user)

import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";

const URL_HOM = "https://homologacao.focusnfe.com.br";
const URL_PROD = "https://api.focusnfe.com.br";

const digits = (s: string) => (s || "").replace(/\D+/g, "");

type Modelo = {
  empresaId: string;
  ambiente?: 1 | 2; // 1=prod, 2=hom (compat com schema antigo)
  serie?: string;
  dataCompetencia?: string;
  faturamentoId?: string | null;
  clienteId?: string | null;
  prestador: {
    cnpj: string; im?: string; razaoSocial: string;
    endereco?: any; regimeTributario?: string; optanteSimples?: boolean;
    codigoMunicipio: string;
  };
  tomador: {
    tipo: "CNPJ" | "CPF" | "EXTERIOR"; documento: string; razaoSocial: string;
    inscricaoMunicipal?: string; email?: string;
    endereco?: { logradouro?: string; numero?: string; complemento?: string;
      bairro?: string; codigoMunicipio?: string; uf?: string; cep?: string; pais?: string };
  };
  servico: {
    descricao: string;
    codigoTributacaoMunicipio: string; // item LC 116
    codigoNbs?: string;
    cnae?: string;
    valorServico: number;
    deducoes?: number;
    descontoIncondicionado?: number;
    descontoCondicionado?: number;
  };
  tributos: {
    aliquotaIss: number; // %
    issRetido: boolean;
    pis?: number; cofins?: number; inss?: number; ir?: number; csll?: number;
  };
  certificadoSenha?: string; // ignorado (Focus gerencia o certificado)
};

function montarPayloadFocus(numero: number, m: Modelo, cnpjEmpresa: string) {
  const dataEmissao = new Date().toISOString().replace(/\.\d+Z$/, "-03:00");
  const valor = Number(m.servico.valorServico) || 0;
  const deducoes = Number(m.servico.deducoes) || 0;
  const descIncond = Number(m.servico.descontoIncondicionado || 0);
  const descCond = Number(m.servico.descontoCondicionado || 0);
  const base = Math.max(0, valor - deducoes - descIncond);
  const aliq = Number(m.tributos.aliquotaIss) || 0;
  const valorIss = +(base * aliq / 100).toFixed(2);
  const end = m.tomador.endereco || {};

  const tomadorDoc: any = {};
  if (m.tomador.tipo === "CNPJ") tomadorDoc.cnpj = digits(m.tomador.documento);
  else if (m.tomador.tipo === "CPF") tomadorDoc.cpf = digits(m.tomador.documento);

  return {
    data_emissao: dataEmissao,
    natureza_operacao: 1, // tributação no município
    prestador: {
      cnpj: cnpjEmpresa,
      inscricao_municipal: m.prestador.im || undefined,
      codigo_municipio: m.prestador.codigoMunicipio,
    },
    tomador: {
      ...tomadorDoc,
      razao_social: m.tomador.razaoSocial,
      email: m.tomador.email || undefined,
      inscricao_municipal: m.tomador.inscricaoMunicipal || undefined,
      endereco: {
        logradouro: end.logradouro || undefined,
        numero: end.numero || "S/N",
        complemento: end.complemento || undefined,
        bairro: end.bairro || undefined,
        codigo_municipio: end.codigoMunicipio || m.prestador.codigoMunicipio,
        uf: end.uf || undefined,
        cep: digits(end.cep || "") || undefined,
      },
    },
    servico: {
      aliquota: aliq,
      discriminacao: m.servico.descricao,
      iss_retido: m.tributos.issRetido ? "true" : "false",
      item_lista_servico: m.servico.codigoTributacaoMunicipio,
      codigo_tributario_municipio: m.servico.codigoTributacaoMunicipio,
      codigo_cnae: m.servico.cnae || undefined,
      codigo_municipio: m.prestador.codigoMunicipio,
      valor_servicos: valor,
      valor_deducoes: deducoes || undefined,
      valor_iss: valorIss,
      base_calculo: base,
      desconto_incondicionado: descIncond || undefined,
      desconto_condicionado: descCond || undefined,
      valor_pis: m.tributos.pis || undefined,
      valor_cofins: m.tributos.cofins || undefined,
      valor_inss: m.tributos.inss || undefined,
      valor_ir: m.tributos.ir || undefined,
      valor_csll: m.tributos.csll || undefined,
    },
  };
}

async function consultarStatus(baseUrl: string, auth: string, ref: string, tentativas = 6, intervaloMs = 1500) {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetch(`${baseUrl}/v2/nfse/${encodeURIComponent(ref)}`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    const txt = await r.text();
    let j: any = null;
    try { j = JSON.parse(txt); } catch {}
    const status = (j?.status || "").toLowerCase();
    if (status && status !== "processando_autorizacao") return { httpStatus: r.status, body: j, raw: txt };
    if (i < tentativas - 1) await new Promise((res) => setTimeout(res, intervaloMs));
  }
  return { httpStatus: 0, body: null, raw: "Tempo de processamento excedido" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const modelo = await req.json() as Modelo;
    if (!modelo?.empresaId) throw new Error("empresaId é obrigatório");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Empresa + ambiente
    const { data: empresa, error: empErr } = await admin
      .from("empresa").select("cnpj, razao_social, nfe_ambiente").eq("id", modelo.empresaId).maybeSingle();
    if (empErr || !empresa) throw new Error("Empresa não encontrada");
    const cnpjEmpresa = digits(empresa.cnpj || "");
    if (cnpjEmpresa.length !== 14) throw new Error("CNPJ da empresa inválido");

    // Determina ambiente: aceita modelo.ambiente (1/2) ou empresa.nfe_ambiente
    let ambienteStr = String(empresa.nfe_ambiente || "homologacao").toLowerCase();
    if (modelo.ambiente === 1) ambienteStr = "producao";
    if (modelo.ambiente === 2) ambienteStr = "homologacao";
    const ambienteNum = ambienteStr === "producao" ? 1 : 2;

    const baseUrl = ambienteStr === "producao" ? URL_PROD : URL_HOM;
    const tokenName = ambienteStr === "producao" ? "FOCUS_NFE_TOKEN_PRODUCAO" : "FOCUS_NFE_TOKEN_HOMOLOGACAO";
    const token = Deno.env.get(tokenName);
    if (!token) throw new Error(`Token ${tokenName} não configurado`);
    const auth = "Basic " + btoa(`${token}:`);

    // 1. Cria rascunho (trigger gera numero_dps)
    const valor = Number(modelo.servico.valorServico) || 0;
    const deducoes = Number(modelo.servico.deducoes) || 0;
    const base = Math.max(0, valor - deducoes - (modelo.servico.descontoIncondicionado || 0));
    const valorIss = +(base * (Number(modelo.tributos.aliquotaIss) || 0) / 100).toFixed(2);
    const serie = modelo.serie || "00001";

    const { data: inserted, error: insErr } = await admin.from("nfses_emitidas").insert({
      empresa_id: modelo.empresaId,
      ambiente: ambienteNum,
      serie,
      status: "processando",
      cliente_id: modelo.clienteId || null,
      faturamento_id: modelo.faturamentoId || null,
      data_competencia: modelo.dataCompetencia || new Date().toISOString().slice(0, 10),
      prestador: modelo.prestador,
      tomador: modelo.tomador,
      servico: modelo.servico,
      tributos: modelo.tributos,
      valor_servico: valor,
      valor_iss: valorIss,
      valor_liquido: valor - (modelo.tributos.issRetido ? valorIss : 0),
    }).select("*").single();
    if (insErr || !inserted) throw new Error("Falha ao gravar rascunho: " + insErr?.message);

    // 2. Monta ref único e envia para Focus
    const ref = `nfse-${inserted.id}`;
    const payload = montarPayloadFocus(inserted.numero_dps, modelo, cnpjEmpresa);

    const postResp = await fetch(`${baseUrl}/v2/nfse?ref=${encodeURIComponent(ref)}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const postText = await postResp.text();
    let postJson: any = null;
    try { postJson = JSON.parse(postText); } catch {}

    // Focus: 202 = aceito, em processamento; 4xx = erro de validação
    if (postResp.status >= 400 && postResp.status !== 422) {
      const msg = postJson?.mensagem || postJson?.erros?.[0]?.mensagem || postText.slice(0, 500);
      await admin.from("nfses_emitidas").update({
        status: "rejeitada",
        mensagem_retorno: `Focus HTTP ${postResp.status}: ${msg}`,
      }).eq("id", inserted.id);
      return new Response(JSON.stringify({
        ok: false, id: inserted.id, httpStatus: postResp.status, mensagem: msg,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Consulta status até autorizada/erro
    const consulta = await consultarStatus(baseUrl, auth, ref);
    const j = consulta.body || {};
    const status = String(j.status || "").toLowerCase();

    let novoStatus: string = "processando";
    let mensagem = j.mensagem || j.mensagem_sefaz || "Em processamento";
    let chave = j.codigo_verificacao || j.numero || null;
    let protocolo = j.numero_rps || j.numero || null;
    let dataEmissao: string | null = j.data_emissao || null;
    let urlDanfse: string | null = j.url || j.caminho_xml_nota_fiscal || null;
    let xmlNfse: string | null = null;

    if (status === "autorizado") {
      novoStatus = "emitida";
      mensagem = "NFS-e autorizada";
      // baixa XML
      try {
        const xmlPath = j.caminho_xml_nota_fiscal;
        if (xmlPath) {
          const xmlUrl = xmlPath.startsWith("http") ? xmlPath : `${baseUrl}${xmlPath}`;
          const xr = await fetch(xmlUrl, { headers: { Authorization: auth } });
          if (xr.ok) xmlNfse = await xr.text();
        }
      } catch (_) { /* opcional */ }
    } else if (status === "cancelado") {
      novoStatus = "cancelada";
    } else if (status === "erro_autorizacao" || status === "rejeitado") {
      novoStatus = "rejeitada";
      mensagem = j.mensagem_sefaz || j.mensagem || "Rejeitada pela prefeitura";
    }

    await admin.from("nfses_emitidas").update({
      status: novoStatus,
      xml_nfse: xmlNfse,
      chave_acesso: chave,
      protocolo,
      data_emissao: dataEmissao || (novoStatus === "emitida" ? new Date().toISOString() : null),
      url_danfse: urlDanfse,
      mensagem_retorno: mensagem,
    }).eq("id", inserted.id);

    return new Response(JSON.stringify({
      ok: novoStatus === "emitida",
      id: inserted.id,
      numero_dps: inserted.numero_dps,
      status: novoStatus,
      ref,
      mensagem,
      chaveAcesso: chave,
      protocolo,
      url: urlDanfse,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("nfse-emitir erro:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

export default __slot.dispatch;
