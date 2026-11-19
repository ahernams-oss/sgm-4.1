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

  const autoTable = await getAutoTable();
  const v = (x?: string | null) => (x ?? "").toString().trim() || "—";
  const lista = (x?: string[]) => (x && x.length ? x.join(", ") : "—");
  const moeda = (x?: string) => (x && x.trim() ? `R$ ${x.trim()}` : "—");
  const largura = pw - ml - mr;

  const tituloSecao = (title: string, minH = 20) => {
    if (y + minH > ph - 30) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK_BLUE);
    doc.text(title, ml, y);
    doc.setDrawColor(...DARK_BLUE);
    doc.setLineWidth(0.5);
    doc.line(ml, y + 1.5, pw - mr, y + 1.5);
    y += 4;
  };

  // Seção em duas colunas de pares rótulo/valor (sempre exibe todos os campos)
  const addSection = (title: string, rows: [string, string][]) => {
    tituloSecao(title, Math.ceil(rows.length / 2) * 8 + 14);
    const body: string[][] = [];
    for (let i = 0; i < rows.length; i += 2) {
      const [l1, v1] = rows[i];
      const [l2, v2] = rows[i + 1] ?? ["", ""];
      body.push([l1, v1, l2, v2]);
    }
    autoTable(doc, {
      startY: y,
      body,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: BORDER_COLOR, lineWidth: 0.2, textColor: [40, 40, 40], overflow: "linebreak", valign: "middle" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 34, fillColor: [238, 242, 248], textColor: [50, 50, 70] },
        1: { cellWidth: largura / 2 - 34 },
        2: { fontStyle: "bold", cellWidth: 34, fillColor: [238, 242, 248], textColor: [50, 50, 70] },
        3: { cellWidth: largura / 2 - 34 },
      },
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  };

  const renderFullWidthBlock = (title: string, content: string) => {
    const text = (content || "").trim() || "—";
    const lines = doc.splitTextToSize(text, largura - 4);
    const boxH = lines.length * 4.5 + 5;
    tituloSecao(title, Math.min(boxH, 60) + 10);
    if (y + boxH > ph - 30) { doc.addPage(); y = 20; }
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.rect(ml, y, largura, boxH);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(lines, ml + 2, y + 4.5);
    y += boxH + 7;
  };

  addSection("Identificação", [
    ["Unidade", v(req.unidade)],
    ["Solicitante", v(req.solicitante)],
    ["Data de abertura", v(req.dataCriacao)],
    ["Status", v(req.status)],
    ["Aprovado por", v(req.aprovadoPor)],
    ["Nº da requisição", String(req.numero)],
  ]);

  addSection("Classificação da Vaga", [
    ["Headcount", v(req.headcount)],
    ["Orçamento", v(req.orcamento)],
    ["Tipo de Vaga", v(req.tipoVaga)],
  ]);

  addSection("Especificação da Vaga", [
    ["Cargo", v(req.cargoNome)],
    ["Salário", moeda(req.salarioVaga)],
  ]);

  addSection("Jornada de Trabalho", [
    ["Jornada", v(req.jornada)],
    ["Carga Horária", v(req.cargaHoraria)],
  ]);

  addSection("Contratação", [
    ["Modalidade", lista(req.tipoContratacao)],
    ["Tipo de contratação", v(req.tipoContratacaoDetalhe)],
    ["Recrutamento", v(req.internoExterno)],
  ]);

  const origemRows: [string, string][] = [["Origem", v(req.origemVaga)]];
  if (req.origemVaga === "Promoção" || req.funcionarioPromocao) origemRows.push(["Funcionário a promover", v(req.funcionarioPromocao)]);
  if (req.motivoOutros) origemRows.push(["Motivo (Outros)", v(req.motivoOutros)]);
  addSection("Origem da Vaga", origemRows);

  const temSubst = [req.nomeSubstituido, req.matricula, req.cargoSubstituido, req.salarioSubstituido, req.dataDesligamento].some((x) => x && x.trim());
  if (temSubst || /substitui/i.test(req.origemVaga || "")) {
    addSection("Colaborador Substituído", [
      ["Nome", v(req.nomeSubstituido)],
      ["Matrícula", v(req.matricula)],
      ["Cargo", v(req.cargoSubstituido)],
      ["Salário", moeda(req.salarioSubstituido)],
      ["Data Desligamento", v(req.dataDesligamento)],
    ]);
  }

  addSection("Qualificação", [
    ["Formação", lista(req.formacao)],
    ["Experiência", v(req.experiencia)],
    ["Detalhe Formação", v(req.formacaoDetalhe)],
  ]);

  renderFullWidthBlock("Conhecimento de Informática", req.conhecimentoInformatica);
  renderFullWidthBlock("Atividades do Cargo", req.atividadesCargo);

  if (req.indicados && req.indicados.length > 0) {
    tituloSecao("Candidatos Indicados", req.indicados.length * 8 + 16);
    autoTable(doc, {
      startY: y,
      head: [["Nome", "CPF", "Telefone", "E-mail"]],
      body: req.indicados.map((i) => [v(i.nome), v(i.cpf), v(i.telefone), v(i.email)]),
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [40, 40, 40], overflow: "linebreak" },
      headStyles: { fillColor: DARK_BLUE, textColor: [255, 255, 255], fontStyle: "bold" },
      margin: { left: ml, right: mr },
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  }

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

    autoTable(doc, {
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
