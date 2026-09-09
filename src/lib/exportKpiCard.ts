import { toJpeg } from "html-to-image";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "kpi";

const hoje = () => new Date().toISOString().slice(0, 10);

async function capturar(el: HTMLElement) {
  return toJpeg(el, {
    backgroundColor: "#ffffff",
    pixelRatio: 3,
    cacheBust: true,
    quality: 0.95,
    filter: (node) => {
      const e = node as HTMLElement;
      return !(e?.dataset && e.dataset.exportIgnore === "true");
    },
  });
}

/** Exporta um card de KPI individual como imagem JPG. */
export async function exportarKpiCardJpg(el: HTMLElement, label: string) {
  const dataUrl = await capturar(el);
  const a = document.createElement("a");
  a.download = `kpi_${slug(label)}_${hoje()}.jpg`;
  a.href = dataUrl;
  a.click();
}

/** Exporta um card de KPI individual como PDF (imagem centralizada com cabeçalho). */
export async function exportarKpiCardPdf(el: HTMLElement, label: string) {
  const dataUrl = await capturar(el);
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a5" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Indicador", 12, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 12, 17);

  const props = doc.getImageProperties(dataUrl);
  const maxW = pw - 40;
  const maxH = ph - 55;
  const ratio = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * ratio;
  const h = props.height * ratio;
  doc.addImage(dataUrl, "JPEG", (pw - w) / 2, 32, w, h);

  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text("Relatório de indicador — SGM Lasant", 12, ph - 8);

  doc.save(`kpi_${slug(label)}_${hoje()}.pdf`);
}
