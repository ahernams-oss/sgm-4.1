

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
export interface KpiExportItem {
  grupo?: string;
  label: string;
  value: string | number;
  subtitle?: string;
}

const DARK_BLUE: [number, number, number] = [30, 58, 107];

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Exporta os KPIs em CSV (separador ";" e BOM para abrir corretamente no Excel PT-BR). */
export function exportarKpisCsv(titulo: string, kpis: KpiExportItem[], contexto?: string) {
  const temGrupo = kpis.some((k) => k.grupo);
  const linhas: string[] = [];
  linhas.push([csvCell(titulo)].join(";"));
  linhas.push([csvCell(`Gerado em: ${new Date().toLocaleString("pt-BR")}`)].join(";"));
  if (contexto) linhas.push([csvCell(contexto)].join(";"));
  linhas.push("");
  linhas.push([...(temGrupo ? [csvCell("Grupo")] : []), csvCell("Indicador"), csvCell("Valor"), csvCell("Detalhe")].join(";"));
  kpis.forEach((k) => {
    linhas.push(
      [
        ...(temGrupo ? [csvCell(k.grupo ?? "")] : []),
        csvCell(k.label),
        csvCell(k.value),
        csvCell(k.subtitle ?? ""),
      ].join(";"),
    );
  });

  const blob = new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kpis_${slug(titulo)}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta os KPIs em PDF, agrupados quando houver o campo "grupo". */
export async function exportarKpisPdf(titulo: string, kpis: KpiExportItem[], contexto?: string) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  doc.setFillColor(...DARK_BLUE);
  doc.rect(0, 0, pw, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 20);
  if (contexto) doc.text(contexto, 14, 25);

  const temGrupo = kpis.some((k) => k.grupo);
  const body = kpis.map((k) => [
    ...(temGrupo ? [k.grupo ?? "—"] : []),
    k.label,
    String(k.value),
    k.subtitle ?? "",
  ]);

  (await getAutoTable())(doc, {
    startY: 36,
    head: [[...(temGrupo ? ["Grupo"] : []), "Indicador", "Valor", "Detalhe"]],
    body,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    columnStyles: temGrupo
      ? { 0: { cellWidth: 42 }, 2: { halign: "right", fontStyle: "bold" } }
      : { 1: { halign: "right", fontStyle: "bold" } },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("Relatório de indicadores — SGM Lasant", 14, ph - 10);
    doc.text(`Página ${i} de ${total}`, pw - 14, ph - 10, { align: "right" });
  }

  doc.save(`kpis_${slug(titulo)}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
