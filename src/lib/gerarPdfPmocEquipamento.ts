import { Equipamento } from "@/contexts/EquipamentosContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface AtividadeLike {
  id: string;
  descricao?: string;
  tipo?: string;
  periodicidade?: string;
  ultimaExecucao?: string | null;
  proximaExecucao?: string | null;
}

interface ExecucaoLike {
  id: string;
  atividade_id: string;
  atividade_descricao: string | null;
  periodicidade: string | null;
  data_execucao: string;
  proxima_execucao: string | null;
  status: string;
  registrado_por: string | null;
  confirmado_por: string | null;
  data_confirmacao: string | null;
  observacoes: string | null;
  fotos: string[] | null;
}

const COR = { primary: [30, 58, 107] as [number, number, number] };

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        try {
          resolve({ data: canvas.toDataURL("image/jpeg", 0.85), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    return null;
  }
}

export async function drawHeader(
  doc: jsPDF,
  pw: number,
  logo: { data: string } | null,
  titulo: string,
  subtitulo: string
) {
  doc.setFillColor(...COR.primary);
  doc.rect(0, 0, pw, 28, "F");
  if (logo) {
    try {
      doc.addImage(logo.data, "JPEG", 10, 5, 32, 18);
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, pw / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitulo, pw / 2, 20, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pw - 10, 25, { align: "right" });
  doc.setTextColor(30);
}

export function rodape(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, pw / 2, ph - 6, { align: "center" });
    doc.text("Lasant Construções LTDA — CNPJ 16.432.951/0001-70", 10, ph - 6);
  }
}

async function infoEquipamentoBlock(doc: jsPDF, pw: number, equip: Equipamento | null, planoTitulo: string | undefined, startY: number): Promise<number> {
  const margin = 10;
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COR.primary);
  doc.text("Dados do Equipamento", margin, y);
  y += 5;

  const linhas: [string, string][] = [
    ["Equipamento", `${equip?.tag || ""} ${equip?.equipamento || ""}`.trim() || "—"],
    ["Cliente / Unidade", equip?.clienteNome || "—"],
    ["Setor", equip?.setorDescricao || "—"],
    ["Local / Pavimento", `${equip?.localDescricao || "—"} ${equip?.pavimentoDescricao ? "/ " + equip.pavimentoDescricao : ""}`.trim()],
    ["Fabricante / Modelo", `${equip?.fabricante || "—"} ${equip?.modelo ? "/ " + equip.modelo : ""}`.trim()],
    ["Nº de Série", equip?.serie || "—"],
    ["Capacidade BTU", equip?.capacidadeBtu || "—"],
    ["Plano de Manutenção", planoTitulo || equip?.planoManutencao || "—"],
    ["Situação", equip?.situacao || "—"],
  ];

  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: linhas,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [240, 243, 250], cellWidth: 55, textColor: 30 },
      1: { cellWidth: pw - margin * 2 - 55 },
    },
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

export async function getLogo() {
  return await loadImage("/Logo_Lasant.png");
}

