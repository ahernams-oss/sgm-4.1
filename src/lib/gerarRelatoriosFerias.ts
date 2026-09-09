import { addHeader, addFooter } from "@/lib/gerarRelatorioEstoque";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

export interface FeriasReportRow {
  funcionario_nome: string;
  clienteNome: string;
  cargoNome: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_limite_concessao: string;
  dias_direito: number;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  dias_gozados: number;
  dias_abonados: number;
  status: string;
  diasParaVencer: number;
  precisaTemporario: boolean;
  critico: boolean;
  substitutos: { id: string; nome: string; mesmoPosto: boolean; clienteNome: string }[];
}

export interface EscalaReportRow extends FeriasReportRow {
  substitutoEscolhido: string;
  inicioSugerido: string;
  fimSugerido: string;
}

const fmt = (d?: string | null) => (d ? d.split("-").reverse().join("/") : "—");

const situacao = (r: FeriasReportRow) => {
  if (r.diasParaVencer < 0) return "Vencida";
  if (r.diasParaVencer <= 30) return `Crítica (${r.diasParaVencer}d)`;
  if (r.diasParaVencer <= 60) return `Atenção (${r.diasParaVencer}d)`;
  return `Em dia (${r.diasParaVencer}d)`;
};

const cobertura = (r: FeriasReportRow) => {
  if (!r.critico) return "—";
  if (r.precisaTemporario) return "Contratar temporário";
  return r.substitutos.map((s) => `${s.nome}${s.mesmoPosto ? "" : ` (${s.clienteNome})`}`).join(" | ");
};

export interface FiltrosPdfFerias {
  cliente?: string;
  status?: string;
  vencimento?: string;
  busca?: string;
}

