import { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const WHITE: [number, number, number] = [255, 255, 255];

export interface DashboardSSOSReport {
  empresa?: Empresa;
  periodoLabel: string;
  filtroLabel: string;
  kpisSS: { total: number; aguardando: number; aprovadas: number; concluidas: number; canceladas: number };
  kpisOS: { total: number; abertas: number; executadas: number; validadas: number; emergenciais: number; conversao: string; conclusao: string };
  ssStatus: { name: string; value: number }[];
  osStatus: { name: string; value: number }[];
  tipoOS: { name: string; value: number }[];
  rankingClientes: { cliente: string; ss: number; os: number; total: number }[];
  rankingFuncionarios: {
    nome: string; cargo: string; total: number; concluidas: number; abertas: number;
    pontos: number; baixa: number; media: number; alta: number;
  }[];
  rankingFuncionariosQtd: {
    nome: string; cargo: string; total: number; concluidas: number; abertas: number;
  }[];
}

// =================== PDF ===================
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
  doc.text("Relatório — Dashboard de Solicitações e Ordens de Serviço", 14, 22);
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
    doc.text(`Relatório gerado automaticamente — Engenharia e Manutenção — ${label}`, 14, ph - 14);
    doc.text(`Página ${i} de ${pageCount}`, pw / 2, ph - 14, { align: "center" });
  }
}

function checkBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); return 42; }
  return y;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_BLUE);
  doc.text(text, 14, y);
  return y + 3;
}

