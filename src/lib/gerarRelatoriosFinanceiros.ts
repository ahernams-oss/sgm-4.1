import { addHeader } from "@/lib/gerarRelatorioEstoque";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

export interface FinReport {
  titulo: string;
  subtitulo?: string;
  filtros?: string;
  colunas: string[];
  linhas: (string | number)[][];
  totais?: { label: string; valor: string }[];
}

export async function gerarPdfFinanceiro(r: FinReport, orientacao?: "portrait" | "landscape") {
  const orient = orientacao || (r.colunas.length > 6 ? "landscape" : "portrait");
  const doc = new (await getJsPDF())({ compress: true, orientation: orient });
  const pw = doc.internal.pageSize.getWidth();

  // Cabeçalho padrão LASANT
  await addHeader(doc, { title: r.titulo, subtitle: r.subtitulo, filters: r.filtros });

  const startY = r.filtros ? 48 : 42;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Total de registros: ${r.linhas.length}`, 14, startY - 3);

  (await getAutoTable())(doc, {
    startY,
    head: [r.colunas],
    body: r.linhas.map((row) => row.map((c) => (c == null ? "" : String(c)))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });


  if (r.totais && r.totais.length) {
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    let y = finalY;
    r.totais.forEach((t) => {
      doc.text(`${t.label}: ${t.valor}`, pw - 14, y, { align: "right" });
      y += 6;
    });
  }

  // Footer
  const pages = doc.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
    doc.text("SGM Lasant - Financeiro", 14, ph - 8);
  }

  doc.save(`${r.titulo.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export async function gerarExcelFinanceiro(r: FinReport) {
  const wb = (await getXLSX()).utils.book_new();
  const data = r.linhas.map((row) => {
    const o: Record<string, any> = {};
    r.colunas.forEach((c, i) => { o[c] = row[i] ?? ""; });
    return o;
  });
  const ws = (await getXLSX()).utils.json_to_sheet(data);
  ws["!cols"] = r.colunas.map(() => ({ wch: 20 }));
  if (r.totais && r.totais.length) {
    (await getXLSX()).utils.sheet_add_aoa(ws, [[]], { origin: -1 });
    for (const t of r.totais) {
      (await getXLSX()).utils.sheet_add_aoa(ws, [[t.label, t.valor]], { origin: -1 });
    }
  }
  (await getXLSX()).utils.book_append_sheet(wb, ws, r.titulo.substring(0, 31));
  (await getXLSX()).writeFile(wb, `${r.titulo.replace(/\s+/g, "_").toLowerCase()}.xlsx`, { compression: true });
}
