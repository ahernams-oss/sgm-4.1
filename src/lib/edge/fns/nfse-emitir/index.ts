import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
import { exigirAcesso, podeModulo, pode } from "@/lib/edge/permissao";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/edge/cors";
import { BRASILNFE_FISCAL_URL, dataFiscalBrasilNfe, montarPayloadBrasilNfe, interpretarRetornoBrasilNfe } from "@/lib/nfseBrasilNfe";
import { ErroMunicipioNfse, resolverEnderecoMunicipioNfse } from "@/lib/municipioNfse";

const digits = (s: string) => (s || "").replace(/\D+/g, "");
type Modelo = Record<string, any>;

async function consultarStatus(token: string, codLote: string, numero: number) {
  const response = await fetch(`${BRASILNFE_FISCAL_URL}/BuscarNotaFiscalServico`, {
    method: "POST",
    headers: { Token: token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ codLote, Rps: [numero] }),
  });
  if (!response.ok) throw new Error(`Brasil NFe: consulta HTTP ${response.status}`);
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const acesso = await exigirAcesso(req, (c) => podeModulo(c, "financeiro.nfes_recebidas", "faturamentos"));
  if (!acesso.ok) return acesso.resposta;

  try {
    const modelo = await req.json() as Modelo;
    if (!modelo?.empresaId) throw new Error("empresaId é obrigatório");

    const admin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

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

    const token = Deno.env.get("BRASILNFE_TOKEN");
    if (!token) throw new Error("Conexão Brasil NFe não configurada");
    // Resolve recipient/construction addresses before persisting or consuming a DPS number.
    modelo.tomador.endereco = await resolverEnderecoMunicipioNfse(modelo.tomador?.endereco, "tomador");
    if (modelo.servico?.informacoesObra?.enderecoBrasil) {
      modelo.servico.informacoesObra.enderecoBrasil = await resolverEnderecoMunicipioNfse(modelo.servico.informacoesObra.enderecoBrasil, "local da obra");
    }
    // Validate the provider payload before consuming a DPS number.
    montarPayloadBrasilNfe(0, modelo, "validacao", ambienteNum);

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
      data_competencia: modelo.dataCompetencia || dataFiscalBrasilNfe(),
      prestador: modelo.prestador,
      tomador: modelo.tomador,
      servico: modelo.servico,
      tributos: modelo.tributos,
      valor_servico: valor,
      valor_iss: valorIss,
      valor_liquido: valor - (modelo.tributos.issRetido ? valorIss : 0),
    }).select("*").single();
    if (insErr || !inserted) throw new Error("Falha ao gravar rascunho: " + insErr?.message);

    const ref = `nfse-${inserted.id}`;
    const payload = montarPayloadBrasilNfe(inserted.numero_dps, modelo, ref, ambienteNum);
    let retorno: any;
    try {
      const response = await fetch(`${BRASILNFE_FISCAL_URL}/EnviarNotaFiscalServico`, {
        method: "POST",
        headers: { Token: token, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      retorno = await response.json();
      if (!response.ok) {
        const mensagem = retorno?.Error || `Brasil NFe HTTP ${response.status}`;
        await admin.from("nfses_emitidas").update({
          status: "rejeitada", mensagem_retorno: mensagem,
        }).eq("id", inserted.id);
        return new Response(JSON.stringify({ ok: false, id: inserted.id, mensagem }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      const mensagem = "Não foi possível confirmar o envio à Brasil NFe. Consulte a nota no provedor antes de tentar novamente.";
      await admin.from("nfses_emitidas").update({ mensagem_retorno: mensagem }).eq("id", inserted.id);
      return new Response(JSON.stringify({ ok: false, id: inserted.id, status: "processando", mensagem }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resultado = interpretarRetornoBrasilNfe(retorno, ref);
    const codLote = retorno?.CodLote;
    for (let i = 0; i < 6 && resultado.status === "processando" && codLote; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        retorno = await consultarStatus(token, String(codLote), inserted.numero_dps);
        resultado = interpretarRetornoBrasilNfe(retorno, ref);
      } catch { break; } // Keep accepted notes pending; never resend automatically.
    }
    let xmlNfse: string | null = null;
    if (resultado.xmlBase64) {
      try {
        xmlNfse = new TextDecoder().decode(Uint8Array.from(atob(resultado.xmlBase64), c => c.charCodeAt(0)));
      } catch { /* Invalid optional XML does not undo authorization. */ }
    }
    const { error: updateError } = await admin.from("nfses_emitidas").update({
      status: resultado.status, xml_nfse: xmlNfse,
      chave_acesso: resultado.chave,
      protocolo: resultado.protocolo || (codLote ? String(codLote) : null),
      data_emissao: resultado.dataEmissao || (resultado.status === "emitida" ? new Date().toISOString() : null),
      mensagem_retorno: resultado.mensagem,
      ...(resultado.valorIss != null ? { valor_iss: resultado.valorIss } : {}),
      ...(resultado.valorLiquido != null ? { valor_liquido: resultado.valorLiquido } : {}),
    }).eq("id", inserted.id);
    if (updateError) throw new Error("Brasil NFe respondeu, mas não foi possível salvar o retorno. Consulte o provedor antes de reenviar.");

    return new Response(JSON.stringify({
      ok: resultado.status === "emitida", id: inserted.id,
      numero_dps: inserted.numero_dps, status: resultado.status, ref,
      mensagem: resultado.mensagem, chaveAcesso: resultado.chave,
      protocolo: resultado.protocolo, provider: "Brasil NFe",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    if (e instanceof ErroMunicipioNfse) {
      return new Response(JSON.stringify({ ok: false, mensagem: e.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.error("nfse-emitir erro:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

export default __slot.dispatch;
