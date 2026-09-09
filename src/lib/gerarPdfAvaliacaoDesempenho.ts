import { AvaliacaoDesempenho, QUESITOS_AVALIACAO } from "@/contexts/AvaliacoesDesempenhoContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const PONTUACAO_MAXIMA = QUESITOS_AVALIACAO.length * 10;

const fmtData = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

interface Opts {
  funcionarioNome?: string;
  empresa?: { razaoSocial?: string; cnpj?: string; logoUrl?: string };
}

export async function gerarPdfAvaliacaoDesempenho(a: AvaliacaoDesempenho, opts: Opts = {}) {
  const doc = new (await getJsPDF())({ compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Avaliação de Desempenho", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(opts.funcionarioNome || "", 14, 22);
  doc.setFontSize(9);
  doc.text(`Data: ${fmtData(a.dataAvaliacao)}`, pageWidth - 14, 14, { align: "right" });
  doc.text(`Período: ${a.periodoReferencia || "—"}`, pageWidth - 14, 20, { align: "right" });

  doc.setTextColor(30, 30, 30);
  let y = 42;

  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [],
    body: [
      ["Funcionário", opts.funcionarioNome || "—"],
      ["Avaliador", a.avaliadorNome || "—"],
      ["Data da Avaliação", fmtData(a.dataAvaliacao)],
      ["Período de Referência", a.periodoReferencia || "—"],
    ],
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Quesito", "Descrição", "Nota"]],
    body: QUESITOS_AVALIACAO.map((q) => [
      q.label,
      q.descricao,
      (a.notas[q.key] ?? 0).toFixed(1),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 58, 107], textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18, halign: "right" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [],
    body: [
      ["Pontuação Total", `${a.pontuacaoTotal.toFixed(1)} / ${PONTUACAO_MAXIMA}`],
      ["Média Ponderada", a.mediaPonderada.toFixed(2)],
    ],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: [240, 244, 250] },
      1: { halign: "right", fontStyle: "bold" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (a.observacoes) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Observações", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(a.observacoes, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 6;
  }

  // Assinatura
  if (y > 250) { doc.addPage(); y = 20; }
  y += 20;
  doc.setDrawColor(120);
  doc.line(pageWidth / 2 - 50, y, pageWidth / 2 + 50, y);
  doc.setFontSize(9);
  doc.text(a.avaliadorNome || "Avaliador", pageWidth / 2, y + 5, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Avaliador", pageWidth / 2, y + 10, { align: "center" });

  doc.save(`avaliacao-desempenho-${(opts.funcionarioNome || "func").replace(/\s+/g, "_")}.pdf`);
}

export async function gerarPdfAvaliacoesLista(
  avaliacoes: AvaliacaoDesempenho[],
  funcMap: Record<string, string>,
) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Avaliações de Desempenho", 14, 15);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, pageWidth - 14, 15, { align: "right" });

  doc.setTextColor(30, 30, 30);

  (await getAutoTable())(doc, {
    startY: 30,
    margin: { left: 14, right: 14 },
    head: [["Funcionário", "Data", "Período", "Avaliador", "Pontuação", "Média"]],
    body: avaliacoes.map((a) => [
      funcMap[a.funcionarioId] || "—",
      fmtData(a.dataAvaliacao),
      a.periodoReferencia || "—",
      a.avaliadorNome || "—",
      `${a.pontuacaoTotal.toFixed(1)} / ${PONTUACAO_MAXIMA}`,
      a.mediaPonderada.toFixed(2),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 58, 107], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
  });

  doc.save("relatorio-avaliacoes-desempenho.pdf");
}
