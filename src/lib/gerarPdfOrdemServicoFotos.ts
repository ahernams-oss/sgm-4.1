import { formatNumeroAno } from "@/lib/formatNumero";
import { supabase } from "@/integrations/supabase/client";
import { renderOS, addContinuationHeaders, type RenderOSOptions } from "@/lib/gerarPdfOrdemServico";
import { renderOrdemServicoEducacao } from "@/lib/gerarPdfOrdemServicoEducacao";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const DARK = [60, 60, 60] as const;
const BORDER: [number, number, number] = [60, 60, 60];

async function resolverModeloNome(cliente?: any): Promise<string> {
  const id = cliente?.modeloOsId;
  if (!id) return "";
  try {
    const { data } = await (supabase as any).from("os_modelos").select("nome").eq("id", id).maybeSingle();
    return data?.nome || "";
  } catch { return ""; }
}

async function loadImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(b);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
      img.onerror = () => resolve({ w: 4, h: 3 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

const fmtDateTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Cabeçalho do relatório fotográfico, no mesmo padrão do modelo padrão de OS. */
async function renderCabecalhoFotos(doc: jsPDF, { os, empresa, cliente }: RenderOSOptions): Promise<number> {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 12, mr = 12;
  const cw = pw - ml - mr;
  let y = 12;

  const clienteLogoUrl = (cliente as any)?.logoUrl;
  if (clienteLogoUrl) {
    const img = await loadImage(clienteLogoUrl);
    if (img) { try { doc.addImage(img.dataUrl, "PNG", ml, y, 30, 16); } catch { /* ignore */ } }
  }
  if (empresa?.logoUrl) {
    const img = await loadImage(empresa.logoUrl);
    if (img) { try { doc.addImage(img.dataUrl, "PNG", pw - mr - 32, y, 32, 16); } catch { /* ignore */ } }
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
  doc.text("RELATÓRIO FOTOGRÁFICO — ORDEM DE SERVIÇO", pw / 2, y + 23, { align: "center" });

  const anoOS = (() => {
    const d = os.createdAt ? new Date(os.createdAt) : new Date();
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  })();
  const numeroFormatado = `${String(os.numero).padStart(2, "0")}-${(cliente as any)?.cap || "0"}/${anoOS}-${os.tipoOs?.sigla || ""}`;
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

  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30], valign: "middle" },
    body: [
      [
        { content: "Unidade Requisitante:", styles: { fontStyle: "bold" } },
        { content: os.localDescricao || "-", styles: { fontStyle: "bold" } },
        { content: "Tipo de serviço:", styles: { fontStyle: "bold" } },
        { content: os.categoria || os.servico || "-", styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Pavimento:", styles: { fontStyle: "bold" } },
        { content: os.pavimentoDescricao || "-", styles: { fontStyle: "bold" } },
        { content: "Setor:", styles: { fontStyle: "bold" } },
        { content: os.setorDescricao || "-", styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Solicitante:", styles: { fontStyle: "bold" } },
        { content: os.solicitante || "-", styles: { fontStyle: "bold" } },
        { content: "Emissão:", styles: { fontStyle: "bold" } },
        { content: fmtDateTime(os.createdAt) || "-", styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Descrição do serviço:", styles: { fontStyle: "bold" } },
        { content: os.descricaoServicos || "-", colSpan: 3 },
      ],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.20 }, 1: { cellWidth: cw * 0.32 },
      2: { cellWidth: cw * 0.16 }, 3: { cellWidth: cw * 0.32 },
    },
    margin: { left: ml, right: mr },
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

/** Renderiza as fotos em grade 2 colunas, quebrando páginas quando necessário. */
async function renderFotos(doc: jsPDF, opts: RenderOSOptions, startY: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 12, mr = 12;
  const cw = pw - ml - mr;
  const gap = 6;
  const cellW = (cw - gap) / 2;
  const cellH = 62;      // área da imagem
  const legendaH = 6;
  const blocoH = cellH + legendaH + gap;

  const fotos = (opts.os as any).fotos || [];
  let y = startY;

  if (fotos.length === 0) {
    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, lineColor: BORDER, lineWidth: 0.3, textColor: [120, 120, 120], halign: "center" },
      body: [[{ content: "Nenhuma foto anexada a esta Ordem de Serviço." }]],
      columnStyles: { 0: { cellWidth: cw } },
      margin: { left: ml, right: mr },
    });
    return;
  }

  for (let i = 0; i < fotos.length; i++) {
    const col = i % 2;
    if (col === 0 && y + blocoH > ph - 15) {
      doc.addPage();
      y = 18;
    }
    const x = ml + col * (cellW + gap);

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(x, y, cellW, cellH);

    const img = await loadImage(fotos[i].url);
    if (img) {
      const maxW = cellW - 3;
      const maxH = cellH - 3;
      const ratio = Math.min(maxW / img.w, maxH / img.h);
      const w = img.w * ratio;
      const h = img.h * ratio;
      try {
        doc.addImage(img.dataUrl, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
      } catch { /* ignore */ }
    } else {
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Imagem indisponível", x + cellW / 2, y + cellH / 2, { align: "center" });
    }

    // Legenda
    doc.setDrawColor(...BORDER);
    doc.rect(x, y + cellH, cellW, legendaH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(30, 30, 30);
    doc.text(`Foto ${i + 1}`, x + cellW / 2, y + cellH + 4, { align: "center" });

    if (col === 1) y += blocoH;
  }
}

const nf2 = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getEntradasMem(l: any): any[] {
  if (Array.isArray(l?.entradas) && l.entradas.length) return l.entradas;
  return [{
    setor: l?.setor || "", funcionario: l?.funcionario, quantidade: l?.quantidade,
    comprimento: l?.comprimento, largura: l?.largura, altura: l?.altura, hrDia: l?.hrDia, dias: l?.dias,
  }];
}

function calcEntradaMem(tipo: string, e: any): number {
  if (tipo === "area") {
    const alt = Number(e.altura) || 0;
    return (Number(e.quantidade) || 0) * (Number(e.comprimento) || 0) * (Number(e.largura) || 0) * (alt > 0 ? alt : 1);
  }
  if (tipo === "mao_de_obra") return (Number(e.hrDia) || 0) * (Number(e.dias) || 0);
  return Number(e.quantidade) || 0;
}

function calcLinhaMem(tipo: string, l: any): number {
  return getEntradasMem(l).reduce((s: number, e: any) => s + calcEntradaMem(tipo, e), 0);
}


/** Renderiza a memória de cálculo (grupos) em tabelas. */
async function renderMemoriaCalculo(doc: jsPDF, grupos: any[], startY: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 12, mr = 12;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...(DARK as unknown as [number, number, number]));
  doc.text("MEMÓRIA DE CÁLCULO", pw / 2, y, { align: "center" });
  y += 5;

  if (!grupos.length) {
    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, lineColor: BORDER, lineWidth: 0.3, textColor: [120, 120, 120], halign: "center" },
      body: [[{ content: "Nenhuma memória de cálculo vinculada a esta Ordem de Serviço." }]],
      margin: { left: ml, right: mr },
    });
    return;
  }

  for (const g of grupos) {
    const tipoGrupo = (g.tipo || "unidade") as string;
    const linhas: any[] = Array.isArray(g.linhas) ? g.linhas : [];
    const tipoDe = (l: any): string => (l?.tipo || tipoGrupo) as string;
    const tipos = linhas.length ? linhas.map(tipoDe) : [tipoGrupo];
    const hasArea = tipos.includes("area");
    const hasMo = tipos.includes("mao_de_obra");
    const hasQtd = hasArea || tipos.includes("unidade");
    const uniforme = tipos.every(t => t === tipos[0]) ? tipos[0] : null;
    const totalLabel = uniforme === "area" ? "ÁREA" : uniforme === "mao_de_obra" ? "TOTAL (h)" : uniforme === "unidade" ? "QTD (un)" : "TOTAL";
    const extra = [
      ...(hasQtd ? ["QTD"] : []),
      ...(hasArea ? ["COMP.", "LARG.", "ALT."] : []),
      ...(hasMo ? ["HR/DIA", "DIAS"] : []),
    ];
    const tipoLabel = (t: string) => (t === "area" ? "Área" : t === "mao_de_obra" ? "Mão de obra" : "Unidade");
    const head = [["ITEM", "CÓDIGO", "DESCRIÇÃO", "TIPO", "SETOR", ...extra, totalLabel]];
    const body: any[] = [];
    linhas.forEach((l: any) => {
      const tipo = tipoDe(l);
      const entradas = getEntradasMem(l);
      entradas.forEach((e: any, ei: number) => {
        const cols: string[] = [];
        if (hasQtd) cols.push(tipo === "mao_de_obra" ? "" : nf2(e.quantidade));
        if (hasArea) cols.push(
          tipo === "area" ? nf2(e.comprimento) : "",
          tipo === "area" ? nf2(e.largura) : "",
          tipo === "area" ? nf2(e.altura) : "",
        );
        if (hasMo) cols.push(
          tipo === "mao_de_obra" ? nf2(e.hrDia) : "",
          tipo === "mao_de_obra" ? nf2(e.dias) : "",
        );
        const base = ei === 0
          ? [
              { content: l.item || "", rowSpan: entradas.length },
              { content: l.codigo || "", rowSpan: entradas.length },
              { content: l.descricao || "", rowSpan: entradas.length },
              { content: tipoLabel(tipo), rowSpan: entradas.length },
              e.setor || "",
            ]
          : [e.setor || ""];
        body.push([...base, ...cols, nf2(calcEntradaMem(tipo, e))]);
      });
      body.push([
        {
          content: `SUBTOTAL${l.item ? ` ITEM ${l.item}` : " DO ITEM"}`,
          colSpan: 5 + extra.length,
          styles: { halign: "right", fontStyle: "bold", fillColor: [248, 248, 248] },
        } as any,
        { content: nf2(calcLinhaMem(tipoDe(l), l)), styles: { fontStyle: "bold", fillColor: [248, 248, 248] } } as any,
      ]);
    });
    const total = linhas.reduce((s, l) => s + calcLinhaMem(tipoDe(l), l), 0);
    const nCols = 5 + extra.length + 1;
    body.push([{ content: "TOTAL", colSpan: nCols - 1, styles: { halign: "right", fontStyle: "bold" } } as any, nf2(total)]);


    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      head: [[{ content: `${g.item ? `${g.item} - ` : ""}${g.titulo || "SEM TÍTULO"}`, colSpan: nCols, styles: { halign: "left", fillColor: [235, 235, 235], textColor: [30, 30, 30] } } as any], ...head],
      body,
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.2, textColor: [30, 30, 30] },
      headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 7 },
      columnStyles: Object.fromEntries(
        Array.from({ length: nCols }).map((_, i) => [i, i >= 5 ? { halign: "right" as const } : {}])
      ) as any,
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }
}

