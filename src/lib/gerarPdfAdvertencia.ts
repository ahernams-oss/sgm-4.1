import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;

interface AdvertenciaData {
  funcionarioNome: string;
  funcionarioCpf: string;
  cargoNome: string;
  dataAdvertencia: string;
  motivo: string;
  observacoes: string;
  empresaRazaoSocial: string;
}

const formatDataExtenso = (d: string) => {
  try {
    return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
};

export async function gerarPdfAdvertencia(data: AdvertenciaData) {
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ml = 20;
  const mr = 20;
  const contentWidth = pw - ml - mr;
  let y = 30;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("AVISO DE ADVERTÊNCIA AO FUNCIONÁRIO", pw / 2, y, { align: "center" });
  y += 16;

  // Employee info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("NOME:", ml, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.funcionarioNome, ml + 18, y);

  doc.setFont("helvetica", "bold");
  doc.text("DATA:", pw - mr - 60, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDataExtenso(data.dataAdvertencia), pw - mr - 60 + 16, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("CPF:", ml, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.funcionarioCpf || "—", ml + 14, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("CARGO:", ml, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.cargoNome || "—", ml + 20, y);
  y += 12;

  // Intro text
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const intro = "Pelo presente fica V. S. advertido pelas faltas discriminadas abaixo:";
  doc.text(intro, ml, y);
  y += 10;

  // Motivo paragraph
  const motivoText = `Conforme verificado pela supervisão, V.Sa ${data.funcionarioNome} ${data.motivo}`;
  const motivoLines = doc.splitTextToSize(motivoText, contentWidth);
  doc.text(motivoLines, ml, y);
  y += motivoLines.length * 5 + 8;

  // Legal text paragraphs
  const legalTexts = [
    'Tal conduta configura ato de indisciplina e insubordinação, conforme previsto no artigo 482, alínea "h", da Consolidação das Leis do Trabalho (CLT), por comprometerem a confiabilidade das informações adicionadas no sistema de gestão de ponto, e caracteriza descumprimento das normas vigentes.',
    "Diante disso, aplicamos a presente advertência disciplinar, a fim de registrar o ocorrido e orientá-lo a cumprir rigorosamente as normas de registro de ponto.",
    "Reforçamos que novas ocorrências poderão resultar em penalidades mais severas, conforme a legislação vigente e o regulamento interno da empresa.",
  ];

  legalTexts.forEach((txt) => {
    const lines = doc.splitTextToSize(txt, contentWidth);
    doc.text(lines, ml, y);
    y += lines.length * 5 + 6;
  });

  // Observations
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("OBSERVAÇÕES:", ml, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const obsText = data.observacoes || "—";
  const obsLines = doc.splitTextToSize(obsText, contentWidth);
  doc.text(obsLines, ml, y);
  y += obsLines.length * 5 + 20;

  // Signature boxes
  const boxW = contentWidth / 2 - 5;
  const boxH = 30;
  const col1X = ml;
  const col2X = ml + boxW + 10;

  // Row 1 - Empregador / Funcionário
  doc.setDrawColor(0);
  doc.rect(col1X, y, boxW, boxH);
  doc.rect(col2X, y, boxW, boxH);

  doc.setFontSize(9);
  doc.line(col1X + 10, y + 18, col1X + boxW - 10, y + 18);
  doc.text("EMPREGADOR", col1X + boxW / 2, y + 25, { align: "center" });

  doc.line(col2X + 10, y + 18, col2X + boxW - 10, y + 18);
  doc.text("FUNCIONÁRIO", col2X + boxW / 2, y + 25, { align: "center" });
  y += boxH + 5;

  // Row 2 - Testemunhas
  doc.rect(col1X, y, boxW, boxH);
  doc.rect(col2X, y, boxW, boxH);

  doc.line(col1X + 10, y + 18, col1X + boxW - 10, y + 18);
  doc.text("TESTEMUNHA 1", col1X + boxW / 2, y + 25, { align: "center" });

  doc.line(col2X + 10, y + 18, col2X + boxW - 10, y + 18);
  doc.text("TESTEMUNHA 2", col2X + boxW / 2, y + 25, { align: "center" });
  y += boxH + 10;

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `DEPARTAMENTO PESSOAL – ${data.empresaRazaoSocial.toUpperCase()}`,
    pw / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  doc.save(`Advertencia_${data.funcionarioNome.replace(/\s+/g, "_")}_${formatDataExtenso(data.dataAdvertencia).replace(/\//g, "-")}.pdf`);
}
