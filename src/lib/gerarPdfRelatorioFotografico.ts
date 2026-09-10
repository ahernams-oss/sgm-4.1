import type { jsPDF } from "jspdf";
import type { OrdemServico } from "@/contexts/OrdensServicoContext";
import capaAsset from "@/assets/capa-relatorio-fotografico.jpg.asset.json";
import finalAsset from "@/assets/final-relatorio-fotografico.jpg.asset.json";

const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const BORDER: [number, number, number] = [60, 60, 60];

async function loadImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(b);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
      img.onerror = () => resolve({ w: 4, h: 3 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

const fmtData = (d?: string) => {
  if (!d) return "";
  const dataSomente = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dataSomente) return `${dataSomente[3]}/${dataSomente[2]}/${dataSomente[1]}`;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR");
};

const fmtDateTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export interface RelatorioFotograficoOptions {
  ordens: OrdemServico[];
  clienteNome?: string;
  unidade?: string;
  descricao?: string;
  numeroProcesso?: string;
  numeroContrato?: string;
  periodoInicio?: string;
  periodoFim?: string;
  orientation?: "p" | "l";
  fileName?: string;
}

async function renderCapa(doc: jsPDF, opt: RelatorioFotograficoOptions) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const capa = await loadImage(capaAsset.url);
  if (capa) {
    const scale = Math.min(pw / capa.w, ph / capa.h);
    const coverW = capa.w * scale;
    const coverH = capa.h * scale;
    const coverX = (pw - coverW) / 2;
    const coverY = (ph - coverH) / 2;

    try { doc.addImage(capa.dataUrl, "JPEG", coverX, coverY, coverW, coverH); } catch { /* ignore */ }

    doc.setTextColor(20, 33, 61);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(7, 10 * scale));

    const put = (text: string, imageX: number, imageY: number, maxImageWidth = 280) => {
      if (!text) return;
      doc.text(text, coverX + imageX * scale, coverY + imageY * scale, { maxWidth: maxImageWidth * scale });
    };

    const periodo = [fmtData(opt.periodoInicio), fmtData(opt.periodoFim)].filter(Boolean).join(" a ");
    // Coordenadas medidas sobre a capa (1055x1491): início e fim de cada linha de preenchimento.
    put(opt.clienteNome || "", 172, 636, 320);
    put(opt.descricao || "", 196, 688, 335);
    put(opt.numeroProcesso || "", 248, 739, 280);
    put(opt.numeroContrato || "", 242, 784, 296);
    // Período deslocado ~2pt (≈4px na imagem da capa) para a direita.
    put(periodo, 181, 831, 293);
  }

  doc.setTextColor(30, 30, 30);
}

async function renderCabecalhoOS(doc: jsPDF, os: OrdemServico, startY: number): Promise<number> {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 12, mr = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 107);
  doc.text(`ORDEM DE SERVIÇO Nº ${String(os.numero).padStart(2, "0")}`, ml, startY);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(os.clienteNome || "", pw - mr, startY, { align: "right", maxWidth: pw * 0.5 });

  (await getAutoTable())(doc, {
    startY: startY + 3,
    margin: { left: ml, right: mr },
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30], valign: "middle" },
    body: [
      [
        { content: "Unidade:", styles: { fontStyle: "bold" as const } }, os.localDescricao || "-",
        { content: "Tipo de serviço:", styles: { fontStyle: "bold" as const } }, os.categoria || os.servico || "-",
      ],
      [
        { content: "Pavimento:", styles: { fontStyle: "bold" as const } }, os.pavimentoDescricao || "-",
        { content: "Setor:", styles: { fontStyle: "bold" as const } }, os.setorDescricao || "-",
      ],
      [
        { content: "Solicitante:", styles: { fontStyle: "bold" as const } }, os.solicitante || "-",
        { content: "Emissão:", styles: { fontStyle: "bold" as const } }, fmtDateTime(os.createdAt) || "-",
      ],
      [
        { content: "Situação:", styles: { fontStyle: "bold" as const } }, os.situacao || "-",
        { content: "Período:", styles: { fontStyle: "bold" as const } },
        `${fmtData(os.dataInicio) || "-"} a ${fmtData(os.dataTermino) || "-"}`,
      ],
    ],
    columnStyles: { 0: { cellWidth: 26 }, 2: { cellWidth: 26 } },
  });

  return ((doc as any).lastAutoTable?.finalY ?? startY + 30) + 4;
}