async function finalizar(doc: jsPDF, opts: RenderOSOptions, sufixo: string) {
  const c: any = opts.cliente || {};
  const ident = [c.relLinha1, c.relLinha2, c.relLinha3, c.relLinha4]
    .map((s: any) => (s || "").toString().trim())
    .filter(Boolean)
    .join(" — ") || (opts.os.clienteNome || "");
  addContinuationHeaders(doc, formatNumeroAno(opts.os.numero, opts.os.createdAt), ident);
  doc.save(`OS_${formatNumeroAno(opts.os.numero, opts.os.createdAt)}_${sufixo}_${(opts.os.clienteNome || "").replace(/\s+/g, "_")}.pdf`);
}

async function renderBase(doc: jsPDF, opts: RenderOSOptions) {
  const modelo = await resolverModeloNome(opts.cliente);
  if (modelo === "Modelo_Educação") {
    await renderOrdemServicoEducacao(doc, opts);
  } else {
    await renderOS(doc, opts);
  }
}

export async function gerarPdfOrdemServicoComFotos(opts: RenderOSOptions) {
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  await renderBase(doc, opts);
  doc.addPage();
  const y = await renderCabecalhoFotos(doc, opts);
  await renderFotos(doc, opts, y);
  await finalizar(doc, opts, "Fotos");
}

