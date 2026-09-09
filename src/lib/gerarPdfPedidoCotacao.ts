import { CotacaoCompras } from "@/contexts/CotacaoComprasContext";
import { RequisicaoCompras } from "@/contexts/RequisicaoComprasContext";
import { Empresa } from "@/contexts/EmpresaContext";
import { format } from "date-fns";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface FornecedorInfo {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

interface PedidoCotacaoData {
  cotacao: CotacaoCompras;
  requisicao?: RequisicaoCompras | null;
  empresa: Empresa | null;
  fornecedor: FornecedorInfo;
}

const BLUE = { r: 30, g: 58, b: 107 };
const LIGHT_BLUE = { r: 220, g: 230, b: 245 };
const BORDER = { r: 180, g: 195, b: 215 };

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
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

async function gerarPdfPedidoCotacao(data: PedidoCotacaoData): Promise<jsPDF> {
  const { cotacao, requisicao, empresa, fornecedor } = data;
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
  doc.text("PEDIDO DE COTAÇÃO", mr, 16, { align: "right" });

  const cotNum = `COT-${String(cotacao.numero).padStart(4, "0")}`;
  doc.setFontSize(12);
  doc.text(`Nº ${cotNum}`, mr, 27, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 40;
  const rowH = 11;

  // ── DADOS DA EMPRESA SOLICITANTE ──
  y = sectionTitle(doc, "EMPRESA SOLICITANTE", ml, y, fullW);
  y = fieldRow(doc, [
    { label: "RAZÃO SOCIAL", value: empresa?.razaoSocial || "—", w: fullW * 0.5 },
    { label: "CNPJ", value: empresa?.cnpj || "—", w: fullW * 0.25 },
    { label: "TELEFONE", value: empresa?.telefone || "—", w: fullW * 0.25 },
  ], ml, y, rowH);
  y = fieldRow(doc, [
    { label: "ENDEREÇO", value: [empresa?.logradouro, empresa?.numero, empresa?.complemento, empresa?.bairro].filter(Boolean).join(", ") || "—", w: fullW * 0.5 },
    { label: "CIDADE/UF", value: [empresa?.cidade, empresa?.uf].filter(Boolean).join("/") || "—", w: fullW * 0.25 },
    { label: "E-MAIL", value: empresa?.emailCompras || empresa?.email || "—", w: fullW * 0.25 },
  ], ml, y, rowH);
  y += 3;

  // ── DADOS DO FORNECEDOR ──
  y = sectionTitle(doc, "FORNECEDOR", ml, y, fullW);
  y = fieldRow(doc, [
    { label: "NOME / RAZÃO SOCIAL", value: fornecedor.nome, w: fullW * 0.5 },
    { label: "CNPJ", value: fornecedor.cnpj || "—", w: fullW * 0.25 },
    { label: "E-MAIL", value: fornecedor.email || "—", w: fullW * 0.25 },
  ], ml, y, rowH);
  y += 3;

  // ── DADOS DA COTAÇÃO ──
  y = sectionTitle(doc, "DADOS DA COTAÇÃO", ml, y, fullW);
  y = fieldRow(doc, [
    { label: "DATA", value: cotacao.dataCriacao ? format(new Date(cotacao.dataCriacao), "dd/MM/yyyy") : "—", w: fullW * 0.2 },
    { label: "COMPRADOR", value: cotacao.comprador, w: fullW * 0.3 },
    { label: "REQUISIÇÃO", value: requisicao ? `RCS-${String(requisicao.numero).padStart(4, "0")}` : `RCS-${String(cotacao.requisicaoNumero).padStart(4, "0")}`, w: fullW * 0.2 },
    { label: "PRAZO DESEJADO", value: requisicao?.prazoDesejado ? format(new Date(requisicao.prazoDesejado), "dd/MM/yyyy") : "—", w: fullW * 0.3 },
  ], ml, y, rowH);
  y += 3;

  // ── ITENS PARA COTAÇÃO ──
  const itens = requisicao?.itens || [];
  if (itens.length > 0) {
    y = sectionTitle(doc, "ITENS PARA COTAÇÃO", ml, y, fullW);

    const body = itens.map((item, idx) => [
      String(idx + 1),
      item.descricao,
      item.unidadeMedida,
      String(item.quantidade),
      item.especificacaoTecnica || "—",
      "", // Preço unitário (para preencher)
      "", // Preço total (para preencher)
    ]);

    (await getAutoTable())(doc, {
      startY: y,
      head: [["#", "DESCRIÇÃO", "UN", "QTD", "ESPECIFICAÇÃO", "PREÇO UNIT. (R$)", "PREÇO TOTAL (R$)"]],
      body,
      margin: { left: ml, right: 12 },
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [BORDER.r, BORDER.g, BORDER.b], lineWidth: 0.3 },
      headStyles: { fillColor: [BLUE.r, BLUE.g, BLUE.b], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 15, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 28, halign: "center" },
        6: { cellWidth: 28, halign: "center" },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ── CONDIÇÕES ──
  y = sectionTitle(doc, "CONDIÇÕES (PREENCHER)", ml, y, fullW);
  y = fieldRow(doc, [
    { label: "CONDIÇÃO DE PAGAMENTO", value: "", w: fullW * 0.35 },
    { label: "PRAZO DE ENTREGA", value: "", w: fullW * 0.3 },
    { label: "VALIDADE DA PROPOSTA", value: "", w: fullW * 0.35 },
  ], ml, y, 14);
  y += 2;

  // ── OBSERVAÇÕES ──
  y = sectionTitle(doc, "OBSERVAÇÕES", ml, y, fullW);
  doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
  doc.setLineWidth(0.3);
  doc.rect(ml, y, fullW, 25);
  y += 28;

  // ── MENSAGEM ──
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const msg = "Prezado fornecedor, solicitamos o envio de sua melhor proposta para os itens acima descritos. " +
    "Favor informar preços unitários e totais, condições de pagamento, prazo de entrega e validade da proposta. " +
    "A proposta deverá ser encaminhada ao comprador responsável indicado neste documento.";
  const lines = doc.splitTextToSize(msg, fullW - 6);
  doc.text(lines, ml + 3, y + 3);
  y += lines.length * 3.5 + 6;

  // ── FOOTER ──
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

  return doc;
}

export async function downloadPdfPedidoCotacaoIndividual(data: PedidoCotacaoData) {
  const doc = await gerarPdfPedidoCotacao(data);
  const cotNum = String(data.cotacao.numero).padStart(4, "0");
  const nomeArq = data.fornecedor.nome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  doc.save(`Pedido_Cotacao_COT-${cotNum}_${nomeArq}.pdf`);
}

export async function gerarBlobPedidoCotacao(data: PedidoCotacaoData): Promise<{ blob: Blob; fileName: string }> {
  const doc = await gerarPdfPedidoCotacao(data);
  const cotNum = String(data.cotacao.numero).padStart(4, "0");
  const nomeArq = data.fornecedor.nome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  return { blob: doc.output("blob"), fileName: `Pedido_Cotacao_COT-${cotNum}_${nomeArq}.pdf` };
}

export async function downloadPdfPedidoCotacaoTodos(
  cotacao: CotacaoCompras,
  requisicao: RequisicaoCompras | null,
  empresa: Empresa | null,
  fornecedores: FornecedorInfo[]
) {
  for (const forn of fornecedores) {
    await downloadPdfPedidoCotacaoIndividual({ cotacao, requisicao, empresa, fornecedor: forn });
  }
}
