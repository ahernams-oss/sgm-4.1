import { CotacaoCompras, PropostaFornecedor } from "@/contexts/CotacaoComprasContext";
import { RequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { Empresa } from "@/contexts/EmpresaContext";
import { format } from "date-fns";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface CotacaoPdfData {
  cotacao: CotacaoCompras;
  requisicao?: RequisicaoCompras | null;
  empresa: Empresa | null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const BLUE = { r: 30, g: 58, b: 107 };
const LIGHT_BLUE = { r: 220, g: 230, b: 245 };
const BORDER = { r: 180, g: 195, b: 215 };

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number, w: number): number {
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(x, y, w, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(text, x + 3, y + 5);
  doc.setTextColor(0, 0, 0);
  return y + 7;
}

function fieldRow(
  doc: jsPDF,
  fields: { label: string; value: string; w: number }[],
  x: number, y: number, h: number
) {
  let cx = x;
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
  doc.setLineWidth(0.3);
  for (const f of fields) {
    doc.setFillColor(LIGHT_BLUE.r, LIGHT_BLUE.g, LIGHT_BLUE.b);
    doc.rect(cx, y, f.w, h / 2, "F");
    doc.rect(cx, y, f.w, h);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(f.label, cx + 2, y + 3.5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(f.value || "—", cx + 2, y + h / 2 + 4);
    cx += f.w;
  }
  return y + h;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, ml: number, fullW: number): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + needed > ph - 20) {
    doc.addPage();
    return 15;
  }
  return y;
}

async function gerarPdfCotacaoAsync(data: CotacaoPdfData): Promise<jsPDF> {
  const { cotacao, requisicao, empresa } = data;
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 12;
  const mr = pw - 12;
  const fullW = mr - ml;

  let logo: string | null = null;
  const logoSrc = empresa?.logoUrl || "/Logo_Lasant.png";
  try { logo = await loadImage(logoSrc); } catch { /* fallback */ }

  // ── HEADER ──
  const headerH = 34;
  const blueStartX = pw * 0.42;
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(blueStartX, 0, pw - blueStartX, headerH, "F");

  if (logo) {
    doc.addImage(logo, "PNG", ml, 4, 42, 26);
  } else {
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(empresa?.razaoSocial || "EMPRESA", ml + 2, 20);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("COTAÇÃO DE COMPRAS", mr, 16, { align: "right" });

  const cotNum = `COT-${String(cotacao.numero).padStart(4, "0")}`;
  doc.setFontSize(12);
  doc.text(`Nº ${cotNum}`, mr, 27, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 40;
  const rowH = 11;

  // ── DADOS DA COTAÇÃO ──
  y = fieldRow(doc, [
    { label: "DATA DE CRIAÇÃO", value: cotacao.dataCriacao ? format(new Date(cotacao.dataCriacao), "dd/MM/yyyy HH:mm") : "—", w: fullW * 0.3 },
    { label: "COMPRADOR", value: cotacao.comprador, w: fullW * 0.35 },
    { label: "STATUS", value: cotacao.status, w: fullW * 0.35 },
  ], ml, y, rowH);

  y = fieldRow(doc, [
    { label: "REQUISIÇÃO", value: requisicao ? `RCS-${String(requisicao.numero).padStart(4, "0")}` : `RCS-${String(cotacao.requisicaoNumero).padStart(4, "0")}`, w: fullW * 0.3 },
    { label: "SOLICITANTE", value: requisicao?.solicitante || "—", w: fullW * 0.35 },
    { label: "CENTRO DE CUSTO", value: requisicao?.centroCustoNome || "—", w: fullW * 0.35 },
  ], ml, y, rowH);

  y += 3;

  // ── ITENS DA REQUISIÇÃO ──
  if (requisicao && requisicao.itens.length > 0) {
    y = sectionTitle(doc, "ITENS SOLICITADOS", ml, y, fullW);

    const itensBody = requisicao.itens.map((item, idx) => [
      String(idx + 1),
      item.descricao,
      item.unidadeMedida,
      String(item.quantidade),
      item.especificacaoTecnica || "—",
    ]);

    (await getAutoTable())(doc, {
      startY: y,
      head: [["#", "DESCRIÇÃO", "UN", "QTD", "ESPECIFICAÇÃO"]],
      body: itensBody,
      margin: { left: ml, right: 12 },
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: [BORDER.r, BORDER.g, BORDER.b], lineWidth: 0.3 },
      headStyles: { fillColor: [BLUE.r, BLUE.g, BLUE.b], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ── PROPOSTAS DOS FORNECEDORES ──
  if (cotacao.propostas.length > 0) {
    y = checkPageBreak(doc, y, 30, ml, fullW);
    y = sectionTitle(doc, "PROPOSTAS DOS FORNECEDORES", ml, y, fullW);

    for (const proposta of cotacao.propostas) {
      y = checkPageBreak(doc, y, 40, ml, fullW);

      const isVencedor = cotacao.fornecedorVencedorId === proposta.fornecedorId;

      // Fornecedor header
      doc.setFillColor(isVencedor ? 65 : 180, isVencedor ? 105 : 195, isVencedor ? 225 : 215);
      doc.rect(ml, y, fullW, 6, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isVencedor ? 255 : 0, isVencedor ? 255 : 0, isVencedor ? 255 : 0);
      doc.text(`${proposta.fornecedorNome}${isVencedor ? " ★ VENCEDOR" : ""}`, ml + 3, y + 4.2);
      doc.text(fmt(proposta.valorTotal), mr - 3, y + 4.2, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 6;

      // Proposta info
      y = fieldRow(doc, [
        { label: "COND. PAGAMENTO", value: proposta.condicaoPagamento, w: fullW * 0.3 },
        { label: "PRAZO ENTREGA", value: proposta.prazoEntrega, w: fullW * 0.3 },
        { label: "VALIDADE PROPOSTA", value: proposta.validadeProposta, w: fullW * 0.2 },
        { label: "VALOR TOTAL", value: fmt(proposta.valorTotal), w: fullW * 0.2 },
      ], ml, y, 10);

      // Itens da proposta
      if (proposta.itens.length > 0) {
        const propostaBody = proposta.itens.map((item, idx) => [
          String(idx + 1),
          item.descricao,
          item.unidadeMedida,
          String(item.quantidade),
          fmt(item.precoUnitario),
          fmt(item.precoUnitario * item.quantidade),
        ]);

        (await getAutoTable())(doc, {
          startY: y,
          head: [["#", "DESCRIÇÃO", "UN", "QTD", "VALOR UNIT.", "VALOR TOTAL"]],
          body: propostaBody,
          margin: { left: ml, right: 12 },
          styles: { fontSize: 7, cellPadding: 1.8, lineColor: [BORDER.r, BORDER.g, BORDER.b], lineWidth: 0.2 },
          headStyles: { fillColor: [100, 120, 150], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
          alternateRowStyles: { fillColor: [248, 250, 253] },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            2: { cellWidth: 13, halign: "center" },
            3: { cellWidth: 15, halign: "center" },
            4: { cellWidth: 25, halign: "right" },
            5: { cellWidth: 25, halign: "right" },
          },
        });

        y = (doc as any).lastAutoTable.finalY;
      }

      if (proposta.observacao) {
        y += 1;
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "italic");
        doc.text(`Obs: ${proposta.observacao}`, ml + 2, y + 3);
        y += 5;
      }

      y += 4;
    }
  }

  // ── MAPA COMPARATIVO (resumo) ──
  if (cotacao.propostas.length > 1) {
    y = checkPageBreak(doc, y, 30, ml, fullW);
    y = sectionTitle(doc, "RESUMO COMPARATIVO", ml, y, fullW);

    const mapaBody = cotacao.propostas
      .sort((a, b) => a.valorTotal - b.valorTotal)
      .map((p, idx) => [
        String(idx + 1),
        p.fornecedorNome,
        p.condicaoPagamento,
        p.prazoEntrega,
        fmt(p.valorTotal),
        p.fornecedorId === cotacao.fornecedorVencedorId ? "★ VENCEDOR" : "",
      ]);

    (await getAutoTable())(doc, {
      startY: y,
      head: [["#", "FORNECEDOR", "COND. PGTO", "PRAZO", "VALOR TOTAL", "STATUS"]],
      body: mapaBody,
      margin: { left: ml, right: 12 },
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [BORDER.r, BORDER.g, BORDER.b], lineWidth: 0.3 },
      headStyles: { fillColor: [BLUE.r, BLUE.g, BLUE.b], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 25, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5 && data.cell.raw === "★ VENCEDOR") {
          data.cell.styles.textColor = [65, 105, 225];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ── JUSTIFICATIVA ──
  if (cotacao.justificativaEscolha) {
    y = checkPageBreak(doc, y, 20, ml, fullW);
    y = sectionTitle(doc, "JUSTIFICATIVA DA ESCOLHA", ml, y, fullW);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(cotacao.justificativaEscolha, fullW - 6);
    doc.text(lines, ml + 3, y + 4);
    y += 4 + lines.length * 4 + 3;
  }

  // ── FOOTER ──
  const addFooter = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
      doc.rect(0, ph - 10, pw, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pw / 2, ph - 5.5, { align: "center" });
      doc.text(`Página ${i} de ${pages}`, pw - 14, ph - 5.5, { align: "right" });
    }
  };

  addFooter();

  return doc;
}

export async function downloadPdfCotacao(data: CotacaoPdfData) {
  const doc = await gerarPdfCotacaoAsync(data);
  doc.save(`Cotacao_COT-${String(data.cotacao.numero).padStart(4, "0")}.pdf`);
}
