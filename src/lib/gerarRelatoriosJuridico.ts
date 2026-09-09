

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");
const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "-";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

interface ReportInput {
  titulo: string;
  subtitulo?: string;
  filtros?: string;
  colunas: string[];
  linhas: (string | number)[][];
  totais?: { label: string; valor: string }[];
}

async function basePdf(r: ReportInput) {
  const orient = r.colunas.length > 6 ? "landscape" : "portrait";
  const doc = new (await getJsPDF())({ compress: true, orientation: orient });
  const pw = doc.internal.pageSize.getWidth();

  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(r.titulo, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (r.subtitulo) doc.text(r.subtitulo, 14, 20);
  const dt = new Date();
  doc.text(
    `Gerado em: ${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR")}`,
    pw - 14,
    12,
    { align: "right" }
  );
  if (r.filtros) doc.text(r.filtros, pw - 14, 20, { align: "right" });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.text(`Total de registros: ${r.linhas.length}`, 14, 36);

  (await getAutoTable())(doc, {
    startY: 42,
    head: [r.colunas],
    body: r.linhas.map((row) => row.map((c) => (c == null ? "" : String(c)))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  if (r.totais && r.totais.length) {
    let y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    r.totais.forEach((t) => {
      doc.text(`${t.label}: ${t.valor}`, pw - 14, y, { align: "right" });
      y += 6;
    });
  }

  const pages = doc.getNumberOfPages();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 8, { align: "center" });
    doc.text("SGM Lasant - Jurídico", 14, ph - 8);
  }

  doc.save(`${r.titulo.replace(/\s+/g, "_").toLowerCase()}.pdf`);
}

async function baseExcel(r: ReportInput) {
  const wb = (await getXLSX()).utils.book_new();
  const data = r.linhas.map((row) => {
    const o: Record<string, any> = {};
    r.colunas.forEach((c, i) => { o[c] = row[i] ?? ""; });
    return o;
  });
  const ws = (await getXLSX()).utils.json_to_sheet(data);
  ws["!cols"] = r.colunas.map(() => ({ wch: 22 }));
  if (r.totais && r.totais.length) {
    (await getXLSX()).utils.sheet_add_aoa(ws, [[]], { origin: -1 });
    for (const t of r.totais) {
      (await getXLSX()).utils.sheet_add_aoa(ws, [[t.label, t.valor]], { origin: -1 });
    }
  }
  (await getXLSX()).utils.book_append_sheet(wb, ws, r.titulo.substring(0, 31));
  (await getXLSX()).writeFile(wb, `${r.titulo.replace(/\s+/g, "_").toLowerCase()}.xlsx`, { compression: true });
}

// ===================== PROCESSOS =====================
function processosReport(processos: any[], filtros?: string): ReportInput {
  const colunas = [
    "Nº Processo", "Autor", "Vara", "Comarca", "UF", "Distribuição",
    "Objeto", "Valor Causa", "Provisão", "Acordo", "Condenação",
    "Risco", "Status", "Fase",
  ];
  const linhas = processos.map((p) => [
    p.numero_processo || "-",
    p.autor_nome || "-",
    p.vara || "-",
    p.comarca || "-",
    p.estado || "-",
    fmtDate(p.data_distribuicao),
    p.objeto_acao || "-",
    fmtBRL(p.valor_causa),
    fmtBRL(p.provisao_contabil),
    fmtBRL(p.valor_acordo),
    fmtBRL(p.valor_condenacao),
    p.risco || "-",
    p.status || "-",
    p.fase_processual || "-",
  ]);
  const tCausa = processos.reduce((s, p) => s + (Number(p.valor_causa) || 0), 0);
  const tProv = processos.reduce((s, p) => s + (Number(p.provisao_contabil) || 0), 0);
  const tAcordo = processos.reduce((s, p) => s + (Number(p.valor_acordo) || 0), 0);
  const tCond = processos.reduce((s, p) => s + (Number(p.valor_condenacao) || 0), 0);
  return {
    titulo: "Relatório de Processos Trabalhistas",
    filtros,
    colunas,
    linhas,
    totais: [
      { label: "Total Valor Causa", valor: fmtBRL(tCausa) },
      { label: "Total Provisão", valor: fmtBRL(tProv) },
      { label: "Total Acordos", valor: fmtBRL(tAcordo) },
      { label: "Total Condenações", valor: fmtBRL(tCond) },
    ],
  };
}

export const gerarPdfProcessos = (p: any[], f?: string) => basePdf(processosReport(p, f));
export const gerarExcelProcessos = (p: any[], f?: string) => baseExcel(processosReport(p, f));

// ===================== AUDIÊNCIAS =====================
function audienciasReport(audiencias: any[]): ReportInput {
  const colunas = ["Processo", "Data", "Hora", "Tipo", "Local", "Vara", "Status", "Notif."];
  const linhas = audiencias.map((a) => {
    const notif = [
      a.notificado_10d ? "10d" : null,
      a.notificado_7d ? "7d" : null,
      a.notificado_5d ? "5d" : null,
      a.notificado_2d ? "2d" : null,
    ].filter(Boolean).join(", ") || "Pendente";
    return [
      a.processo_numero || "-",
      fmtDate(a.data_audiencia),
      a.hora || "-",
      a.tipo || "-",
      a.local || "-",
      a.vara || "-",
      a.status || "-",
      notif,
    ];
  });
  return { titulo: "Relatório de Audiências", colunas, linhas };
}

export const gerarPdfAudiencias = (a: any[]) => basePdf(audienciasReport(a));
export const gerarExcelAudiencias = (a: any[]) => baseExcel(audienciasReport(a));

// ===================== CONTATOS =====================
function contatosReport(contatos: any[]): ReportInput {
  const colunas = ["Nome", "Tipo", "WhatsApp", "E-mail", "OAB", "CRC", "Ativo", "Observações"];
  const linhas = contatos.map((c) => [
    c.nome || "-",
    c.tipo || "-",
    c.telefone_whatsapp || "-",
    c.email || "-",
    c.oab || "-",
    c.crc || "-",
    c.ativo ? "Sim" : "Não",
    c.observacoes || "-",
  ]);
  return { titulo: "Relatório de Contatos para Notificação", colunas, linhas };
}

export const gerarPdfContatos = (c: any[]) => basePdf(contatosReport(c));
export const gerarExcelContatos = (c: any[]) => baseExcel(contatosReport(c));

// ===================== PROVISÃO FINANCEIRA =====================
function provisaoReport(processos: any[]): ReportInput {
  const colunas = [
    "Nº Processo", "Autor", "Status", "Risco", "Valor Causa",
    "Provisão", "Acordo", "Condenação", "Honorários", "Exposição",
  ];
  const linhas = processos.map((p) => {
    const exp = (Number(p.provisao_contabil) || 0) +
      (Number(p.valor_acordo) || 0) +
      (Number(p.valor_condenacao) || 0) +
      (Number(p.honorarios) || 0);
    return [
      p.numero_processo || "-",
      p.autor_nome || "-",
      p.status || "-",
      p.risco || "-",
      fmtBRL(p.valor_causa),
      fmtBRL(p.provisao_contabil),
      fmtBRL(p.valor_acordo),
      fmtBRL(p.valor_condenacao),
      fmtBRL(p.honorarios),
      fmtBRL(exp),
    ];
  });
  const tProv = processos.reduce((s, p) => s + (Number(p.provisao_contabil) || 0), 0);
  const tAcordo = processos.reduce((s, p) => s + (Number(p.valor_acordo) || 0), 0);
  const tCond = processos.reduce((s, p) => s + (Number(p.valor_condenacao) || 0), 0);
  const tHon = processos.reduce((s, p) => s + (Number(p.honorarios) || 0), 0);
  return {
    titulo: "Relatório de Provisão Financeira",
    colunas,
    linhas,
    totais: [
      { label: "Total Provisão", valor: fmtBRL(tProv) },
      { label: "Total Acordos", valor: fmtBRL(tAcordo) },
      { label: "Total Condenações", valor: fmtBRL(tCond) },
      { label: "Total Honorários", valor: fmtBRL(tHon) },
      { label: "Exposição Total", valor: fmtBRL(tProv + tAcordo + tCond + tHon) },
    ],
  };
}

export const gerarPdfProvisao = (p: any[]) => basePdf(provisaoReport(p));
export const gerarExcelProvisao = (p: any[]) => baseExcel(provisaoReport(p));

// ===================== SÍNTESE / DASHBOARD =====================
function sinteseReport(processos: any[], audiencias: any[]): ReportInput {
  const STATUS = ["Ativo", "Recurso", "Acordo", "Encerrado", "Arquivado"];
  const RISCO = ["Baixo", "Médio", "Alto"];
  const linhas: (string | number)[][] = [];
  linhas.push(["Total de Processos", processos.length]);
  STATUS.forEach((s) =>
    linhas.push([`Processos - ${s}`, processos.filter((p) => p.status === s).length])
  );
  RISCO.forEach((r) =>
    linhas.push([`Ativos Risco ${r}`, processos.filter((p) => p.risco === r && p.status === "Ativo").length])
  );
  linhas.push([
    "Valor Causa Total",
    fmtBRL(processos.reduce((s, p) => s + (Number(p.valor_causa) || 0), 0)),
  ]);
  linhas.push([
    "Provisão Total",
    fmtBRL(processos.reduce((s, p) => s + (Number(p.provisao_contabil) || 0), 0)),
  ]);
  linhas.push(["Audiências Cadastradas", audiencias.length]);
  linhas.push(["Audiências Agendadas", audiencias.filter((a) => a.status === "Agendada").length]);
  linhas.push(["Audiências Realizadas", audiencias.filter((a) => a.status === "Realizada").length]);
  return {
    titulo: "Síntese do Contencioso Jurídico",
    colunas: ["Indicador", "Valor"],
    linhas,
  };
}

export const gerarPdfSintese = (p: any[], a: any[]) => basePdf(sinteseReport(p, a));
export const gerarExcelSintese = (p: any[], a: any[]) => baseExcel(sinteseReport(p, a));

// ===================== DECISÕES / PAGAMENTOS =====================
function decisoesReport(decisoes: any[], parcelas: any[], filtros?: string): ReportInput {
  const colunas = [
    "Nº Processo", "Tipo", "Data", "Juiz", "Patrono Autor", "OAB",
    "Valor Total", "Parcelas", "Pagas", "Pago (R$)", "Saldo (R$)", "Status",
  ];
  const linhas = decisoes.map((d) => {
    const ps = parcelas.filter((p) => p.decisao_id === d.id);
    const pagas = ps.filter((p) => p.status === "Pago");
    const totalPago = pagas.reduce((s, p) => s + (Number(p.valor_pago ?? p.valor) || 0), 0);
    const saldo = (Number(d.valor_total) || 0) - totalPago;
    return [
      d.processo_numero || "-",
      d.tipo || "-",
      fmtDate(d.data_decisao),
      d.juiz || "-",
      d.patrono_nome || "-",
      d.patrono_oab || "-",
      fmtBRL(d.valor_total),
      ps.length || d.qtd_parcelas || 0,
      pagas.length,
      fmtBRL(totalPago),
      fmtBRL(saldo),
      d.status || "-",
    ];
  });
  const tTotal = decisoes.reduce((s, d) => s + (Number(d.valor_total) || 0), 0);
  const tPago = parcelas
    .filter((p) => p.status === "Pago" && decisoes.some((d) => d.id === p.decisao_id))
    .reduce((s, p) => s + (Number(p.valor_pago ?? p.valor) || 0), 0);
  return {
    titulo: "Relatório de Decisões e Acordos",
    filtros,
    colunas,
    linhas,
    totais: [
      { label: "Total Acordado/Decidido", valor: fmtBRL(tTotal) },
      { label: "Total Pago", valor: fmtBRL(tPago) },
      { label: "Saldo", valor: fmtBRL(tTotal - tPago) },
    ],
  };
}

export const gerarPdfDecisoes = (d: any[], p: any[], f?: string) => basePdf(decisoesReport(d, p, f));
export const gerarExcelDecisoes = (d: any[], p: any[], f?: string) => baseExcel(decisoesReport(d, p, f));

// ===================== PARCELAS / PROGRAMAÇÃO =====================
function parcelasReport(parcelas: any[], decisoes: any[], filtros?: string): ReportInput {
  const colunas = [
    "Nº Processo", "Tipo", "Parc.", "Vencimento", "Valor", "Status",
    "Data Pagamento", "Valor Pago", "Forma", "Banco/PIX",
  ];
  const linhas = parcelas.map((p) => {
    const d = decisoes.find((x) => x.id === p.decisao_id);
    return [
      d?.processo_numero || "-",
      d?.tipo || "-",
      p.numero,
      fmtDate(p.data_vencimento),
      fmtBRL(p.valor),
      p.status || "-",
      fmtDate(p.data_pagamento),
      p.valor_pago != null ? fmtBRL(p.valor_pago) : "-",
      p.forma_pagamento || "-",
      d?.banco || d?.pix_chave || "-",
    ];
  });
  const tProg = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const tPago = parcelas.filter((p) => p.status === "Pago").reduce((s, p) => s + (Number(p.valor_pago ?? p.valor) || 0), 0);
  const tPend = parcelas.filter((p) => p.status === "Pendente").reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const tAtr = parcelas.filter((p) => p.status === "Atrasado").reduce((s, p) => s + (Number(p.valor) || 0), 0);
  return {
    titulo: "Programação de Parcelas",
    filtros,
    colunas,
    linhas,
    totais: [
      { label: "Total Programado", valor: fmtBRL(tProg) },
      { label: "Total Pago", valor: fmtBRL(tPago) },
      { label: "Total Pendente", valor: fmtBRL(tPend) },
      { label: "Total Atrasado", valor: fmtBRL(tAtr) },
    ],
  };
}

export const gerarPdfParcelas = (p: any[], d: any[], f?: string) => basePdf(parcelasReport(p, d, f));
export const gerarExcelParcelas = (p: any[], d: any[], f?: string) => baseExcel(parcelasReport(p, d, f));
