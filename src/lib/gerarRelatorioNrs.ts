import { addHeader, addFooter } from "@/lib/gerarRelatorioEstoque";
import type { NrCatalogo } from "@/contexts/NrsCatalogoContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const fmt = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");

export async function gerarPdfNrs(nrs: NrCatalogo[], filtros?: string) {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape" });

  await addHeader(doc, {
    title: "Relatório de Normas Regulamentadoras (NRs)",
    subtitle: `Total: ${nrs.length} NRs cadastradas`,
    filters: filtros,
  });

  (await getAutoTable())(doc, {
    startY: 44,
    head: [["Cod/Nome", "Descrição", "Validade (dias)", "Publicação", "Vigência", "Revisões", "Observação"]],
    body: nrs.map((n) => [
      n.codigo,
      n.descricao || "",
      n.validadeDias != null ? String(n.validadeDias) : "—",
      fmt(n.dataPublicacao),
      fmt(n.dataVigencia),
      String(n.revisoes?.length || 0),
      n.observacao || "",
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 26, halign: "center" },
      5: { cellWidth: 20, halign: "center" },
      6: { cellWidth: 60 },
    },
  });

  const comRev = nrs.filter((n) => (n.revisoes?.length || 0) > 0);
  if (comRev.length) {
    (await getAutoTable())(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["NR", "Revisão", "Publicação", "Vigência", "Observação", "Anexos"]],
      body: comRev.flatMap((n) =>
        (n.revisoes || []).map((r) => [
          n.codigo,
          r.revisao,
          fmt(r.dataPublicacao),
          fmt(r.dataVigencia),
          r.observacao || "",
          String(r.anexos?.length || 0),
        ]),
      ),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
  }

  addFooter(doc);
  doc.save("relatorio-nrs.pdf");
}

export async function gerarExcelNrs(nrs: NrCatalogo[]) {
  const wb = (await getXLSX()).utils.book_new();

  const ws = (await getXLSX()).utils.json_to_sheet(
    nrs.map((n) => ({
      "Cod/Nome": n.codigo,
      "Descrição": n.descricao || "",
      "Validade (dias)": n.validadeDias ?? "",
      "Data de Publicação": fmt(n.dataPublicacao),
      "Data de Vigência": fmt(n.dataVigencia),
      "Revisões": n.revisoes?.length || 0,
      "Observação": n.observacao || "",
      "Anexo": n.anexoNome || "",
    })),
  );
  ws["!cols"] = [{ wch: 14 }, { wch: 45 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 40 }, { wch: 30 }];
  (await getXLSX()).utils.book_append_sheet(wb, ws, "NRs");

  const revRows = nrs.flatMap((n) =>
    (n.revisoes || []).map((r) => ({
      "Cod/Nome NR": n.codigo,
      "Revisão": r.revisao,
      "Publicação": fmt(r.dataPublicacao),
      "Vigência": fmt(r.dataVigencia),
      "Observação": r.observacao || "",
      "Anexos": (r.anexos || []).map((a) => a.nome).join(", "),
    })),
  );
  if (revRows.length) {
    const wsRev = (await getXLSX()).utils.json_to_sheet(revRows);
    wsRev["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 40 }];
    (await getXLSX()).utils.book_append_sheet(wb, wsRev, "Revisões");
  }

  (await getXLSX()).writeFile(wb, "relatorio-nrs.xlsx", { compression: true });
}
