import { Funcionario } from "@/contexts/FuncionariosContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface EpiPdfOptions {
  cargoNome?: string;
  clienteNome?: string;
  setor?: string;
}

const formatDate = (d: string) => {
  if (!d) return "";
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
};

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function drawHeader(doc: jsPDF, pw: number, logoLasant: string | null, logoSeg: string | null) {
  // Border around the header area
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(10, 6, pw - 20, 24);

  // Lasant logo (left)
  if (logoLasant) {
    doc.addImage(logoLasant, "PNG", 14, 8, 36, 20);
  } else {
    doc.setTextColor(30, 58, 107);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("LASANT", 14, 18);
    doc.setFontSize(7);
    doc.text("CONSTRUÇÕES", 14, 23);
  }

  // Title (center)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FICHA DE CONTROLE DE EPI", pw / 2, 21, { align: "center" });

  // Safety logo (right)
  if (logoSeg) {
    doc.addImage(logoSeg, "JPEG", pw - 40, 8, 20, 20);
  }
}

function drawEmployeeData(doc: jsPDF, func: Funcionario, opts: EpiPdfOptions, pw: number): number {
  let y = 36;
  const leftCol = 12;
  const rightCol = pw / 2 + 10;

  // Border box for employee data
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(10, 32, pw - 20, 28);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  // Row 1: Nome + CPF/MF
  doc.setFont("helvetica", "bold");
  doc.text("Nome:", leftCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(func.nome || "", leftCol + doc.getTextWidth("Nome:") + 2, y);

  doc.setFont("helvetica", "bold");
  doc.text("CPF/MF:", rightCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(func.cpf || "", rightCol + doc.getTextWidth("CPF/MF:") + 2, y);

  // Row 2: Adm + CNPJ
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Adm:", leftCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(func.dataAdmissao) || "", leftCol + doc.getTextWidth("Adm:") + 2, y);

  doc.setFont("helvetica", "bold");
  doc.text("CNPJ:", rightCol, y);
  doc.setFont("helvetica", "normal");
  doc.text("16.432.951/0001-70", rightCol + doc.getTextWidth("CNPJ:") + 2, y);

  // Row 3: Setor + Função
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Setor:", leftCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(opts.setor || "", leftCol + doc.getTextWidth("Setor:") + 2, y);

  doc.setFont("helvetica", "bold");
  doc.text("Função:", rightCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(opts.cargoNome || "", rightCol + doc.getTextWidth("Função:") + 2, y);

  // Row 4: Unidade + Matrícula
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Unidade:", leftCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(opts.clienteNome || "", leftCol + doc.getTextWidth("Unidade:") + 2, y);

  doc.setFont("helvetica", "bold");
  doc.text("Matrícula:", rightCol, y);

  return 64;
}

function drawTermoAndLegal(doc: jsPDF, pw: number, startY: number, dataEntrega?: string): number {
  let y = startY;
  const margin = 12;
  const contentW = pw - margin * 2;

  // TERMO DE RESPONSABILIDADE
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TERMO DE RESPONSABILIDADE", pw / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  const t1 = "Recebi da Lasant Construções LTDA, os equipamentos de proteção individual (EPI) abaixo discriminados, ficando obrigado a usá-los em serviço ou em trânsito por área de risco, sob pena de ser punido por ato faltoso com base no artigo 482, letras E e H 158 Único da Consolidação das Leis do Trabalho – CLT.";
  const l1 = doc.splitTextToSize(t1, contentW);
  doc.text(l1, margin, y);
  y += l1.length * 3.2 + 2;

  const t2 = "Estou ciente que os EPI's citados estão sob a minha inteira responsabilidade, guarda e conservação, para utilização no desenvolvimento das atividades que me forem atribuídas e que conheço o disposto nas normas regulamentares, extraviados ou danificados.";
  const l2 = doc.splitTextToSize(t2, contentW);
  doc.text(l2, margin, y);
  y += l2.length * 3.2 + 3;

  // NR01
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("NR01 – 'DISPOSIÇÕES GERAIS'", pw / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("1.4.2 Cabe ao trabalhador :", margin, y);
  y += 3.5;

  const nr01 = [
    "a) cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho, inclusive as ordens de serviço expedidas pelo empregador;",
    "b) submeter-se aos exames médicos previstos nas NR;",
    "c) colaborar com a organização na aplicação das NR;",
    "d) usar o equipamento de proteção individual fornecido pelo empregador.",
  ];
  nr01.forEach((item) => {
    const lines = doc.splitTextToSize(item, contentW - 4);
    doc.text(lines, margin + 3, y);
    y += lines.length * 3.2;
  });

  const faltoso = "1.4.2.1 Constitui ato faltoso a recusa injustificada do empregado ao cumprimento do disposto nas alíneas do subitem anterior.";
  const fl = doc.splitTextToSize(faltoso, contentW - 4);
  doc.text(fl, margin + 3, y);
  y += fl.length * 3.2 + 3;

  // NR06
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text('NR06 – "EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL"', pw / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Item 6.6 Responsabilidades do trabalhador", margin, y);
  y += 3.5;
  doc.text("6.6.1 Cabe ao trabalhador, quanto ao EPI:", margin, y);
  y += 3.5;

  const nr06 = [
    "a) usar o fornecido pela organização, observado o disposto no item 6.5.2",
    "b) usá-lo apenas para a finalidade a que se destina;",
    "c) responsabilizar-se pela sua limpeza, guarda e conservação;",
    "d) comunicar à organização quando extraviado, danificado ou qualquer alteração que o torne impróprio para uso, e",
    "e) cumprir as determinações da organização sobre o uso adequado.",
  ];
  nr06.forEach((item) => {
    const lines = doc.splitTextToSize(item, contentW - 4);
    doc.text(lines, margin + 3, y);
    y += lines.length * 3.2;
  });
  y += 3;

  // CLT
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Consolidação das Leis do Trabalho", pw / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  const cltIntro = "A lei 6.514/1977, que alterou a CLT (consolidação das leis do trabalho), estabelece no Brasil as diretrizes de Segurança e Medicina do Trabalho especificamente sobre o EPI, a lei determina que as empresa forneçam gratuitamente os equipamentos de proteção adequados aos riscos que devem estar sempre em perfeito estado.";
  const cil = doc.splitTextToSize(cltIntro, contentW);
  doc.text(cil, margin, y);
  y += cil.length * 3.2 + 2;

  const clt = "Art. 462 – Ao empregador é vedado efetuar qualquer desconto nos salários do empregado, salvo quando este resultar de adiantamentos, de dispositivos de lei ou de contrato coletivo.";
  const cl = doc.splitTextToSize(clt, contentW);
  doc.text(cl, margin, y);
  y += cl.length * 3.2 + 2;

  const cltLimite = "Art 462 -O limite máximo de desconto total não pode ultrapassar 70% do salário líquido, garantindo ao trabalhador pelo menos 30% da sua remuneração.";
  const cLim = doc.splitTextToSize(cltLimite, contentW);
  doc.text(cLim, margin, y);
  y += cLim.length * 3.2 + 2;

  const p1 = "§ 1º - Em caso de dano causado pelo empregado, o desconto será lícito, desde que esta possibilidade tenha sido acordada ou na ocorrência de dolo do empregado.";
  const pl = doc.splitTextToSize(p1, contentW);
  doc.text(pl, margin, y);
  y += pl.length * 3.2 + 3;

  // Termo de imagem
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Termo de autorização de termo de uso de imagem.", pw / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  const img1 = "Autoriza, de forma livre, expressa e informada, a captação, utilização e armazenamento de sua imagem pela empresa, por meio de fotografias ou vídeos realizados durante o exercício de suas atividades profissionais, para fins de controle do uso de EPI, cumprimento de obrigações legais, auditorias, treinamentos internos, defesa administrativa ou judicial e divulgação institucional, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).";
  const il1 = doc.splitTextToSize(img1, contentW);
  doc.text(il1, margin, y);
  y += il1.length * 3.2 + 2;

  const img2 = "Declaro ciência de que esta autorização não gera direito a qualquer indenização e poderá ser revogada mediante solicitação formal, respeitados os registros necessários ao cumprimento das obrigações legais.";
  const il2 = doc.splitTextToSize(img2, contentW);
  doc.text(il2, margin, y);
  y += il2.length * 3.2 + 6;

  // Data field only (no signature line here)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Data:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(dataEntrega ? formatDate(dataEntrega) : "", margin + doc.getTextWidth("Data:") + 4, y);
  y += 6;

  return y;
}

export async function gerarPdfEpi(func: Funcionario, opts: EpiPdfOptions = {}) {
  // Load logos
  let logoLasant: string | null = null;
  let logoSeg: string | null = null;
  try {
    logoLasant = await loadImage("/Logo_Lasant.png");
  } catch { /* fallback to text */ }
  try {
    logoSeg = await loadImage("/seguranca_trabalho.jpg");
  } catch { /* skip */ }

  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Page 1 - Header + Employee Data + Termo + EPI Table start
  await drawHeader(doc, pw, logoLasant, logoSeg);
  let y = drawEmployeeData(doc, func, opts, pw);
  const epis = func.epis || [];
  const primeiraDataEntrega = epis.length > 0 ? epis[0].dataEntrega : "";
  y = drawTermoAndLegal(doc, pw, y, primeiraDataEntrega);

  // EPI Table starts on same page
  const epiRows = epis.map((e) => [
    String(e.quantidade).padStart(2, "0"),
    formatDate(e.dataEntrega),
    e.ca || "",
    e.pedido || "",
    e.descricao,
    e.motivo || "",
    "",
    e.responsavelDistribuicao || "",
  ]);

  if (epiRows.length === 0) {
    epiRows.push(["", "", "", "", "", "", "", ""]);
  }

  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [["QUANT", "DATA", "CA", "Nº PEDIDO", "EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL - EPI", "MOTIVO", "RUBRICA DO FUNCIONÁRIO", "RESPONSÁVEL EM DISTRIBUIR"]],
    body: epiRows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, minCellHeight: 8, lineColor: [0, 0, 0], lineWidth: 0.3 },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      fontSize: 6.5,
    },
    bodyStyles: {
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 50 },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 28 },
      7: { cellWidth: 30, fontSize: 6.5 },
    },
  });

  // Legenda de motivos + assinatura
  let legY = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  if (legY > ph - 30) { doc.addPage(); legY = 20; }
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("MOTIVO:", 10, legY);
  doc.setFont("helvetica", "normal");
  doc.text(
    "1 - Admissão    2 - Reposição por desgaste    3 - Reposição por perda    4 - Mudança de função    5 - Extravio    6 - Demissão",
    10 + doc.getTextWidth("MOTIVO:") + 3,
    legY
  );

  const assY = legY + 16;
  if (assY < ph - 15) {
    doc.line(130, assY, pw - 10, assY);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Assinatura do Empregado", pw - 10, assY + 4, { align: "right" });
  }


  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${i}`, pw / 2, ph - 8, { align: "center" });
  }

  doc.save(`EPI_${func.nome.replace(/\s+/g, "_")}.pdf`);
}
