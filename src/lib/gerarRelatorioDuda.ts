import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, BorderStyle, AlignmentType } from "docx";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

export interface ReportData {
  titulo: string;
  colunas: string[];
  dados: string[][];
  resumo?: string;
}

export async function gerarPdfDuda(report: ReportData) {
  const doc = new (await getJsPDF())({ compress: true, orientation: report.colunas.length > 6 ? "landscape" : "portrait" });
  const pw = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(report.titulo, 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pw - 14, 12, { align: "right" });
  if (report.resumo) doc.text(report.resumo, 14, 22);
  doc.text(`Total: ${report.dados.length} registros`, pw - 14, 22, { align: "right" });
  doc.setTextColor(30, 30, 30);

  (await getAutoTable())(doc, {
    startY: 34,
    head: [report.colunas],
    body: report.dados,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  // Footer
  const pages = doc.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
    doc.text("Gerado por Duda - Assistente SGM", 14, ph - 8);
  }

  doc.save(`${report.titulo.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export async function gerarExcelDuda(report: ReportData) {
  const data = report.dados.map(row => {
    const obj: Record<string, string> = {};
    report.colunas.forEach((col, i) => { obj[col] = row[i] || ""; });
    return obj;
  });
  const ws = (await getXLSX()).utils.json_to_sheet(data);
  ws["!cols"] = report.colunas.map(() => ({ wch: 20 }));
  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, report.titulo.substring(0, 31));
  (await getXLSX()).writeFile(wb, `${report.titulo.replace(/\s+/g, "_").toLowerCase()}.xlsx`, { compression: true });
}

export async function gerarWordDuda(report: ReportData) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const headerRow = new TableRow({
    children: report.colunas.map(col =>
      new TableCell({
        borders,
        children: [new Paragraph({ children: [new TextRun({ text: col, bold: true, font: "Arial", size: 20, color: "FFFFFF" })] })],
        shading: { fill: "1E3A6B", type: "clear" as any },
      })
    ),
  });

  const dataRows = report.dados.map(row =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          borders,
          children: [new Paragraph({ children: [new TextRun({ text: cell || "", font: "Arial", size: 18 })] })],
        })
      ),
    })
  );

  const children: any[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: report.titulo, bold: true, font: "Arial" })] }),
    new Paragraph({ children: [new TextRun({ text: `Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, font: "Arial", size: 18, color: "888888" })] }),
  ];

  if (report.resumo) {
    children.push(new Paragraph({ children: [new TextRun({ text: report.resumo, font: "Arial", size: 20, italics: true })] }));
  }

  children.push(
    new Paragraph({ children: [] }),
    new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Gerado por Duda - Assistente SGM", font: "Arial", size: 16, color: "AAAAAA" })],
    }),
  );

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBlob(doc);
  const url = URL.createObjectURL(buffer);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.titulo.replace(/\s+/g, "_").toLowerCase()}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
