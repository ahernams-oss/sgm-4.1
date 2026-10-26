import { addHeader, addFooter } from "@/lib/gerarRelatorioEstoque";
import type { EpiCatalogo } from "@/contexts/EpisCatalogoContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
const getXLSX = async () => await import("xlsx");

const validadeTexto = (meses: number | null) =>
  meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "—";

export async function gerarPdfEpis(epis: EpiCatalogo[], filtros?: string) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });

  await addHeader(doc, {
    title: "Relatório de Catálogo de EPIs",
    subtitle: `Total: ${epis.length} ${epis.length === 1 ? "EPI" : "EPIs"}`,
    filters: filtros,
  });

  (await getAutoTable())(doc, {
    startY: 44,
    head: [["Código", "Descrição", "Grupo", "SubGrupo", "Unidade", "CA", "Validade", "Observação"]],
    body: epis.map((e) => [
      e.codigo || "—",
      e.descricao,
      e.grupo || "—",
      e.subgrupo || "—",
      e.unidade || "—",
      e.ca || "—",
      validadeTexto(e.validadeMeses),
      e.observacao || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto", fontStyle: "bold" },
      2: { cellWidth: 40 },
      3: { cellWidth: 34 },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
      6: { cellWidth: 20, halign: "center" },
      7: { cellWidth: 50 },
    },
  });

  addFooter(doc);
  doc.save("relatorio-epis.pdf");
}

export async function gerarExcelEpis(epis: EpiCatalogo[]) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.json_to_sheet(
    epis.map((e) => ({
      "Código": e.codigo || "",
      "Descrição": e.descricao,
      "Grupo": e.grupo || "",
      "SubGrupo": e.subgrupo || "",
      "Unidade": e.unidade || "",
      "CA": e.ca || "",
      "Validade (meses)": e.validadeMeses ?? "",
      "Observação": e.observacao || "",
    })),
  );
  ws["!cols"] = [{ wch: 12 }, { wch: 45 }, { wch: 30 }, { wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, "EPIs");

  XLSX.writeFile(wb, "relatorio-epis.xlsx", { compression: true });
}
