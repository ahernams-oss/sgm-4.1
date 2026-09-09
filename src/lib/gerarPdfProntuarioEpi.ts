

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
export interface ProntuarioEvento {
  data: string;
  tipo: "Entrega" | "Devolução";
  descricao: string;
  ca: string;
  quantidade: number;
  detalhe: string;
  /** Data/hora da confirmação por reconhecimento facial */
  confirmadoEm?: string;
  /** Hashes SHA-256 das selfies */
  hashes?: string[];
  /** Imagens (dataURL) das selfies */
  fotos?: string[];
  ip?: string;
}


export interface ProntuarioDados {
  funcionarioNome: string;
  cpf?: string;
  cargoNome?: string;
  clienteNome?: string;
  admissao?: string;
  eventos: ProntuarioEvento[];
  emAberto: { descricao: string; ca: string; quantidade: number; dataEntrega: string; dataVencimento: string; motivo?: string; pedido?: string }[];
}

const fmt = (d: string) => {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

async function loadImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function gerarPdfProntuarioEpi(d: ProntuarioDados) {
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  const logo = await loadImage("/Logo_Lasant.png");

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(10, 6, pw - 20, 24);
  if (logo) doc.addImage(logo, "PNG", 14, 8, 36, 20);
  doc.setTextColor(0);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("PRONTUÁRIO DE EPIs", pw / 2, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Controle contínuo de entrega e recolhimento", pw / 2, 24, { align: "center" });

  let y = 36;
  doc.setFontSize(9);
  const linhas = [
    [`Funcionário: ${d.funcionarioNome}`, `CPF: ${d.cpf || "—"}`],
    [`Cargo: ${d.cargoNome || "—"}`, `Cliente/Obra: ${d.clienteNome || "—"}`],
    [`Admissão: ${fmt(d.admissao || "")}`, `Emissão: ${new Date().toLocaleString("pt-BR")}`],
  ];
  doc.rect(10, y - 5, pw - 20, linhas.length * 6 + 3);
  linhas.forEach(([a, b]) => {
    doc.text(a, 13, y);
    doc.text(b, pw / 2 + 5, y);
    y += 6;
  });
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EPIs em posse do funcionário", 12, y);
  y += 2;

  (await getAutoTable())(doc, {
    startY: y,
    head: [["EPI", "CA", "Qtd", "Entrega", "Vencimento", "Pedido", "Motivo"]],
    body: d.emAberto.length
      ? d.emAberto.map((e) => [e.descricao, e.ca || "—", String(e.quantidade), fmt(e.dataEntrega), fmt(e.dataVencimento), e.pedido || "—", e.motivo || "—"])
      : [["Nenhum EPI em posse", "", "", "", "", "", ""]],
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontSize: 8 },
    margin: { left: 10, right: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("MOTIVO:", 12, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    "1 - Admissão   2 - Reposição por desgaste   3 - Reposição por perda   4 - Mudança de função   5 - Extravio   6 - Demissão",
    12 + doc.getTextWidth("MOTIVO:") + 3,
    y
  );

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Histórico contínuo (entregas e recolhimentos)", 12, y);

  (await getAutoTable())(doc, {
    startY: y + 2,
    head: [["Data", "Movimento", "EPI", "CA", "Qtd", "Detalhes"]],
    body: d.eventos.length
      ? d.eventos.map((e) => [fmt(e.data), e.tipo, e.descricao, e.ca || "—", String(e.quantidade), e.detalhe || "—"])
      : [["—", "—", "Sem movimentações registradas", "", "", ""]],
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontSize: 8 },
    columnStyles: { 5: { cellWidth: 55 } },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text("LASANT — Documento gerado pelo SGM", 10, ph - 8);
      doc.text(`Página ${doc.getNumberOfPages()}`, pw - 10, ph - 8, { align: "right" });
      doc.setTextColor(0);
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;
  const ph = doc.internal.pageSize.getHeight();
  if (finalY < ph - 30) {
    doc.setFontSize(8);
    doc.line(20, finalY, 90, finalY);
    doc.text("Funcionário", 45, finalY + 4);
    doc.line(pw - 90, finalY, pw - 20, finalY);
    doc.text("Responsável SESMT", pw - 65, finalY + 4);
  }

  // ===== Registros fotográficos e hashes =====
  const comEvidencia = d.eventos.filter((e) => (e.fotos && e.fotos.length) || (e.hashes && e.hashes.length));
  if (comEvidencia.length) {
    doc.addPage();
    let ey = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Registros fotográficos e hashes de autenticidade", 12, ey);
    ey += 6;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    doc.text("Imagens capturadas por reconhecimento facial no ato da entrega/devolução. O hash SHA-256 garante a integridade do arquivo.", 12, ey);
    doc.setTextColor(0);
    ey += 6;

    comEvidencia.forEach((e) => {
      const blocoH = 52;
      if (ey + blocoH > ph - 18) { doc.addPage(); ey = 16; }
      doc.setDrawColor(200);
      doc.rect(10, ey, pw - 20, blocoH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`${e.tipo} — ${e.descricao}`, 13, ey + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`Data: ${fmt(e.data)}${e.ca ? `   CA: ${e.ca}` : ""}   Qtd: ${e.quantidade}`, 13, ey + 10);
      doc.text(
        `Confirmação facial: ${e.confirmadoEm ? new Date(e.confirmadoEm).toLocaleString("pt-BR") : "—"}${e.ip ? `   IP: ${e.ip}` : ""}`,
        13,
        ey + 14.5
      );
      (e.hashes || []).forEach((h, i) => {
        doc.text(`Hash foto ${i + 1}: ${h}`, 13, ey + 19 + i * 4.5, { maxWidth: pw - 120 });
      });
      (e.fotos || []).slice(0, 2).forEach((f, i) => {
        try { doc.addImage(f, "JPEG", pw - 20 - 34 - i * 36, ey + 6, 32, 40); } catch { /* ignore */ }
      });
      ey += blocoH + 4;
    });
  }


  doc.save(`Prontuario_EPIs_${d.funcionarioNome.replace(/\s+/g, "_")}.pdf`);
}
