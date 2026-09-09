import { Requisicao } from "@/contexts/RequisicaoContext";
import { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const BORDER_COLOR: [number, number, number] = [180, 180, 180];

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  // Try canvas-based loader first (handles CORS images well)
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
}

export async function gerarPdfRequisicao(req: Requisicao, empresa?: Empresa) {
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 14;
  const mr = 14;

  // ===== HEADER (Lasant official layout) =====
  // Blue rectangle on the RIGHT half of the header
  const headerH = 34;
  const blueStartX = pw * 0.42;
  doc.setFillColor(...DARK_BLUE);
  doc.rect(blueStartX, 0, pw - blueStartX, headerH, "F");

  // Logo on the LEFT (white area) — uses empresa.logoUrl or fallback
  const logoSrc = empresa?.logoUrl || "/Logo_Lasant.png";
  const logoData = await loadImageAsDataUrl(logoSrc);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", ml, 4, 42, 26);
    } catch {
      doc.setTextColor(...DARK_BLUE);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LASANT", ml, 20);
    }
  } else {
    doc.setTextColor(...DARK_BLUE);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LASANT", ml, 20);
  }

  // Title on the RIGHT (inside blue area)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("REQUISIÇÃO DE PESSOAL", pw - mr, 14, { align: "right" });

  // Number + meta below title
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`RC Nº ${req.numero}`, pw - mr, 21, { align: "right" });
  doc.text(`Data: ${req.dataCriacao}  |  Status: ${req.status}`, pw - mr, 27, { align: "right" });

  doc.setTextColor(40, 40, 40);
  let y = headerH + 10;

  // ===== HELPER: Section with bordered table =====
  const addSection = async (title: string, rows: [string, string][]) => {
    const filteredRows = rows.filter(([, val]) => val && val.trim() !== "");
    if (filteredRows.length === 0) return;

    const estimatedHeight = filteredRows.length * 10 + 18;
    if (y + estimatedHeight > ph - 30) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_BLUE);
    doc.text(title, ml, y);
    y += 4;

    (await getAutoTable())(doc, {
      startY: y,
      head: [],
      body: filteredRows,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: BORDER_COLOR,
        lineWidth: 0.3,
        textColor: [40, 40, 40],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55, textColor: [60, 60, 60] },
        1: { cellWidth: "auto" },
      },
      tableWidth: 130,
      margin: { left: ml, right: mr },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  };

  // ===== UNIDADE =====
  addSection("", [["Unidade", req.unidade]]);

  // ===== CLASSIFICAÇÃO DA VAGA =====
  addSection("Classificação da Vaga", [
    ["Headcount", req.headcount],
    ["Orçamento", req.orcamento],
    ["Tipo de Vaga", req.tipoVaga],
  ]);

  // ===== ESPECIFICAÇÃO DA VAGA =====
  const cargoLabel = req.cargoNome || "";
  addSection("Especificação da Vaga", [
    ["Cargo", cargoLabel],
    ["Salário", req.salarioVaga ? `R$ ${req.salarioVaga}` : ""],
  ]);

  // ===== JORNADA DE TRABALHO =====
  addSection("Jornada de Trabalho", [
    ["Jornada", req.jornada],
    ["Carga Horária", req.cargaHoraria],
  ]);

  // ===== CONTRATAÇÃO =====
  addSection("Contratação", [
    ["Modalidade", req.tipoContratacao?.join(", ") || ""],
    ["Tipo de contratação", req.tipoContratacaoDetalhe || ""],
    ["Recrutamento", req.internoExterno],
  ]);

  // ===== ORIGEM DA VAGA =====
  addSection("Origem da Vaga", [
    ["Origem", req.origemVaga],
    ["Motivo (Outros)", req.motivoOutros],
  ]);

  // ===== COLABORADOR SUBSTITUÍDO =====
  addSection("Colaborador Substituído", [
    ["Nome", req.nomeSubstituido],
    ["Matrícula", req.matricula],
    ["Cargo", req.cargoSubstituido],
    ["Salário", req.salarioSubstituido ? `R$ ${req.salarioSubstituido}` : ""],
    ["Data Desligamento", req.dataDesligamento],
  ]);

  // ===== QUALIFICAÇÃO =====
  addSection("Qualificação", [
    ["Formação", req.formacao?.join(", ") || ""],
    ["Detalhe Formação", req.formacaoDetalhe],
    ["Experiência", req.experiencia],
  ]);

  // ===== Blocos full-width (sempre exibidos) =====
  const renderFullWidthBlock = (title: string, content: string) => {
    const text = (content || "").trim() || "—";
    const lines = doc.splitTextToSize(text, pw - ml - mr - 4);
    const boxH = lines.length * 5 + 6;
    if (y + boxH + 10 > ph - 30) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_BLUE);
    doc.text(title, ml, y);
    y += 4;

    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.rect(ml, y, pw - ml - mr, boxH);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(lines, ml + 2, y + 5);
    y += boxH + 8;
  };

  renderFullWidthBlock("Conhecimento de Informática", req.conhecimentoInformatica);
  renderFullWidthBlock("Atividades do Cargo", req.atividadesCargo);

  // ===== RESUMO DA APROVAÇÃO / PROCESSO SELETIVO =====
  const ultimoEvento = [...(req.historicoStatus || [])].reverse().find((h) => h.observacao);
  if (ultimoEvento) {
    renderFullWidthBlock(
      "Justificativa da Decisão",
      `${ultimoEvento.status} em ${ultimoEvento.dataHora}${ultimoEvento.usuario ? ` por ${ultimoEvento.usuario}` : ""}\n"${ultimoEvento.observacao}"`
    );
  }



  // ===== ANEXOS =====
  if (y + 20 > ph - 30) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_BLUE);
  doc.text("Anexos", ml, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.text("Não possui anexos vinculados", ml, y);
  y += 12;

  // ===== HISTÓRICO DE STATUS =====
  if (req.historicoStatus && req.historicoStatus.length > 0) {
    const estHeight = req.historicoStatus.length * 10 + 24;
    if (y + estHeight > ph - 30) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_BLUE);
    doc.text("Histórico de Status", ml, y);
    y += 4;

    (await getAutoTable())(doc, {
      startY: y,
      head: [["Status", "Data/Hora", "Usuário", "Justificativa"]],
      body: req.historicoStatus.map((h) => [
        h.status,
        h.dataHora,
        h.usuario || "—",
        h.observacao || "—",
      ]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 4, textColor: [40, 40, 40], overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 34 },
        2: { cellWidth: 34 },
        3: { cellWidth: "auto", fontStyle: "italic" },
      },
      headStyles: {
        fillColor: DARK_BLUE,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      margin: { left: ml, right: mr },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ===== FOOTER =====
  const empresaNome = empresa?.nomeFantasia || empresa?.razaoSocial || "SGM Lasant";
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(200, 200, 200);
    doc.line(ml, pageH - 20, pw - mr, pageH - 20);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`Documento gerado automaticamente — ${empresaNome}`, ml, pageH - 14);
    doc.text(`Página ${i} de ${pageCount}`, pw / 2, pageH - 14, { align: "center" });
    doc.text(`RC Nº ${req.numero}`, pw - mr, pageH - 14, { align: "right" });
  }

  doc.save(`RC_${req.numero}_${req.unidade.replace(/\s+/g, "_")}_${req.dataCriacao.replace(/\//g, "-")}.pdf`);
}
