import { MedicaoServico } from "@/contexts/MedicoesContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function downloadExcelHistoricoMedicao(med: MedicaoServico) {
  const wb = (await getXLSX()).utils.book_new();

  // Resumo
  const resumo: any[][] = [
    [`Medição #${med.numero} — ${med.descricao || ""}`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Campo", "Valor"],
    ["Cliente / Obra", med.cliente_nome || ""],
    ["Fornecedor", (med as any).fornecedor_nome || ""],
    ["Contrato", med.contrato || ""],
    ["Status", med.status],
    ["Valor Contratado", med.valor_total_contratado || 0],
    ["Valor Medido", med.valor_total_medido || 0],
    ["Saldo (Contratado - Medido)", (med.valor_total_contratado || 0) - (med.valor_total_medido || 0)],
    ["% Executado", (med.percentual_medido || 0) / 100],
    ["Data Pagamento", (med as any).data_pagamento || ""],
    ["Observações", med.observacoes || ""],
  ];
  const wsResumo = (await getXLSX()).utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [{ wch: 20 }, { wch: 30 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsResumo, "Resumo");

  const fornecedor = (med as any).fornecedor_nome || "";

  // Itens
  const itensData: any[][] = [
    [`Fornecedor: ${fornecedor}`],
    ["Item", "Unidade", "Qtd Contratada", "Valor Unitário", "Valor Total"],
    ...(med.itens || []).map((item) => [
      item.descricao,
      item.unidade,
      item.quantidade_contratada,
      item.valor_unitario,
      item.valor_total_contratado,
    ]),
  ];
  const wsItens = (await getXLSX()).utils.aoa_to_sheet(itensData);
  wsItens["!cols"] = [{ wch: 35 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsItens, "Itens");

  // Histórico
  const histData: any[][] = [
    [`Fornecedor: ${fornecedor}`],
    ["#", "Data", "Tipo", "Valor", "%", "Status", "Observação"],
    ...(med.medicoes || []).map((l) => [
      l.numero,
      l.data,
      l.tipo === "percentual" ? "Percentual" : "Valor",
      l.valor_total,
      (l.percentual_total || 0) / 100,
      l.status,
      l.observacao || "",
    ]),
  ];
  const wsHist = (await getXLSX()).utils.aoa_to_sheet(histData);
  wsHist["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsHist, "Histórico");

  (await getXLSX()).writeFile(wb, `Medicao_${med.numero}_Historico.xlsx`, { compression: true });
}
