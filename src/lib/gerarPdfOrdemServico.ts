import QRCode from "qrcode";
import { OrdemServico, MaterialOS } from "@/contexts/OrdensServicoContext";
import { Empresa } from "@/contexts/EmpresaContext";
import { Cliente } from "@/contexts/ClientesContext";
import type { OsAssinatura } from "@/contexts/OsAssinaturasContext";
import { formatNumeroAno } from "@/lib/formatNumero";
import { supabase } from "@/integrations/supabase/client";
import { renderOrdemServicoEducacao } from "@/lib/gerarPdfOrdemServicoEducacao";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

async function resolverModeloNome(cliente?: Cliente): Promise<string> {
  const id = (cliente as any)?.modeloOsId;
  if (!id) return "";
  try {
    const { data } = await (supabase as any).from("os_modelos").select("nome").eq("id", id).maybeSingle();
    return data?.nome || "";
  } catch { return ""; }
}

const DARK = [60, 60, 60] as const;
const BORDER: [number, number, number] = [60, 60, 60];

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

const fmtBRL = (n: number) =>
  `R$ ${(Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDateTime = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const fmtDate = (s?: string) => {
  if (!s) return "";
  if (s.includes("/")) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
};

export interface RenderOSOptions {
  os: OrdemServico;
  empresa?: Empresa;
  cliente?: Cliente;
  assinaturas?: OsAssinatura[];
}

async function gerarQRCodeDataUrl(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 200 });
  } catch {
    return null;
  }
}

async function renderAssinaturas(doc: jsPDF, assinaturas: OsAssinatura[], y: number, ml: number, mr: number, cw: number): Promise<number> {
  if (!assinaturas || assinaturas.length === 0) return y;

  const labelPapel = (p: string) => p === "fiscal" ? "Fiscal do Contrato" : "Solicitante";

  // Cabeçalho
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30], fontStyle: "bold", halign: "center", fillColor: [240, 240, 240] },
    body: [[{ content: "ASSINATURAS ELETRÔNICAS" }]],
    columnStyles: { 0: { cellWidth: cw } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY;

  const blockWidth = cw / 2;
  for (const a of assinaturas) {
    const verifyUrl = `${window.location.origin}/verificar-assinatura/${a.codigo_verificador}`;
    const qrDataUrl = await gerarQRCodeDataUrl(verifyUrl);

    const startY = y;
    const blockHeight = 24;
    const qrSize = 10;
    const qrX = ml + blockWidth - qrSize - 1.5;
    const qrY = startY + 1.5;

    // Caixa
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.rect(ml, startY, blockWidth, blockHeight);

    // QR Code
    if (qrDataUrl) {
      try { doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize); } catch { /* ignore */ }
    }

    // Texto da assinatura
    const textX = ml + 2.5;
    let textY = startY + 3.8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(30, 30, 30);
    doc.text(`${labelPapel(a.papel)} — Assinado Eletronicamente`, textX, textY);

    textY += 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.7);
    doc.text(`Signatário: ${a.signatario_nome}`, textX, textY);
    if (a.signatario_cargo) {
      textY += 2.6;
      doc.text(`Cargo: ${a.signatario_cargo}`, textX, textY);
    }
    if (a.signatario_matricula) {
      textY += 2.6;
      doc.text(`Matrícula: ${a.signatario_matricula}`, textX, textY);
    }
    textY += 2.6;
    doc.text(`Data/Hora: ${fmtDateTime(a.signed_at)}`, textX, textY);
    textY += 2.6;
    doc.text(`IP: ${a.ip_origem || "-"}`, textX, textY);
    textY += 2.6;
    doc.setFontSize(5);
    doc.text(`Código: ${a.codigo_verificador}`, textX, textY);
    textY += 2.3;
    doc.setTextColor(80, 80, 80);
    const baseLegal = "LEI Nº 14.063, DE 23 DE SETEMBRO DE 2020";
    const splitLegal = doc.splitTextToSize(baseLegal, blockWidth - qrSize - 6);
    doc.text(splitLegal, textX, textY);

    doc.setTextColor(30, 30, 30);
    y = startY + blockHeight + 1.5;
  }

  return y;
}

export async function renderOS(doc: jsPDF, { os, empresa, cliente, assinaturas }: RenderOSOptions) {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 12, mr = 12;
  const cw = pw - ml - mr;
  let y = 12;

  // ===== HEADER =====
  // Logo cliente (esquerda)
  const clienteLogoUrl = (cliente as any)?.logoUrl;
  if (clienteLogoUrl) {
    const data = await loadImageAsDataUrl(clienteLogoUrl);
    if (data) {
      try { doc.addImage(data, "PNG", ml, y, 30, 16); } catch { /* ignore */ }
    }
  }

  // Logo empresa (direita)
  if (empresa?.logoUrl) {
    const data = await loadImageAsDataUrl(empresa.logoUrl);
    if (data) {
      try { doc.addImage(data, "PNG", pw - mr - 32, y, 32, 16); } catch { /* ignore */ }
    }
  }

  // Centro: Linhas 1-4 do cadastro do cliente (empilhadas)
  doc.setTextColor(...DARK);
  const c: any = cliente || {};
  const linhas = [c.relLinha1, c.relLinha2, c.relLinha3, c.relLinha4].map((s) => s || "");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (linhas[0]) doc.text(linhas[0], pw / 2, y + 3.5, { align: "center" });
  doc.setFontSize(7.5);
  if (linhas[1]) doc.text(linhas[1], pw / 2, y + 7.5, { align: "center" });
  if (linhas[2]) doc.text(linhas[2], pw / 2, y + 11.5, { align: "center" });
  if (linhas[3]) doc.text(linhas[3], pw / 2, y + 16, { align: "center" });

  // Título principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ORDEM DE SERVIÇO DE MANUTENÇÃO", pw / 2, y + 23, { align: "center" });

  // Caixa do número da OS (direita) — formato: NUMERO-CAP/ANO-TIPO
  const anoOS = (() => {
    const d = os.createdAt ? new Date(os.createdAt) : new Date();
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  })();
  const numeroFormatado = `${String(os.numero).padStart(2, "0")}-${cliente?.cap || "0"}/${anoOS}-${os.tipoOs?.sigla || ""}`;
  const boxW = 38, boxH = 8;
  const boxX = pw - mr - boxW;
  const boxY = y + 19;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.rect(boxX, boxY, boxW, boxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(numeroFormatado, boxX + boxW / 2, boxY + 5.5, { align: "center" });

  y += 30;

  // ===== INFO TABLE: Unidade Requisitante / Data Aprovação =====
  const localText = os.localDescricao || "";
  const dataCriacao = fmtDateTime(os.createdAt);
  const dataValidacao = (() => {
    const h = (os.historico || []).find((h: any) => h.situacao === "Validada");
    return h ? fmtDateTime(h.data) : "";
  })();
  const dataSolicitacao = (() => {
    // Tenta data do histórico "Aberta" como aproximação
    const h = (os.historico || []).find((h: any) => h.situacao === "Aberta");
    return h ? fmtDateTime(h.data) : dataCriacao;
  })();
  const dataExecucao = os.dataInicio
    ? `${fmtDate(os.dataInicio)}${os.horaInicio ? ` ${os.horaInicio}` : ""}`
    : "";

  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30], valign: "middle" },
    body: [
      [
        { content: "Unidade Requisitante:", styles: { fontStyle: "bold", fontSize: 7.5, halign: "left" } },
        { content: localText || "-", styles: { fontStyle: "bold", fontSize: 9.5, halign: "left" } },
        { content: "Data aprovação:", styles: { fontStyle: "bold", fontSize: 7.5, halign: "left" } },
        { content: dataValidacao || "-", styles: { fontStyle: "bold", fontSize: 9, halign: "center" } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.16 },
      1: { cellWidth: cw * 0.50 },
      2: { cellWidth: cw * 0.14 },
      3: { cellWidth: cw * 0.20 },
    },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY;

  // ===== Datas: Solicitação / Execução, Pavimento / Setor =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30], halign: "center", valign: "middle" },
    body: [
      [
        { content: "Data da Solicitação:", styles: { fontStyle: "bold" } },
        { content: dataSolicitacao || "-", styles: { fontStyle: "bold" } },
        { content: "Data de Execução:", styles: { fontStyle: "bold" } },
        { content: dataExecucao || "-", styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Pavimento:", styles: { fontStyle: "bold" } },
        { content: os.pavimentoDescricao || "-", styles: { fontStyle: "bold" } },
        { content: "Setor:", styles: { fontStyle: "bold" } },
        { content: os.setorDescricao || "-", styles: { fontStyle: "bold" } },
      ],
      [
        { content: "Processo:", styles: { fontStyle: "bold" } },
        {
          content: (() => {
            const contratos = (cliente as any)?.contratos || [];
            const ativo = contratos.find((c: any) => c?.numero) || contratos[0];
            return ativo?.numero || "-";
          })(),
          styles: { fontStyle: "bold" },
        },
        { content: "Tipo de serviço:", styles: { fontStyle: "bold" } },
        { content: os.categoria || os.servico || "-", styles: { fontStyle: "bold" } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.22 }, 1: { cellWidth: cw * 0.28 },
      2: { cellWidth: cw * 0.22 }, 3: { cellWidth: cw * 0.28 },
    },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== Descrição do Serviço Pretendido + Nome do Solicitante =====
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30] },
    body: [
      [
        { content: `Descrição do Serviço Pretendido — Nº da SS: ${os.solicitacaoNumero || "-"}`, styles: { fontSize: 6.5 } },
        { content: "Nome do solicitante:", styles: { fontSize: 6.5 } },
      ],
      [
        { content: os.descricaoServicos || "", styles: { fontStyle: "bold", minCellHeight: 14, valign: "middle" } },
        { content: os.solicitante || "-", styles: { fontStyle: "bold", fontSize: 10, halign: "center", valign: "middle", minCellHeight: 14 } },
      ],
    ],
    columnStyles: { 0: { cellWidth: cw * 0.75 }, 1: { cellWidth: cw * 0.25 } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== Aprovação da Fiscalização + Carimbo =====
  const fiscalizada = !!(os.historico || []).find((h: any) =>
    ["Executada", "Serviço Confirmado", "Validada"].includes(h.situacao)
  );
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30] },
    body: [
      [
        { content: "Aprovação da Fiscalização", styles: { fontSize: 6.5 } },
        { content: "Carimbo e assinatura", styles: { fontSize: 6.5 } },
      ],
      [
        {
          content: fiscalizada ? "Autorizado pelo Departamento de Engenharia / Fiscalização" : "",
          styles: { fontStyle: "bold", halign: "center", valign: "middle", minCellHeight: 8, fontSize: 9 },
        },
        { content: "", styles: { minCellHeight: 8 } },
      ],
    ],
    columnStyles: { 0: { cellWidth: cw * 0.75 }, 1: { cellWidth: cw * 0.25 } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== MATERIAIS SCO =====
  // BDI: prioriza o contrato do cliente; cai para os.bdi se não houver
  const parseBdi = (v: any): number => {
    if (v === null || v === undefined || v === "") return NaN;
    const n = Number(String(v).replace(",", "."));
    return isNaN(n) ? NaN : n;
  };
  const contratoBdi = (() => {
    const contratos = (cliente as any)?.contratos || [];
    if (contratos.length === 0) return NaN;
    const ativo = contratos.find((c: any) => parseBdi(c?.bdi) > 0) || contratos[0];
    return parseBdi(ativo?.bdi);
  })();
  const bdi = !isNaN(contratoBdi) ? contratoBdi : (Number(os.bdi) || 0);
  const totalSCO = (os.materiais || []).reduce((s, m) => s + (Number(m.valorTotal) || 0), 0);
  const bdiSCO = totalSCO * (bdi / 100);
  const totalSCOcomBDI = totalSCO + bdiSCO;

  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30], halign: "center", valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: [30, 30, 30], fontStyle: "bold", lineColor: BORDER, lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: cw * 0.13 },
      1: { cellWidth: cw * 0.45, halign: "left" },
      2: { cellWidth: cw * 0.08 },
      3: { cellWidth: cw * 0.08 },
      4: { cellWidth: cw * 0.13, halign: "right" },
      5: { cellWidth: cw * 0.13, halign: "right" },
    },
    head: [["Código", "Descrição", "Und", "Qtd", "Pr. Unit.", "Pr. Total"]],
    body: (() => {
      const rows: any[] = (os.materiais || []).map((m: MaterialOS) => [
        m.codigo || "",
        m.descricao || "",
        m.unidade || "",
        String(m.quantidade ?? ""),
        fmtBRL(Number(m.valorUnitario) || 0),
        fmtBRL(Number(m.valorTotal) || 0),
      ]);
      if (rows.length === 0) {
        rows.push([{ content: "Sem materiais SCO", colSpan: 6, styles: { fontStyle: "italic", textColor: [120, 120, 120] } }]);
      }
      rows.push([
        { content: "TOTAL MATERIAL SCO", colSpan: 5, styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtBRL(totalSCO), styles: { fontStyle: "bold", halign: "right" } },
      ]);
      rows.push([
        { content: "BDI (Benefícios e Despesas Indiretas)", colSpan: 4, styles: { fontStyle: "bold", halign: "left" } },
        { content: `${bdi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`, styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtBRL(bdiSCO), styles: { fontStyle: "bold", halign: "right" } },
      ]);
      rows.push([
        { content: "TOTAL SCO + BDI", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        { content: fmtBRL(totalSCOcomBDI), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
      ]);
      return rows;
    })(),
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  // ===== MATERIAIS DE ESTOQUE =====
  const totalEst = (os.materiaisEstoque || []).reduce((s, m) => s + (Number(m.valorTotal) || 0), 0);
  const bdiEst = totalEst * (bdi / 100);
  const totalEstcomBDI = totalEst + bdiEst;

  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30], halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: cw * 0.13 },
      1: { cellWidth: cw * 0.45, halign: "left" },
      2: { cellWidth: cw * 0.08 },
      3: { cellWidth: cw * 0.08 },
      4: { cellWidth: cw * 0.13, halign: "right" },
      5: { cellWidth: cw * 0.13, halign: "right" },
    },
    body: (() => {
      const rows: any[] = [
        [{ content: "Materiais de Estoque", colSpan: 6, styles: { fontStyle: "bold", halign: "center", fillColor: [240, 240, 240] } }],
      ];
      const itens = os.materiaisEstoque || [];
      if (itens.length === 0) {
        rows.push([{ content: "Sem materiais de estoque", colSpan: 6, styles: { fontStyle: "italic", textColor: [120, 120, 120] } }]);
      } else {
        itens.forEach((m: MaterialOS) => {
          rows.push([
            m.codigo || "",
            m.descricao || "",
            m.unidade || "",
            String(m.quantidade ?? ""),
            fmtBRL(Number(m.valorUnitario) || 0),
            fmtBRL(Number(m.valorTotal) || 0),
          ]);
        });
      }
      rows.push([
        { content: "TOTAL MATERIAL ESTOQUE", colSpan: 5, styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtBRL(totalEst), styles: { fontStyle: "bold", halign: "right" } },
      ]);
      rows.push([
        { content: "BDI (Benefícios e Despesas Indiretas)", colSpan: 4, styles: { fontStyle: "bold", halign: "left" } },
        { content: `${bdi.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`, styles: { fontStyle: "bold", halign: "right" } },
        { content: fmtBRL(bdiEst), styles: { fontStyle: "bold", halign: "right" } },
      ]);
      rows.push([
        { content: "TOTAL MATERIAIS ESTOQUE + BDI", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
        { content: fmtBRL(totalEstcomBDI), styles: { fontStyle: "bold", halign: "right", fillColor: [240, 240, 240] } },
      ]);
      rows.push([
        { content: "TOTAL GERAL", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: [220, 220, 220], fontSize: 9 } },
        { content: fmtBRL(totalSCOcomBDI + totalEstcomBDI), styles: { fontStyle: "bold", halign: "right", fillColor: [220, 220, 220], fontSize: 9 } },
      ]);
      return rows;
    })(),
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== DADOS FINAIS / Avaliação + Carimbo gerente =====
  const validada = os.situacao === "Validada";
  const assinaturaFiscal = (assinaturas || []).find((a) => a.papel === "fiscal");
  let fiscalCellRect: { x: number; y: number; w: number; h: number } | null = null;
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30] },
    didDrawCell: (data: any) => {
      // captura o retângulo da célula com rowSpan (carimbo/assinatura)
      if (data.section === "body" && data.row.index === 1 && data.column.index === 2) {
        fiscalCellRect = { x: data.cell.x, y: data.cell.y, w: data.cell.width, h: data.cell.height };
      }
    },
    body: [
      [
        { content: "DADOS FINAIS:", colSpan: 2, styles: { fontStyle: "bold", fontSize: 7 } },
        { content: "Carimbo e assinatura / Assinatura eletrônica", styles: { fontSize: 6.5, halign: "center" } },
      ],
      [
        { content: "Qual a avaliação do requisitante quanto à execução do serviço solicitado nesta OS?", colSpan: 2, styles: { fontSize: 7 } },
        { content: "", rowSpan: 4, styles: { minCellHeight: 13 } },
      ],
      [
        { content: validada ? "X" : "", styles: { halign: "center", valign: "middle", fontStyle: "bold", fontSize: 11, minCellHeight: 3 } },
        { content: "A CONTENTO", styles: { fontStyle: "bold", valign: "middle", minCellHeight: 3, fontSize: 7 } },
      ],
      [
        { content: "", styles: { halign: "center", valign: "middle", fontStyle: "bold", fontSize: 11, minCellHeight: 3 } },
        { content: "NÃO A CONTENTO", styles: { fontStyle: "bold", valign: "middle", minCellHeight: 3, fontSize: 7 } },
      ],
      [
        { content: "OBSERVAÇÕES:", colSpan: 2, styles: { fontSize: 7, fontStyle: "bold" } },
      ],
    ],
    columnStyles: {
      0: { cellWidth: cw * 0.15 },
      1: { cellWidth: cw * 0.42 },
      2: { cellWidth: cw * 0.43 },
    },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Renderiza assinatura do fiscal dentro do retângulo "Carimbo e assinatura / Assinatura eletrônica"
  if (assinaturaFiscal && fiscalCellRect) {
    const r = fiscalCellRect;
    const verifyUrl = `${window.location.origin}/verificar-assinatura/${assinaturaFiscal.codigo_verificador}`;
    const qrDataUrl = await gerarQRCodeDataUrl(verifyUrl);
    const qrSize = 13;
    const qrX = r.x + r.w - qrSize - 2;
    const qrY = r.y + 2;
    if (qrDataUrl) {
      try { doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize); } catch { /* ignore */ }
    }
    const textX = r.x + 2;
    let textY = r.y + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    doc.text("Fiscal — Assinado Eletronicamente", textX, textY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    textY += 3.5;
    const nomeLines = doc.splitTextToSize(`Signatário: ${assinaturaFiscal.signatario_nome}`, r.w - qrSize - 6);
    doc.text(nomeLines, textX, textY);
    textY += 3.5 * nomeLines.length;
    if (assinaturaFiscal.signatario_cargo) {
      doc.text(`Cargo: ${assinaturaFiscal.signatario_cargo}`, textX, textY);
      textY += 3.5;
    }
    if (assinaturaFiscal.signatario_matricula) {
      doc.text(`Matrícula: ${assinaturaFiscal.signatario_matricula}`, textX, textY);
      textY += 3.5;
    }
    doc.text(`Data/Hora: ${fmtDateTime(assinaturaFiscal.signed_at)}`, textX, textY);
    textY += 3.5;
    doc.text(`IP: ${assinaturaFiscal.ip_origem || "-"}`, textX, textY);
    textY += 3.5;
    doc.setFontSize(6);
    const codLines = doc.splitTextToSize(`Código: ${assinaturaFiscal.codigo_verificador}`, r.w - 4);
    doc.text(codLines, textX, textY);
    textY += 3 * codLines.length;
    doc.setTextColor(80, 80, 80);
    const baseLegal = "LEI Nº 14.063, DE 23 DE SETEMBRO DE 2020";
    const legalLines = doc.splitTextToSize(baseLegal, r.w - 4);
    doc.text(legalLines, textX, textY);
    doc.setTextColor(30, 30, 30);
  }

  // Caixa de observações grande
  const obsTexto = (os.observacoes || []).map((o: any) => `• ${o.descricao || ""}`).join("\n") || "";
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: BORDER, lineWidth: 0.3, textColor: [30, 30, 30] },
    body: [[{ content: obsTexto, styles: { minCellHeight: 8, valign: "top" } }]],
    columnStyles: { 0: { cellWidth: cw } },
    margin: { left: ml, right: mr },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== ASSINATURAS ELETRÔNICAS (somente solicitante; fiscal já foi renderizado acima) =====
  const assinaturasRestantes = (assinaturas || []).filter((a) => a.papel !== "fiscal");
  if (assinaturasRestantes.length > 0) {
    const ph = doc.internal.pageSize.getHeight();
    const espacoNecessario = 8 + assinaturasRestantes.length * 34;
    if (y + espacoNecessario > ph - 15) {
      doc.addPage();
      y = 18;
    }
    y = await renderAssinaturas(doc, assinaturasRestantes, y, ml, mr, cw);
  }
}

export function addContinuationHeaders(doc: jsPDF, osNumero?: number | string, clienteIdent?: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 12, mr = 12;
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const left = osNumero ? `Ordem de Serviço Nº ${osNumero}` : "Ordem de Serviço";
    doc.text(left, ml, 8);
    if (clienteIdent) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const leftWidth = doc.getTextWidth(left);
      const maxRightW = Math.max(30, pw - mr - (ml + leftWidth + 4));
      const truncated = (doc.splitTextToSize(clienteIdent, maxRightW)[0] as string) || clienteIdent;
      doc.text(truncated, pw - mr, 8, { align: "right" });
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(ml, 10, pw - mr, 10);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`Página ${i} de ${pages}`, pw - mr, 13, { align: "right" });
  }
}

export async function gerarPdfOrdemServico(opts: RenderOSOptions) {
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  const modelo = await resolverModeloNome(opts.cliente);
  if (modelo === "Modelo_Educação") {
    await renderOrdemServicoEducacao(doc, opts);
  } else {
    await renderOS(doc, opts);
  }
  const c: any = opts.cliente || {};
  const ident = [c.relLinha1, c.relLinha2, c.relLinha3, c.relLinha4]
    .map((s: any) => (s || "").toString().trim())
    .filter(Boolean)
    .join(" — ") || (opts.os.clienteNome || "");
  addContinuationHeaders(doc, formatNumeroAno(opts.os.numero, opts.os.createdAt), ident);
  doc.save(`OS_${formatNumeroAno(opts.os.numero, opts.os.createdAt)}_${(opts.os.clienteNome || "").replace(/\s+/g, "_")}.pdf`);
}

export async function gerarPdfOrdemServicoLote(lista: RenderOSOptions[]) {
  if (lista.length === 0) return;
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  for (let i = 0; i < lista.length; i++) {
    if (i > 0) doc.addPage();
    const modelo = await resolverModeloNome(lista[i].cliente);
    if (modelo === "Modelo_Educação") {
      await renderOrdemServicoEducacao(doc, lista[i]);
    } else {
      await renderOS(doc, lista[i]);
    }
  }
  addContinuationHeaders(doc);
  const nums = lista.map(l => formatNumeroAno(l.os.numero, l.os.createdAt)).join("_");
  doc.save(`OS_Lote_${nums}.pdf`);
}
