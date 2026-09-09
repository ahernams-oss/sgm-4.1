

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
export interface TreinamentoExportRow {
  funcionario: string;
  cpf: string;
  titulo: string;
  tipo: string;
  status: string;
  nota: string;
  conclusao: string;
}

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const HEAD = ["Funcionário", "CPF", "Título", "Tipo", "Status", "Nota", "Conclusão"];
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const stamp = () => new Date().toISOString().slice(0, 10);

const toArray = (r: TreinamentoExportRow) => [r.funcionario, r.cpf, r.titulo, r.tipo, r.status, r.nota, r.conclusao];

export function exportarTreinamentosCsv(rows: TreinamentoExportRow[], contexto?: string) {
  const linhas = [
    csvCell("Treinamentos"),
    csvCell(`Gerado em: ${new Date().toLocaleString("pt-BR")}`),
    ...(contexto ? [csvCell(contexto)] : []),
    "",
    HEAD.map(csvCell).join(";"),
    ...rows.map((r) => toArray(r).map(csvCell).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `treinamentos_${stamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportarTreinamentosPdf(rows: TreinamentoExportRow[], contexto?: string) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  doc.setFillColor(...DARK_BLUE);
  doc.rect(0, 0, pw, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Relatório de Treinamentos", 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 20);
  if (contexto) doc.text(contexto, 14, 25);

  (await getAutoTable())(doc, {
    startY: 36,
    head: [HEAD],
    body: rows.map(toArray),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: DARK_BLUE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    columnStyles: { 5: { halign: "right" } },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("Relatório de treinamentos — SGM Lasant", 14, ph - 10);
    doc.text(`Página ${i} de ${total}`, pw - 14, ph - 10, { align: "right" });
  }

  doc.save(`treinamentos_${stamp()}.pdf`);
}
