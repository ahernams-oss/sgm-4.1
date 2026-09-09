import { Lancamento, TipoFalta, TipoAdvertencia } from "@/contexts/LancamentosContext";
import { Funcionario } from "@/contexts/FuncionariosContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const TIPO_FALTA_LABELS: Record<TipoFalta, string> = {
  justificada: "Justificada",
  injustificada: "Injustificada",
  suspensao: "Suspensão",
};

const TIPO_ADVERTENCIA_LABELS: Record<TipoAdvertencia, string> = {
  verbal: "Verbal",
  escrita: "Escrita",
};

interface MapaPdfParams {
  lancamentos: Lancamento[];
  funcionarios: Funcionario[];
  cargos: { id: string; nome: string }[];
  clientes: { id: string; nome: string }[];
  filterMes: string;
  filterCliente: string;
  filterFuncionario: string;
}

const formatData = (d: string) => {
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
};

const formatMes = (mes: string) => {
  try {
    const [y, m] = mes.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return format(d, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
  } catch { return mes; }
};

export async function gerarPdfMapaFuncionarios(params: MapaPdfParams) {
  const { lancamentos, funcionarios, cargos, clientes, filterMes, filterCliente, filterFuncionario } = params;
  const doc = new (await getJsPDF())({ orientation: "landscape", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  const getFuncNome = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? "—";
  const getCargoNome = (funcId: string) => {
    const func = funcionarios.find((f) => f.id === funcId);
    if (!func) return "—";
    return cargos.find((c) => c.id === func.cargoId)?.nome ?? "—";
  };
  const getClienteNome = (funcId: string) => {
    const func = funcionarios.find((f) => f.id === funcId);
    if (!func?.clienteId) return "—";
    return clientes.find((c) => c.id === func.clienteId)?.nome ?? "—";
  };

  // Header
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Mapa de Funcionários", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${formatMes(filterMes)}`, 14, 20);
  doc.setFontSize(9);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - 14, 12, { align: "right" });

  if (filterCliente !== "todos") {
    const cli = clientes.find((c) => c.id === filterCliente);
    if (cli) doc.text(`Cliente: ${cli.nome}`, pageWidth - 14, 20, { align: "right" });
  }
  if (filterFuncionario !== "todos") {
    doc.text(`Funcionário: ${getFuncNome(filterFuncionario)}`, pageWidth - 14, 26, { align: "right" });
  }

  doc.setTextColor(30, 30, 30);
  let y = 36;

  // Separate by type
  const faltas = lancamentos.filter((l) => l.tipo === "falta").sort((a, b) => a.data.localeCompare(b.data));
  const horasExtras = lancamentos.filter((l) => l.tipo === "hora_extra").sort((a, b) => a.data.localeCompare(b.data));
  const advertencias = lancamentos.filter((l) => l.tipo === "advertencia").sort((a, b) => a.data.localeCompare(b.data));

  // KPIs
  const totalFaltas = faltas.length;
  const faltasJust = faltas.filter((l) => l.tipoFalta === "justificada").length;
  const faltasInjust = faltas.filter((l) => l.tipoFalta === "injustificada").length;
  const faltasSusp = faltas.filter((l) => l.tipoFalta === "suspensao").length;
  const totalHE = horasExtras.reduce((s, l) => s + (l.horasExtras || 0), 0);
  const funcComFalta = new Set(faltas.map((l) => l.funcionarioId)).size;
  const funcComHE = new Set(horasExtras.map((l) => l.funcionarioId)).size;
  const totalAdv = advertencias.length;
  const funcComAdv = new Set(advertencias.map((l) => l.funcionarioId)).size;

  // Summary table
  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Resumo do Período", "", "", ""]],
    body: [
      [`Total de Faltas: ${totalFaltas}`, `Justificadas: ${faltasJust}`, `Injustificadas: ${faltasInjust}`, `Suspensões: ${faltasSusp}`],
      [`Total Horas Extras: ${totalHE.toFixed(1)}h`, `Funcionários c/ HE: ${funcComHE}`, `Total Advertências: ${totalAdv}`, `Funcionários c/ adv: ${funcComAdv}`],
    ],
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [230, 236, 245], textColor: [30, 58, 107], fontStyle: "bold", fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Faltas table
  if (faltas.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 236, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.text("Registro de Faltas", 16, y + 2);
    y += 10;

    (await getAutoTable())(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["Data", "Funcionário", "Cargo", "Cliente", "Tipo", "Observação"]],
      body: faltas.map((l) => [
        formatData(l.data),
        getFuncNome(l.funcionarioId),
        getCargoNome(l.funcionarioId),
        getClienteNome(l.funcionarioId),
        TIPO_FALTA_LABELS[l.tipoFalta || "injustificada"],
        l.observacao || "—",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 5: { cellWidth: 60 } },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Horas extras table
  if (horasExtras.length > 0) {
    if (y > 160) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 236, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.text("Registro de Horas Extras", 16, y + 2);
    y += 10;

    (await getAutoTable())(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["Data", "Funcionário", "Cargo", "Cliente", "Horas", "Percentual", "Observação"]],
      body: horasExtras.map((l) => [
        formatData(l.data),
        getFuncNome(l.funcionarioId),
        getCargoNome(l.funcionarioId),
        getClienteNome(l.funcionarioId),
        `${l.horasExtras}h`,
        `${l.percentual}%`,
        l.observacao || "—",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 6: { cellWidth: 60 } },
    });
  }

  // Advertências table
  if (advertencias.length > 0) {
    if (y > 160) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 236, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.text("Registro de Advertências", 16, y + 2);
    y += 10;

    (await getAutoTable())(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["Data", "Funcionário", "Cargo", "Cliente", "Tipo", "Motivo", "Observação"]],
      body: advertencias.map((l) => [
        formatData(l.data),
        getFuncNome(l.funcionarioId),
        getCargoNome(l.funcionarioId),
        getClienteNome(l.funcionarioId),
        TIPO_ADVERTENCIA_LABELS[l.tipoAdvertencia || "verbal"],
        l.motivo || "—",
        l.observacao || "—",
      ]),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 5: { cellWidth: 50 }, 6: { cellWidth: 50 } },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    const ph = doc.internal.pageSize.getHeight();
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, ph - 8, { align: "right" });
  }

  const mesLabel = filterMes.replace("-", "_");
  doc.save(`Mapa_Funcionarios_${mesLabel}.pdf`);
}