export async function gerarPdfOrdemServicoFotosMemoria(
  opts: RenderOSOptions & { memoriaCalculo?: any[] }
) {
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  await renderBase(doc, opts);

  doc.addPage();
  const y = await renderCabecalhoFotos(doc, opts);
  await renderFotos(doc, opts, y);

  doc.addPage();
  const y2 = await renderCabecalhoFotos(doc, opts);
  renderMemoriaCalculo(doc, Array.isArray(opts.memoriaCalculo) ? opts.memoriaCalculo : [], y2);

  await finalizar(doc, opts, "Fotos_Memoria");
}

const BUCKET_MEM = "memoria-calculo-imagens";

async function carregarFotosLinha(l: any) {
  const imgs: any[] = Array.isArray(l?.imagens) ? l.imagens : [];
  const out: { dataUrl: string }[] = [];
  for (const img of imgs.slice(0, 3)) {
    try {
      const { data } = await supabase.storage.from(BUCKET_MEM).createSignedUrl(img.path, 3600);
      if (!data?.signedUrl) continue;
      const loaded = await loadImage(data.signedUrl);
      if (loaded) out.push({ dataUrl: loaded.dataUrl });
    } catch { /* ignore */ }
  }
  return out;
}

/** Memória de cálculo item a item, com as fotos de cada sub-item logo abaixo. */
async function renderMemoriaCalculoComFotos(doc: jsPDF, grupos: any[], startY: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 12, mr = 12;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...(DARK as unknown as [number, number, number]));
  doc.text("MEMÓRIA DE CÁLCULO COM FOTOS", pw / 2, y, { align: "center" });
  y += 5;

  if (!grupos.length) {
    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, lineColor: BORDER, lineWidth: 0.3, textColor: [120, 120, 120], halign: "center" },
      body: [[{ content: "Nenhuma memória de cálculo vinculada a esta Ordem de Serviço." }]],
      margin: { left: ml, right: mr },
    });
    return;
  }

  const tipoLabel = (t: string) => (t === "area" ? "Área" : t === "mao_de_obra" ? "Mão de obra" : "Unidade");

  for (const g of grupos) {
    const tipoGrupo = (g.tipo || "unidade") as string;
    const linhas: any[] = Array.isArray(g.linhas) ? g.linhas : [];
    const tipoDe = (l: any): string => (l?.tipo || tipoGrupo) as string;
    const tipos = linhas.length ? linhas.map(tipoDe) : [tipoGrupo];
    const hasArea = tipos.includes("area");
    const hasMo = tipos.includes("mao_de_obra");
    const hasQtd = hasArea || tipos.includes("unidade");
    const uniforme = tipos.every(t => t === tipos[0]) ? tipos[0] : null;
    const totalLabel = uniforme === "area" ? "ÁREA" : uniforme === "mao_de_obra" ? "TOTAL (h)" : uniforme === "unidade" ? "QTD (un)" : "TOTAL";
    const extra = [
      ...(hasQtd ? ["QTD"] : []),
      ...(hasArea ? ["COMP.", "LARG.", "ALT."] : []),
      ...(hasMo ? ["HR/DIA", "DIAS"] : []),
    ];
    const head = [["ITEM", "CÓDIGO", "DESCRIÇÃO", "TIPO", "SETOR", ...extra, totalLabel]];
    const nCols = 5 + extra.length + 1;

    if (y > ph - 50) { doc.addPage(); y = 20; }

    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      body: [[{
        content: `${g.item ? `${g.item} - ` : ""}${g.titulo || "SEM TÍTULO"}`,
        styles: { fillColor: [235, 235, 235], textColor: [30, 30, 30], fontStyle: "bold", halign: "left" },
      } as any]],
      styles: { fontSize: 8, cellPadding: 2, lineColor: BORDER, lineWidth: 0.2 },
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY;

    for (const l of linhas) {
      const tipo = tipoDe(l);
      const entradas = getEntradasMem(l);
      const body: any[] = [];

      entradas.forEach((e: any, ei: number) => {
        const cols: string[] = [];
        if (hasQtd) cols.push(tipo === "mao_de_obra" ? "" : nf2(e.quantidade));
        if (hasArea) cols.push(
          tipo === "area" ? nf2(e.comprimento) : "",
          tipo === "area" ? nf2(e.largura) : "",
          tipo === "area" ? nf2(e.altura) : "",
        );
        if (hasMo) cols.push(
          tipo === "mao_de_obra" ? nf2(e.hrDia) : "",
          tipo === "mao_de_obra" ? nf2(e.dias) : "",
        );
        const base = ei === 0
          ? [
              { content: l.item || "", rowSpan: entradas.length },
              { content: l.codigo || "", rowSpan: entradas.length },
              { content: l.descricao || "", rowSpan: entradas.length },
              { content: tipoLabel(tipo), rowSpan: entradas.length },
              e.setor || "",
            ]
          : [e.setor || ""];
        body.push([...base, ...cols, nf2(calcEntradaMem(tipo, e))]);
      });

      body.push([
        {
          content: `SUBTOTAL${l.item ? ` ITEM ${l.item}` : " DO ITEM"}`,
          colSpan: nCols - 1,
          styles: { halign: "right", fontStyle: "bold", fillColor: [248, 248, 248] },
        } as any,
        { content: nf2(calcLinhaMem(tipo, l)), styles: { fontStyle: "bold", fillColor: [248, 248, 248] } } as any,
      ]);

      (await getAutoTable())(doc, {
        startY: y,
        theme: "grid",
        head,
        body,
        styles: { fontSize: 7, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.2, textColor: [30, 30, 30] },
        headStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 7 },
        columnStyles: Object.fromEntries(
          Array.from({ length: nCols }).map((_, i) => [i, i >= 5 ? { halign: "right" as const } : {}])
        ) as any,
        margin: { left: ml, right: mr },
      });
      y = (doc as any).lastAutoTable.finalY + 3;

      const fotos = await carregarFotosLinha(l);
      if (fotos.length) {
        const gap = 4;
        const imgW = (pw - ml - mr - gap * 2) / 3;
        const imgH = imgW * 0.72;
        if (y + imgH + 12 > ph - 16) { doc.addPage(); y = 20; }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...(DARK as unknown as [number, number, number]));
        doc.text(`FOTOS — ITEM ${l.item || ""}`.trim(), ml, y + 3);
        y += 6;

        fotos.forEach((f, i) => {
          const x = ml + i * (imgW + gap);
          try {
            const fmt = f.dataUrl.includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(f.dataUrl, fmt, x, y, imgW, imgH);
          } catch { /* ignore */ }
          doc.setDrawColor(...BORDER);
          doc.setLineWidth(0.2);
          doc.rect(x, y, imgW, imgH);
        });
        y += imgH + 6;
        doc.setTextColor(30, 30, 30);
      }

      if (y > ph - 40) { doc.addPage(); y = 20; }
    }

    const total = linhas.reduce((s, l) => s + calcLinhaMem(tipoDe(l), l), 0);
    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      body: [[
        { content: "TOTAL:", styles: { halign: "right", fontStyle: "bold", fillColor: [245, 245, 245] } } as any,
        { content: nf2(total), styles: { fontStyle: "bold", fillColor: [245, 245, 245], cellWidth: 30, halign: "right" } } as any,
      ]],
      styles: { fontSize: 8, cellPadding: 2, lineColor: BORDER, lineWidth: 0.2 },
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
    if (y > ph - 40) { doc.addPage(); y = 20; }
  }
}

