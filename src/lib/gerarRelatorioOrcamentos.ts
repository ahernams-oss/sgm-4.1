import { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const WHITE: [number, number, number] = [255, 255, 255];
const BAR_COLORS: [number, number, number][] = [
  [59, 130, 246],
  [16, 185, 129],
  [245, 158, 11],
  [239, 68, 68],
  [139, 92, 246],
  [236, 72, 153],
  [6, 182, 212],
  [132, 204, 22],
];

const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface OrcamentoLinha {
  numero: number | string;
  cliente: string;
  data: string;
  categoria: string;
  valor: number;
  orcamentista: string;
  status: string;
}

export interface RelatorioOrcamentosData {
  empresa?: Empresa;
  periodoLabel: string;
  filtroLabel: string;
  kpis: {
    total: number;
    valorTotal: number;
    ticket: number;
    aprovados: number;
    pendentes: number;
    disponiveis: number;
    devolvidos: number;
    cancelados: number;
  };
  porCategoria: { name: string; qtd: number; valor: number }[];
  porOrcamentista: { name: string; qtd: number; valor: number }[];
  porStatus: { name: string; value: number }[];
  lista: OrcamentoLinha[];
}

// -------- Header / Footer --------
function addHeader(doc: jsPDF, empresa?: Empresa) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...DARK_BLUE);
  doc.rect(0, 0, pw, 36, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  const title = empresa?.nomeFantasia || empresa?.razaoSocial || "SGM Lasant";
  doc.text(title, 14, 14);
  doc.setFontSize(11);
  doc.text("Relatório — Orçamentos de Engenharia", 14, 22);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, 14, { align: "right" });
  if (empresa?.cnpj) doc.text(`CNPJ: ${empresa.cnpj}`, pw - 14, 20, { align: "right" });
}

function addFooter(doc: jsPDF, empresa?: Empresa) {
  const pageCount = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.line(14, ph - 20, pw - 14, ph - 20);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    const label = empresa?.nomeFantasia || empresa?.razaoSocial || "SGM Lasant";
    doc.text(`Relatório gerado automaticamente — Engenharia — ${label}`, 14, ph - 14);
    doc.text(`Página ${i} de ${pageCount}`, pw / 2, ph - 14, { align: "center" });
  }
}

// -------- Horizontal bar chart (drawn natively) --------
function drawHorizontalBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  data: { name: string; value: number; secondary?: number }[],
  opts: { valueFormatter?: (n: number) => string; showSecondary?: boolean } = {}
): number {
  const { valueFormatter = (n) => String(n), showSecondary = false } = opts;
  const rows = data.slice(0, 10);
  const rowH = 14;
  const labelW = 60;
  const valueW = 42;
  const chartX = x + labelW;
  const chartW = width - labelW - valueW;
  const headerH = 12;
  const height = headerH + Math.max(1, rows.length) * rowH + 6;

  // title
  doc.setFillColor(...DARK_BLUE);
  doc.rect(x, y, width, headerH, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, x + 4, y + 8);

  // frame
  doc.setDrawColor(220, 220, 220);
  doc.rect(x, y + headerH, width, height - headerH);

  if (!rows.length) {
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Sem dados no período.", x + width / 2, y + headerH + 20, { align: "center" });
    return y + height;
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  rows.forEach((r, i) => {
    const rowY = y + headerH + 4 + i * rowH;
    // label
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const label = r.name.length > 22 ? r.name.slice(0, 22) + "…" : r.name;
    doc.text(label, x + 3, rowY + rowH / 2 + 2);

    // bar
    const bw = Math.max(1, (r.value / max) * chartW);
    const color = BAR_COLORS[i % BAR_COLORS.length];
    doc.setFillColor(...color);
    doc.rect(chartX, rowY + 2, bw, rowH - 5, "F");

    // value
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(valueFormatter(r.value), x + width - 2, rowY + rowH / 2 + 2, { align: "right" });

    if (showSecondary && r.secondary !== undefined) {
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`(${r.secondary})`, x + width - 2, rowY + rowH / 2 + 8, { align: "right" });
    }
  });

  return y + height;
}

