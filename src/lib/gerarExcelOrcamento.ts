import { Orcamento } from "@/contexts/OrcamentosContext";
import { Empresa } from "@/contexts/EmpresaContext";

import type ExcelJSTypes from "exceljs";
const getExcelJS = async () => (await import("exceljs")).default;


const SEM_FAMILIA = "SEM FAMÍLIA";

// Cores extraídas do modelo enviado pelo cliente
const COR_FAMILIA = "FFDAE3F3";      // Azul claro
const COR_SUBTOTAL = "FFE2EFDA";     // Verde claro
const COR_TOTAL = "FF002060";        // Azul marinho
const COR_HEADER = "FF1E3A6B";       // Cabeçalho tabela (dark blue)

type Linha = {
  familia: string; codigo: string; descricao: string; unidade: string;
  quantidade: number; valorUnitario: number; valorTotal: number;
};

function coletar(orc: Orcamento): Map<string, Linha[]> {
  const linhas: Linha[] = [
    ...orc.itensSco.map<Linha>(i => ({
      familia: (i.familia || SEM_FAMILIA).trim().toUpperCase() || SEM_FAMILIA,
      codigo: i.codSco, descricao: i.descricao, unidade: i.unidade,
      quantidade: i.quantidade, valorUnitario: i.valorUnitario, valorTotal: i.valorTotal,
    })),
    ...orc.itensMateriais.map<Linha>(i => ({
      familia: (i.familia || SEM_FAMILIA).trim().toUpperCase() || SEM_FAMILIA,
      codigo: i.codigo, descricao: i.descricao, unidade: i.unidade,
      quantidade: i.quantidade, valorUnitario: i.valorUnitario, valorTotal: i.valorTotal,
    })),
  ];
  const map = new Map<string, Linha[]>();
  for (const l of linhas) {
    if (!map.has(l.familia)) map.set(l.familia, []);
    map.get(l.familia)!.push(l);
  }
  return map;
}

const fill = (color: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: color } });
const thinBorder = {
  top: { style: "thin" as const, color: { argb: "FFB4B4B4" } },
  left: { style: "thin" as const, color: { argb: "FFB4B4B4" } },
  bottom: { style: "thin" as const, color: { argb: "FFB4B4B4" } },
  right: { style: "thin" as const, color: { argb: "FFB4B4B4" } },
};

async function fetchLogoBuffer(url: string): Promise<{ buffer: ArrayBuffer; ext: "png" | "jpeg" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    const ext: "png" | "jpeg" = type.includes("jpeg") || type.includes("jpg") || /\.jpe?g($|\?)/i.test(url) ? "jpeg" : "png";
    return { buffer: await res.arrayBuffer(), ext };
  } catch { return null; }
}

