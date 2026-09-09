import type {
  PmocPlano, PmocAtividade, PmocOrdemServico, PmocInconformidade,
  PmocQualidadeArPonto, PmocQualidadeArMedicao, PmocBibliotecaRotina,
} from "@/contexts/PmocContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface PmocReportData {
  planos: PmocPlano[];
  atividades: PmocAtividade[];
  ordensServico: PmocOrdemServico[];
  inconformidades: PmocInconformidade[];
  filtroCliente?: string;
  tipo: "geral" | "cliente" | "conformidade";
}

function header(doc: jsPDF, titulo: string, subtitulo: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${titulo} — Engenharia e Manutenção`, 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitulo, 14, 24);
  doc.setFontSize(9);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 14, 16, { align: "right" });
}

function footer(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.line(14, ph - 20, pw - 14, ph - 20);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório PMOC — Engenharia e Manutenção — SGM Lasant", 14, ph - 14);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 14, { align: "center" });
  }
}

async function tabelaResumo(doc: jsPDF, y: number, titulo: string, head: string[], body: string[][]) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 107);
  doc.text(titulo, 14, y);
  y += 3;
  (await getAutoTable())(doc, {
    startY: y,
    head: [head],
    body,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY + 10;
}

export async function gerarPdfPmocGeral(data: PmocReportData): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  header(doc, "Relatório Geral PMOC", `Total: ${data.planos.length} planos | ${data.atividades.length} atividades | ${data.ordensServico.length} OS`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  // Resumo status planos
  const statusPlanos: Record<string, number> = {};
  data.planos.forEach(p => { statusPlanos[p.status] = (statusPlanos[p.status] || 0) + 1; });
  y = await tabelaResumo(doc, y, "Planos por Status", ["Status", "Quantidade"],
    Object.entries(statusPlanos).map(([s, c]) => [s, c.toString()]));

  // Resumo OS por status
  const statusOS: Record<string, number> = {};
  data.ordensServico.forEach(o => { statusOS[o.status] = (statusOS[o.status] || 0) + 1; });
  y = await tabelaResumo(doc, y, "Ordens de Serviço por Status", ["Status", "Quantidade"],
    Object.entries(statusOS).map(([s, c]) => [s, c.toString()]));

  // Atividades por tipo
  const tipoAtiv: Record<string, number> = {};
  data.atividades.forEach(a => { tipoAtiv[a.tipo] = (tipoAtiv[a.tipo] || 0) + 1; });
  y = await tabelaResumo(doc, y, "Atividades por Tipo", ["Tipo", "Quantidade"],
    Object.entries(tipoAtiv).map(([s, c]) => [s, c.toString()]));

  // Lista de planos
  const ph = doc.internal.pageSize.getHeight();
  if (y + 30 > ph - 30) { doc.addPage(); y = 20; }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 107);
  doc.text("Lista de Planos", 14, y);
  y += 3;
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Título", "Cliente", "Vigência", "Status", "RT"]],
    body: data.planos.map(p => [
      p.titulo, p.clienteNome || "-",
      p.vigenciaInicio && p.vigenciaFim ? `${p.vigenciaInicio} a ${p.vigenciaFim}` : "-",
      p.status, p.responsavelTecnicoNome || "-",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  footer(doc);
  return doc;
}

export async function gerarPdfPmocCliente(data: PmocReportData): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  const clienteNome = data.filtroCliente || "Todos";
  header(doc, "Relatório PMOC por Cliente", `Cliente: ${clienteNome}`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  const planosFiltrados = data.filtroCliente
    ? data.planos.filter(p => p.clienteNome === data.filtroCliente) : data.planos;
  const planosIds = new Set(planosFiltrados.map(p => p.id));
  const atividadesFiltradas = data.atividades.filter(a => planosIds.has(a.planoId));
  const osFiltradas = data.ordensServico.filter(o => planosIds.has(o.planoId));

  // KPIs
  const exec = atividadesFiltradas.filter(a => a.ultimaExecucao).length;
  const pct = atividadesFiltradas.length > 0 ? Math.round((exec / atividadesFiltradas.length) * 100) : 0;
  y = await tabelaResumo(doc, y, "Resumo", ["Indicador", "Valor"], [
    ["Planos", planosFiltrados.length.toString()],
    ["Atividades Programadas", atividadesFiltradas.length.toString()],
    ["Atividades Executadas", exec.toString()],
    ["% Execução", `${pct}%`],
    ["Ordens de Serviço", osFiltradas.length.toString()],
  ]);

  // OS detalhada
  if (osFiltradas.length > 0) {
    const ph = doc.internal.pageSize.getHeight();
    if (y + 30 > ph - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 107);
    doc.text("Ordens de Serviço", 14, y);
    y += 3;
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Nº", "Equipamento", "Tipo", "Prioridade", "Status", "Abertura", "Conclusão"]],
      body: osFiltradas.map(o => [
        o.numero.toString(), o.equipamentoNome || "-", o.tipo, o.prioridade,
        o.status, o.dataAbertura || "-", o.dataConclusao || "-",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
  }

  footer(doc);
  return doc;
}

export async function gerarPdfPmocConformidade(data: PmocReportData): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  const totalAtiv = data.atividades.length;
  const exec = data.atividades.filter(a => a.ultimaExecucao).length;
  const pct = totalAtiv > 0 ? Math.round((exec / totalAtiv) * 100) : 0;
  header(doc, "Relatório de Conformidade PMOC", `Conformidade geral: ${pct}% | Inconformidades: ${data.inconformidades.length}`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  // Conformidade por plano
  const porPlano = data.planos.map(p => {
    const ativs = data.atividades.filter(a => a.planoId === p.id);
    const ex = ativs.filter(a => a.ultimaExecucao).length;
    return [p.titulo, p.clienteNome, ativs.length.toString(), ex.toString(),
      ativs.length > 0 ? `${Math.round((ex / ativs.length) * 100)}%` : "0%"];
  });
  y = await tabelaResumo(doc, y, "Conformidade por Plano",
    ["Plano", "Cliente", "Atividades", "Executadas", "% Conformidade"], porPlano);

  // Inconformidades
  if (data.inconformidades.length > 0) {
    const ph = doc.internal.pageSize.getHeight();
    if (y + 30 > ph - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 107);
    doc.text("Inconformidades", 14, y);
    y += 3;
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Nº", "Equipamento", "Gravidade", "Responsável", "Status", "Prazo"]],
      body: data.inconformidades.map(i => [
        i.numero.toString(), i.equipamentoNome || "-", i.gravidade,
        i.responsavel || "-", i.status, i.prazo || "-",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
  }

  footer(doc);
  return doc;
}

export async function downloadPdfPmoc(data: PmocReportData) {
  let doc: jsPDF;
  let nome: string;
  const ts = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  if (data.tipo === "cliente") {
    doc = await gerarPdfPmocCliente(data);
    nome = `PMOC_Cliente_${(data.filtroCliente || "todos").replace(/\s+/g, "_")}_${ts}.pdf`;
  } else if (data.tipo === "conformidade") {
    doc = await gerarPdfPmocConformidade(data);
    nome = `PMOC_Conformidade_${ts}.pdf`;
  } else {
    doc = await gerarPdfPmocGeral(data);
    nome = `PMOC_Relatorio_Geral_${ts}.pdf`;
  }
  doc.save(nome);
}

// ====================== Relatório de Planos ======================
export async function gerarPdfPmocPlanos(planos: PmocPlano[], atividades: PmocAtividade[], filtroCliente?: string): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  const lista = filtroCliente ? planos.filter(p => p.clienteNome === filtroCliente) : planos;
  header(doc, "Relatório de Planos PMOC", `${lista.length} plano(s)${filtroCliente ? ` — Cliente: ${filtroCliente}` : ""}`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Título", "Cliente", "Unidade", "Vigência", "Rev.", "Status", "RT", "Atividades"]],
    body: lista.map(p => [
      p.titulo, p.clienteNome || "-", p.unidade || "-",
      p.vigenciaInicio && p.vigenciaFim ? `${p.vigenciaInicio} a ${p.vigenciaFim}` : "-",
      p.revisao.toString(), p.status, p.responsavelTecnicoNome || "-",
      atividades.filter(a => a.planoId === p.id).length.toString(),
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  footer(doc);
  return doc;
}

// ====================== Relatório de OS ======================
export async function gerarPdfPmocOS(ordensServico: PmocOrdemServico[], detalhado = true): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  header(doc, "Relatório de Ordens de Serviço PMOC", `${ordensServico.length} OS`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  // Tabela resumo
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Nº", "Equipamento", "Tipo", "Prioridade", "Status", "Abertura", "Prazo", "Conclusão", "Técnico"]],
    body: ordensServico.map(o => [
      o.numero.toString(), o.equipamentoNome || "-", o.tipo, o.prioridade,
      o.status, o.dataAbertura || "-", o.dataPrazo || "-",
      o.dataConclusao || "-", o.tecnicoResponsavel || "-",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  if (detalhado) {
    for (const o of ordensServico) {
      doc.addPage();
      header(doc, `OS Nº ${o.numero}`, `${o.equipamentoNome || "-"} | ${o.status}`);
      doc.setTextColor(30, 30, 30);
      let yy = 46;

      (await getAutoTable())(doc, {
        startY: yy,
        head: [["Campo", "Valor"]],
        body: [
          ["Equipamento", o.equipamentoNome || "-"],
          ["Origem", o.origem], ["Unidade", o.unidade || "-"],
          ["Local", o.localDescricao || "-"], ["Tipo", o.tipo],
          ["Prioridade", o.prioridade], ["Status", o.status],
          ["Abertura", o.dataAbertura || "-"], ["Prazo", o.dataPrazo || "-"],
          ["Início Execução", o.dataInicioExecucao || "-"],
          ["Conclusão", o.dataConclusao || "-"],
          ["Técnico Responsável", o.tecnicoResponsavel || "-"],
          ["Equipe", o.equipe || "-"],
          ["Aprovado por", o.aprovadoPor || "-"],
          ["Data Aprovação", o.dataAprovacao || "-"],
        ],
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
        margin: { left: 14, right: 14 },
      });
      yy = (doc as any).lastAutoTable.finalY + 6;

      if (o.descricao) {
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Descrição:", 14, yy); yy += 5;
        doc.setFont("helvetica", "normal");
        const linhas = doc.splitTextToSize(o.descricao, 180);
        doc.text(linhas, 14, yy); yy += linhas.length * 5 + 4;
      }

      if (o.materiaisUtilizados?.length) {
        (await getAutoTable())(doc, {
          startY: yy,
          head: [["Material Utilizado", "Qtd", "Unidade"]],
          body: o.materiaisUtilizados.map((m: any) => [m.descricao || m.nome || "-", (m.quantidade ?? "-").toString(), m.unidade || "-"]),
          theme: "grid", styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
          margin: { left: 14, right: 14 },
        });
        yy = (doc as any).lastAutoTable.finalY + 6;
      }

      if (o.checklistResultado?.length) {
        (await getAutoTable())(doc, {
          startY: yy,
          head: [["Item Checklist", "Resultado", "Observação"]],
          body: o.checklistResultado.map((c: any) => [c.item || c.descricao || "-", c.resultado || c.status || "-", c.observacao || "-"]),
          theme: "grid", styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
          margin: { left: 14, right: 14 },
        });
        yy = (doc as any).lastAutoTable.finalY + 6;
      }

      if (o.observacoes) {
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Observações:", 14, yy); yy += 5;
        doc.setFont("helvetica", "normal");
        const linhas = doc.splitTextToSize(o.observacoes, 180);
        doc.text(linhas, 14, yy);
      }
    }
  }

  footer(doc);
  return doc;
}

// ====================== Relatório de Qualidade do Ar ======================
export async function gerarPdfPmocQualidadeAr(pontos: PmocQualidadeArPonto[], medicoes: PmocQualidadeArMedicao[]): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  const naoConf = medicoes.filter(m => !m.conforme).length;
  header(doc, "Relatório de Qualidade do Ar (QAI)", `${pontos.length} ponto(s) | ${medicoes.length} medição(ões) | ${naoConf} não conforme(s)`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  y = await tabelaResumo(doc, y, "Pontos de Monitoramento",
    ["Descrição", "Ambiente", "Tipo", "Periodicidade", "Status"],
    pontos.map(p => [p.descricao, p.ambiente || "-", p.tipoAmbiente || "-", p.periodicidadeColeta, p.status])
  );

  const ph = doc.internal.pageSize.getHeight();
  if (y + 30 > ph - 30) { doc.addPage(); y = 20; }
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 58, 107);
  doc.text("Medições", 14, y); y += 3;
  (await getAutoTable())(doc, {
    startY: y,
    head: [["Data", "Hora", "Ponto", "Temp.", "Umid.", "CO₂", "Renov.", "Pressão", "Conforme", "Resp."]],
    body: medicoes.map(m => [
      m.dataMedicao || "-", m.horaMedicao || "-", m.pontoDescricao || "-",
      m.temperatura?.toString() ?? "-", m.umidade?.toString() ?? "-",
      m.co2?.toString() ?? "-", m.renovacaoAr?.toString() ?? "-",
      m.pressaoDiferencial?.toString() ?? "-",
      m.conforme ? "Sim" : "NÃO", m.responsavel || "-",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 8 && d.cell.raw === "NÃO") {
        d.cell.styles.textColor = [200, 30, 30]; d.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });

  footer(doc);
  return doc;
}

// ====================== Relatório de Inconformidades ======================
export async function gerarPdfPmocInconformidades(inconformidades: PmocInconformidade[]): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  const abertas = inconformidades.filter(i => i.status !== "Encerrada" && i.status !== "Resolvida").length;
  header(doc, "Relatório de Inconformidades PMOC", `${inconformidades.length} registro(s) | ${abertas} aberta(s)`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  // Por gravidade
  const porGrav: Record<string, number> = {};
  inconformidades.forEach(i => { porGrav[i.gravidade] = (porGrav[i.gravidade] || 0) + 1; });
  y = await tabelaResumo(doc, y, "Por Gravidade", ["Gravidade", "Qtd"],
    Object.entries(porGrav).map(([g, c]) => [g, c.toString()]));

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Nº", "Equipamento", "Ambiente", "Descrição", "Gravidade", "Resp.", "Prazo", "Status", "Reinc."]],
    body: inconformidades.map(i => [
      i.numero.toString(), i.equipamentoNome || "-", i.ambiente || "-",
      i.descricao || "-", i.gravidade, i.responsavel || "-",
      i.prazo || "-", i.status, i.reincidencia.toString(),
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  footer(doc);
  return doc;
}

// ====================== Relatório de Biblioteca ======================
export async function gerarPdfPmocBiblioteca(biblioteca: PmocBibliotecaRotina[]): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true });
  header(doc, "Biblioteca de Rotinas PMOC", `${biblioteca.length} rotina(s) cadastrada(s)`);
  doc.setTextColor(30, 30, 30);
  let y = 46;

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Título", "Tipo Equipamento", "Tipo Atividade", "Periodicidade", "Duração", "Versão", "Ativa"]],
    body: biblioteca.map(b => [
      b.titulo, b.tipoEquipamento || "-", b.tipoAtividade,
      b.periodicidadeSugerida, b.duracaoEstimada || "-",
      b.versao.toString(), b.ativa ? "Sim" : "Não",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
  });

  // Detalhar checklist por rotina
  for (const b of biblioteca) {
    if (!b.checklistItens?.length) return;
    doc.addPage();
    header(doc, `Rotina: ${b.titulo}`, `${b.tipoEquipamento || "-"} | ${b.tipoAtividade} | v${b.versao}`);
    doc.setTextColor(30, 30, 30);
    (await getAutoTable())(doc, {
      startY: 46,
      head: [["#", "Item de Checklist"]],
      body: b.checklistItens.map((c: any, idx: number) => [
        (idx + 1).toString(),
        typeof c === "string" ? c : (c.item || c.descricao || JSON.stringify(c)),
      ]),
      theme: "grid", styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });
  }

  footer(doc);
  return doc;
}

// ====================== Helpers de download ======================
const ts = () => new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
export const downloadPdfPmocPlanos = async (planos: PmocPlano[], atividades: PmocAtividade[], filtroCliente?: string) =>
  (await gerarPdfPmocPlanos(planos, atividades, filtroCliente)).save(`PMOC_Planos_${ts()}.pdf`);
export const downloadPdfPmocOS = async (os: PmocOrdemServico[], detalhado = true) =>
  (await gerarPdfPmocOS(os, detalhado)).save(`PMOC_OS_${ts()}.pdf`);
export const downloadPdfPmocQualidadeAr = async (pontos: PmocQualidadeArPonto[], medicoes: PmocQualidadeArMedicao[]) =>
  (await gerarPdfPmocQualidadeAr(pontos, medicoes)).save(`PMOC_QualidadeAr_${ts()}.pdf`);
export const downloadPdfPmocInconformidades = async (inc: PmocInconformidade[]) =>
  (await gerarPdfPmocInconformidades(inc)).save(`PMOC_Inconformidades_${ts()}.pdf`);
export const downloadPdfPmocBiblioteca = async (bib: PmocBibliotecaRotina[]) =>
  (await gerarPdfPmocBiblioteca(bib)).save(`PMOC_Biblioteca_${ts()}.pdf`);