/** OS + relatório fotográfico + memória de cálculo com as fotos de cada sub-item. */
export async function gerarPdfOrdemServicoFotosMemoriaFotos(
  opts: RenderOSOptions & { memoriaCalculo?: any[] }
) {
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  await renderBase(doc, opts);

  doc.addPage();
  const y = await renderCabecalhoFotos(doc, opts);
  await renderFotos(doc, opts, y);

  doc.addPage();
  const y2 = await renderCabecalhoFotos(doc, opts);
  await renderMemoriaCalculoComFotos(doc, Array.isArray(opts.memoriaCalculo) ? opts.memoriaCalculo : [], y2);

  await finalizar(doc, opts, "Fotos_Memoria_Fotos");
}



/* ============ Impressão em lote ============ */

type LoteOpts = RenderOSOptions & { memoriaCalculo?: any[] };

async function finalizarLote(doc: jsPDF, lista: LoteOpts[], sufixo: string) {
  addContinuationHeaders(doc);
  const nums = lista.map((l) => formatNumeroAno(l.os.numero, l.os.createdAt)).join("_");
  doc.save(`OS_Lote_${sufixo}_${nums}.pdf`);
}

/** Lote: OS + relatório fotográfico. */
export async function gerarPdfOrdemServicoComFotosLote(lista: LoteOpts[]) {
  if (!lista.length) return;
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  for (let i = 0; i < lista.length; i++) {
    if (i > 0) doc.addPage();
    await renderBase(doc, lista[i]);
    doc.addPage();
    const y = await renderCabecalhoFotos(doc, lista[i]);
    await renderFotos(doc, lista[i], y);
  }
  await finalizarLote(doc, lista, "Fotos");
}