export async function gerarPdfDashboardSSOS(data: DashboardSSOSReport): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  addHeader(doc, data.empresa);
  doc.setTextColor(30, 30, 30);
  let y = 42;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.periodoLabel}  |  ${data.filtroLabel}`, 14, y);
  y += 8;

  // KPIs SS
  y = sectionTitle(doc, "Indicadores — Solicitações de Serviço (SS)", y);
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Total", "Aguardando", "Aprovadas", "Concluídas", "Canceladas"]],
    body: [[
      data.kpisSS.total, data.kpisSS.aguardando, data.kpisSS.aprovadas,
      data.kpisSS.concluidas, data.kpisSS.canceladas,
    ].map(String)],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 4, halign: "center" },
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold", halign: "center" },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // KPIs OS
  y = checkBreak(doc, y, 30);
  y = sectionTitle(doc, "Indicadores — Ordens de Serviço (OS)", y);
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Total", "Abertas", "Executadas", "Validadas", "Faturadas", "Emergenciais", "Conv. SS→OS", "% Conclusão"]],
    body: [[
      data.kpisOS.total, data.kpisOS.abertas, data.kpisOS.executadas,
      data.kpisOS.validadas, (data.kpisOS as any).faturadas ?? 0, data.kpisOS.emergenciais, data.kpisOS.conversao, data.kpisOS.conclusao,
    ].map(String)],
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 4, halign: "center" },
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold", halign: "center" },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // SS por Status
  if (data.ssStatus.length) {
    y = checkBreak(doc, y, data.ssStatus.length * 8 + 20);
    y = sectionTitle(doc, "SS por Situação", y);
    const totalSS = data.ssStatus.reduce((a, b) => a + b.value, 0) || 1;
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Situação", "Quantidade", "Percentual"]],
      body: data.ssStatus.map(s => [s.name, String(s.value), `${((s.value / totalSS) * 100).toFixed(1)}%`]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // OS por Status
  if (data.osStatus.length) {
    y = checkBreak(doc, y, data.osStatus.length * 8 + 20);
    y = sectionTitle(doc, "OS por Situação", y);
    const totalOS = data.osStatus.reduce((a, b) => a + b.value, 0) || 1;
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Situação", "Quantidade", "Percentual"]],
      body: data.osStatus.map(s => [s.name, String(s.value), `${((s.value / totalOS) * 100).toFixed(1)}%`]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Tipo OS
  if (data.tipoOS.length) {
    y = checkBreak(doc, y, data.tipoOS.length * 8 + 20);
    y = sectionTitle(doc, "OS por Tipo de Manutenção", y);
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Tipo", "Quantidade"]],
      body: data.tipoOS.map(t => [t.name, String(t.value)]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Ranking Clientes
  if (data.rankingClientes.length) {
    y = checkBreak(doc, y, data.rankingClientes.length * 8 + 20);
    y = sectionTitle(doc, "Ranking de Clientes (SS + OS)", y);
    (await getAutoTable())(doc, {
      startY: y,
      head: [["#", "Cliente", "SS", "OS", "Total"]],
      body: data.rankingClientes.map((c, i) => [String(i + 1), c.cliente, String(c.ss), String(c.os), String(c.total)]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 12, halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Ranking Funcionários
  if (data.rankingFuncionarios.length) {
    y = checkBreak(doc, y, data.rankingFuncionarios.length * 8 + 30);
    y = sectionTitle(doc, "Ranking de Funcionários Mais Produtivos", y);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Pontuação por complexidade da OS · Baixa = 1 pt · Média = 3 pts · Alta = 5 pts", 14, y);
    doc.setTextColor(30, 30, 30);
    y += 4;
    (await getAutoTable())(doc, {
      startY: y,
      head: [["#", "Funcionário", "Cargo", "Baixa", "Média", "Alta", "OS Concl.", "Total OS", "Pontos"]],
      body: data.rankingFuncionarios.map((f, i) => [
        String(i + 1), f.nome, f.cargo,
        String(f.baixa), String(f.media), String(f.alta),
        String(f.concluidas), String(f.total), String(f.pontos),
      ]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" },
        6: { halign: "center" }, 7: { halign: "center" },
        8: { halign: "center", fontStyle: "bold", textColor: DARK_BLUE },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Ranking Funcionários por Quantidade de OS
  if (data.rankingFuncionariosQtd.length) {
    y = checkBreak(doc, y, data.rankingFuncionariosQtd.length * 8 + 20);
    y = sectionTitle(doc, "Ranking de Funcionários por Quantidade de OS", y);
    (await getAutoTable())(doc, {
      startY: y,
      head: [["#", "Funcionário", "Cargo", "OS Concluídas", "OS Abertas", "Total OS"]],
      body: data.rankingFuncionariosQtd.map((f, i) => [
        String(i + 1), f.nome, f.cargo,
        String(f.concluidas), String(f.abertas), String(f.total),
      ]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        3: { halign: "center" }, 4: { halign: "center" },
        5: { halign: "center", fontStyle: "bold", textColor: DARK_BLUE },
      },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc, data.empresa);
  return doc;
}

export async function downloadPdfDashboardSSOS(data: DashboardSSOSReport) {
  const doc = await gerarPdfDashboardSSOS(data);
  const dt = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  doc.save(`Dashboard_SS_OS_${dt}.pdf`);
}

// =================== Excel ===================
export async function gerarExcelDashboardSSOS(data: DashboardSSOSReport): Promise<XLSXTypes.WorkBook> {
  const wb = (await getXLSX()).utils.book_new();
  const empresaLabel = data.empresa?.nomeFantasia || data.empresa?.razaoSocial || "SGM Lasant";

  // Resumo
  const resumo: any[][] = [
    [empresaLabel],
    ["Relatório — Dashboard de Solicitações e Ordens de Serviço"],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [data.periodoLabel],
    [data.filtroLabel],
    [],
    ["Indicadores — Solicitações de Serviço (SS)"],
    ["Total", "Aguardando", "Aprovadas", "Concluídas", "Canceladas"],
    [data.kpisSS.total, data.kpisSS.aguardando, data.kpisSS.aprovadas, data.kpisSS.concluidas, data.kpisSS.canceladas],
    [],
    ["Indicadores — Ordens de Serviço (OS)"],
    ["Total", "Abertas", "Executadas", "Validadas", "Faturadas", "Emergenciais", "Conv. SS→OS", "% Conclusão"],
    [data.kpisOS.total, data.kpisOS.abertas, data.kpisOS.executadas, data.kpisOS.validadas, (data.kpisOS as any).faturadas ?? 0, data.kpisOS.emergenciais, data.kpisOS.conversao, data.kpisOS.conclusao],
  ];
  const wsResumo = (await getXLSX()).utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsResumo, "Resumo");

  // SS Status
  const ssRows: any[][] = [["Situação", "Quantidade"], ...data.ssStatus.map(s => [s.name, s.value])];
  const wsSS = (await getXLSX()).utils.aoa_to_sheet(ssRows);
  wsSS["!cols"] = [{ wch: 30 }, { wch: 14 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsSS, "SS por Situação");

  // OS Status
  const osRows: any[][] = [["Situação", "Quantidade"], ...data.osStatus.map(s => [s.name, s.value])];
  const wsOS = (await getXLSX()).utils.aoa_to_sheet(osRows);
  wsOS["!cols"] = [{ wch: 30 }, { wch: 14 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsOS, "OS por Situação");

  // Tipo OS
  const tipoRows: any[][] = [["Tipo", "Quantidade"], ...data.tipoOS.map(t => [t.name, t.value])];
  const wsTipo = (await getXLSX()).utils.aoa_to_sheet(tipoRows);
  wsTipo["!cols"] = [{ wch: 25 }, { wch: 14 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsTipo, "OS por Tipo");

  // Ranking Clientes
  const cliRows: any[][] = [
    ["#", "Cliente", "SS", "OS", "Total"],
    ...data.rankingClientes.map((c, i) => [i + 1, c.cliente, c.ss, c.os, c.total]),
  ];
  const wsCli = (await getXLSX()).utils.aoa_to_sheet(cliRows);
  wsCli["!cols"] = [{ wch: 5 }, { wch: 40 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsCli, "Ranking Clientes");

  // Ranking Funcionários
  const funcRows: any[][] = [
    ["Pontuação: Baixa = 1 pt · Média = 3 pts · Alta = 5 pts"],
    [],
    ["#", "Funcionário", "Cargo", "OS Baixa", "OS Média", "OS Alta", "OS Concluídas", "Total OS", "Pontos"],
    ...data.rankingFuncionarios.map((f, i) => [
      i + 1, f.nome, f.cargo, f.baixa, f.media, f.alta, f.concluidas, f.total, f.pontos,
    ]),
  ];
  const wsFunc = (await getXLSX()).utils.aoa_to_sheet(funcRows);
  wsFunc["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsFunc, "Ranking Funcionários");

  // Ranking Funcionários por Quantidade de OS
  const funcQtdRows: any[][] = [
    ["#", "Funcionário", "Cargo", "OS Concluídas", "OS Abertas", "Total OS"],
    ...data.rankingFuncionariosQtd.map((f, i) => [
      i + 1, f.nome, f.cargo, f.concluidas, f.abertas, f.total,
    ]),
  ];
  const wsFuncQtd = (await getXLSX()).utils.aoa_to_sheet(funcQtdRows);
  wsFuncQtd["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
  (await getXLSX()).utils.book_append_sheet(wb, wsFuncQtd, "Ranking Qtd. OS");

  return wb;
}

export async function downloadExcelDashboardSSOS(data: DashboardSSOSReport) {
  const wb = await gerarExcelDashboardSSOS(data);
  const dt = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  (await getXLSX()).writeFile(wb, `Dashboard_SS_OS_${dt}.xlsx`, { compression: true });
}
