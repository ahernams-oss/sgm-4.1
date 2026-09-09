import { format } from "date-fns";
import type { Pregao, PregaoItem, PregaoParticipante, PregaoLance } from "@/contexts/PregaoContext";
import type { Empresa } from "@/contexts/EmpresaContext";
import { formatNumeroAno } from "@/lib/formatNumero";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const BLUE = { r: 30, g: 58, b: 107 };
const BORDER = { r: 180, g: 195, b: 215 };

const fmt = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadImage(url: string): Promise<string | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        c.getContext("2d")?.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  } catch { return null; }
}

interface AtaData {
  pregao: Pregao;
  itens: PregaoItem[];
  participantes: PregaoParticipante[];
  lances: PregaoLance[];
  empresa: Empresa | null;
}

export async function gerarPdfAtaPregao(data: AtaData): Promise<jsPDF> {
  const { pregao, itens, participantes, lances, empresa } = data;
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 12;
  const mr = pw - 12;
  const fullW = mr - ml;

  const logo = await loadImage(empresa?.logoUrl || "/Logo_Lasant.png");

  // Header
  const headerH = 30;
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(pw * 0.42, 0, pw - pw * 0.42, headerH, "F");
  if (logo) doc.addImage(logo, "PNG", ml, 4, 42, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ATA DA SESSÃO PÚBLICA", mr, 14, { align: "right" });
  doc.setFontSize(11);
  doc.text(`Pregão Eletrônico ${formatNumeroAno(pregao.numero, pregao.createdAt)}`, mr, 22, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 36;

  // Resumo
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("OBJETO:", ml, y);
  doc.setFont("helvetica", "normal");
  const objLines = doc.splitTextToSize(pregao.objeto || "—", fullW - 20);
  doc.text(objLines, ml + 18, y);
  y += objLines.length * 4 + 2;

  const meta: [string, string][] = [
    ["Modalidade", pregao.modalidade],
    ["Tipo de disputa", pregao.tipoDisputa],
    ["Pregoeiro", pregao.pregoeiroNome || "—"],
    ["Status", pregao.status],
    ["Início da disputa", pregao.dataInicioDisputa ? format(new Date(pregao.dataInicioDisputa), "dd/MM/yyyy HH:mm") : "—"],
    ["Encerramento", pregao.dataEncerramentoDisputa ? format(new Date(pregao.dataEncerramentoDisputa), "dd/MM/yyyy HH:mm") : "—"],
  ];
  (await getAutoTable())(doc, {
    startY: y,
    body: meta,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [BORDER.r, BORDER.g, BORDER.b] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, fillColor: [240, 245, 252] } },
    margin: { left: ml, right: 12 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Participantes
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255, 255, 255);
  doc.rect(ml, y, fullW, 6, "F");
  doc.text("LICITANTES CREDENCIADOS", ml + 3, y + 4.3);
  doc.setTextColor(0, 0, 0);
  y += 6;

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Apelido", "Fornecedor", "CNPJ", "Status"]],
    body: participantes.map(p => [p.apelido, p.fornecedorNome, p.fornecedorCnpj, p.status]),
    margin: { left: ml, right: 12 },
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [BORDER.r, BORDER.g, BORDER.b] },
    headStyles: { fillColor: [BLUE.r, BLUE.g, BLUE.b], textColor: [255, 255, 255], fontSize: 7.5 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Por item: ranking
  for (const item of itens.sort((a, b) => a.ordem - b.ordem)) {
    if (y > ph - 60) { doc.addPage(); y = 15; }
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.rect(ml, y, fullW, 6, "F");
    doc.text(`ITEM ${String(item.ordem).padStart(3, "0")} — ${item.descricao}`.slice(0, 95), ml + 3, y + 4.3);
    doc.setTextColor(0, 0, 0);
    y += 6;

    const lancesItem = lances.filter(l => l.itemId === item.id && !l.cancelado).sort((a, b) => a.valor - b.valor);
    const venc = item.vencedorParticipanteId ? participantes.find(p => p.id === item.vencedorParticipanteId) : null;

    (await getAutoTable())(doc, {
      startY: y,
      body: [
        ["Quantidade", `${item.quantidade} ${item.unidade}`],
        ["Status", item.status],
        ["Vencedor", venc ? `${venc.apelido} — ${venc.fornecedorNome} (${venc.fornecedorCnpj})` : "—"],
        ["Valor vencedor", item.vencedorValor ? fmt(item.vencedorValor) : "—"],
        ["Valor unitário", item.vencedorValorUnitario ? fmt(item.vencedorValorUnitario) : "—"],
      ],
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [BORDER.r, BORDER.g, BORDER.b] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40, fillColor: [240, 245, 252] } },
      margin: { left: ml, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    if (lancesItem.length) {
      (await getAutoTable())(doc, {
        startY: y,
        head: [["#", "Licitante", "Fornecedor", "Data/Hora", "Valor"]],
        body: lancesItem.map((l, i) => {
          const p = participantes.find(x => x.id === l.participanteId);
          return [
            String(i + 1),
            p?.apelido || "—",
            p?.fornecedorNome || "—",
            format(new Date(l.ts), "dd/MM/yyyy HH:mm:ss"),
            fmt(l.valor),
          ];
        }),
        margin: { left: ml, right: 12 },
        styles: { fontSize: 7, cellPadding: 1.5, lineColor: [BORDER.r, BORDER.g, BORDER.b] },
        headStyles: { fillColor: [80, 100, 140], textColor: [255, 255, 255], fontSize: 7 },
        columnStyles: { 0: { cellWidth: 8, halign: "center" }, 4: { halign: "right" } },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    } else {
      doc.setFontSize(8); doc.setFont("helvetica", "italic");
      doc.text("Item sem lances (deserto/fracassado).", ml + 3, y + 4);
      y += 8;
    }
  }

  // Footer
  if (y > ph - 25) { doc.addPage(); y = 15; }
  y += 6;
  doc.setFontSize(8); doc.setFont("helvetica", "italic");
  doc.text(
    `Ata gerada eletronicamente em ${format(new Date(), "dd/MM/yyyy HH:mm")} — sessão pública conduzida pelo pregoeiro ${pregao.pregoeiroNome || "—"}.`,
    ml, y
  );

  // Page footer band
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
    doc.rect(0, ph - 8, pw, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(`Pregão ${formatNumeroAno(pregao.numero, pregao.createdAt)} — pág. ${i}/${pageCount}`, pw / 2, ph - 3, { align: "center" });
  }

  return doc;
}

export async function downloadAtaPregao(data: AtaData) {
  const doc = await gerarPdfAtaPregao(data);
  doc.save(`Ata_Pregao_${formatNumeroAno(data.pregao.numero, data.pregao.createdAt)}.pdf`);
}