/** Lote: OS + fotos + memória de cálculo. */
export async function gerarPdfOrdemServicoFotosMemoriaLote(lista: LoteOpts[]) {
  if (!lista.length) return;
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  for (let i = 0; i < lista.length; i++) {
    if (i > 0) doc.addPage();
    await renderBase(doc, lista[i]);
    doc.addPage();
    const y = await renderCabecalhoFotos(doc, lista[i]);
    await renderFotos(doc, lista[i], y);
    doc.addPage();
    const y2 = await renderCabecalhoFotos(doc, lista[i]);
    renderMemoriaCalculo(doc, Array.isArray(lista[i].memoriaCalculo) ? lista[i].memoriaCalculo! : [], y2);
  }
  await finalizarLote(doc, lista, "Fotos_Memoria");
}

/** Lote: OS + fotos + memória de cálculo com fotos por sub-item. */
export async function gerarPdfOrdemServicoFotosMemoriaFotosLote(lista: LoteOpts[]) {
  if (!lista.length) return;
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  for (let i = 0; i < lista.length; i++) {
    if (i > 0) doc.addPage();
    await renderBase(doc, lista[i]);
    doc.addPage();
    const y = await renderCabecalhoFotos(doc, lista[i]);
    await renderFotos(doc, lista[i], y);
    doc.addPage();
    const y2 = await renderCabecalhoFotos(doc, lista[i]);
    await renderMemoriaCalculoComFotos(doc, Array.isArray(lista[i].memoriaCalculo) ? lista[i].memoriaCalculo! : [], y2);
  }
  await finalizarLote(doc, lista, "Fotos_Memoria_Fotos");
}
