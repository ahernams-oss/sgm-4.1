import { Orcamento } from "@/contexts/OrcamentosContext";
import { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const BORDER_COLOR: [number, number, number] = [180, 180, 180];

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type LinhaItem = {
  origem: "SCO" | "MAT";
  familia: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

const SEM_FAMILIA = "SEM FAMÍLIA";

function agruparPorFamilia(orc: Orcamento) {
  const linhas: LinhaItem[] = [
    ...orc.itensSco.map<LinhaItem>(i => ({
      origem: "SCO",
      familia: (i.familia || SEM_FAMILIA).trim().toUpperCase() || SEM_FAMILIA,
      codigo: i.codSco, descricao: i.descricao, unidade: i.unidade,
      quantidade: i.quantidade, valorUnitario: i.valorUnitario, valorTotal: i.valorTotal,
    })),
    ...orc.itensMateriais.map<LinhaItem>(i => ({
      origem: "MAT",
      familia: (i.familia || SEM_FAMILIA).trim().toUpperCase() || SEM_FAMILIA,
      codigo: i.codigo, descricao: i.descricao, unidade: i.unidade,
      quantidade: i.quantidade, valorUnitario: i.valorUnitario, valorTotal: i.valorTotal,
    })),
  ];
  const grupos = new Map<string, LinhaItem[]>();
  for (const l of linhas) {
    if (!grupos.has(l.familia)) grupos.set(l.familia, []);
    grupos.get(l.familia)!.push(l);
  }
  return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
}

export async function gerarPdfOrcamento(orc: Orcamento, empresa?: Empresa) {
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ml = 14;
  const mr = 14;

  // ===== Cabeçalho padrão LASANT =====
  let y = 14;
  const logoH = 18;
  const logoW = 40;

  if (empresa?.logoUrl) {
    const logoData = await loadImageAsDataUrl(empresa.logoUrl);
    if (logoData) {
      try { doc.addImage(logoData, "PNG", ml, y, logoW, logoH); } catch { /* ignore */ }
    }
  }

  const titleCenter = pw / 2;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...DARK_BLUE);
  doc.text("ORÇAMENTO DE SERVIÇO", titleCenter, y + 9, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...DARK_BLUE);
  doc.text(orc.clienteNome || "Cliente", titleCenter, y + 17, { align: "center" });

  y += logoH + 6;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.line(ml, y, pw - mr, y);
  y += 8;

  // ===== Info do Orçamento =====
  doc.setTextColor(30, 30, 30);
  (await getAutoTable())(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [180, 180, 180], lineWidth: 0.3, textColor: [30, 30, 30] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 32 },
      1: { cellWidth: 48 },
      2: { fontStyle: "bold", cellWidth: 28 },
      3: { cellWidth: "auto" },
    },
    body: [
      [
        { content: "Nº Orçamento:", styles: { fontStyle: "bold" } },
        String(orc.numero ?? "-"),
        { content: "Nº SS:", styles: { fontStyle: "bold" } },
        String(orc.solicitacaoNumero ?? "-"),
      ],
      [
        { content: "Data:", styles: { fontStyle: "bold" } },
        orc.createdAt ? new Date(orc.createdAt).toLocaleDateString("pt-BR") : "-",
        { content: "Status:", styles: { fontStyle: "bold" } },
        { content: orc.status || "-", styles: { fontStyle: "bold", textColor: [...DARK_BLUE] } },
      ],
      [
        { content: "Categoria:", styles: { fontStyle: "bold" } },
        orc.categoria || "-",
        { content: "Aprovado por:", styles: { fontStyle: "bold" } },
        orc.aprovadoPor || "-",
      ],
    ],
    margin: { left: ml, right: mr },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Tabela agrupada por Família
  const grupos = agruparPorFamilia(orc);

  if (grupos.length > 0) {
    const body: any[] = [];
    for (const [familia, itens] of grupos) {
      body.push([{
        content: familia,
        colSpan: 6,
        styles: { fillColor: [220, 228, 240], textColor: 30, fontStyle: "bold", halign: "left" },
      }]);
      let subtotal = 0;
      for (const it of itens) {
        subtotal += it.valorTotal;
        body.push([
          it.codigo,
          it.descricao,
          it.unidade,
          it.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 }),
          fmt(it.valorUnitario),
          fmt(it.valorTotal),
        ]);
      }
      body.push([
        { content: `Subtotal ${familia}:`, colSpan: 5, styles: { halign: "right", fontStyle: "bold", fillColor: [245, 247, 252] } },
        { content: fmt(subtotal), styles: { fontStyle: "bold", fillColor: [245, 247, 252] } },
      ]);
    }
    body.push([
      { content: "TOTAL GERAL:", colSpan: 5, styles: { halign: "right", fontStyle: "bold", fillColor: [30, 58, 107], textColor: 255 } },
      { content: fmt(orc.valorTotal), styles: { fontStyle: "bold", fillColor: [30, 58, 107], textColor: 255 } },
    ]);

    (await getAutoTable())(doc, {
      startY: y,
      head: [["Código", "Descrição", "Unid", "Quant", "Pr. Unit.", "Pr. Total"]],
      body,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 28 },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: 24, halign: "right" },
        5: { cellWidth: 26, halign: "right" },
      },
      theme: "grid",
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (orc.observacoes) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Observações", ml, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(orc.observacoes, pw - ml - mr);
    doc.text(lines, ml, y);
    y += lines.length * 5 + 8;
  }

  if (orc.aprovadoPor) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`Aprovado por ${orc.aprovadoPor} em ${orc.dataAprovacao ? new Date(orc.dataAprovacao).toLocaleDateString("pt-BR") : ""}`, ml, y);
  }

  doc.save(`Orcamento_${orc.numero}_SS${orc.solicitacaoNumero}.pdf`);
}
