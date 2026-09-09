import type { Eventograma } from "@/contexts/EventogramasContext";
import type { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const fmtMoney = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s?: string) => {
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

export async function gerarPdfEventograma(ev: Eventograma, empresa: Empresa | null) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 27, 61);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("EVENTOGRAMA", 10, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text((empresa as any)?.razaoSocial || (empresa as any)?.razao_social || "", pageW - 10, 12, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 24;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Nº ${ev.numero}  |  Cliente: ${ev.cliente_nome || "-"}  |  Obra: ${ev.obra || "-"}`, 10, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Contrato: ${ev.contrato_numero || "-"}  |  Assinatura: ${fmtDate(ev.data_assinatura)}  |  Valor: ${fmtMoney(ev.valor_total)}  |  Status: ${ev.status}`, 10, y);
  y += 5;
  if (ev.descricao) { doc.text(`Descrição: ${ev.descricao}`, 10, y); y += 5; }

  (await getAutoTable())(doc, {
    startY: y + 2,
    head: [["#", "Marco", "Descrição", "Prazo", "Data prevista", "% Contrato", "Valor", "Critério de medição", "Status", "Data realizada"]],
    body: (ev.eventos || []).map((e) => [
      e.ordem,
      e.marco,
      e.descricao,
      e.prazo,
      fmtDate(e.data_prevista),
      `${(Number(e.percentual) || 0).toFixed(2)}%`,
      fmtMoney(e.valor),
      e.criterio_medicao,
      e.status,
      fmtDate(e.data_realizada),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 27, 61], textColor: 255 },
    columnStyles: { 0: { cellWidth: 8 }, 5: { halign: "right" }, 6: { halign: "right" } },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 10;
  const totalPct = (ev.eventos || []).reduce((s, e) => s + (Number(e.percentual) || 0), 0);
  const totalValor = (ev.eventos || []).reduce((s, e) => s + (Number(e.valor) || 0), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Total: ${totalPct.toFixed(2)}%   |   ${fmtMoney(totalValor)}`, pageW - 10, finalY + 6, { align: "right" });

  doc.save(`eventograma-${ev.numero}.pdf`);
}