// =====================================================================
// 1) Relatório de Informações (equipamento + atividades planejadas)
// =====================================================================
export async function gerarPdfPmocInformacoes(params: {
  equip: Equipamento | null;
  equipNome: string;
  planoTitulo?: string;
  atividades: AtividadeLike[];
}) {
  const { equip, equipNome, planoTitulo, atividades } = params;
  const logo = await getLogo();
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  await drawHeader(doc, pw, logo, "PMOC — Ficha do Equipamento", equipNome);

  let y = 34;
  y = await infoEquipamentoBlock(doc, pw, equip, planoTitulo, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COR.primary);
  doc.text("Atividades Planejadas", 10, y);
  y += 3;

  (await getAutoTable())(doc, {
    startY: y + 2,
    margin: { left: 10, right: 10 },
    head: [["Atividade", "Tipo", "Periodicidade", "Última Execução", "Próxima Execução"]],
    body: atividades.map((a) => [
      a.descricao || "—",
      a.tipo || "—",
      a.periodicidade || "—",
      fmtDateTime(a.ultimaExecucao),
      fmtDateTime(a.proximaExecucao),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: COR.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  rodape(doc);
  doc.save(`PMOC_Informacoes_${(equipNome || "equipamento").replace(/\s+/g, "_")}.pdf`);
}

// =====================================================================
// 2) Relatório de Manutenções com Fotos
// =====================================================================
export async function gerarPdfPmocManutencoesFotos(params: {
  equip: Equipamento | null;
  equipNome: string;
  planoTitulo?: string;
  execucoes: ExecucaoLike[];
}) {
  const { equip, equipNome, planoTitulo, execucoes } = params;
  const logo = await getLogo();
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  await drawHeader(doc, pw, logo, "PMOC — Manutenções Executadas (com fotos)", equipNome);

  let y = 34;
  y = await infoEquipamentoBlock(doc, pw, equip, planoTitulo, y);

  const realizadas = execucoes
    .filter((e) => e.status === "Confirmada" || e.status === "Pendente")
    .sort((a, b) => new Date(b.data_execucao).getTime() - new Date(a.data_execucao).getTime());

  if (realizadas.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Nenhuma manutenção registrada para este equipamento.", 10, y + 6);
    rodape(doc);
    doc.save(`PMOC_Manutencoes_Fotos_${(equipNome || "equipamento").replace(/\s+/g, "_")}.pdf`);
    return;
  }

  for (let idx = 0; idx < realizadas.length; idx++) {
    const ex = realizadas[idx];
    // Estima altura mínima do bloco (cabeçalho + obs)
    if (y > ph - 60) {
      doc.addPage();
      await drawHeader(doc, pw, logo, "PMOC — Manutenções Executadas (com fotos)", equipNome);
      y = 34;
    }

    // Cabeçalho do bloco
    doc.setFillColor(...COR.primary);
    doc.rect(10, y, pw - 20, 7, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Manutenção ${idx + 1} — ${ex.atividade_descricao || "—"}`, 12, y + 5);
    doc.setFontSize(8);
    doc.text(ex.status, pw - 12, y + 5, { align: "right" });
    y += 10;

    doc.setTextColor(30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const meta: [string, string][] = [
      ["Executada em", fmtDateTime(ex.data_execucao)],
      ["Próxima", fmtDateTime(ex.proxima_execucao)],
      ["Periodicidade", ex.periodicidade || "—"],
      ["Registrado por", ex.registrado_por || "—"],
      ["Confirmado por", ex.confirmado_por || "—"],
      ["Confirmado em", fmtDateTime(ex.data_confirmacao)],
    ];
    (await getAutoTable())(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      body: meta,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [220, 220, 220], lineWidth: 0.2 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [245, 247, 250], cellWidth: 40 },
        1: { cellWidth: "auto" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    if (ex.observacoes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Observações:", 10, y + 4);
      doc.setFont("helvetica", "normal");
      const linhas = doc.splitTextToSize(ex.observacoes, pw - 20);
      doc.text(linhas, 10, y + 9);
      y += 9 + linhas.length * 4;
    }

    // Fotos
    const fotos = ex.fotos || [];
    if (fotos.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`Fotos (${fotos.length}):`, 10, y + 4);
      y += 7;

      const cols = 3;
      const gap = 4;
      const cellW = (pw - 20 - gap * (cols - 1)) / cols;
      const cellH = cellW * 0.75;

      for (let i = 0; i < fotos.length; i++) {
        const col = i % cols;
        if (col === 0 && i > 0) y += cellH + gap;
        if (y + cellH > ph - 15) {
          doc.addPage();
          await drawHeader(doc, pw, logo, "PMOC — Manutenções Executadas (com fotos)", equipNome);
          y = 34;
        }
        const x = 10 + col * (cellW + gap);
        const img = await loadImage(fotos[i]);
        if (img) {
          try {
            // Encaixa preservando proporção
            const ratio = Math.min(cellW / img.w, cellH / img.h);
            const w = img.w * ratio;
            const h = img.h * ratio;
            const dx = x + (cellW - w) / 2;
            const dy = y + (cellH - h) / 2;
            doc.setDrawColor(200);
            doc.rect(x, y, cellW, cellH);
            doc.addImage(img.data, "JPEG", dx, dy, w, h);
          } catch {
            doc.setDrawColor(220);
            doc.rect(x, y, cellW, cellH);
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text("[falha ao carregar]", x + 2, y + cellH / 2);
          }
        } else {
          doc.setDrawColor(220);
          doc.rect(x, y, cellW, cellH);
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text("[sem imagem]", x + 2, y + cellH / 2);
        }
      }
      const linhasUsadas = Math.ceil(fotos.length / cols);
      y += cellH * 1 + (linhasUsadas - 1) * 0 + gap;
      y += 4;
    }

    y += 6;
  }

  rodape(doc);
  doc.save(`PMOC_Manutencoes_Fotos_${(equipNome || "equipamento").replace(/\s+/g, "_")}.pdf`);
}

// =====================================================================
// 3) Histórico de Atividades do Equipamento
// =====================================================================
export async function gerarPdfPmocHistoricoAtividades(params: {
  equip: Equipamento | null;
  equipNome: string;
  planoTitulo?: string;
  execucoes: ExecucaoLike[];
}) {
  const { equip, equipNome, planoTitulo, execucoes } = params;
  const logo = await getLogo();
  const doc = new (await getJsPDF())({ compress: true, orientation: "l" });
  const pw = doc.internal.pageSize.getWidth();
  await drawHeader(doc, pw, logo, "PMOC — Histórico de Atividades do Equipamento", equipNome);

  let y = 34;
  y = await infoEquipamentoBlock(doc, pw, equip, planoTitulo, y);

  const ordenadas = [...execucoes].sort(
    (a, b) => new Date(b.data_execucao).getTime() - new Date(a.data_execucao).getTime()
  );

  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [["Atividade", "Periodicidade", "Executada em", "Próxima", "Status", "Registrado por", "Confirmado por", "Observações"]],
    body: ordenadas.map((e) => [
      e.atividade_descricao || "—",
      e.periodicidade || "—",
      fmtDateTime(e.data_execucao),
      fmtDateTime(e.proxima_execucao),
      e.status,
      e.registrado_por || "—",
      e.confirmado_por || "—",
      e.observacoes || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: COR.primary, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 60 },
      7: { cellWidth: 50 },
    },
  });

  // Resumo
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  const total = ordenadas.length;
  const confirm = ordenadas.filter((e) => e.status === "Confirmada").length;
  const pend = ordenadas.filter((e) => e.status === "Pendente").length;
  const rej = ordenadas.filter((e) => e.status === "Rejeitada").length;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COR.primary);
  doc.text(
    `Total: ${total}   |   Confirmadas: ${confirm}   |   Pendentes: ${pend}   |   Rejeitadas: ${rej}`,
    10,
    finalY
  );

  rodape(doc);
  doc.save(`PMOC_Historico_${(equipNome || "equipamento").replace(/\s+/g, "_")}.pdf`);
}
