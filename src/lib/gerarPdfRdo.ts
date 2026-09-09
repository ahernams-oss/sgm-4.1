import type { Rdo } from "@/contexts/RdosContext";
import type { Empresa } from "@/contexts/EmpresaContext";
import type { Cliente } from "@/contexts/ClientesContext";
import type { RdoAssinatura } from "@/contexts/RdoAssinaturasContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const DARK = [60, 60, 60] as const;
const BORDER: [number, number, number] = [60, 60, 60];

async function loadImageAsDataUrl(url: string): Promise<string | null> {
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

const fmtDate = (s?: string) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
};

export interface RenderRdoOptions {
  rdo: Rdo;
  empresa?: Empresa;
  cliente?: Cliente;
  assinaturas?: RdoAssinatura[];
  incluirImagens?: boolean;
}

export async function gerarPdfRdo({ rdo, empresa, cliente, assinaturas = [], incluirImagens = false }: RenderRdoOptions) {
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ml = 12, mr = 12;
  const cw = pw - ml - mr;
  let y = 12;

  // ===== HEADER =====
  const clienteLogoUrl = (cliente as any)?.logoUrl;
  if (clienteLogoUrl) {
    const data = await loadImageAsDataUrl(clienteLogoUrl);
    if (data) { try { doc.addImage(data, "PNG", ml, y, 30, 16); } catch {} }
  }
  if (empresa?.logoUrl) {
    const data = await loadImageAsDataUrl(empresa.logoUrl);
    if (data) { try { doc.addImage(data, "PNG", pw - mr - 32, y, 32, 16); } catch {} }
  }

  doc.setTextColor(...DARK);
  const c: any = cliente || {};
  const linhas = [c.relLinha1, c.relLinha2, c.relLinha3, c.relLinha4].map((s) => s || "");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (linhas[0]) doc.text(linhas[0], pw / 2, y + 3.5, { align: "center" });
  doc.setFontSize(7.5);
  if (linhas[1]) doc.text(linhas[1], pw / 2, y + 7.5, { align: "center" });
  if (linhas[2]) doc.text(linhas[2], pw / 2, y + 11.5, { align: "center" });
  if (linhas[3]) doc.text(linhas[3], pw / 2, y + 16, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RDO - REGISTRO DIÁRIO DE OBRAS — ENGENHARIA E MANUTENÇÃO", pw / 2, y + 23, { align: "center" });

  const ano = new Date(rdo.data_rdo || rdo.created_at || Date.now()).getFullYear();
  const numeroFormatado = `${rdo.numero}/${ano}`;
  const boxW = 38, boxH = 8;
  const boxX = pw - mr - boxW;
  const boxY = y + 19;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.rect(boxX, boxY, boxW, boxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(numeroFormatado, boxX + boxW / 2, boxY + 5.5, { align: "center" });

  y += 30;

  // ===== INFO =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30] },
    body: [
      [
        { content: "Data:", styles: { fontStyle: "bold", fontSize: 7 } },
        { content: fmtDate(rdo.data_rdo), styles: { fontStyle: "bold" } },
        { content: "Cliente / Obra:", styles: { fontStyle: "bold", fontSize: 7 } },
        { content: `${rdo.cliente_nome || "-"}${rdo.obra ? " — " + rdo.obra : ""}`, styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Responsável:", styles: { fontStyle: "bold", fontSize: 7 } },
        { content: rdo.responsavel || "-", styles: { fontStyle: "bold" } },
        { content: "Avanço Físico Geral:", styles: { fontStyle: "bold", fontSize: 7 } },
        { content: `${(Number(rdo.avanco_fisico_geral) || 0).toFixed(2)} %`, styles: { fontStyle: "bold" } },
      ],
    ],
    columnStyles: { 0: { cellWidth: cw * 0.18 }, 1: { cellWidth: cw * 0.32 }, 2: { cellWidth: cw * 0.18 }, 3: { cellWidth: cw * 0.32 } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== CLIMA =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    head: [["Turno", "Clima", "Condição de Trabalho"]],
    body: [
      ["Manhã", rdo.clima_manha || "-", rdo.condicao_manha || "-"],
      ["Tarde", rdo.clima_tarde || "-", rdo.condicao_tarde || "-"],
      ["Noite", rdo.clima_noite || "-", rdo.condicao_noite || "-"],
    ],
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.3 },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: cw * 0.2, halign: "center" }, 1: { cellWidth: cw * 0.4 }, 2: { cellWidth: cw * 0.4 } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== EFETIVO =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    head: [[{ content: "EFETIVO (Mão de Obra)", colSpan: 3, styles: { halign: "center", fillColor: [220, 220, 220] } }], ["Função", "Quantidade", "Horas"]],
    body: (rdo.efetivo || []).length
      ? (rdo.efetivo || []).map((e) => [e.funcao || "-", String(e.quantidade ?? 0), String(e.horas ?? 0)])
      : [[{ content: "Sem efetivo registrado", colSpan: 3, styles: { fontStyle: "italic", halign: "center", textColor: [120, 120, 120] } }]],
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.3 },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: cw * 0.6 }, 1: { cellWidth: cw * 0.2, halign: "center" }, 2: { cellWidth: cw * 0.2, halign: "center" } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== EQUIPAMENTOS =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    head: [[{ content: "EQUIPAMENTOS", colSpan: 3, styles: { halign: "center", fillColor: [220, 220, 220] } }], ["Descrição", "Quantidade", "Horas"]],
    body: (rdo.equipamentos || []).length
      ? (rdo.equipamentos || []).map((e) => [e.descricao || "-", String(e.quantidade ?? 0), String(e.horas ?? 0)])
      : [[{ content: "Sem equipamentos registrados", colSpan: 3, styles: { fontStyle: "italic", halign: "center", textColor: [120, 120, 120] } }]],
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.3 },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: cw * 0.6 }, 1: { cellWidth: cw * 0.2, halign: "center" }, 2: { cellWidth: cw * 0.2, halign: "center" } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== ATIVIDADES =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    head: [[{ content: "ATIVIDADES EXECUTADAS", colSpan: 3, styles: { halign: "center", fillColor: [220, 220, 220] } }], ["Descrição", "% Avanço", "Observação"]],
    body: (rdo.atividades || []).length
      ? (rdo.atividades || []).map((a) => [a.descricao || "-", `${(Number(a.percentual_avanco) || 0).toFixed(1)} %`, a.observacao || ""])
      : [[{ content: "Sem atividades registradas", colSpan: 3, styles: { fontStyle: "italic", halign: "center", textColor: [120, 120, 120] } }]],
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.3 },
    headStyles: { fillColor: [240, 240, 240], textColor: [30, 30, 30], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: cw * 0.5 }, 1: { cellWidth: cw * 0.15, halign: "center" }, 2: { cellWidth: cw * 0.35 } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== OCORRÊNCIAS / OBSERVAÇÕES =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    body: [
      [{ content: "Ocorrências do Dia", styles: { fontStyle: "bold", fontSize: 7, fillColor: [240, 240, 240] } }],
      [{ content: rdo.ocorrencias || "-", styles: { minCellHeight: 12, valign: "top" } }],
      [{ content: "Observações", styles: { fontStyle: "bold", fontSize: 7, fillColor: [240, 240, 240] } }],
      [{ content: rdo.observacoes || "-", styles: { minCellHeight: 12, valign: "top" } }],
    ],
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3 },
    columnStyles: { 0: { cellWidth: cw } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== ASSINATURAS =====
  const assResp = assinaturas.find(a => a.papel === "responsavel");
  const assFisc = assinaturas.find(a => a.papel === "fiscalizacao");
  const temEletronica = !!(assResp || assFisc);

  if (temEletronica) {
    // === ESTILO ASSINATURA ELETRÔNICA OFICIAL (SEI) ===
    if (y > 220) { doc.addPage(); y = 15; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text("ASSINATURAS ELETRÔNICAS OFICIAIS", pw / 2, y + 4, { align: "center" });
    y += 7;

    const fmtDt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const renderBloco = (a: typeof assResp, papelLabel: string) => {
      if (!a) return;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.rect(ml, y, cw, 22);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      const linha1 = `Documento assinado eletronicamente por ${a.signatario_nome}${a.signatario_cargo ? ", " + a.signatario_cargo : ""},`;
      const linha2 = `como ${papelLabel}, em ${fmtDt(a.signed_at)}, conforme ${a.base_legal}.`;
      doc.text(linha1, ml + 2, y + 5);
      doc.text(linha2, ml + 2, y + 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`A autenticidade do documento pode ser conferida em ${baseUrl}/verificar-assinatura`, ml + 2, y + 14);
      doc.text(`informando o código verificador: ${a.codigo_verificador}`, ml + 2, y + 18);
      y += 24;
    };

    if (assResp) renderBloco(assResp, "Responsável Técnico");
    if (assFisc) renderBloco(assFisc, "Fiscalização");
  } else {
    // === FALLBACK: Linhas para assinatura manual ===
    if (y > 230) { doc.addPage(); y = 15; }
    const sigW = (cw - 4) / 2;
    const sigH = 28;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(ml, y, sigW, sigH);
    doc.rect(ml + sigW + 4, y, sigW, sigH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Responsável Técnico", ml + 2, y + 4);
    doc.text("Fiscalização", ml + sigW + 6, y + 4);
    doc.setLineWidth(0.2);
    doc.line(ml + 4, y + 22, ml + sigW - 4, y + 22);
    doc.line(ml + sigW + 8, y + 22, ml + sigW * 2 - 4, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(rdo.assinatura_responsavel_nome || "_______________________", ml + sigW / 2, y + 26, { align: "center" });
    doc.text(rdo.assinatura_fiscalizacao_nome || "_______________________", ml + sigW + 4 + sigW / 2, y + 26, { align: "center" });
  }

  // ===== ANEXOS / IMAGENS =====
  if (incluirImagens) {
    const imagens = (rdo.anexos || []).filter(a => (a.tipo || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(a.nome || ""));
    if (imagens.length > 0) {
      doc.addPage();
      let yi = 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      doc.text("REGISTRO FOTOGRÁFICO", pw / 2, yi, { align: "center" });
      yi += 6;

      const ph = doc.internal.pageSize.getHeight();
      const cols = 2;
      const gap = 4;
      const imgW = (cw - gap) / cols;
      const imgH = 60;
      const descH = 5; // espaço para descrição no topo
      const cellH = descH + imgH + 8;
      let col = 0;

      for (const anx of imagens) {
        const data = await loadImageAsDataUrl(anx.url);
        if (!data) continue;
        if (yi + cellH > ph - 15) {
          doc.addPage();
          yi = 12;
          col = 0;
        }
        const x = ml + col * (imgW + gap);
        try {
          // Descrição no topo da foto
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(40, 40, 40);
          const descRaw = (anx.descricao || "").trim() || "(sem descrição)";
          const descLine = descRaw.length > 80 ? descRaw.slice(0, 77) + "..." : descRaw;
          doc.text(descLine, x + imgW / 2, yi + 3.5, { align: "center", maxWidth: imgW - 2 });

          const fmt = /png/i.test(anx.tipo || anx.nome) ? "PNG" : "JPEG";
          doc.addImage(data, fmt, x, yi + descH, imgW, imgH);
          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.2);
          doc.rect(x, yi + descH, imgW, imgH);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(80, 80, 80);
          const nome = (anx.nome || "").length > 60 ? anx.nome.slice(0, 57) + "..." : (anx.nome || "");
          doc.text(nome, x + imgW / 2, yi + descH + imgH + 4, { align: "center" });
        } catch {}
        col++;
        if (col >= cols) {
          col = 0;
          yi += cellH;
        }
      }
    }
  }


  const pages = doc.getNumberOfPages();
  const nome = empresa?.nomeFantasia || empresa?.razaoSocial || "SGM Lasant";
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.line(ml, ph - 10, pw - mr, ph - 10);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`Documento gerado automaticamente — Engenharia e Manutenção — ${nome}`, ml, ph - 5);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 5, { align: "center" });
    doc.text(`RDO Nº ${rdo.numero}`, pw - mr, ph - 5, { align: "right" });
  }

  const sufixo = incluirImagens ? "_com_imagens" : "";
  doc.save(`RDO_${rdo.numero}_${(rdo.cliente_nome || "").replace(/\s+/g, "_")}${sufixo}.pdf`);
}
