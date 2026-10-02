import type { jsPDF } from "jspdf";
import { desenharCabecalhoPadrao } from "@/lib/gerarPdfProcessoSeletivo";

export interface RelatorioRH {
  titulo: string;
  subtitulo: string;
  filtros: string[];
  head: string[];
  body: (string | number)[][];
  resumo?: [string, string | number][];
  arquivo: string;
  empresaLogoUrl?: string;
}

export async function exportarPdfRH(r: RelatorioRH): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc: jsPDF = new JsPDF({ orientation: "landscape", compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  let y = await desenharCabecalhoPadrao(doc, {
    titulo: r.titulo,
    subtitulo: r.subtitulo,
    linhas: [...r.filtros.slice(0, 1), `Emitido em: ${new Date().toLocaleString("pt-BR")}`],
    empresaLogoUrl: r.empresaLogoUrl,
  });

  if (r.filtros.length > 1) {
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(r.filtros.slice(1).join("  |  "), 14, y - 3);
    y += 2;
  }

  if (r.resumo?.length) {
    autoTable(doc, {
      startY: y,
      head: [r.resumo.map(([k]) => k)],
      body: [r.resumo.map(([, v]) => String(v))],
      theme: "grid",
      styles: { fontSize: 9, halign: "center", textColor: [0, 0, 0] },
      headStyles: { fillColor: [230, 236, 245], textColor: [30, 58, 107], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  autoTable(doc, {
    startY: y,
    head: [r.head],
    body: r.body.length ? r.body.map((l) => l.map((c) => String(c ?? ""))) : [[{ content: "Nenhum registro encontrado.", colSpan: r.head.length, styles: { halign: "center" } } as any]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`${r.titulo} — ${r.subtitulo}`, 14, ph - 8);
    doc.text(`Página ${i} de ${pages}`, pw - 14, ph - 8, { align: "right" });
  }
  doc.save(`${r.arquivo}.pdf`);
}

export async function exportarExcelRH(r: RelatorioRH): Promise<void> {
  const XLSX = await import("xlsx");
  const linhas: (string | number)[][] = [
    [`${r.titulo} — ${r.subtitulo}`],
    ...r.filtros.map((f) => [f]),
    [`Emitido em: ${new Date().toLocaleString("pt-BR")}`],
    [],
  ];
  if (r.resumo?.length) {
    linhas.push(r.resumo.map(([k]) => k), r.resumo.map(([, v]) => v), []);
  }
  linhas.push(r.head, ...r.body);
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws["!cols"] = r.head.map((h, i) => ({
    wch: Math.min(45, Math.max(h.length, ...r.body.map((l) => String(l[i] ?? "").length)) + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, r.subtitulo.slice(0, 30));
  XLSX.writeFile(wb, `${r.arquivo}.xlsx`);
}
