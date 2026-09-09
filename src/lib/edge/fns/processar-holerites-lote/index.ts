import { createDenoSlot } from "@/lib/edge/deno-shim";
const __slot = createDenoSlot();
const serve = __slot.serve;
const Deno = __slot.Deno;
// Recebe PDF consolidado de holerites (base64), quebra por página,
// usa IA para extrair CPF/nome/tipo/valor e casa com funcionários.

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

const VAZIO = {
  cpf: null as string | null, nome: null as string | null, tipo: "folha",
  valor_liquido: null as number | null, salario_base: null as number | null,
  horas_trabalhadas: null as number | null, horas_extras: null as number | null,
  valor_horas_extras: null as number | null, total_proventos: null as number | null,
  total_descontos: null as number | null,
};

const num = (v: any) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  let s = String(v).replace(/[R$\s]/gi, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
};

async function extractComIA(pdfBase64: string, mes: number, ano: number) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const prompt = `Este é um holerite (contracheque) de UM único funcionário referente à competência ${mes.toString().padStart(2, "0")}/${ano}.
Extraia estas informações e retorne APENAS um JSON válido, sem markdown:
{"cpf":"somente dígitos","nome":"nome completo","tipo":"folha|13o|ferias|rescisao|outros","valor_liquido":numero,"salario_base":numero,"horas_trabalhadas":numero,"horas_extras":numero,"valor_horas_extras":numero,"total_proventos":numero,"total_descontos":numero}

Regras:
- Se o documento mencionar "Rescisão" ou "TRCT" → tipo "rescisao".
- Se mencionar "13º", "Décimo Terceiro" ou "Gratificação Natalina" → tipo "13o".
- Se mencionar "Férias" (recibo de férias) → tipo "ferias".
- Caso contrário → tipo "folha".
- valor_liquido é o LÍQUIDO A RECEBER (valor final que o funcionário recebe).
- A tabela de eventos tem as colunas: CÓDIGO, DESCRIÇÃO, REFERÊNCIA, VENCIMENTOS (proventos) e DESCONTOS.
- salario_base = valor da coluna VENCIMENTOS da linha cuja DESCRIÇÃO é "Horas Normais" (ou "Salário Normal"/"Horas Trabalhadas").
- horas_trabalhadas = valor da coluna REFERÊNCIA dessa MESMA linha de "Horas Normais" (ex.: 220,00).
- horas_extras = SOMA dos valores da coluna REFERÊNCIA de TODAS as linhas cuja DESCRIÇÃO contenha "Horas Extras" (50%, 100%, etc.).
- valor_horas_extras = SOMA dos valores da coluna VENCIMENTOS dessas mesmas linhas de "Horas Extras".
- total_proventos = valor do campo "Total de Vencimentos" (rodapé do holerite).
- total_descontos = valor do campo "Total de Descontos" (rodapé do holerite).
- Números decimais com ponto, sem separador de milhar e sem "R$" (ex.: "1.234,56" → 1234.56).
- Se não encontrar algum campo, use null.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
        ],
      }],
      temperature: 0,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error("IA err:", resp.status, t);
    return { ...VAZIO };
  }
  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) return { ...VAZIO };
  try {
    const parsed = JSON.parse(m[0]);
    return {
      cpf: parsed.cpf ? onlyDigits(String(parsed.cpf)) : null,
      nome: parsed.nome ?? null,
      tipo: ["folha", "13o", "ferias", "rescisao", "outros"].includes(parsed.tipo) ? parsed.tipo : "folha",
      valor_liquido: num(parsed.valor_liquido),
      salario_base: num(parsed.salario_base),
      horas_trabalhadas: num(parsed.horas_trabalhadas),
      horas_extras: num(parsed.horas_extras),
      valor_horas_extras: num(parsed.valor_horas_extras),
      total_proventos: num(parsed.total_proventos),
      total_descontos: num(parsed.total_descontos),
    };
  } catch {
    return { ...VAZIO };
  }
}


// ---------- EXCEL ----------
const norm = (s: any) => String(s ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ASCII = (s: any) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");

const COLMAP: Record<string, string[]> = {
  cpf: ["cpf", "cpf funcionario", "documento"],
  nome: ["nome", "nome funcionario", "funcionario", "colaborador", "empregado"],
  tipo: ["tipo", "tipo holerite", "tipo documento"],
  valor_liquido: ["valor liquido", "liquido", "liquido a receber", "total liquido"],
  salario_base: ["salario base", "salario", "horas normais", "vencimento base"],
  horas_trabalhadas: ["horas", "horas trabalhadas", "horas normais ref", "referencia horas"],
  horas_extras: ["horas extras", "he", "qtd horas extras"],
  valor_horas_extras: ["valor horas extras", "valor he", "vlr horas extras"],
  total_proventos: ["proventos", "total proventos", "total de vencimentos", "vencimentos"],
  total_descontos: ["descontos", "total descontos", "total de descontos"],
};

function mapHeaders(headers: any[]) {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    for (const [campo, alias] of Object.entries(COLMAP)) {
      if (idx[campo] !== undefined) continue;
      if (alias.some((a) => n === a || n.includes(a))) idx[campo] = i;
    }
  });
  return idx;
}

function tipoDe(v: any) {
  const n = norm(v);
  if (!n) return "folha";
  if (n.includes("rescis") || n.includes("trct")) return "rescisao";
  if (n.includes("13") || n.includes("decimo") || n.includes("natalina")) return "13o";
  if (n.includes("feria")) return "ferias";
  if (n.includes("folha") || n.includes("mensal")) return "folha";
  return "outros";
}

function lerExcel(b64: string) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const wb = XLSX.read(bin, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  // localiza a linha de cabeçalho (a primeira que mapeia cpf ou nome)
  let hIdx = -1;
  let idx: Record<string, number> = {};
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const m = mapHeaders(linhas[i] || []);
    if (m.cpf !== undefined || m.nome !== undefined) { hIdx = i; idx = m; break; }
  }
  if (hIdx < 0) throw new Error("Não foi possível identificar as colunas (CPF/Nome) na planilha.");
  const get = (row: any[], campo: string) => (idx[campo] === undefined ? null : row[idx[campo]]);
  const registros = [];
  for (let i = hIdx + 1; i < linhas.length; i++) {
    const row = linhas[i] || [];
    const cpf = onlyDigits(String(get(row, "cpf") ?? ""));
    const nome = get(row, "nome") ? String(get(row, "nome")).trim() : null;
    if (!cpf && !nome) continue;
    registros.push({
      cpf: cpf || null,
      nome,
      tipo: tipoDe(get(row, "tipo")),
      valor_liquido: num(get(row, "valor_liquido")),
      salario_base: num(get(row, "salario_base")),
      horas_trabalhadas: num(get(row, "horas_trabalhadas")),
      horas_extras: num(get(row, "horas_extras")),
      valor_horas_extras: num(get(row, "valor_horas_extras")),
      total_proventos: num(get(row, "total_proventos")),
      total_descontos: num(get(row, "total_descontos")),
    });
  }
  return registros;
}

const moneyBR = (v: number | null) =>
  v == null ? "-" : "R$ " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, "#").replace(/\./g, ",").replace(/#/g, ".");

async function pdfDoRegistro(r: any, mes: number, ano: number) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 790;
  const t = (txt: string, size = 10, f = font) => { page.drawText(ASCII(txt), { x: 45, y, size, font: f, color: rgb(0, 0, 0) }); y -= size + 6; };
  t(`RECIBO DE PAGAMENTO - ${String(mes).padStart(2, "0")}/${ano}`, 14, bold);
  y -= 6;
  t(`Funcionario: ${r.nome ?? "-"}`, 11, bold);
  t(`CPF: ${r.cpf ?? "-"}`);
  t(`Tipo: ${r.tipo}`);
  y -= 8;
  t("DEMONSTRATIVO", 11, bold);
  t(`Salario base: ${moneyBR(r.salario_base)}`);
  t(`Horas trabalhadas: ${r.horas_trabalhadas ?? "-"}`);
  t(`Horas extras: ${r.horas_extras ?? "-"}  |  Valor: ${moneyBR(r.valor_horas_extras)}`);
  t(`Total de vencimentos: ${moneyBR(r.total_proventos)}`);
  t(`Total de descontos: ${moneyBR(r.total_descontos)}`);
  y -= 6;
  t(`VALOR LIQUIDO: ${moneyBR(r.valor_liquido)}`, 13, bold);
  const bytes = await doc.save();
  let b64 = "";
  const CH = 0x8000;
  for (let k = 0; k < bytes.length; k += CH) b64 += String.fromCharCode(...bytes.subarray(k, k + CH));
  return btoa(b64);
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      pdfBase64, arquivo_nome, competencia_mes, competencia_ano,
      importado_por, importado_por_nome,
    } = body;
    // Processamento em blocos para não estourar o limite de 150s da edge function.
    const inicio: number = Number(body.inicio ?? 0);       // índice da 1ª página (0-based)
    const tamanho: number = Math.min(Number(body.tamanho ?? 4), body.excelBase64 ? 50 : 6);
    let loteId: string | null = body.lote_id ?? null;

    const excelBase64: string | null = body.excelBase64 ?? null;
    const modo: "pdf" | "excel" = excelBase64 ? "excel" : "pdf";

    if ((!pdfBase64 && !excelBase64) || !competencia_mes || !competencia_ano) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Decode fonte (PDF consolidado ou planilha Excel)
    let srcDoc: any = null;
    let registrosExcel: any[] = [];
    let totalPages = 0;
    if (modo === "excel") {
      registrosExcel = lerExcel(excelBase64!);
      totalPages = registrosExcel.length;
      if (!totalPages) throw new Error("Nenhuma linha de funcionário encontrada na planilha.");
    } else {
      const bin = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      srcDoc = await PDFDocument.load(bin);
      totalPages = srcDoc.getPageCount();
    }

    // Cria lote (apenas na primeira chamada)
    if (!loteId) {
      // Reimportação da MESMA competência = atualização: remove lotes/itens anteriores
      const { data: antigos } = await supabase
        .from("portal_holerites_import_lote")
        .select("id")
        .eq("competencia_mes", competencia_mes)
        .eq("competencia_ano", competencia_ano);
      const ids = (antigos || []).map((l: any) => l.id);
      if (ids.length) {
        await supabase.from("portal_holerites_import_item").delete().in("lote_id", ids);
        await supabase.from("portal_holerites_import_lote").delete().in("id", ids);
      }

      const { data: lote, error: loteErr } = await supabase
        .from("portal_holerites_import_lote")
        .insert({
          arquivo_nome, competencia_mes, competencia_ano,
          total_paginas: totalPages, status: "conferencia",
          importado_por, importado_por_nome,
        })
        .select("id").single();
      if (loteErr) throw loteErr;
      loteId = lote.id;
    }

    // Carrega funcionarios (para matching)
    const { data: funcs } = await supabase
      .from("funcionarios")
      .select("id, nome, cpf, status")
      .in("status", ["Ativo", "ativo", "ATIVO"]);
    const byCpf = new Map<string, any[]>();
    (funcs || []).forEach((f: any) => {
      const c = onlyDigits(f.cpf || "");
      if (!c) return;
      const arr = byCpf.get(c) || [];
      arr.push(f);
      byCpf.set(c, arr);
    });

    const fim = Math.min(inicio + tamanho, totalPages);
    const indices: number[] = [];
    for (let i = inicio; i < fim; i++) indices.push(i);

    // Processa páginas/linhas do bloco em paralelo
    const items = await Promise.all(indices.map(async (i) => {
      if (modo === "excel") {
        const r = registrosExcel[i];
        const b64x = await pdfDoRegistro(r, competencia_mes, competencia_ano);
        let funcionario_id: string | null = null;
        let status_match = "nao_encontrado";
        if (r.cpf) {
          const matches = byCpf.get(r.cpf) || [];
          if (matches.length === 1) { funcionario_id = matches[0].id; status_match = "auto"; }
          else if (matches.length > 1) { status_match = "ambiguo"; }
        }
        return {
          lote_id: loteId, pagina: i + 1,
          cpf_detectado: r.cpf, nome_detectado: r.nome,
          funcionario_id, tipo: r.tipo, valor_liquido: r.valor_liquido,
          salario_base: r.salario_base,
          horas_trabalhadas: r.horas_trabalhadas,
          horas_extras: r.horas_extras,
          valor_horas_extras: r.valor_horas_extras,
          total_proventos: r.total_proventos,
          total_descontos: r.total_descontos,
          status_match, pdf_pagina_base64: b64x,
        };
      }
      const singleDoc = await PDFDocument.create();
      const [pg] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(pg);
      const bytes = await singleDoc.save();
      let b64 = "";
      const CH = 0x8000;
      for (let k = 0; k < bytes.length; k += CH) {
        b64 += String.fromCharCode(...bytes.subarray(k, k + CH));
      }
      b64 = btoa(b64);

      const extracted = await extractComIA(b64, competencia_mes, competencia_ano);

      let funcionario_id: string | null = null;
      let status_match = "nao_encontrado";
      if (extracted.cpf) {
        const matches = byCpf.get(extracted.cpf) || [];
        if (matches.length === 1) { funcionario_id = matches[0].id; status_match = "auto"; }
        else if (matches.length > 1) { status_match = "ambiguo"; }
      }

      return {
        lote_id: loteId, pagina: i + 1,
        cpf_detectado: extracted.cpf, nome_detectado: extracted.nome,
        funcionario_id, tipo: extracted.tipo, valor_liquido: extracted.valor_liquido,
        salario_base: extracted.salario_base,
        horas_trabalhadas: extracted.horas_trabalhadas,
        horas_extras: extracted.horas_extras,
        valor_horas_extras: extracted.valor_horas_extras,
        total_proventos: extracted.total_proventos,
        total_descontos: extracted.total_descontos,
        status_match, pdf_pagina_base64: b64,
      };
    }));

    if (items.length) {
      const { error: itErr } = await supabase.from("portal_holerites_import_item").insert(items);
      if (itErr) throw itErr;
    }

    return new Response(JSON.stringify({
      lote_id: loteId,
      total: totalPages,
      processadas: fim,
      concluido: fim >= totalPages,
      proximo_inicio: fim,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

export default __slot.dispatch;