export async function gerarPdfRelatorioFotografico(opt: RelatorioFotograficoOptions) {
  const JsPDF = await getJsPDF();
  const doc = new JsPDF({ compress: true, orientation: opt.orientation || "p", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 12, mr = 12;
  const contentW = pw - ml - mr;

  await renderCapa(doc, opt);

  const ordensComFotos = opt.ordens.filter((os) => Array.isArray(os.fotos) && os.fotos.length > 0);
  if (ordensComFotos.length === 0) {
    throw new Error("Nenhuma Ordem de Serviço com imagens anexadas no filtro selecionado.");
  }

  for (const os of ordensComFotos) {
    const fotos = os.fotos;
    const imagens = (await Promise.all(fotos.map(async (foto) => ({ foto, imagem: await loadImage(foto.url) })))).filter(
      (item): item is { foto: typeof fotos[number]; imagem: { dataUrl: string; w: number; h: number } } => item.imagem !== null
    );
    if (imagens.length === 0) continue;

    doc.addPage();
    let y = await renderCabecalhoOS(doc, os, 16);

    const columns = opt.orientation === "l" ? 3 : 2;
    const gap = opt.orientation === "l" ? 5 : 6;
    const cellW = (contentW - gap * (columns - 1)) / columns;
    const cellH = cellW * 0.75;
    const captionH = imagens.some(({ foto }) => foto.observacao?.trim()) ? 18 : 0;
    const blockH = cellH + captionH;
    let col = 0;

    for (const { foto, imagem } of imagens) {
      if (y + blockH > ph - 14) {
        doc.addPage();
        y = 16;
        col = 0;
      }

      const x = ml + col * (cellW + gap);
      const imagePadding = 2;
      const maxImageW = cellW - imagePadding * 2;
      const maxImageH = cellH - imagePadding * 2;
      const ratio = Math.min(maxImageW / imagem.w, maxImageH / imagem.h);
      const w = imagem.w * ratio;
      const h = imagem.h * ratio;

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.rect(x, y, cellW, cellH);
      try {
        doc.addImage(imagem.dataUrl, "JPEG", x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
      } catch { /* ignore */ }

      const observacao = foto.observacao?.trim().slice(0, 200);
      if (observacao) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(45, 45, 45);
        const linhas = doc.splitTextToSize(observacao, cellW - 4).slice(0, 5);
        doc.text(linhas, x + 2, y + cellH + 4, { maxWidth: cellW - 4 });
      }

      col += 1;
      if (col === columns) { col = 0; y += blockH + gap; }
    }
  }

  const pages = doc.getNumberOfPages();
  if (pages < 2) {
    throw new Error("Não foi possível carregar as imagens das Ordens de Serviço filtradas.");
  }
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i - 1} de ${pages - 1}`, pw / 2, ph - 6, { align: "center" });
  }

  const contracapa = await loadImage(finalAsset.url);
  if (contracapa) {
    doc.addPage();
    const scale = Math.min(pw / contracapa.w, ph / contracapa.h);
    const w = contracapa.w * scale;
    const h = contracapa.h * scale;
    try { doc.addImage(contracapa.dataUrl, "JPEG", (pw - w) / 2, (ph - h) / 2, w, h); } catch { /* ignore */ }
  }

  doc.save(`${opt.fileName || "relatorio_fotografico"}.pdf`);
}
