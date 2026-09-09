import type { Eventograma } from "@/contexts/EventogramasContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const fmtDate = (s?: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

export async function gerarExcelEventograma(ev: Eventograma) {
  const wb = (await getXLSX()).utils.book_new();

  const cabec = [
    ["EVENTOGRAMA"],
    ["Número", ev.numero],
    ["Cliente", ev.cliente_nome],
    ["Obra", ev.obra],
    ["Descrição", ev.descricao],
    ["Responsável", ev.responsavel],
    ["Contrato", ev.contrato_numero],
    ["Assinatura", fmtDate(ev.data_assinatura)],
    ["Valor total", ev.valor_total],
    ["Status", ev.status],
    [],
  ];

  const head = ["#", "Marco", "Descrição", "Prazo", "Data prevista", "% Contrato", "Valor", "Critério de medição", "Status", "Data realizada", "Observação"];
  const rows = (ev.eventos || []).map((e) => [
    e.ordem, e.marco, e.descricao, e.prazo, fmtDate(e.data_prevista),
    Number(e.percentual) || 0, Number(e.valor) || 0,
    e.criterio_medicao, e.status, fmtDate(e.data_realizada), e.observacao,
  ]);

  const ws = (await getXLSX()).utils.aoa_to_sheet([...cabec, head, ...rows]);
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Eventograma");
  (await getXLSX()).writeFile(wb, `eventograma-${ev.numero}.xlsx`, { compression: true });
}
