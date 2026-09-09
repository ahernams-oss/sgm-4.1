import { OrdemServico, MaterialOS } from "@/contexts/OrdensServicoContext";
import { Empresa } from "@/contexts/EmpresaContext";
import { Cliente } from "@/contexts/ClientesContext";
import type { OsAssinatura } from "@/contexts/OsAssinaturasContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const BORDER: [number, number, number] = [40, 40, 40];

const fmtBRL = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s?: string) => {
  if (!s) return "";
  if (s.includes("/")) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
};

async function loadImage(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return await new Promise<string>((res) => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.readAsDataURL(b);
    });
  } catch { return null; }
}

interface Opts {
  os: OrdemServico;
  empresa?: Empresa;
  cliente?: Cliente;
  assinaturas?: OsAssinatura[];
}

/**
 * Layout SME (Modelo_Educação) — baseado em MODELOS_RELATORIOS_SME.xlsx
 * Estrutura: cabeçalho FISCAL.-ESCOLA-C.R.E., identificação, bloco ESTIMATIVA,
 * tipos de OS, bloco CUSTO FINAL, atestados (Fiscalização/Escola/C.R.E.).
 */
export async function renderOrdemServicoEducacao(doc: jsPDF, { os, empresa, cliente }: Opts) {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 10, mr = 10;
  const cw = pw - ml - mr;
  let y = 10;

  const anoOS = (() => {
    const d = os.createdAt ? new Date(os.createdAt) : new Date();
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  })();
  const c: any = cliente || {};

  // ============ CABEÇALHO ============
  // Faixa superior com logo cliente (esq), título (centro), logo empresa (dir)
  const headerH = 18;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.rect(ml, y, cw, headerH);

  if (c.logoUrl) {
    const d = await loadImage(c.logoUrl);
    if (d) { try { doc.addImage(d, "PNG", ml + 1, y + 1, 22, headerH - 2); } catch { /**/ } }
  }
  if (empresa?.logoUrl) {
    const d = await loadImage(empresa.logoUrl);
    if (d) { try { doc.addImage(d, "PNG", pw - mr - 23, y + 1, 22, headerH - 2); } catch { /**/ } }
  }

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("FISCAL. - ESCOLA - C.R.E.", pw / 2, y + 4, { align: "center" });
  doc.setFontSize(14);
  doc.text("ORDEM DE SERVIÇO", pw / 2, y + 11, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const linhasCli = [c.relLinha1, c.relLinha2].filter(Boolean).join(" — ");
  if (linhasCli) doc.text(linhasCli, pw / 2, y + 16, { align: "center" });

  y += headerH;

  // Linha DATA / Nº OS / ITEM-SIGLA / FL.
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.2, lineColor: BORDER, lineWidth: 0.3, halign: "center", valign: "middle", textColor: [20, 20, 20] },
    body: [
      [
        { content: "DATA", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        { content: fmtDate(os.createdAt) || "-", styles: {} },
        { content: "Nº OS", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        { content: `${String(os.numero).padStart(2, "0")}/${anoOS}`, styles: { fontStyle: "bold" } },
        { content: "ITEM - SIGLA", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        { content: os.tipoOs?.sigla || "-", styles: {} },
        { content: "FL.", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        { content: "1 / 1", styles: {} },
      ],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.10 }, 1: { cellWidth: cw * 0.15 },
      2: { cellWidth: cw * 0.08 }, 3: { cellWidth: cw * 0.15 },
      4: { cellWidth: cw * 0.13 }, 5: { cellWidth: cw * 0.13 },
      6: { cellWidth: cw * 0.06 }, 7: { cellWidth: cw * 0.20 },
    },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY;

  // ============ IDENTIFICAÇÃO ============
  const contrato = ((c.contratos || [])[0] || {}) as any;
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.6, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20], valign: "middle" },
    body: [
      [
        { content: "UNIDADE:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: os.localDescricao || c.relLinha1 || "-", colSpan: 3 },
        { content: "SOLICITANTE:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: os.solicitante || "-", colSpan: 2 },
      ],
      [
        { content: "END.:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: c.relLinha2 || "-", colSpan: 2 },
        { content: "TEL.:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: os.telefone || c.telefone || "-" },
        { content: "MATR.:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: os.matricula || "-" },
      ],
      [
        { content: "CRE:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: c.cre || c.relLinha3 || "-", colSpan: 2 },
        { content: "EMPRESA:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: empresa?.nomeFantasia || empresa?.razaoSocial || "-", colSpan: 3 },
      ],
      [
        { content: "RESP./MATR./DATA:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: `${os.operadorNome || "-"}  ${fmtDate(os.createdAt)}`, colSpan: 2 },
        { content: "Nº PROC. ORIGEM:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        { content: contrato?.numero || "-", colSpan: 3 },
      ],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.14 }, 1: { cellWidth: cw * 0.20 },
      2: { cellWidth: cw * 0.16 }, 3: { cellWidth: cw * 0.11 },
      4: { cellWidth: cw * 0.17 }, 5: { cellWidth: cw * 0.10 },
      6: { cellWidth: cw * 0.12 },
    },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  // ============ BLOCO ESTIMATIVA ============
  const renderBlocoSCO = async (titulo: string, materiais: MaterialOS[], rotuloRodape: { esq: string; dir: string }, dataLabel: { inicio: string; termino: string }) => {
    // Faixa vertical "FISCALIZAÇÃO – EMPRESA" + descrição
    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20], valign: "middle" },
      body: [
        [
          { content: "FISCALIZAÇÃO – EMPRESA", rowSpan: 3, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 230, 230], fontSize: 8 } },
          { content: "DESCRIÇÃO DO SERVIÇO:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
        ],
        [{ content: os.descricaoServicos || "-", styles: { minCellHeight: 14, valign: "top" } }],
        [{ content: "COD. COMPOSIÇÕES SCO / DESCRIÇÃO / QUANTIDADE:", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }],
      ],
      columnStyles: { 0: { cellWidth: cw * 0.08 }, 1: { cellWidth: cw * 0.92 } },
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY;

    // Tabela SCO RIO
    const total = (materiais || []).reduce((s, m) => s + (Number(m.valorTotal) || 0), 0);
    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 6.8, cellPadding: 1.2, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20], halign: "center", valign: "middle" },
      headStyles: { fillColor: [220, 220, 220], textColor: [20, 20, 20], fontStyle: "bold" },
      head: [
        [
          { content: titulo, colSpan: 7, styles: { halign: "center", fillColor: [200, 200, 200], fontSize: 8 } },
        ],
        ["Nº ITEM", "CÓDIGO SCO RIO", "DESCRIÇÃO", "UNIDADE", "PREÇO UNITÁRIO (R$)", "QUANTIDADE", "TOTAL (R$)"],
      ],
      columnStyles: {
        0: { cellWidth: cw * 0.06 },
        1: { cellWidth: cw * 0.12 },
        2: { cellWidth: cw * 0.40, halign: "left" },
        3: { cellWidth: cw * 0.08 },
        4: { cellWidth: cw * 0.12, halign: "right" },
        5: { cellWidth: cw * 0.10 },
        6: { cellWidth: cw * 0.12, halign: "right" },
      },
      body: (() => {
        const rows: any[] = (materiais || []).map((m, i) => [
          String(i + 1),
          m.codigo || "",
          m.descricao || "",
          m.unidade || "",
          fmtBRL(Number(m.valorUnitario) || 0),
          String(m.quantidade ?? ""),
          fmtBRL(Number(m.valorTotal) || 0),
        ]);
        // padding até pelo menos 7 linhas (igual ao Excel)
        while (rows.length < 7) rows.push(["", "", "", "", "", "", ""]);
        rows.push([
          { content: "TOTAL", colSpan: 6, styles: { fontStyle: "bold", halign: "right", fillColor: [235, 235, 235] } },
          { content: fmtBRL(total), styles: { fontStyle: "bold", halign: "right", fillColor: [235, 235, 235] } },
        ]);
        return rows;
      })(),
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY;

    // Rodapé do bloco — DATAS + VISTOS
    (await getAutoTable())(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.4, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20], valign: "middle" },
      body: [
        [
          { content: `${dataLabel.inicio}:`, styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
          { content: fmtDate(os.dataInicio) || "-" },
          { content: rotuloRodape.esq, styles: { fontStyle: "bold", halign: "center", fillColor: [235, 235, 235] } },
          { content: rotuloRodape.dir, styles: { fontStyle: "bold", halign: "center", fillColor: [235, 235, 235] } },
        ],
        [
          { content: `${dataLabel.termino}:`, styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
          { content: fmtDate(os.dataTermino) || "-" },
          { content: "RUBRICA: ___________________\nMATR.: ____________  DATA: __________", styles: { halign: "left", minCellHeight: 10 } },
          { content: "RUBRICA: ___________________\nMATR.: ____________  DATA: __________", styles: { halign: "left", minCellHeight: 10 } },
        ],
      ],
      columnStyles: {
        0: { cellWidth: cw * 0.18 },
        1: { cellWidth: cw * 0.22 },
        2: { cellWidth: cw * 0.30 },
        3: { cellWidth: cw * 0.30 },
      },
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY + 1;
  };

  renderBlocoSCO(
    "MATERIAL / MÃO DE OBRA (ESTIMATIVA DE CUSTO)",
    os.materiais || [],
    { esq: "VISTO SUPERVISOR MANUTENÇÃO", dir: "AUTORIZAÇÃO DA FISCALIZAÇÃO" },
    { inicio: "DATA PREVISTA PARA INÍCIO", termino: "DATA PREVISTA PARA TÉRMINO" },
  );

  // Tipos de OS
  const tipoCod = os.tipoOs?.cod ?? 1;
  const mk = (n: number, label: string) =>
    `${tipoCod === n ? "[X]" : "[  ]"} ${label}`;
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.4, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20] },
    body: [
      [{ content: "Tipo de Ordem de Serviço (tipo OS):", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }],
      [{ content: mk(1, "01 – Manutenção Corretiva Programada") }],
      [{ content: mk(2, "02 – Manutenção Corretiva Emergencial") }],
      [{ content: mk(3, "03 – Serviços (extra-manutenção)") }],
    ],
    columnStyles: { 0: { cellWidth: cw } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 1;

  // Nova página para o bloco CUSTO FINAL + atestados se faltar espaço
  const ph = doc.internal.pageSize.getHeight();
  if (y > ph - 110) { doc.addPage(); y = 10; }

  renderBlocoSCO(
    "MATERIAL / MÃO DE OBRA (CUSTO FINAL)",
    os.materiaisEstoque && os.materiaisEstoque.length > 0
      ? [...(os.materiais || []), ...(os.materiaisEstoque || [])]
      : (os.materiais || []),
    { esq: "VISTO SUPERVISOR MANUTENÇÃO", dir: "VISTO DA FISCALIZAÇÃO" },
    { inicio: "DATA EFETIVA DE INÍCIO", termino: "DATA EFETIVA DE TÉRMINO" },
  );

  // ============ ATESTADOS ============
  if (y > ph - 70) { doc.addPage(); y = 10; }

  // FISCALIZAÇÃO — 3 colunas
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.4, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20], valign: "middle" },
    body: [
      [
        { content: "FISCALIZAÇÃO", rowSpan: 5, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 230, 230] } },
        { content: "ATESTADO DO SERVIÇO EXECUTADO", styles: { fontStyle: "bold", halign: "center", fillColor: [245, 245, 245] } },
        { content: "ATESTADO DO SERVIÇO EXECUTADO", styles: { fontStyle: "bold", halign: "center", fillColor: [245, 245, 245] } },
        { content: "ATESTADO DO SERVIÇO EXECUTADO", styles: { fontStyle: "bold", halign: "center", fillColor: [245, 245, 245] } },
      ],
      [{ content: "NOME:" }, { content: "NOME:" }, { content: "NOME:" }],
      [{ content: "RUBRICA:" }, { content: "RUBRICA:" }, { content: "RUBRICA:" }],
      [{ content: "MATRÍCULA:" }, { content: "MATRÍCULA:" }, { content: "MATRÍCULA:" }],
      [{ content: "DATA:" }, { content: "DATA:" }, { content: "DATA:" }],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.10 },
      1: { cellWidth: cw * 0.30 },
      2: { cellWidth: cw * 0.30 },
      3: { cellWidth: cw * 0.30 },
    },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 1;

  // ESCOLA
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.4, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20], valign: "middle" },
    body: [
      [
        { content: "ESCOLA", rowSpan: 5, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 230, 230] } },
        { content: "ATESTADO DO SERVIÇO EXECUTADO", styles: { fontStyle: "bold", halign: "center", fillColor: [245, 245, 245] } },
        { content: "OBS.:", rowSpan: 5, styles: { fontStyle: "bold", valign: "top", fillColor: [250, 250, 250] } },
      ],
      [{ content: "NOME:" }],
      [{ content: "RUBRICA:" }],
      [{ content: "MATRÍCULA:" }],
      [{ content: "DATA:" }],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.10 },
      1: { cellWidth: cw * 0.45 },
      2: { cellWidth: cw * 0.45 },
    },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 1;

  // C.R.E.
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.4, lineColor: BORDER, lineWidth: 0.3, textColor: [20, 20, 20], valign: "middle" },
    body: [
      [
        { content: "C.R.E.", rowSpan: 5, styles: { fontStyle: "bold", halign: "center", fillColor: [230, 230, 230] } },
        { content: "ATESTADO DO SERVIÇO EXECUTADO", styles: { fontStyle: "bold", halign: "center", fillColor: [245, 245, 245] } },
        { content: "OBS.:", rowSpan: 5, styles: { fontStyle: "bold", valign: "top", fillColor: [250, 250, 250] } },
      ],
      [{ content: "NOME:" }],
      [{ content: "RUBRICA:" }],
      [{ content: "MATRÍCULA:" }],
      [{ content: "DATA:" }],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.10 },
      1: { cellWidth: cw * 0.45 },
      2: { cellWidth: cw * 0.45 },
    },
    margin: { left: ml, right: mr },
  });
}
