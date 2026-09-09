import { MedicaoServico } from "@/contexts/MedicoesContext";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function gerarExcelMedicoes(medicoes: MedicaoServico[], filterLabel?: string): Promise<XLSXTypes.WorkBook> {
  const wb = (await getXLSX()).utils.book_new();

  // Resumo sheet
  const statusCounts: Record<string, { count: number; contratado: number; medido: number }> = {};
  medicoes.forEach((m) => {
    if (!statusCounts[m.status]) statusCounts[m.status] = { count: 0, contratado: 0, medido: 0 };
    statusCounts[m.status].count += 1;
    statusCounts[m.status].contratado += m.valor_total_contratado || 0;
    statusCounts[m.status].medido += m.valor_total_medido || 0;
  });

  const resumoData: any[][] = [
    ["Relatório de Medição de Serviços e Obras"],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [`Total de medições: ${medicoes.length}`],
    [`Filtros: ${filterLabel || "Sem filtros aplicados"}`],
    [],
    ["Status", "Quantidade", "Valor Contratado", "Valor Medido"],
    ...Object.entries(statusCounts).map(([s, v]) => [s, v.count, v.contratado, v.medido]),
  ];
  const wsResumo = (await getXLSX()).utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Detalhes sheet
  const detalhesData = [
    ["Nº", "Cliente / Obra", "Fornecedor", "Contrato", "Descrição", "Status", "Valor Contratado", "Valor Medido", "% Executado", "Data Pagamento", "Data Lançamento", "Observações"],
    ...medicoes.map((m) => [
      m.numero,
      m.cliente_nome || "",
      (m as any).fornecedor_nome || "",
      m.contrato || "",
      m.descricao || "",
      m.status,
      m.valor_total_contratado || 0,
      m.valor_total_medido || 0,
      (m.percentual_medido || 0) / 100,
      (m as any).data_pagamento || "",
      m.created_at ? new Date(m.created_at).toLocaleDateString("pt-BR") : "",
      m.observacoes || "",
    ]),
  ];
  const wsDetalhes = (await getXLSX()).utils.aoa_to_sheet(detalhesData);
  wsDetalhes["!cols"] = [
    { wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 30 },
    { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
  ];
  (await getXLSX()).utils.book_append_sheet(wb, wsDetalhes, "Detalhes");

  // Itens sheet
  const itensRows: any[][] = [["Medição Nº", "Item", "Unidade", "Qtd Contratada", "Valor Unitário", "Valor Total"]];
  medicoes.forEach((m) => {
    (m.itens || []).forEach((item) => {
      itensRows.push([
        m.numero,
        item.descricao,
        item.unidade,
        item.quantidade_contratada,
        item.valor_unitario,
        item.valor_total_contratado,
      ]);
    });
  });
  const wsItens = (await getXLSX()).utils.aoa_to_sheet(itensRows);
  wsItens["!cols"] = [{ wch: 10 }, { wch: 35 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsItens, "Itens");

  return wb;
}

export async function downloadExcelMedicoes(medicoes: MedicaoServico[], filterLabel?: string) {
  const wb = await gerarExcelMedicoes(medicoes, filterLabel);
  (await getXLSX()).writeFile(wb, `Relatorio_Medicoes_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`, { compression: true });
}