export async function gerarExcelOrcamento(orc: Orcamento, empresa?: Empresa) {
  const wb = new (await getExcelJS()).Workbook();
  const ws = wb.addWorksheet("Orçamento");

  ws.columns = [
    { width: 22 }, { width: 60 }, { width: 10 },
    { width: 12 }, { width: 16 }, { width: 16 },
  ];

  // Logo da empresa (canto superior esquerdo)
  if (empresa?.logoUrl) {
    const logo = await fetchLogoBuffer(empresa.logoUrl);
    if (logo) {
      const imageId = wb.addImage({ buffer: logo.buffer as any, extension: logo.ext });
      ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 140, height: 90 } });
    }
  }
  for (let r = 1; r <= 6; r++) ws.getRow(r).height = 16;

  // Nome da empresa (padrão LASANT)
  ws.mergeCells("A7:F7");
  const emp = ws.getCell("A7");
  emp.value = (empresa?.razaoSocial || empresa?.nomeFantasia || "LASANT CONSTRUÇÕES LTDA").toUpperCase();
  emp.font = { bold: true, size: 12, color: { argb: "FF1E3A6B" } };
  emp.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(7).height = 20;


  // Título
  ws.mergeCells("A9:F9");
  const title = ws.getCell("A9");
  title.value = "ORÇAMENTO DE SERVIÇO";
  title.font = { bold: true, size: 16, color: { argb: "FF1E3A6B" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(9).height = 24;

  // Info do orçamento
  const info: Array<[string, any, string, any]> = [
    ["Orçamento Nº", orc.numero, "SS Nº", orc.solicitacaoNumero],
    ["Cliente", orc.clienteNome, "Status", orc.status],
    ["Categoria", orc.categoria || "-", "Data", orc.createdAt ? new Date(orc.createdAt).toLocaleDateString("pt-BR") : ""],
  ];
  info.forEach((row, idx) => {
    const r = 11 + idx;
    ws.getCell(`A${r}`).value = row[0];
    ws.getCell(`A${r}`).font = { bold: true };
    ws.getCell(`B${r}`).value = row[1];
    ws.getCell(`D${r}`).value = row[2];
    ws.getCell(`D${r}`).font = { bold: true };
    ws.getCell(`E${r}`).value = row[3];
  });

  // Cabeçalho da tabela
  const headerRow = 15;
  const headers = ["Código", "Descrição", "Unid", "Quant", "Pr. Unit.", "Pr. Total"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(COR_HEADER);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });



  const money = 'R$ #,##0.00;[Red]-R$ #,##0.00';
  const grupos = coletar(orc);
  let cursor = headerRow + 1;

  for (const [familia, itens] of Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"))) {
    // Linha da Família (label em A, fill em toda a linha, sem merge)
    const famCell = ws.getCell(cursor, 1);
    famCell.value = familia;
    famCell.font = { bold: true, color: { argb: "FF1E3A6B" } };
    famCell.alignment = { horizontal: "left", vertical: "middle" };
    for (let c = 1; c <= 6; c++) {
      const cell = ws.getCell(cursor, c);
      cell.fill = fill(COR_FAMILIA);
      cell.border = thinBorder;
    }
    cursor++;

    let sub = 0;
    for (const it of itens) {
      sub += it.valorTotal;
      const row = [it.codigo, it.descricao, it.unidade, it.quantidade, it.valorUnitario, it.valorTotal];
      row.forEach((v, i) => {
        const cell = ws.getCell(cursor, i + 1);
        cell.value = v;
        cell.border = thinBorder;
        cell.alignment = { vertical: "top", wrapText: i === 1 };
        if (i >= 3) cell.alignment = { horizontal: "right", vertical: "top" };
        if (i === 2) cell.alignment = { horizontal: "center", vertical: "top" };
        if (i === 4 || i === 5) cell.numFmt = money;
      });
      cursor++;
    }

    // Subtotal (label em A, valor em F, sem merge)
    const subLabel = ws.getCell(cursor, 1);
    subLabel.value = `Subtotal ${familia}:`;
    subLabel.font = { bold: true };
    subLabel.alignment = { horizontal: "left", vertical: "middle" };
    const subVal = ws.getCell(cursor, 6);
    subVal.value = sub;
    subVal.numFmt = money;
    subVal.font = { bold: true };
    subVal.alignment = { horizontal: "right", vertical: "middle" };
    for (let c = 1; c <= 6; c++) {
      const cell = ws.getCell(cursor, c);
      cell.fill = fill(COR_SUBTOTAL);
      cell.border = thinBorder;
    }
    cursor++;
  }


  // Total geral (linha em branco antes)
  cursor++;
  const totLabel = ws.getCell(cursor, 1);
  totLabel.value = "TOTAL GERAL:";
  totLabel.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  totLabel.alignment = { horizontal: "left", vertical: "middle" };
  const totVal = ws.getCell(cursor, 6);
  totVal.value = orc.valorTotal;
  totVal.numFmt = money;
  totVal.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  totVal.alignment = { horizontal: "right", vertical: "middle" };
  for (let c = 1; c <= 6; c++) {
    const cell = ws.getCell(cursor, c);
    cell.fill = fill(COR_TOTAL);
    cell.border = thinBorder;
  }
  ws.getRow(cursor).height = 20;
  cursor += 2;


  if (orc.observacoes) {
    ws.getCell(cursor, 1).value = "Observações:";
    ws.getCell(cursor, 1).font = { bold: true };
    ws.mergeCells(cursor, 2, cursor, 6);
    ws.getCell(cursor, 2).value = orc.observacoes;
    ws.getCell(cursor, 2).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Orcamento_${orc.numero}_SS${orc.solicitacaoNumero}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
