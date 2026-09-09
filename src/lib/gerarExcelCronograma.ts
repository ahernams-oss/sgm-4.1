import type { Cronograma } from "@/contexts/CronogramasContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

export async function gerarExcelCronograma(cronograma: Cronograma) {
  const wb = (await getXLSX()).utils.book_new();
  const periodos = cronograma.periodos || [];
  const atividades = cronograma.atividades || [];

  // ===== Aba Resumo =====
  const resumo = [
    ["CRONOGRAMA FÍSICO-FINANCEIRO"],
    [],
    ["Cliente", cronograma.cliente_nome || ""],
    ["Obra", cronograma.obra || ""],
    ["Responsável", cronograma.responsavel || ""],
    ["Status", cronograma.status || ""],
    ["Início", cronograma.data_inicio || ""],
    ["Fim", cronograma.data_fim || ""],
    ["Granularidade", cronograma.granularidade === "mensal" ? "Mensal" : cronograma.granularidade === "quinzenal" ? "Quinzenal" : "Semanal"],
    ["Valor Total", Number(cronograma.valor_total || 0)],
    ["Observações", cronograma.observacoes || ""],
  ];
  const wsResumo = (await getXLSX()).utils.aoa_to_sheet(resumo);
  (await getXLSX()).utils.book_append_sheet(wb, wsResumo, "Resumo");

  // ===== Aba Físico =====
  const headFis = ["#", "Atividade", "Tipo", ...periodos.map(p => p.rotulo), "Total"];
  const bodyFis: any[][] = [headFis];
  atividades.forEach((a, i) => {
    const prev: any[] = [i + 1, a.descricao, "Previsto %"];
    const real: any[] = ["", "", "Realizado %"];
    let tp = 0, tr = 0;
    periodos.forEach(p => {
      const v = a.valores?.[p.rotulo] || { previsto_fisico: 0, realizado_fisico: 0, previsto_financeiro: 0, realizado_financeiro: 0 };
      prev.push(Number(v.previsto_fisico) || 0);
      real.push(Number(v.realizado_fisico) || 0);
      tp += Number(v.previsto_fisico) || 0;
      tr += Number(v.realizado_fisico) || 0;
    });
    prev.push(tp);
    real.push(tr);
    bodyFis.push(prev, real);
  });
  const wsFis = (await getXLSX()).utils.aoa_to_sheet(bodyFis);
  (await getXLSX()).utils.book_append_sheet(wb, wsFis, "Físico (%)");

  // ===== Aba Financeiro =====
  const headFin = ["#", "Atividade", "Tipo", ...periodos.map(p => p.rotulo), "Total"];
  const bodyFin: any[][] = [headFin];
  const tPrevPer: Record<string, number> = {};
  const tRealPer: Record<string, number> = {};
  periodos.forEach(p => { tPrevPer[p.rotulo] = 0; tRealPer[p.rotulo] = 0; });
  let tgPrev = 0, tgReal = 0;
  atividades.forEach((a, i) => {
    const prev: any[] = [i + 1, a.descricao, "Previsto R$"];
    const real: any[] = ["", "", "Realizado R$"];
    let tp = 0, tr = 0;
    periodos.forEach(p => {
      const v = a.valores?.[p.rotulo] || { previsto_fisico: 0, realizado_fisico: 0, previsto_financeiro: 0, realizado_financeiro: 0 };
      const pv = Number(v.previsto_financeiro) || 0;
      const rv = Number(v.realizado_financeiro) || 0;
      prev.push(pv);
      real.push(rv);
      tp += pv; tr += rv;
      tPrevPer[p.rotulo] += pv;
      tRealPer[p.rotulo] += rv;
    });
    prev.push(tp); real.push(tr);
    tgPrev += tp; tgReal += tr;
    bodyFin.push(prev, real);
  });
  const totalP: any[] = ["", "TOTAL", "Previsto R$"];
  const totalR: any[] = ["", "", "Realizado R$"];
  periodos.forEach(p => { totalP.push(tPrevPer[p.rotulo]); totalR.push(tRealPer[p.rotulo]); });
  totalP.push(tgPrev); totalR.push(tgReal);
  bodyFin.push(totalP, totalR);
  const wsFin = (await getXLSX()).utils.aoa_to_sheet(bodyFin);
  (await getXLSX()).utils.book_append_sheet(wb, wsFin, "Financeiro (R$)");

  (await getXLSX()).writeFile(wb, `Cronograma_${cronograma.numero}_${(cronograma.cliente_nome || "").replace(/\s+/g, "_")}.xlsx`, { compression: true });
}
