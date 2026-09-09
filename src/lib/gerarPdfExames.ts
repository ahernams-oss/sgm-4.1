

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
interface ExameData {
  funcionario_nome: string;
  tipo_exame: string;
  data_realizacao: string | null;
  data_vencimento: string;
  resultado: string;
  clinica: string;
  observacoes: string;
}

const getStatusLabel = (dataVencimento: string) => {
  const hoje = new Date();
  const venc = new Date(dataVencimento + "T00:00:00");
  const diffDays = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Vencido";
  if (diffDays <= 10) return `${diffDays}d`;
  if (diffDays <= 20) return `${diffDays}d`;
  if (diffDays <= 30) return `${diffDays}d`;
  return "OK";
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
};

export async function gerarPdfExames(exames: ExameData[]) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Exames Periódicos", 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, 14, 21);
  doc.text(`Total: ${exames.length} registro(s)`, pageWidth - 14, 13, { align: "right" });

  // Summary
  const vencidos = exames.filter((e) => getStatusLabel(e.data_vencimento) === "Vencido").length;
  const proximos = exames.filter((e) => { const s = getStatusLabel(e.data_vencimento); return s !== "Vencido" && s !== "OK"; }).length;
  const emDia = exames.filter((e) => getStatusLabel(e.data_vencimento) === "OK").length;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.text("Resumo:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Vencidos: ${vencidos}  |  Próximos ao vencimento: ${proximos}  |  Em dia: ${emDia}`, 42, y);
  y += 6;

  // Table
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Funcionário", "Tipo", "Realização", "Vencimento", "Status", "Resultado", "Clínica", "Observações"]],
    body: exames.map((e) => [
      e.funcionario_nome,
      e.tipo_exame,
      formatDate(e.data_realizacao),
      formatDate(e.data_vencimento),
      getStatusLabel(e.data_vencimento),
      e.resultado || "—",
      e.clinica || "—",
      e.observacoes || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const val = data.cell.text[0];
        if (val === "Vencido") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        } else if (val !== "OK") {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
    },
  });

  doc.save("relatorio-exames-periodicos.pdf");
}
