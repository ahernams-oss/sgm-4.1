import { Orcamento } from "@/contexts/OrcamentosContext";
import { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const BORDER_COLOR: [number, number, number] = [180, 180, 180];

const nf = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tipo = "area" | "mao_de_obra" | "unidade";

const UNIDADE_LABEL: Record<Tipo, string> = {
  area: "ÁREA",
  mao_de_obra: "HORA TOTAL",
  unidade: "UNIDADE",
};

const TIPO_LABEL: Record<Tipo, string> = {
  area: "Área",
  mao_de_obra: "Mão de obra",
  unidade: "Unidade",
};

const getEntradas = (l: any): any[] => {
  if (Array.isArray(l?.entradas) && l.entradas.length) return l.entradas;
  return [{
    setor: l?.setor || "",
    funcionario: l?.funcionario,
    quantidade: l?.quantidade,
    comprimento: l?.comprimento,
    largura: l?.largura,
    altura: l?.altura,
    hrDia: l?.hrDia,
    dias: l?.dias,
  }];
};

const calcEntrada = (tipo: Tipo, e: any): number => {
  if (tipo === "area") {
    const alt = Number(e.altura) || 0;
    return (e.quantidade || 0) * (e.comprimento || 0) * (e.largura || 0) * (alt > 0 ? alt : 1);
  }
  if (tipo === "mao_de_obra") return (e.hrDia || 0) * (e.dias || 0);
  return e.quantidade || 0;
};

const calcLinha = (tipo: Tipo, l: any): number =>
  getEntradas(l).reduce((s: number, e: any) => s + calcEntrada(tipo, e), 0);


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

async function renderMemoria(doc: jsPDF, orc: Orcamento, empresa?: Empresa) {
  const grupos: any[] = Array.isArray(orc.memoriaCalculo) ? orc.memoriaCalculo : [];
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

  const center = pw / 2;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...DARK_BLUE);
  doc.text("MEMÓRIA DE CÁLCULO", center, y + 9, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "italic");
  doc.text(orc.clienteNome || "Cliente", center, y + 17, { align: "center" });

  y += logoH + 6;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.line(ml, y, pw - mr, y);
  y += 8;

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
      ["Nº Orçamento:", String(orc.numero ?? "-"), "Nº SS:", String(orc.solicitacaoNumero ?? "-")],
      [
        "Data:",
        orc.createdAt ? new Date(orc.createdAt).toLocaleDateString("pt-BR") : "-",
        "Categoria:",
        orc.categoria || "-",
      ],
    ],
    margin: { left: ml, right: mr },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (!grupos.length) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Nenhuma memória de cálculo cadastrada neste orçamento.", ml, y + 4);
  }

  for (const g of grupos) {
    const tipoGrupo: Tipo = (g.tipo || "unidade") as Tipo;
    const linhas: any[] = Array.isArray(g.linhas) ? g.linhas : [];
    const tipoDe = (l: any): Tipo => ((l?.tipo || tipoGrupo) as Tipo);
    const tipos = linhas.length ? linhas.map(tipoDe) : [tipoGrupo];
    const hasArea = tipos.includes("area");
    const hasMo = tipos.includes("mao_de_obra");
    const hasQtd = hasArea || tipos.includes("unidade");
    const uniforme = tipos.every(t => t === tipos[0]) ? tipos[0] : null;
    const total = linhas.reduce((s, l) => s + calcLinha(tipoDe(l), l), 0);

    const head = [[
      "ITEM", "CÓDIGO", "DESCRIÇÃO", "TIPO", "SETOR",
      ...(hasQtd ? ["QTD"] : []),
      ...(hasArea ? ["COMP.", "LARG.", "ALT."] : []),
      ...(hasMo ? ["HR/DIA", "DIAS"] : []),
      uniforme ? UNIDADE_LABEL[uniforme] : "TOTAL",
    ]];

    const body: any[] = [
      [{
        content: `${g.item ? g.item + " - " : ""}${g.titulo || "SEM TÍTULO"}`,
        colSpan: head[0].length,
        styles: { fillColor: [220, 228, 240], textColor: 30, fontStyle: "bold", halign: "left" },
      }],
    ];

    for (const l of linhas) {
      const tipo = tipoDe(l);
      const entradas = getEntradas(l);
      entradas.forEach((e: any, ei: number) => {
        const rowSpan = entradas.length;
        const base =
          ei === 0
            ? [
                { content: l.item || "", rowSpan },
                { content: l.codigo || "", rowSpan },
                { content: l.descricao || "", rowSpan },
                { content: TIPO_LABEL[tipo], rowSpan },
                e.setor || "",
              ]
            : [e.setor || ""];
        const medidas: string[] = [];
        if (hasQtd) medidas.push(tipo === "mao_de_obra" ? "" : nf(e.quantidade || 0));
        if (hasArea) medidas.push(
          tipo === "area" ? nf(e.comprimento || 0) : "",
          tipo === "area" ? nf(e.largura || 0) : "",
          tipo === "area" ? nf(e.altura || 0) : "",
        );
        if (hasMo) medidas.push(
          tipo === "mao_de_obra" ? nf(e.hrDia || 0) : "",
          tipo === "mao_de_obra" ? nf(e.dias || 0) : "",
        );
        body.push([...base, ...medidas, nf(calcEntrada(tipo, e))]);
      });
      body.push([
        {
          content: `SUBTOTAL${l.item ? ` ITEM ${l.item}` : " DO ITEM"}`,
          colSpan: head[0].length - 1,
          styles: { halign: "right", fontStyle: "bold", fillColor: [248, 248, 248] },
        },
        { content: nf(calcLinha(tipo, l)), styles: { fontStyle: "bold", fillColor: [248, 248, 248] } },
      ]);
    }


    body.push([
      { content: "TOTAL:", colSpan: head[0].length - 1, styles: { halign: "right", fontStyle: "bold", fillColor: [245, 247, 252] } },
      { content: nf(total), styles: { fontStyle: "bold", fillColor: [245, 247, 252] } },
    ]);

    (await getAutoTable())(doc, {
      startY: y,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255 },
      columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 24 } },
      theme: "grid",
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
    if (y > 260) { doc.addPage(); y = 20; }
  }

}

function aplicarRodape(doc: jsPDF, empresa?: Empresa) {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 14;
  const mr = 14;
  const pages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${empresa?.razaoSocial || empresa?.nomeFantasia || "LASANT"} — Memória de Cálculo`,
      ml,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(`Página ${p} de ${pages}`, pw - mr, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }
}

export async function gerarPdfMemoriaCalculo(orc: Orcamento, empresa?: Empresa) {
  const doc = new (await getJsPDF())({ compress: true });
  await renderMemoria(doc, orc, empresa);
  aplicarRodape(doc, empresa);
  doc.save(`Memoria_Calculo_Orcamento_${orc.numero}.pdf`);
}

export async function gerarPdfMemoriaCalculoLote(orcs: Orcamento[], empresa?: Empresa) {
  const doc = new (await getJsPDF())({ compress: true });
  for (let i = 0; i < orcs.length; i++) {
    if (i > 0) doc.addPage();
    await renderMemoria(doc, orcs[i], empresa);
  }
  aplicarRodape(doc, empresa);
  doc.save(`Memorias_Calculo_Lote_${orcs.length}.pdf`);
}
