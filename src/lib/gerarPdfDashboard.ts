import { Requisicao } from "@/contexts/RequisicaoContext";
import { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface DashboardReportData {
  requisicoes: Requisicao[];
  dateFrom?: string;
  dateTo?: string;
  empresa?: Empresa;
  funcionarios?: any[];
  exames?: any[];
  processos?: any[];
  lancamentos?: any[];
}

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const WHITE: [number, number, number] = [255, 255, 255];

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
  doc.text("Relatório — Dashboard Gestão de Pessoas", 14, 22);
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
    doc.text(`Relatório gerado automaticamente — Gestão de Pessoas — ${label}`, 14, ph - 14);
    doc.text(`Página ${i} de ${pageCount}`, pw / 2, ph - 14, { align: "center" });
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    return 20;
  }
  return y;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_BLUE);
  doc.text(text, 14, y);
  return y + 3;
}

export async function gerarPdfDashboard(data: DashboardReportData): Promise<jsPDF> {
  const { requisicoes, dateFrom, dateTo, empresa, funcionarios, exames, processos, lancamentos } = data;
  const doc = new (await getJsPDF())({ compress: true });

  addHeader(doc, empresa);

  doc.setTextColor(30, 30, 30);
  let y = 42;

  // Period info
  const periodo = dateFrom || dateTo
    ? `Período: ${dateFrom || "—"} a ${dateTo || "—"}`
    : "Período: Todos";
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${periodo}  |  Total de requisições: ${requisicoes.length}`, 14, y);
  y += 8;

  // --- Resumo por Status ---
  y = sectionTitle(doc, "Resumo por Status", y);
  const statusCounts: Record<string, number> = {};
  requisicoes.forEach((r) => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Status", "Quantidade", "Percentual"]],
    body: Object.entries(statusCounts).map(([status, count]) => [
      status, count.toString(), `${((count / requisicoes.length) * 100).toFixed(1)}%`,
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // --- Solicitações por Cliente/Unidade ---
  const clienteCounts: Record<string, number> = {};
  requisicoes.forEach((r) => { clienteCounts[r.unidade || "Sem unidade"] = (clienteCounts[r.unidade || "Sem unidade"] || 0) + 1; });
  const clienteSorted = Object.entries(clienteCounts).sort((a, b) => b[1] - a[1]);

  y = checkPageBreak(doc, y, clienteSorted.length * 10 + 20);
  y = sectionTitle(doc, "Solicitações por Cliente/Unidade", y);
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Cliente/Unidade", "Quantidade", "Percentual"]],
    body: clienteSorted.map(([name, count]) => [
      name, count.toString(), `${((count / requisicoes.length) * 100).toFixed(1)}%`,
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // --- Solicitações por Cargo ---
  const cargoCounts: Record<string, number> = {};
  requisicoes.forEach((r) => { cargoCounts[r.cargoNome || "Sem cargo"] = (cargoCounts[r.cargoNome || "Sem cargo"] || 0) + 1; });
  const cargoSorted = Object.entries(cargoCounts).sort((a, b) => b[1] - a[1]);

  y = checkPageBreak(doc, y, cargoSorted.length * 10 + 20);
  y = sectionTitle(doc, "Solicitações por Cargo", y);
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Cargo", "Quantidade", "Percentual"]],
    body: cargoSorted.map(([name, count]) => [
      name, count.toString(), `${((count / requisicoes.length) * 100).toFixed(1)}%`,
    ]),
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // --- Funcionários ---
  if (funcionarios && funcionarios.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = sectionTitle(doc, "Resumo de Funcionários", y);
    const funcStatusCounts: Record<string, number> = {};
    funcionarios.forEach((f: any) => { funcStatusCounts[f.status || "Indefinido"] = (funcStatusCounts[f.status || "Indefinido"] || 0) + 1; });
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Status", "Quantidade", "Percentual"]],
      body: Object.entries(funcStatusCounts).map(([status, count]) => [
        status, count.toString(), `${((count / funcionarios.length) * 100).toFixed(1)}%`,
      ]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Exames ---
  if (exames && exames.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = sectionTitle(doc, "Exames Periódicos", y);
    const hoje = new Date();
    let vencidos = 0, aVencer = 0, emDia = 0;
    exames.forEach((e: any) => {
      if (!e.data_vencimento) return;
      const dias = Math.floor((new Date(e.data_vencimento).getTime() - hoje.getTime()) / 86400000);
      if (dias < 0) vencidos++;
      else if (dias <= 30) aVencer++;
      else emDia++;
    });
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Situação", "Quantidade"]],
      body: [
        ["Em Dia", emDia.toString()],
        ["A Vencer (30 dias)", aVencer.toString()],
        ["Vencidos", vencidos.toString()],
        ["Total", exames.length.toString()],
      ],
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Processos Seletivos ---
  if (processos && processos.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = sectionTitle(doc, "Processos Seletivos", y);
    let totalCandidatos = 0, contratados = 0;
    processos.forEach((p: any) => {
      const cands = p.candidatos || [];
      totalCandidatos += cands.length;
      contratados += cands.filter((c: any) => c.contratacaoFinalizada).length;
    });
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de Processos", processos.length.toString()],
        ["Total de Candidatos", totalCandidatos.toString()],
        ["Contratados", contratados.toString()],
        ["Taxa de Conversão", totalCandidatos > 0 ? `${((contratados / totalCandidatos) * 100).toFixed(1)}%` : "N/A"],
      ],
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Faltas / Suspensões ---
  if (lancamentos && lancamentos.length > 0) {
    y = checkPageBreak(doc, y, 60);
    y = sectionTitle(doc, "Faltas e Suspensões", y);
    const faltasJust = lancamentos.filter((l: any) => l.tipo === "falta" && l.tipoFalta === "justificada");
    const faltasInjust = lancamentos.filter((l: any) => l.tipo === "falta" && l.tipoFalta === "injustificada");
    const suspensoes = lancamentos.filter((l: any) => l.tipo === "falta" && l.tipoFalta === "suspensao");
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Tipo", "Quantidade"]],
      body: [
        ["Faltas Justificadas", faltasJust.length.toString()],
        ["Faltas Injustificadas", faltasInjust.length.toString()],
        ["Suspensões", suspensoes.length.toString()],
      ],
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Lista detalhada das requisições ---
  y = checkPageBreak(doc, y, 30);
  y = sectionTitle(doc, "Lista Detalhada das Requisições", y);

  (await getAutoTable())(doc, {
    startY: y,
    head: [["RC Nº", "Data", "Unidade", "Cargo", "Status", "Tipo Contratação"]],
    body: requisicoes.map((r) => [
      `RC ${r.numero}`, r.dataCriacao, r.unidade, r.cargoNome, r.status,
      r.tipoContratacao?.join(", ") || "",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: DARK_BLUE, textColor: WHITE, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 22 } },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc, empresa);
  return doc;
}

export async function downloadPdfDashboard(data: DashboardReportData) {
  const doc = await gerarPdfDashboard(data);
  const periodoLabel = data.dateFrom || data.dateTo
    ? `${(data.dateFrom || "").replace(/\//g, "-")}_${(data.dateTo || "").replace(/\//g, "-")}`
    : "completo";
  doc.save(`Relatorio_Dashboard_GP_${periodoLabel}_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`);
}

export function gerarTextoDashboard(requisicoes: Requisicao[], dateFrom?: string, dateTo?: string): string {
  const periodo = dateFrom || dateTo
    ? `Período: ${dateFrom || "—"} a ${dateTo || "—"}`
    : "Período: Todos";

  const statusCounts: Record<string, number> = {};
  requisicoes.forEach((r) => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  const clienteCounts: Record<string, number> = {};
  requisicoes.forEach((r) => { clienteCounts[r.unidade || "Sem unidade"] = (clienteCounts[r.unidade || "Sem unidade"] || 0) + 1; });

  let msg = `📊 *Relatório de Requisições*\n${periodo}\n\n`;
  msg += `📋 *Total:* ${requisicoes.length}\n\n`;

  msg += `*Por Status:*\n`;
  Object.entries(statusCounts).forEach(([status, count]) => {
    msg += `• ${status}: ${count} (${((count / requisicoes.length) * 100).toFixed(0)}%)\n`;
  });

  msg += `\n*Por Unidade:*\n`;
  Object.entries(clienteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([name, count]) => {
      msg += `• ${name}: ${count}\n`;
    });

  msg += `\n_Gerado em ${new Date().toLocaleString("pt-BR")}_`;
  return msg;
}