// -------- KPI grid --------
function drawKpis(doc: jsPDF, y: number, kpis: RelatorioOrcamentosData["kpis"]): number {
  const pw = doc.internal.pageSize.getWidth();
  const items = [
    { l: "Total Orçamentos", v: String(kpis.total), c: BAR_COLORS[0] },
    { l: "Valor Total", v: fmtBRL(kpis.valorTotal), c: BAR_COLORS[1] },
    { l: "Ticket Médio", v: fmtBRL(kpis.ticket), c: BAR_COLORS[4] },
    { l: "Aprovados", v: String(kpis.aprovados), c: BAR_COLORS[1] },
    { l: "Disponíveis", v: String(kpis.disponiveis), c: BAR_COLORS[6] },
    { l: "Pendentes", v: String(kpis.pendentes), c: BAR_COLORS[2] },
    { l: "Devolvidos", v: String(kpis.devolvidos), c: BAR_COLORS[2] },
    { l: "Cancelados", v: String(kpis.cancelados), c: BAR_COLORS[3] },
  ];
  const cols = 4;
  const gap = 4;
  const totalW = pw - 28;
  const cardW = (totalW - gap * (cols - 1)) / cols;
  const cardH = 22;
  items.forEach((it, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = 14 + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    doc.setFillColor(248, 250, 252);
    doc.rect(cx, cy, cardW, cardH, "F");
    doc.setDrawColor(...it.c);
    doc.setLineWidth(0.8);
    doc.line(cx, cy, cx, cy + cardH);
    doc.setLineWidth(0.2);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(it.l.toUpperCase(), cx + 4, cy + 7);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(it.v, cx + 4, cy + 17);
  });
  const rows = Math.ceil(items.length / cols);
  return y + rows * (cardH + gap);
}

// -------- Main PDF --------
export async function gerarRelatorioOrcamentosPDF(data: RelatorioOrcamentosData): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true, orientation: "portrait", unit: "mm", format: "a4" });
  addHeader(doc, data.empresa);

  // Filters block
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Período:", 14, 44);
  doc.setFont("helvetica", "normal");
  doc.text(data.periodoLabel, 34, 44);
  doc.setFont("helvetica", "bold");
  doc.text("Filtro:", 14, 50);
  doc.setFont("helvetica", "normal");
  doc.text(data.filtroLabel, 34, 50);

  // KPIs
  let y = drawKpis(doc, 56, data.kpis);
  y += 6;

  const pw = doc.internal.pageSize.getWidth();
  const colW = (pw - 28 - 6) / 2;

  // Charts row: Categoria (valor) | Orçamentista (valor)
  const y1 = drawHorizontalBarChart(
    doc, 14, y, colW,
    "Valor por Categoria (R$)",
    data.porCategoria.map((c) => ({ name: c.name, value: c.valor, secondary: c.qtd })),
    { valueFormatter: fmtBRL, showSecondary: true }
  );
  const y2 = drawHorizontalBarChart(
    doc, 14 + colW + 6, y, colW,
    "Valor por Orçamentista (R$)",
    data.porOrcamentista.map((o) => ({ name: o.name, value: o.valor, secondary: o.qtd })),
    { valueFormatter: fmtBRL, showSecondary: true }
  );
  y = Math.max(y1, y2) + 6;

  // Charts row: Categoria (qtd) | Status (qtd)
  const y3 = drawHorizontalBarChart(
    doc, 14, y, colW,
    "Quantidade por Categoria",
    data.porCategoria.map((c) => ({ name: c.name, value: c.qtd })),
  );
  const y4 = drawHorizontalBarChart(
    doc, 14 + colW + 6, y, colW,
    "Distribuição por Status",
    data.porStatus.map((s) => ({ name: s.name, value: s.value })),
  );
  y = Math.max(y3, y4) + 6;

  // Table: Category totals
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Categoria", "Qtd", "Valor Total"]],
    body: data.porCategoria.map((c) => [c.name, String(c.qtd), fmtBRL(c.valor)]),
    theme: "striped",
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  // Table: Orçamentista totals
  (await getAutoTable())(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    head: [["Orçamentista", "Qtd", "Valor Total"]],
    body: data.porOrcamentista.map((o) => [o.name, String(o.qtd), fmtBRL(o.valor)]),
    theme: "striped",
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  // Detailed list (new page)
  doc.addPage();
  addHeader(doc, data.empresa);
  (await getAutoTable())(doc, {
    startY: 44,
    head: [["N°", "Unidade", "Data", "Categoria", "Valor", "Orçamentista", "Status"]],
    body: data.lista.map((l) => [
      String(l.numero), l.cliente, l.data, l.categoria,
      fmtBRL(l.valor), l.orcamentista, l.status,
    ]),
    theme: "striped",
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      4: { halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, data.empresa);
  return doc;
}

export async function downloadRelatorioOrcamentosPDF(data: RelatorioOrcamentosData, filename = "relatorio-orcamentos.pdf") {
  const doc = await gerarRelatorioOrcamentosPDF(data);
  doc.save(filename);
}
