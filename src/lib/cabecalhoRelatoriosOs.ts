import type { jsPDF } from "jspdf";

/** Retorna a posição segura para iniciar o conteúdo abaixo do cabeçalho. */
export function addHeader(doc: jsPDF, titulo: string, subtitulo?: string, filtros?: string): number {
  const pw = doc.internal.pageSize.getWidth();
  const largura = pw - 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const linhasTitulo = doc.splitTextToSize(titulo, largura) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const linhasSubtitulo = subtitulo ? doc.splitTextToSize(subtitulo, largura) as string[] : [];
  const linhasFiltros = filtros ? doc.splitTextToSize(filtros, largura) as string[] : [];
  const ySubtitulo = 12 + linhasTitulo.length * 6 + 1;
  const yFiltros = ySubtitulo + linhasSubtitulo.length * 4.5;
  const yGerado = yFiltros + linhasFiltros.length * 4.5;
  const altura = yGerado + 5;

  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, altura, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(linhasTitulo, 14, 12, { lineHeightFactor: 6 / (14 * 25.4 / 72) });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const opcoes = { lineHeightFactor: 4.5 / (9 * 25.4 / 72) };
  if (linhasSubtitulo.length) doc.text(linhasSubtitulo, 14, ySubtitulo, opcoes);
  if (linhasFiltros.length) doc.text(linhasFiltros, 14, yFiltros, opcoes);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, yGerado);
  doc.setTextColor(30, 30, 30);
  return altura + 4;
}