export async function gerarPdfFerias(rows: FeriasReportRow[], opts?: { output?: "save" | "blob"; filtros?: FiltrosPdfFerias }) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });
  await addHeader(doc, {
    title: "Relatório de Mapa de Férias",
    subtitle: `Total: ${rows.length} registro(s) · CLT Art. 134 — concessão em até 12 meses`,
  });

  const vencidas = rows.filter((r) => r.diasParaVencer < 0).length;
  const criticas = rows.filter((r) => r.diasParaVencer >= 0 && r.diasParaVencer <= 30).length;
  const atencao = rows.filter((r) => r.diasParaVencer > 30 && r.diasParaVencer <= 60).length;
  const semCobertura = rows.filter((r) => r.precisaTemporario).length;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo:", 14, 42);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Vencidas: ${vencidas}  |  Críticas (≤30d): ${criticas}  |  Atenção (31-60d): ${atencao}  |  Sem cobertura: ${semCobertura}`,
    42, 42,
  );

  // Bloco de filtros aplicados
  const f = opts?.filtros;
  const filtrosItens: string[] = [];
  if (f?.cliente) filtrosItens.push(`Cliente: ${f.cliente}`);
  if (f?.status) filtrosItens.push(`Status: ${f.status}`);
  if (f?.vencimento) filtrosItens.push(`Situação: ${f.vencimento}`);
  if (f?.busca) filtrosItens.push(`Busca: "${f.busca}"`);

  let y = 48;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Filtros aplicados:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(filtrosItens.length ? filtrosItens.join("   |   ") : "Nenhum — todos os registros considerados.", 42, y);

  // Intervalo de datas considerado
  y += 5;
  const datasAquisitivo = rows.flatMap((r) => [r.periodo_aquisitivo_inicio, r.periodo_aquisitivo_fim]).filter(Boolean).sort();
  const datasLimite = rows.map((r) => r.data_limite_concessao).filter(Boolean).sort();
  doc.setFont("helvetica", "bold");
  doc.text("Intervalo considerado:", 14, y);
  doc.setFont("helvetica", "normal");
  const intervaloTxt = rows.length
    ? `Períodos aquisitivos de ${fmt(datasAquisitivo[0])} a ${fmt(datasAquisitivo[datasAquisitivo.length - 1])}   |   Limites de concessão de ${fmt(datasLimite[0])} a ${fmt(datasLimite[datasLimite.length - 1])}   |   Data-base: ${new Date().toLocaleDateString("pt-BR")}`
    : "Sem registros no recorte.";
  doc.text(intervaloTxt, 46, y);

  (await getAutoTable())(doc, {
    startY: y + 5,
    head: [["Funcionário", "Cliente", "Cargo", "Período Aquisitivo", "Limite", "Situação", "Gozo", "Dias", "Status", "Cobertura do posto"]],
    body: rows.map((r) => [
      r.funcionario_nome,
      r.clienteNome,
      r.cargoNome,
      `${fmt(r.periodo_aquisitivo_inicio)} a ${fmt(r.periodo_aquisitivo_fim)}`,
      fmt(r.data_limite_concessao),
      situacao(r),
      r.data_inicio_gozo ? `${fmt(r.data_inicio_gozo)} a ${fmt(r.data_fim_gozo)}` : "—",
      String(r.dias_direito ?? 30),
      r.status,
      cobertura(r),
    ]),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 9: { cellWidth: 55 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const v = data.cell.text[0] || "";
        if (v.startsWith("Vencida") || v.startsWith("Crítica")) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        } else if (v.startsWith("Atenção")) {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
      if (data.section === "body" && data.column.index === 9 && data.cell.text[0] === "Contratar temporário") {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  addFooter(doc);
  if (opts?.output === "blob") return doc.output("blob");
  doc.save("relatorio-mapa-ferias.pdf");
}

export async function gerarPdfEscalaFerias(escala: EscalaReportRow[], opts?: { output?: "save" | "blob" }) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });
  await addHeader(doc, {
    title: "Escala Sugerida de Férias",
    subtitle: `Total: ${escala.length} registro(s)`,
  });

  doc.setFontSize(8);
  doc.text(
    "Sugestão gerada priorizando o limite de concessão mais próximo, garantindo que nenhum posto fique descoberto.",
    14, 42,
  );

  (await getAutoTable())(doc, {
    startY: 48,
    head: [["Funcionário", "Cliente", "Cargo", "Limite", "Dias p/ limite", "Janela sugerida", "Dias", "Substituto / Ação"]],
    body: escala.map((e) => [
      e.funcionario_nome,
      e.clienteNome,
      e.cargoNome,
      fmt(e.data_limite_concessao),
      String(e.diasParaVencer),
      `${e.inicioSugerido} a ${e.fimSugerido}`,
      String(e.dias_direito ?? 30),
      e.precisaTemporario ? "Sem cobertura — abrir RP temporária" : e.substitutoEscolhido,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 7: { cellWidth: 70 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7 && (data.cell.text[0] || "").startsWith("Sem cobertura")) {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  addFooter(doc);
  if (opts?.output === "blob") return doc.output("blob");
  doc.save("escala-sugerida-ferias.pdf");
}

export async function gerarExcelFerias(rows: FeriasReportRow[], escala: EscalaReportRow[], opts?: { output?: "save" | "blob" }) {
  const wb = (await getXLSX()).utils.book_new();

  const mapa = rows.map((r) => ({
    "Funcionário": r.funcionario_nome,
    "Cliente": r.clienteNome,
    "Cargo": r.cargoNome,
    "Aquisitivo Início": fmt(r.periodo_aquisitivo_inicio),
    "Aquisitivo Fim": fmt(r.periodo_aquisitivo_fim),
    "Limite Concessão": fmt(r.data_limite_concessao),
    "Dias p/ Limite": r.diasParaVencer,
    "Situação": situacao(r),
    "Início Gozo": fmt(r.data_inicio_gozo),
    "Fim Gozo": fmt(r.data_fim_gozo),
    "Dias Direito": r.dias_direito ?? 30,
    "Dias Gozados": r.dias_gozados ?? 0,
    "Dias Abonados": r.dias_abonados ?? 0,
    "Status": r.status,
    "Cobertura do Posto": cobertura(r),
  }));
  const ws = (await getXLSX()).utils.json_to_sheet(mapa);
  ws["!cols"] = [
    { wch: 32 }, { wch: 26 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 13 },
    { wch: 14 }, { wch: 14 }, { wch: 45 },
  ];
  (await getXLSX()).utils.book_append_sheet(wb, ws, "Mapa de Férias");

  const escalaRows = escala.map((e) => ({
    "Funcionário": e.funcionario_nome,
    "Cliente": e.clienteNome,
    "Cargo": e.cargoNome,
    "Limite Concessão": fmt(e.data_limite_concessao),
    "Dias p/ Limite": e.diasParaVencer,
    "Início Sugerido": e.inicioSugerido,
    "Fim Sugerido": e.fimSugerido,
    "Dias": e.dias_direito ?? 30,
    "Substituto / Ação": e.precisaTemporario ? "Sem cobertura — abrir RP temporária" : e.substitutoEscolhido,
  }));
  const ws2 = (await getXLSX()).utils.json_to_sheet(
    escalaRows.length ? escalaRows : [{ "Funcionário": "Nenhum período em fase crítica (≤ 60 dias)" }],
  );
  ws2["!cols"] = [
    { wch: 32 }, { wch: 26 }, { wch: 22 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 45 },
  ];
  (await getXLSX()).utils.book_append_sheet(wb, ws2, "Escala Sugerida");

  const resumo = [
    { Indicador: "Total de períodos", Valor: rows.length },
    { Indicador: "Vencidas", Valor: rows.filter((r) => r.diasParaVencer < 0).length },
    { Indicador: "Críticas (≤30 dias)", Valor: rows.filter((r) => r.diasParaVencer >= 0 && r.diasParaVencer <= 30).length },
    { Indicador: "Atenção (31-60 dias)", Valor: rows.filter((r) => r.diasParaVencer > 30 && r.diasParaVencer <= 60).length },
    { Indicador: "Sem cobertura interna", Valor: rows.filter((r) => r.precisaTemporario).length },
  ];
  const ws3 = (await getXLSX()).utils.json_to_sheet(resumo);
  ws3["!cols"] = [{ wch: 30 }, { wch: 12 }];
  (await getXLSX()).utils.book_append_sheet(wb, ws3, "Resumo");

  if (opts?.output === "blob") {
    const buf = (await getXLSX()).write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  (await getXLSX()).writeFile(wb, "relatorio-mapa-ferias.xlsx", { compression: true });
}
