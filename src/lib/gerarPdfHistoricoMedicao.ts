import { MedicaoServico } from "@/contexts/MedicoesContext";
import { addHeader, addFooter } from "@/lib/gerarRelatorioEstoque";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPerc = (v: number) => `${v.toFixed(2)}%`;

export async function gerarPdfHistoricoMedicao(med: MedicaoServico): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();

  await addHeader(doc, {
    title: `Medição #${med.numero}`,
    subtitle: med.descricao || undefined,
    filters: `Status: ${med.status}`,
  });

  doc.setTextColor(30, 30, 30);
  let y = 50;

  // Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente / Obra:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(med.cliente_nome || "—", 55, y);

  doc.setFont("helvetica", "bold");
  doc.text("Fornecedor:", 110, y);
  doc.setFont("helvetica", "normal");
  doc.text((med as any).fornecedor_nome || "—", 145, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("Contrato:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(med.contrato || "—", 55, y);

  doc.setFont("helvetica", "bold");
  doc.text("Data Pgto:", 110, y);
  doc.setFont("helvetica", "normal");
  doc.text((med as any).data_pagamento || "—", 145, y);
  y += 10;

  // Summary box
  const saldo = (med.valor_total_contratado || 0) - (med.valor_total_medido || 0);
  doc.setFillColor(240, 243, 248);
  doc.roundedRect(14, y, pw - 28, 26, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 107);
  doc.text(`Valor Contratado: ${fmt(med.valor_total_contratado || 0)}`, 20, y + 8);
  doc.text(`Valor Medido: ${fmt(med.valor_total_medido || 0)}`, 90, y + 8);
  doc.text(`% Executado: ${fmtPerc(med.percentual_medido || 0)}`, 155, y + 8);
  doc.setTextColor(saldo < 0 ? 180 : 20, saldo < 0 ? 30 : 110, saldo < 0 ? 30 : 60);
  doc.text(`Saldo (Contratado - Medido): ${fmt(saldo)}`, 20, y + 18);
  doc.setTextColor(30, 58, 107);
  y += 36;

  // Itens do contrato
  doc.setTextColor(30, 58, 107);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Itens do Contrato", 14, y);
  y += 3;

  if (med.itens && med.itens.length > 0) {
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Item", "Unidade", "Qtd Contratada", "Valor Unitário", "Valor Total"]],
      body: med.itens.map((item) => [
        item.descricao,
        item.unidade,
        item.quantidade_contratada.toString(),
        fmt(item.valor_unitario),
        fmt(item.valor_total_contratado),
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("Nenhum item cadastrado.", 14, y);
    y += 10;
  }

  // Histórico de medições
  const ph = doc.internal.pageSize.getHeight();
  if (y + 30 > ph - 30) { doc.addPage(); y = 20; }

  doc.setTextColor(30, 58, 107);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Histórico de Medições", 14, y);
  y += 3;

  if (med.medicoes && med.medicoes.length > 0) {
    (await getAutoTable())(doc, {
      startY: y,
      head: [["#", "Data", "Tipo", "Valor", "%", "Status", "Observação"]],
      body: med.medicoes.map((l) => [
        l.numero.toString(),
        l.data,
        l.tipo === "percentual" ? "Percentual" : "Valor",
        fmt(l.valor_total),
        fmtPerc(l.percentual_total),
        l.status,
        l.observacao || "",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 10 }, 6: { cellWidth: 40 } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Totals row
    const totalValor = med.medicoes.reduce((s, l) => s + (l.valor_total || 0), 0);
    const totalPerc = med.medicoes.reduce((s, l) => s + (l.percentual_total || 0), 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`Total das Medições: ${fmt(totalValor)} | ${fmtPerc(totalPerc)}`, 14, y);
  } else {
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("Nenhuma medição lançada.", 14, y);
  }

  // Footer
  addFooter(doc);

  return doc;
}

export async function downloadPdfHistoricoMedicao(med: MedicaoServico) {
  const doc = await gerarPdfHistoricoMedicao(med);
  doc.save(`Medicao_${med.numero}_Historico.pdf`);
}
