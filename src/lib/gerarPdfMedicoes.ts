import { MedicaoServico } from "@/contexts/MedicoesContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function gerarPdfMedicoes(medicoes: MedicaoServico[], filterLabel?: string): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Medição de Serviços e Obras — Engenharia e Manutenção", 14, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 22);
  doc.text(`Total: ${medicoes.length} medições`, pw - 14, 14, { align: "right" });

  const totalContratado = medicoes.reduce((s, m) => s + (m.valor_total_contratado || 0), 0);
  const totalMedido = medicoes.reduce((s, m) => s + (m.valor_total_medido || 0), 0);
  doc.text(`Contratado: ${fmt(totalContratado)}  |  Medido: ${fmt(totalMedido)}`, pw - 14, 22, { align: "right" });

  // Filter info
  if (filterLabel && filterLabel !== "Sem filtros aplicados") {
    doc.setFontSize(8);
    doc.text(`Filtros: ${filterLabel}`, 14, 30);
  }

  doc.setTextColor(30, 30, 30);
  let y = 44;

  // Summary by status
  const statusCounts: Record<string, { count: number; contratado: number; medido: number }> = {};
  medicoes.forEach((m) => {
    if (!statusCounts[m.status]) statusCounts[m.status] = { count: 0, contratado: 0, medido: 0 };
    statusCounts[m.status].count += 1;
    statusCounts[m.status].contratado += m.valor_total_contratado || 0;
    statusCounts[m.status].medido += m.valor_total_medido || 0;
  });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 107);
  doc.text("Resumo por Status", 14, y);
  y += 3;

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Status", "Qtd", "Valor Contratado", "Valor Medido"]],
    body: Object.entries(statusCounts).map(([s, v]) => [
      s, v.count.toString(), fmt(v.contratado), fmt(v.medido),
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Detail table
  const ph = doc.internal.pageSize.getHeight();
  if (y + 30 > ph - 30) { doc.addPage(); y = 20; }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 107);
  doc.text("Lista Detalhada das Medições", 14, y);
  y += 3;

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Nº", "Cliente / Obra", "Fornecedor", "Contrato", "Descrição", "Status", "Contratado", "Medido", "% Exec.", "Data Pgto"]],
    body: medicoes.map((m) => [
      m.numero.toString(),
      m.cliente_nome || "",
      (m as any).fornecedor_nome || "",
      m.contrato || "",
      m.descricao || "",
      m.status,
      fmt(m.valor_total_contratado || 0),
      fmt(m.valor_total_medido || 0),
      `${(m.percentual_medido || 0).toFixed(1)}%`,
      (m as any).data_pagamento || "",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 12 }, 4: { cellWidth: 45 } },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.line(14, h - 18, pw - 14, h - 18);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório gerado automaticamente — Engenharia e Manutenção — SGM Lasant", 14, h - 12);
    doc.text(`Página ${i} de ${pages}`, pw / 2, h - 12, { align: "center" });
  }

  return doc;
}

export async function downloadPdfMedicoes(medicoes: MedicaoServico[], filterLabel?: string) {
  const doc = await gerarPdfMedicoes(medicoes, filterLabel);
  doc.save(`Relatorio_Medicoes_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
}
