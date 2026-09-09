import { Funcionario } from "@/contexts/FuncionariosContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface Recebimento {
  id: string; token: string; status: string;
  epis_snapshot: any[]; selfie_hash: string | null;
  ip: string | null; user_agent: string | null;
  confirmado_em: string | null; created_at: string;
  cpf_verificado: boolean; verificado_em: string | null;
}

interface Opts {
  cargoNome?: string;
  clienteNome?: string;
  setor?: string;
  selfieDataUrl?: string | null;
}

const fmtDate = (d?: string | null) => {
  if (!d) return "";
  if (d.includes("T")) return new Date(d).toLocaleString("pt-BR");
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
};

async function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
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
}

export async function gerarPdfEpiFacial(func: Funcionario, rec: Recebimento, opts: Opts = {}) {
  let logoLasant: string | null = null;
  let logoSeg: string | null = null;
  try { logoLasant = await loadImage("/Logo_Lasant.png"); } catch {}
  try { logoSeg = await loadImage("/seguranca_trabalho.jpg"); } catch {}

  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Header
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.rect(10, 6, pw - 20, 24);
  if (logoLasant) doc.addImage(logoLasant, "PNG", 14, 8, 36, 20);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("FICHA DE CONTROLE DE EPI", pw / 2, 21, { align: "center" });
  if (logoSeg) doc.addImage(logoSeg, "JPEG", pw - 40, 8, 20, 20);

  // Employee box
  doc.setLineWidth(0.3); doc.rect(10, 32, pw - 20, 28);
  doc.setFontSize(9);
  const L = 12, R = pw / 2 + 10;
  let y = 36;
  const kv = (k: string, v: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold"); doc.text(k, x, yy);
    doc.setFont("helvetica", "normal"); doc.text(v, x + doc.getTextWidth(k) + 2, yy);
  };
  kv("Nome:", func.nome || "", L, y); kv("CPF/MF:", func.cpf || "", R, y);
  y += 6; kv("Adm:", fmtDate(func.dataAdmissao), L, y); kv("CNPJ:", "16.432.951/0001-70", R, y);
  y += 6; kv("Setor:", opts.setor || "", L, y); kv("Função:", opts.cargoNome || "", R, y);
  y += 6; kv("Unidade:", opts.clienteNome || "", L, y);
  doc.setFont("helvetica", "bold"); doc.text("Matrícula:", R, y);

  // Termo + legal (compact)
  y = 66;
  const margin = 12; const contentW = pw - margin * 2;
  const centerBold = (t: string, size = 9) => {
    doc.setFontSize(size); doc.setFont("helvetica", "bold");
    doc.text(t, pw / 2, y, { align: "center" }); y += 5;
  };
  const para = (t: string, indent = 0) => {
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    const l = doc.splitTextToSize(t, contentW - indent);
    doc.text(l, margin + indent, y); y += l.length * 3.2 + 1.5;
  };

  centerBold("TERMO DE RESPONSABILIDADE");
  para("Recebi da Lasant Construções LTDA, os equipamentos de proteção individual (EPI) abaixo discriminados, ficando obrigado a usá-los em serviço ou em trânsito por área de risco, sob pena de ser punido por ato faltoso com base no artigo 482, letras E e H 158 Único da Consolidação das Leis do Trabalho – CLT.");
  para("Estou ciente que os EPI's citados estão sob a minha inteira responsabilidade, guarda e conservação, para utilização no desenvolvimento das atividades que me forem atribuídas e que conheço o disposto nas normas regulamentares, extraviados ou danificados.");

  centerBold("NR01 – 'DISPOSIÇÕES GERAIS'", 7.5);
  para("1.4.2 Cabe ao trabalhador:");
  ["a) cumprir as disposições legais e regulamentares sobre segurança e saúde no trabalho, inclusive as ordens de serviço expedidas pelo empregador;",
   "b) submeter-se aos exames médicos previstos nas NR;",
   "c) colaborar com a organização na aplicação das NR;",
   "d) usar o equipamento de proteção individual fornecido pelo empregador.",
   "1.4.2.1 Constitui ato faltoso a recusa injustificada do empregado ao cumprimento do disposto nas alíneas do subitem anterior."].forEach(t => para(t, 3));

  centerBold('NR06 – "EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL"', 7.5);
  para("6.6.1 Cabe ao trabalhador, quanto ao EPI:");
  ["a) usar o fornecido pela organização, observado o disposto no item 6.5.2;",
   "b) usá-lo apenas para a finalidade a que se destina;",
   "c) responsabilizar-se pela sua limpeza, guarda e conservação;",
   "d) comunicar à organização quando extraviado, danificado ou qualquer alteração que o torne impróprio para uso;",
   "e) cumprir as determinações da organização sobre o uso adequado."].forEach(t => para(t, 3));

  centerBold("Consolidação das Leis do Trabalho", 7.5);
  para("A lei 6.514/1977, que alterou a CLT (consolidação das leis do trabalho), estabelece no Brasil as diretrizes de Segurança e Medicina do Trabalho especificamente sobre o EPI, a lei determina que as empresa forneçam gratuitamente os equipamentos de proteção adequados aos riscos que devem estar sempre em perfeito estado.");
  para("Art. 462 – Ao empregador é vedado efetuar qualquer desconto nos salários do empregado, salvo quando este resultar de adiantamentos, de dispositivos de lei ou de contrato coletivo.");
  para("Art 462 -O limite máximo de desconto total não pode ultrapassar 70% do salário líquido, garantindo ao trabalhador pelo menos 30% da sua remuneração.");
  para("§ 1º - Em caso de dano causado pelo empregado, o desconto será lícito, desde que esta possibilidade tenha sido acordada ou na ocorrência de dolo do empregado.");

  centerBold("Termo de autorização de uso de imagem", 7.5);
  para("Autoriza, de forma livre, expressa e informada, a captação, utilização e armazenamento de sua imagem pela empresa, para fins de controle do uso de EPI, cumprimento de obrigações legais, auditorias, defesa administrativa ou judicial, em conformidade com a LGPD (Lei nº 13.709/2018).");

  y += 2;
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("Data:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(rec.confirmado_em ? fmtDate(rec.confirmado_em) : fmtDate(rec.created_at), margin + doc.getTextWidth("Data:") + 4, y);
  y += 5;

  // EPI table (novo modelo)
  const rows = (rec.epis_snapshot || []).map((e: any) => [
    String(e.quantidade || 1).padStart(2, "0"),
    fmtDate(e.dataEntrega || rec.confirmado_em || rec.created_at),
    e.ca || "",
    e.pedido || "",
    e.descricao || "",
    e.motivo || "",
    "",
    e.responsavelDistribuicao || "",
  ]);
  if (rows.length === 0) rows.push(["", "", "", "", "", "", "", ""]);

  (await getAutoTable())(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [["QUANT", "DATA", "CA", "Nº PEDIDO", "EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL - EPI", "MOTIVO", "RUBRICA DO FUNCIONÁRIO", "RESPONSÁVEL EM DISTRIBUIR"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, minCellHeight: 8, lineColor: [0, 0, 0], lineWidth: 0.3 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center", fontSize: 6.5 },
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

  // Legenda de motivos
  let legY = (doc as any).lastAutoTable.finalY + 5;
  if (legY > ph - 20) { doc.addPage(); legY = 20; }
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
  doc.text("MOTIVO:", 10, legY);
  doc.setFont("helvetica", "normal");
  doc.text(
    "1 - Admissão    2 - Reposição por desgaste    3 - Reposição por perda    4 - Mudança de função    5 - Extravio    6 - Demissão",
    10 + doc.getTextWidth("MOTIVO:") + 3, legY
  );

  let ay = legY + 6;

  // Confirmation block: selfie + metadata
  const boxH = 62;
  if (ay + boxH > ph - 15) { doc.addPage(); ay = 20; }

  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.rect(10, ay, pw - 20, boxH);
  doc.setFillColor(30, 58, 107); doc.rect(10, ay, pw - 20, 6, "F");
  doc.setTextColor(255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("COMPROVANTE DE ENTREGA POR RECONHECIMENTO FACIAL", pw / 2, ay + 4.2, { align: "center" });
  doc.setTextColor(0);

  const selfieX = 13, selfieY = ay + 9, selfieW = 44, selfieH = 50;
  if (opts.selfieDataUrl) {
    try { doc.addImage(opts.selfieDataUrl, "JPEG", selfieX, selfieY, selfieW, selfieH); } catch {}
  } else {
    doc.setDrawColor(180); doc.rect(selfieX, selfieY, selfieW, selfieH);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text("(sem selfie)", selfieX + selfieW / 2, selfieY + selfieH / 2, { align: "center" });
    doc.setTextColor(0);
  }

  const infoX = selfieX + selfieW + 6;
  let iy = selfieY + 4;
  const line = (k: string, v: string) => {
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(k, infoX, iy);
    doc.setFont("helvetica", "normal");
    const w = pw - infoX - 15 - doc.getTextWidth(k) - 2;
    const l = doc.splitTextToSize(v || "—", Math.max(40, w));
    doc.text(l, infoX + doc.getTextWidth(k) + 2, iy);
    iy += Math.max(4.5, l.length * 3.8);
  };
  line("Funcionário:", func.nome || "");
  line("CPF verificado:", rec.cpf_verificado ? "Sim" : "Não");
  line("Verificado em:", fmtDate(rec.verificado_em));
  line("Confirmado em:", fmtDate(rec.confirmado_em));
  line("Status:", rec.status);
  line("IP:", rec.ip || "");
  line("Token:", rec.token);
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text("Hash SHA-256 da selfie:", infoX, iy);
  iy += 3.5;
  doc.setFont("courier", "normal"); doc.setFontSize(6.5);
  const hl = doc.splitTextToSize(rec.selfie_hash || "—", pw - infoX - 15);
  doc.text(hl, infoX, iy);

  // Footer
  const pc = doc.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`${i}/${pc}`, pw / 2, ph - 8, { align: "center" });
  }

  doc.save(`EPI_FACIAL_${(func.nome || "func").replace(/\s+/g, "_")}_${rec.token.slice(0, 6)}.pdf`);
}
