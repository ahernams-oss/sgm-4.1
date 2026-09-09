import type { OrcamentoSco } from "@/contexts/OrcamentosScoContext";
import { supabase } from "@/integrations/supabase/client";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const fmt = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number, dp = 2) =>
  (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: dp, maximumFractionDigits: dp });

async function loadComposicoes(servicoCodigos: string[]) {
  if (!servicoCodigos.length) return {} as Record<string, any[]>;
  const { data: comps } = await (supabase as any)
    .from("sco_composicoes")
    .select("*")
    .in("servico_codigo", servicoCodigos);
  const elemCodes = Array.from(new Set((comps || []).map((c: any) => c.elementar_codigo).filter(Boolean)));
  let precos: Record<string, number> = {};
  if (elemCodes.length) {
    const { data: els } = await (supabase as any)
      .from("sco_elementares").select("codigo,preco,grupo").in("codigo", elemCodes);
    precos = Object.fromEntries((els || []).map((e: any) => [e.codigo, Number(e.preco || 0)]));
  }
  const grouped: Record<string, any[]> = {};
  for (const c of comps || []) {
    const arr = grouped[c.servico_codigo] || (grouped[c.servico_codigo] = []);
    arr.push({ ...c, elementar_preco: precos[c.elementar_codigo] || 0 });
  }
  return grouped;
}

export async function gerarPdfOrcamentoSco(orc: OrcamentoSco, empresaNome = "") {
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();

  // header
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(`Orçamento SCO Nº ${orc.numero}`, 14, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${orc.titulo}`, 14, 20);
  doc.text(`Análise: ${orc.tipo_analise === "analitica" ? "Analítica" : "Sintética"}`, 14, 26);
  doc.setFontSize(9);
  doc.text(empresaNome, pw - 14, 13, { align: "right" });
  doc.text(new Date(orc.created_at).toLocaleDateString("pt-BR"), pw - 14, 20, { align: "right" });

  doc.setTextColor(30, 30, 30);
  let y = 38;
  doc.setFontSize(9);
  if (orc.cliente_nome) { doc.text(`Cliente: ${orc.cliente_nome}`, 14, y); y += 5; }
  if (orc.obra) { doc.text(`Obra: ${orc.obra}`, 14, y); y += 5; }
  doc.text(`BDI: ${fmtNum(orc.bdi, 2)}%   Desconto: ${fmtNum(orc.desconto, 2)}%`, 14, y);
  y += 6;

  if (orc.tipo_analise === "sintetica") {
    (await getAutoTable())(doc, {
      startY: y,
      head: [["Código", "Descrição", "Un", "Qtd", "Unit.", "Total"]],
      body: orc.itens.map((i) => [
        i.servico_codigo,
        i.descricao,
        i.unidade,
        fmtNum(i.quantidade, 2),
        fmt(i.preco_unit),
        fmt(i.preco_total),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 107], textColor: 255 },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    // analítica - mostra cada serviço com sua composição
    const grouped = await loadComposicoes(orc.itens.map((i) => i.servico_codigo));
    for (const item of orc.itens) {
      (await getAutoTable())(doc, {
        startY: y,
        head: [[`${item.servico_codigo} — ${item.descricao}`, "", "", "", "", ""]],
        body: [["Un: " + item.unidade, `Qtd: ${fmtNum(item.quantidade, 2)}`, `Unit: ${fmt(item.preco_unit)}`, "", "", `Total: ${fmt(item.preco_total)}`]],
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 107], textColor: 255, fontStyle: "bold" },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY;
      const comps = grouped[item.servico_codigo] || [];
      (await getAutoTable())(doc, {
        startY: y,
        head: [["Composição — Código", "Descrição do Elementar", "Un", "Qtd Unit.", "Qtd Total", "Preço Unit.", "Subtotal"]],
        body: comps.map((c: any) => {
          const qtdTot = Number(c.quantidade) * Number(item.quantidade);
          return [
            c.elementar_codigo,
            c.elementar_descricao,
            c.unidade,
            fmtNum(Number(c.quantidade), 4),
            fmtNum(qtdTot, 4),
            fmt(c.elementar_preco),
            fmt(qtdTot * c.elementar_preco),
          ];
        }),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [200, 210, 230], textColor: 30 },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
      if (y > 250) { doc.addPage(); y = 20; }
    }
  }

  // totals
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFillColor(240, 240, 245);
  doc.roundedRect(14, y, pw - 28, 26, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal: ${fmt(orc.subtotal)}`, 20, y + 7);
  doc.text(`BDI (${fmtNum(orc.bdi, 2)}%): ${fmt(orc.subtotal * (orc.bdi / 100))}`, 20, y + 13);
  doc.text(`Desconto (${fmtNum(orc.desconto, 2)}%): ${fmt(orc.subtotal * (1 + orc.bdi / 100) * (orc.desconto / 100))}`, 20, y + 19);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 107);
  doc.text(`Valor Total: ${fmt(orc.valor_total)}`, pw - 20, y + 16, { align: "right" });

  if (orc.observacoes) {
    y += 32;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 14, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(orc.observacoes, pw - 28);
    doc.text(lines, 14, y + 5);
  }

  doc.save(`Orcamento_SCO_${orc.numero}_${orc.tipo_analise}.pdf`);
}
