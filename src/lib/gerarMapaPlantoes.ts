import { Funcionario } from "@/contexts/FuncionariosContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

export type TipoJornada =
  | "Diarista"
  | "Plantão Diurno - PAR"
  | "Plantão Diurno - ÍMPAR"
  | "Plantão Noturno - PAR"
  | "Plantão Noturno - ÍMPAR";

export const SIGLAS: Record<TipoJornada, string> = {
  "Diarista": "D",
  "Plantão Diurno - PAR": "DP",
  "Plantão Diurno - ÍMPAR": "DI",
  "Plantão Noturno - PAR": "NP",
  "Plantão Noturno - ÍMPAR": "NI",
};

export function trabalhaNoDia(jornada: string, dia: number, dataRef: Date): boolean {
  const j = (jornada || "") as TipoJornada;
  if (j === "Diarista") {
    const d = new Date(dataRef.getFullYear(), dataRef.getMonth(), dia).getDay();
    return d >= 1 && d <= 5; // Seg-Sex
  }
  const par = dia % 2 === 0;
  if (j === "Plantão Diurno - PAR" || j === "Plantão Noturno - PAR") return par;
  if (j === "Plantão Diurno - ÍMPAR" || j === "Plantão Noturno - ÍMPAR") return !par;
  return false;
}

function diasDoMes(ano: number, mes: number) {
  return new Date(ano, mes + 1, 0).getDate();
}

interface Params {
  funcionarios: Funcionario[];
  cargos: { id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  ano: number;
  mes: number; // 0-11
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SIGLAS_DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function gerarMapaPlantoesPdf({ funcionarios, cargos, clientes, ano, mes }: Params) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Mapa de Plantões - ${MESES[mes]}/${ano}`, pageWidth / 2, 12, { align: "center" });

  const dias = diasDoMes(ano, mes);
  const dataRef = new Date(ano, mes, 1);
  const diasArr = Array.from({ length: dias }, (_, i) => i + 1);
  const dowArr = diasArr.map((d) => new Date(ano, mes, d).getDay());
  const head = [
    ["Funcionário", "Cargo", "Cliente", "Jornada", ...diasArr.map((d) => `${SIGLAS_DOW[dowArr[d - 1]]}\n${d}`)],
  ];

  const body = funcionarios.map((f) => {
    const cargo = cargos.find((c) => c.id === f.cargoId)?.nome || "—";
    const cliente = clientes.find((c) => c.id === f.clienteId)?.nome || "—";
    const sigla = SIGLAS[(f.jornadaTrabalho as TipoJornada)] || "";
    const linhaDias = Array.from({ length: dias }, (_, i) =>
      trabalhaNoDia(f.jornadaTrabalho, i + 1, dataRef) ? sigla : ""
    );
    return [f.nome, cargo, cliente, f.jornadaTrabalho || "—", ...linhaDias];
  });

  const diasColStyles: any = {};
  diasArr.forEach((d, idx) => {
    const colIdx = 4 + idx;
    const fimSemana = dowArr[idx] === 0 || dowArr[idx] === 6;
    if (fimSemana) diasColStyles[colIdx] = { fillColor: [240, 240, 245] };
  });

  (await getAutoTable())(doc, {
    startY: 18,
    head,
    body,
    styles: { fontSize: 6, cellPadding: 1, halign: "center", valign: "middle" },
    headStyles: { fillColor: [103, 58, 183], textColor: 255, fontSize: 6, halign: "center", valign: "middle" },
    columnStyles: {
      0: { halign: "left", cellWidth: 35 },
      1: { halign: "left", cellWidth: 25 },
      2: { halign: "left", cellWidth: 25 },
      3: { halign: "left", cellWidth: 28 },
      ...diasColStyles,
    },
  });

  doc.setFontSize(8);
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.text("Legenda: D=Diarista | DP=Plantão Diurno PAR | DI=Plantão Diurno ÍMPAR | NP=Plantão Noturno PAR | NI=Plantão Noturno ÍMPAR", 10, finalY);

  doc.save(`mapa-plantoes-${ano}-${String(mes + 1).padStart(2, "0")}.pdf`);
}

export async function gerarMapaPlantoesExcel({ funcionarios, cargos, clientes, ano, mes }: Params) {
  const dias = diasDoMes(ano, mes);
  const dataRef = new Date(ano, mes, 1);
  const diasArr = Array.from({ length: dias }, (_, i) => i + 1);
  const dowArr = diasArr.map((d) => new Date(ano, mes, d).getDay());

  const headerDow = ["", "", "", "", ...diasArr.map((d) => SIGLAS_DOW[dowArr[d - 1]])];
  const headerDia = ["Funcionário", "Cargo", "Cliente", "Jornada", ...diasArr.map((d) => String(d))];

  const rows = funcionarios.map((f) => {
    const cargo = cargos.find((c) => c.id === f.cargoId)?.nome || "";
    const cliente = clientes.find((c) => c.id === f.clienteId)?.nome || "";
    const sigla = SIGLAS[(f.jornadaTrabalho as TipoJornada)] || "";
    const linhaDias = diasArr.map((d) => (trabalhaNoDia(f.jornadaTrabalho, d, dataRef) ? sigla : ""));
    return [f.nome, cargo, cliente, f.jornadaTrabalho || "", ...linhaDias];
  });

  const ws = (await getXLSX()).utils.aoa_to_sheet([headerDow, headerDia, ...rows]);
  ws["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, ...Array.from({ length: dias }, () => ({ wch: 4 }))];
  const wb = (await getXLSX()).utils.book_new();
  (await getXLSX()).utils.book_append_sheet(wb, ws, `${MESES[mes]} ${ano}`);
  (await getXLSX()).writeFile(wb, `mapa-plantoes-${ano}-${String(mes + 1).padStart(2, "0")}.xlsx`, { compression: true });
}
