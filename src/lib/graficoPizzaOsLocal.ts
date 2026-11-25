import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type LocalPizza = { nome: string; qtd: number; percentual: number };
const cores: [number, number, number][] = [[30, 58, 107], [42, 136, 25], [231, 183, 59], [220, 38, 38], [14, 165, 233], [147, 51, 234]];

/** Pizza por quantidade, incluindo ordens sem local e sem valor financeiro. */
export function desenharPizzaOsLocal(doc: jsPDF, locais: LocalPizza[], inicio: number): number {
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;
  const raio = 30;
  const cy = inicio + 39;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Percentual de Ordens de Serviço por Local", cx, inicio + 4, { align: "center" });
  let angulo = -Math.PI / 2;
  locais.forEach((local, indice) => {
    const amplitude = local.percentual * Math.PI / 50;
    if (amplitude <= 0) return;
    const passos = Math.max(2, Math.ceil(amplitude * 30));
    const pontos: [number, number][] = [[0, 0]];
    for (let i = 0; i <= passos; i++) {
      const a = angulo + amplitude * i / passos;
      pontos.push([Math.cos(a) * raio, Math.sin(a) * raio]);
    }
    pontos.push([0, 0]);
    const vetores: [number, number][] = [];
    for (let i = 1; i < pontos.length; i++) {
      const atual = pontos[i];
      const anterior = pontos[i - 1];
      if (atual && anterior) vetores.push([atual[0] - anterior[0], atual[1] - anterior[1]]);
    }
    const cor = cores[indice % cores.length] ?? [30, 58, 107];
    doc.setFillColor(...cor);
    doc.setDrawColor(255, 255, 255);
    doc.lines(vetores, cx, cy, [1, 1], "FD", true);
    if (local.percentual >= 5) {
      const meio = angulo + amplitude / 2;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(`${local.percentual.toFixed(1).replace(".", ",")}%`, cx + Math.cos(meio) * raio * 0.65, cy + Math.sin(meio) * raio * 0.65, { align: "center" });
    }
    angulo += amplitude;
  });
  doc.setTextColor(30, 30, 30);
  autoTable(doc, {
    startY: cy + raio + 5,
    head: [["Local", "Qtd O.S.", "% de O.S."]],
    body: locais.map(l => [l.nome, String(l.qtd), `${l.percentual.toFixed(2).replace(".", ",")}%`]),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [30, 58, 107] },
    columnStyles: { 1: { cellWidth: 22, halign: "center" }, 2: { cellWidth: 28, halign: "right" } },
    didParseCell: data => {
      if (data.section === "body" && data.column.index === 0) {
        data.cell.styles.textColor = cores[data.row.index % cores.length] ?? [30, 58, 107];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  const tabela = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return (tabela?.finalY ?? cy + raio + 5) + 8;
}