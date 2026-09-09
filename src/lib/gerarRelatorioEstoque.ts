

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");
const DARK_BLUE: [number, number, number] = [30, 58, 107];

export interface ReportHeader {
  title: string;
  subtitle?: string;
  filters?: string;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    try {
      const r = await fetch(url);
      const b = await r.blob();
      return await new Promise<string>((resolve) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result as string);
        fr.readAsDataURL(b);
      });
    } catch {
      return null;
    }
  }
}

export async function addHeader(doc: jsPDF, h: ReportHeader, logoUrl?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 14;
  const mr = 14;
  const headerH = 34;

  // Blue rectangle on the RIGHT half
  const blueStartX = pw * 0.42;
  doc.setFillColor(...DARK_BLUE);
  doc.rect(blueStartX, 0, pw - blueStartX, headerH, "F");

  // Logo on the LEFT
  const logoSrc = logoUrl || "/Logo_Lasant.png";
  const logoData = await loadImageAsDataUrl(logoSrc);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", ml, 4, 42, 26);
    } catch {
      doc.setTextColor(...DARK_BLUE);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LASANT", ml, 20);
    }
  } else {
    doc.setTextColor(...DARK_BLUE);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LASANT", ml, 20);
  }

  // Title on the RIGHT (inside blue area)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(h.title.toUpperCase(), pw - mr, 13, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (h.subtitle) doc.text(h.subtitle, pw - mr, 20, { align: "right" });
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`,
    pw - mr,
    26,
    { align: "right" }
  );

  if (h.filters) {
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(8);
    doc.text(h.filters, ml, headerH + 6, { maxWidth: pw - ml - mr });
  }

  doc.setTextColor(30, 30, 30);
}

export function addFooter(doc: jsPDF) {
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
  }
}

export async function gerarPdfEstoque(
  title: string,
  columns: string[],
  rows: string[][],
  filters?: string,
  logoUrl?: string
) {
  const doc = new (await getJsPDF())({ compress: true, orientation: columns.length > 6 ? "landscape" : "portrait" });
  await addHeader(doc, { title, subtitle: `Total: ${rows.length} registros`, filters }, logoUrl);
  (await getAutoTable())(doc, {
    startY: filters ? 44 : 38,
    head: [columns],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  addFooter(doc);
  doc.save(`${title.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

export async function gerarExcelEstoque(title: string, columns: string[], rows: string[][], filters?: string) {
  const aoa: (string | number)[][] = [];
  aoa.push([title.toUpperCase()]);
  aoa.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`]);
  if (filters) aoa.push([filters]);
  aoa.push([`Total: ${rows.length} registros`]);
  aoa.push([]);
  aoa.push(columns);
  rows.forEach((r) => aoa.push(r));

  const ws = (await getXLSX()).utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map(() => ({ wch: 20 }));
  const merge = { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, columns.length - 1) } };
  ws["!merges"] = [merge];
  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, title.substring(0, 31));
  (await getXLSX()).writeFile(wb, `${title.replace(/\s+/g, "_").toLowerCase()}.xlsx`, { compression: true });
}
