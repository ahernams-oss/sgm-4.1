import type { Cliente, Contrato, Faturamento } from "@/contexts/ClientesContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const parseBR = (v?: string | number | null): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/[R$\s]/g, "");
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesLabel = (d: Date) => `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;

export interface SaldoRow {
  mesLabel: string;
  mesKey: string; // YYYY-MM
  numeroNf: string;
  fatFolha: number;
  fatVariavel: number;
  fatTotal: number;
  prevFolha: number;
  prevVariavel: number;
  saldoFolha: number;
  saldoVariavel: number;
}

export interface SaldoReportInput {
  cliente: Cliente;
  contrato: Contrato;
  periodoInicio: string; // YYYY-MM-01
  periodoFim: string; // YYYY-MM-01
  prevFolhaMensal: number;
  prevVariavelMensal: number;
  transferencias?: SaldoTransferenciaContrato[];
}

type TipoSaldoTransferencia = "maoDeObraMensal" | "maoDeObraAnual" | "maoDeObraContratual" | "valorVariavel";

export interface SaldoTransferenciaContrato {
  data: string;
  created_at?: string | null;
  tipo_saldo: TipoSaldoTransferencia;
  contrato_origem_id?: string | null;
  contrato_destino_id?: string | null;
  saldo_origem_antes?: number | null;
  saldo_origem_depois?: number | null;
  saldo_destino_antes?: number | null;
  saldo_destino_depois?: number | null;
}

const transferenciaTime = (t: SaldoTransferenciaContrato) => {
  const dataTime = new Date((t.data || "1900-01-01") + "T00:00:00").getTime();
  const createdTime = t.created_at ? new Date(t.created_at).getTime() : 0;
  return dataTime + createdTime / 100000000;
};

const fimDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

const saldoTransferencia = (t: SaldoTransferenciaContrato, contratoId: string, momento: "antes" | "depois") => {
  if (t.contrato_origem_id === contratoId) {
    return Number(momento === "antes" ? t.saldo_origem_antes : t.saldo_origem_depois);
  }
  if (t.contrato_destino_id === contratoId) {
    return Number(momento === "antes" ? t.saldo_destino_antes : t.saldo_destino_depois);
  }
  return NaN;
};

const valorPrevistoNaData = (
  transferencias: SaldoTransferenciaContrato[] | undefined,
  contratoId: string,
  tipo: TipoSaldoTransferencia,
  fallback: number,
  dataLimite: Date,
  normalizar: (n: number) => number = (n) => n
) => {
  const relevantes = (transferencias || [])
    .filter((t) => t.tipo_saldo === tipo && (t.contrato_origem_id === contratoId || t.contrato_destino_id === contratoId))
    .sort((a, b) => transferenciaTime(a) - transferenciaTime(b));
  if (relevantes.length === 0) return fallback;

  const limite = dataLimite.getTime();
  const ateData = relevantes.filter((t) => new Date((t.data || "1900-01-01") + "T00:00:00").getTime() <= limite);
  const ref = ateData[ateData.length - 1];
  if (ref) {
    const valor = saldoTransferencia(ref, contratoId, "depois");
    return isFinite(valor) ? normalizar(valor) : fallback;
  }

  const primeiraFutura = relevantes[0];
  const valorAntes = saldoTransferencia(primeiraFutura, contratoId, "antes");
  return isFinite(valorAntes) ? normalizar(valorAntes) : fallback;
};

const valorFolhaPrevistoNaData = (input: SaldoReportInput, dataLimite: Date) => {
  const { contrato, prevFolhaMensal, transferencias } = input;
  const temTipo = (tipo: TipoSaldoTransferencia) => (transferencias || []).some(
    (t) => t.tipo_saldo === tipo && (t.contrato_origem_id === contrato.id || t.contrato_destino_id === contrato.id)
  );
  if (temTipo("maoDeObraMensal")) return valorPrevistoNaData(transferencias, contrato.id, "maoDeObraMensal", prevFolhaMensal, dataLimite);
  if (temTipo("maoDeObraAnual")) return valorPrevistoNaData(transferencias, contrato.id, "maoDeObraAnual", prevFolhaMensal, dataLimite, (n) => n / 12);
  if (temTipo("maoDeObraContratual")) return valorPrevistoNaData(transferencias, contrato.id, "maoDeObraContratual", prevFolhaMensal, dataLimite, (n) => n / 12);
  return prevFolhaMensal;
};

export function montarLinhasSaldos(input: SaldoReportInput): SaldoRow[] {
  const { contrato, periodoInicio, periodoFim, prevFolhaMensal, prevVariavelMensal } = input;
  const start = new Date(periodoInicio + "T00:00:00");
  const end = new Date(periodoFim + "T00:00:00");
  const rows: SaldoRow[] = [];

  // Group faturamentos by mês (periodoInicio)
  const byMonth = new Map<string, Faturamento[]>();
  (contrato.faturamentos || []).forEach((f) => {
    if (!f.periodoInicio) return;
    const key = f.periodoInicio.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(f);
  });

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const fats = byMonth.get(key) || [];
    const fatFolha = fats.reduce((s, f) => s + parseBR(f.valorFolha), 0);
    const fatVariavel = fats.reduce((s, f) => s + parseBR(f.valorVariavel), 0);
    // Valor Bruto da NF = Folha + Variável
    const fatTotal = fatFolha + fatVariavel;
    const numeroNf = fats.map((f) => f.numeroNf).filter(Boolean).join(", ");
    const dataLimiteMes = fimDoMes(cursor);
    const prevFolhaMes = valorFolhaPrevistoNaData(input, dataLimiteMes);
    const prevVariavelMes = valorPrevistoNaData(input.transferencias, contrato.id, "valorVariavel", prevVariavelMensal, dataLimiteMes);

    rows.push({
      mesLabel: mesLabel(cursor),
      mesKey: key,
      numeroNf,
      fatFolha,
      fatVariavel,
      fatTotal,
      prevFolha: prevFolhaMes,
      prevVariavel: prevVariavelMes,
      saldoFolha: prevFolhaMes - fatFolha,
      saldoVariavel: prevVariavelMes - fatVariavel,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return rows;
}

const HEADERS = [
  "MÊS",
  "Nº Nota Fiscal",
  "V. Fat. - M.O. Fixa",
  "V. Fat. - Variável",
  "V. Total - Nota Fiscal",
  "V. Prev. - M.O. Fixa",
  "V. Prev. - Variável",
  "Saldo - M.O. Fixa",
  "Saldo - Variável",
];

async function fetchDataUrl(url: string): Promise<{ dataUrl: string; ext: string } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
    const ext = (dataUrl.match(/data:image\/(\w+);/)?.[1] || "PNG").toUpperCase();
    return { dataUrl, ext };
  } catch { return null; }
}

export async function gerarPdfSaldosContrato(input: SaldoReportInput, logoUrl?: string) {
  const { cliente, contrato } = input;
  const rows = montarLinhasSaldos(input);
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });
  const pw = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 32, "F");

  const logo = logoUrl ? await fetchDataUrl(logoUrl) : null;
  if (logo) {
    // Fundo branco arredondado para destacar a logo sobre a faixa azul
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(8, 4, 34, 24, 2, 2, "F");
    try { doc.addImage(logo.dataUrl, logo.ext, 10, 6, 30, 20); } catch { /* ignore */ }
  }
  const tx = logo ? 48 : 14;


  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Relatório de Saldos por Contrato" + (contrato.numero ? ` — Contrato ${contrato.numero}` : ""), tx, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Cliente: ${cliente.nome || cliente.nomeFantasia}`, tx, 19);
  doc.text(`Contrato: ${contrato.numero || "—"}${contrato.descricao ? " — " + contrato.descricao : ""}`, tx, 25);
  const dt = new Date();
  doc.text(`Gerado em: ${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR")}`, pw - 14, 12, { align: "right" });
  doc.text(`Período: ${input.periodoInicio.slice(0, 7)} a ${input.periodoFim.slice(0, 7)}`, pw - 14, 19, { align: "right" });


  const totals = rows.reduce(
    (a, r) => {
      a.fatFolha += r.fatFolha;
      a.fatVariavel += r.fatVariavel;
      a.fatTotal += r.fatTotal;
      a.prevFolha += r.prevFolha;
      a.prevVariavel += r.prevVariavel;
      a.saldoFolha += r.saldoFolha;
      a.saldoVariavel += r.saldoVariavel;
      return a;
    },
    { fatFolha: 0, fatVariavel: 0, fatTotal: 0, prevFolha: 0, prevVariavel: 0, saldoFolha: 0, saldoVariavel: 0 }
  );

  const body = rows.map((r) => [
    r.mesLabel,
    r.numeroNf || "—",
    fmtBRL(r.fatFolha),
    fmtBRL(r.fatVariavel),
    fmtBRL(r.fatTotal),
    fmtBRL(r.prevFolha),
    fmtBRL(r.prevVariavel),
    fmtBRL(r.saldoFolha),
    fmtBRL(r.saldoVariavel),
  ]);

  (await getAutoTable())(doc, {
    startY: 36,
    head: [HEADERS],
    body,
    foot: [[
      "TOTAL",
      "",
      fmtBRL(totals.fatFolha),
      fmtBRL(totals.fatVariavel),
      fmtBRL(totals.fatTotal),
      fmtBRL(totals.prevFolha),
      fmtBRL(totals.prevVariavel),
      fmtBRL(totals.saldoFolha),
      fmtBRL(totals.saldoVariavel),
    ]],
    styles: { fontSize: 8, cellPadding: 2, halign: "right" },
    columnStyles: {
      0: { halign: "center" },
      1: { halign: "center" },
    },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [230, 236, 245], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data) => {
      if (data.section === "body" && (data.column.index === 7 || data.column.index === 8)) {
        const raw = data.column.index === 7 ? rows[data.row.index].saldoFolha : rows[data.row.index].saldoVariavel;
        if (raw < 0) {
          data.cell.styles.textColor = [200, 30, 30];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const pages = doc.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
    doc.text("SGM Lasant - Saldos por Contrato", 14, ph - 8);
  }
  const fname = `saldos_${(cliente.nome || "cliente").replace(/\s+/g, "_").toLowerCase()}_${contrato.numero || "contrato"}.pdf`;
  doc.save(fname);
}

export async function gerarExcelSaldosContrato(input: SaldoReportInput) {
  const { cliente, contrato } = input;
  const rows = montarLinhasSaldos(input);
  const wb = (await getXLSX()).utils.book_new();

  const aoa: (string | number)[][] = [];
  aoa.push([`Relatório de Saldos por Contrato${contrato.numero ? ` — Contrato ${contrato.numero}` : ""}`]);
  aoa.push([`Cliente: ${cliente.nome || cliente.nomeFantasia}`]);
  aoa.push([`Contrato: ${contrato.numero || "—"}${contrato.descricao ? " — " + contrato.descricao : ""}`]);
  aoa.push([`Período: ${input.periodoInicio.slice(0, 7)} a ${input.periodoFim.slice(0, 7)}`]);
  aoa.push([]);
  aoa.push(HEADERS);
  rows.forEach((r) => {
    aoa.push([
      r.mesLabel,
      r.numeroNf || "",
      r.fatFolha,
      r.fatVariavel,
      r.fatTotal,
      r.prevFolha,
      r.prevVariavel,
      r.saldoFolha,
      r.saldoVariavel,
    ]);
  });
  const totals = rows.reduce(
    (a, r) => {
      a[0] += r.fatFolha; a[1] += r.fatVariavel; a[2] += r.fatTotal;
      a[3] += r.prevFolha; a[4] += r.prevVariavel; a[5] += r.saldoFolha; a[6] += r.saldoVariavel;
      return a;
    },
    [0, 0, 0, 0, 0, 0, 0]
  );
  aoa.push(["TOTAL", "", ...totals]);

  const ws = (await getXLSX()).utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

  // Format numeric cells as currency
  const startDataRow = 7; // 1-indexed row where data starts
  const totalRows = rows.length + 1; // + total
  for (let i = 0; i < totalRows; i++) {
    const rowIdx = startDataRow + i;
    for (let col = 2; col <= 8; col++) {
      const addr = (await getXLSX()).utils.encode_cell({ r: rowIdx - 1, c: col });
      if (ws[addr]) ws[addr].z = 'R$ #,##0.00;[Red]-R$ #,##0.00';
    }
  }

  (await getXLSX()).utils.book_append_sheet(wb, ws, "Saldos");
  const fname = `saldos_${(cliente.nome || "cliente").replace(/\s+/g, "_").toLowerCase()}_${contrato.numero || "contrato"}.xlsx`;
  (await getXLSX()).writeFile(wb, fname, { compression: true });
}
