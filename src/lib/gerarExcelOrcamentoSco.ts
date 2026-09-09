import type { OrcamentoSco } from "@/contexts/OrcamentosScoContext";
import { supabase } from "@/integrations/supabase/client";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

async function loadComps(codes: string[]) {
  if (!codes.length) return {} as Record<string, any[]>;
  const { data: comps } = await (supabase as any).from("sco_composicoes").select("*").in("servico_codigo", codes);
  const elem = Array.from(new Set((comps || []).map((c: any) => c.elementar_codigo)));
  let precos: Record<string, number> = {};
  if (elem.length) {
    const { data: els } = await (supabase as any).from("sco_elementares").select("codigo,preco").in("codigo", elem);
    precos = Object.fromEntries((els || []).map((e: any) => [e.codigo, Number(e.preco || 0)]));
  }
  const g: Record<string, any[]> = {};
  for (const c of comps || []) (g[c.servico_codigo] ||= []).push({ ...c, elementar_preco: precos[c.elementar_codigo] || 0 });
  return g;
}

export async function gerarExcelOrcamentoSco(orc: OrcamentoSco) {
  const wb = (await getXLSX()).utils.book_new();

  // resumo
  const resumo = [
    ["Orçamento SCO Nº", orc.numero],
    ["Título", orc.titulo],
    ["Cliente", orc.cliente_nome || ""],
    ["Obra", orc.obra || ""],
    ["Tipo", orc.tipo_analise],
    ["BDI (%)", orc.bdi],
    ["Desconto (%)", orc.desconto],
    ["Subtotal", orc.subtotal],
    ["Valor Total", orc.valor_total],
    ["Observações", orc.observacoes || ""],
  ];
  (await getXLSX()).utils.book_append_sheet(wb, (await getXLSX()).utils.aoa_to_sheet(resumo), "Resumo");

  // sintético
  const sint = [["Código", "Descrição", "Un", "Qtd", "Unit.", "Total"]];
  for (const i of orc.itens) sint.push([i.servico_codigo, i.descricao, i.unidade, i.quantidade, i.preco_unit, i.preco_total] as any);
  (await getXLSX()).utils.book_append_sheet(wb, (await getXLSX()).utils.aoa_to_sheet(sint), "Sintético");

  if (orc.tipo_analise === "analitica") {
    const grouped = await loadComps(orc.itens.map((i) => i.servico_codigo));
    const ana: any[][] = [["Serviço Cód.", "Serviço Desc.", "Qtd Serv.", "Elementar Cód.", "Elementar Desc.", "Un", "Qtd Unit.", "Qtd Total", "Preço Unit.", "Subtotal"]];
    for (const item of orc.itens) {
      const comps = grouped[item.servico_codigo] || [];
      if (!comps.length) ana.push([item.servico_codigo, item.descricao, item.quantidade, "—", "(sem composição)", "", 0, 0, 0, 0]);
      for (const c of comps) {
        const qtdT = Number(c.quantidade) * Number(item.quantidade);
        ana.push([item.servico_codigo, item.descricao, item.quantidade, c.elementar_codigo, c.elementar_descricao, c.unidade, Number(c.quantidade), qtdT, c.elementar_preco, qtdT * c.elementar_preco]);
      }
    }
    (await getXLSX()).utils.book_append_sheet(wb, (await getXLSX()).utils.aoa_to_sheet(ana), "Analítico");
  }

  (await getXLSX()).writeFile(wb, `Orcamento_SCO_${orc.numero}_${orc.tipo_analise}.xlsx`, { compression: true });
}
