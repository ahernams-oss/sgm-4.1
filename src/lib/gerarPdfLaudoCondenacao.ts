import QRCode from "qrcode";
import type { LaudoCondenacao, FotoLaudo } from "@/contexts/LaudosCondenacaoContext";
import type { LaudoAssinatura } from "@/contexts/LaudosAssinaturasContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const fmtDate = (d: string) => {
  if (!d) return "";
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
};
const fmtBRL = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadImageWithMarcadores(foto: FotoLaudo): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      // Draw marcadores
      const r = Math.max(18, Math.min(img.width, img.height) * 0.03);
      ctx.font = `bold ${Math.round(r * 1.1)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const m of foto.marcadores || []) {
        const cx = m.x * img.width;
        const cy = m.y * img.height;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#dc2626";
        ctx.fill();
        ctx.lineWidth = Math.max(2, r * 0.15);
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(m.n), cx, cy);
      }
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), w: img.width, h: img.height });
    };
    img.onerror = () => resolve(null);
    img.src = foto.url;
  });
}

export interface EmpresaTimbrado {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  logoUrl?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  site?: string;
}

async function loadLogo(url?: string): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      try {
        resolve({ data: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawTimbrado(doc: jsPDF, pw: number, empresa: EmpresaTimbrado | undefined, logo: { data: string; w: number; h: number } | null) {
  // Barra superior colorida
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pw, 30, "F");
  if (logo) {
    try {
      const maxH = 22, maxW = 38;
      const ratio = logo.w / logo.h;
      let h = maxH, w = maxH * ratio;
      if (w > maxW) { w = maxW; h = maxW / ratio; }
      // Cartão branco atrás do logo para não ser ofuscado pela tarja azul
      const pad = 2;
      const bx = 8, by = 4;
      const bw = w + pad * 2, bh = h + pad * 2;
      doc.setFillColor(255, 255, 255);
      (doc as any).roundedRect ? doc.roundedRect(bx, by, bw, bh, 1.5, 1.5, "F") : doc.rect(bx, by, bw, bh, "F");
      doc.addImage(logo.data, "PNG", bx + pad, by + pad, w, h);
    } catch { /* ignore */ }
  }
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(empresa?.razaoSocial || empresa?.nomeFantasia || "", pw / 2, 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const endereco = [empresa?.logradouro, empresa?.numero, empresa?.complemento, empresa?.bairro]
    .filter(Boolean).join(", ");
  const cidadeUf = [empresa?.cidade, empresa?.uf].filter(Boolean).join("/");
  const cep = empresa?.cep ? `CEP ${empresa.cep}` : "";
  const linha2 = [endereco, cidadeUf, cep].filter(Boolean).join(" — ");
  if (linha2) doc.text(linha2, pw / 2, 17, { align: "center" });
  const contatos = [
    empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : "",
    empresa?.telefone ? `Tel: ${empresa.telefone}` : "",
    empresa?.email || "",
    empresa?.site || "",
  ].filter(Boolean).join(" · ");
  if (contatos) doc.text(contatos, pw / 2, 22, { align: "center" });
  doc.setTextColor(0);
}

function drawRodape(doc: jsPDF, numeroFmt: string, empresa: EmpresaTimbrado | undefined) {
  const total = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(200);
    doc.line(10, ph - 12, pw - 10, ph - 12);
    doc.setFontSize(7);
    doc.setTextColor(120);
    const rodEmp = empresa?.razaoSocial
      ? `${empresa.razaoSocial}${empresa.cnpj ? ` — CNPJ ${empresa.cnpj}` : ""}`
      : "";
    doc.text(rodEmp, 10, ph - 7);
    doc.text(`Laudo nº ${numeroFmt} · Página ${i} de ${total}`, pw - 10, ph - 7, { align: "right" });
    doc.setTextColor(0);
  }
}

async function gerarQrDataUrl(text: string): Promise<string | null> {
  try { return await QRCode.toDataURL(text, { margin: 1, width: 240 }); } catch { return null; }
}

export async function gerarPdfLaudoCondenacao(
  laudo: LaudoCondenacao,
  empresa?: EmpresaTimbrado,
  assinatura?: LaudoAssinatura,
) {
  const doc = new (await getJsPDF())({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const logo = await loadLogo(empresa?.logoUrl);

  drawTimbrado(doc, pw, empresa, logo);
  let y = 38;

  // Título
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("LAUDO TÉCNICO DE CONDENAÇÃO DE EQUIPAMENTO", pw / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Documento de Avaliação Técnica para Baixa e Descontinuidade de Ativos", pw / 2, y, { align: "center" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const yearNum = laudo.data_emissao ? new Date(laudo.data_emissao).getFullYear() : new Date().getFullYear();
  const numeroFmt = `${String(laudo.numero).padStart(3, "0")}/${yearNum}`;
  doc.text(`Documento nº: ${numeroFmt}`, 14, y);
  doc.text(`Data de emissão: ${fmtDate(laudo.data_emissao)}`, pw - 14, y, { align: "right" });
  y += 5;
  doc.text(`Responsável técnico: ${laudo.responsavel_tecnico || "-"}`, 14, y);
  doc.text(`Registro (CFT/CREA): ${laudo.registro_profissional || "-"}`, pw - 14, y, { align: "right" });
  y += 8;

  const sectionTitle = (t: string) => {
    if (y > ph - 30) { doc.addPage(); drawTimbrado(doc, pw, empresa, logo); y = 38; }
    doc.setFillColor(30, 58, 107);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.rect(14, y - 4, pw - 28, 6, "F");
    doc.text(t, 16, y);
    doc.setTextColor(0);
    y += 5;
  };

  // 1. Identificação
  sectionTitle("1. IDENTIFICAÇÃO DO EQUIPAMENTO");
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    body: [
      ["Tipo do equipamento", laudo.tipo || laudo.equipamento_nome || "-", "Marca", laudo.marca || "-"],
      ["Modelo", laudo.modelo || "-", "Nº de série", laudo.serie || "-"],
      ["Patrimônio/TAG", laudo.patrimonio || laudo.equipamento_tag || "-", "Ano fabricação", laudo.ano_fabricacao || "-"],
      ["Data aquisição", fmtDate(laudo.data_aquisicao) || "-", "Localização", laudo.localizacao || "-"],
      ["Estado conservação", laudo.estado_conservacao || "-", "", ""],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 }, 2: { fontStyle: "bold", cellWidth: 35 } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const textBlock = (title: string, text: string) => {
    sectionTitle(title);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text || "-", pw - 28);
    if (y + lines.length * 4 > ph - 15) { doc.addPage(); drawTimbrado(doc, pw, empresa, logo); y = 38; }
    doc.text(lines, 14, y);
    y += lines.length * 4 + 4;
  };

  // 2. Histórico
  textBlock("2. HISTÓRICO", laudo.historico);

  // 3. Inspeção Técnica
  sectionTitle("3. INSPEÇÃO TÉCNICA");
  const sub = (t: string, txt: string) => {
    if (y > ph - 25) { doc.addPage(); drawTimbrado(doc, pw, empresa, logo); y = 38; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(t, 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(txt || "-", pw - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 3;
  };
  sub("3.1 Condições Físicas", laudo.insp_condicoes_fisicas);
  sub("3.2 Condições Elétricas/Eletrônicas", laudo.insp_condicoes_eletricas);
  sub("3.3 Condições Mecânicas", laudo.insp_condicoes_mecanicas);
  sub("3.4 Funcionalidade", laudo.insp_funcionalidade);

  // 4. Fundamentação
  sectionTitle("4. FUNDAMENTAÇÃO TÉCNICA DA CONDENAÇÃO");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Motivos que fundamentam a condenação:", 14, y);
  y += 5;
  (laudo.motivos_condenacao || []).forEach((m, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${m}`, pw - 32);
    if (y + lines.length * 4 > ph - 15) { doc.addPage(); drawTimbrado(doc, pw, empresa, logo); y = 38; }
    doc.text(lines, 18, y);
    y += lines.length * 4 + 1;
  });
  y += 3;

  const pct = laudo.valor_novo_equivalente > 0
    ? (laudo.custo_reparo / laudo.valor_novo_equivalente) * 100
    : 0;
  const viavel = pct > 0 && pct < 50 ? "economicamente viável" : "economicamente inviável";
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    body: [
      ["Custo estimado de reparo", fmtBRL(laudo.custo_reparo)],
      ["Valor residual do equipamento", fmtBRL(laudo.valor_residual)],
      ["Valor equipamento novo equivalente", fmtBRL(laudo.valor_novo_equivalente)],
      ["Custo de reparo sobre valor novo", `${pct.toFixed(1)}%`],
      ["Análise", `A reparação é ${viavel}.`],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // 5. Conclusão
  sectionTitle("5. CONCLUSÃO TÉCNICA");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const conclusaoTxt = `Com base na inspeção técnica realizada e nos fundamentos apresentados neste laudo, atesta-se que o equipamento descrito encontra-se em condições ${laudo.conclusao_condicoes || "___"} que inviabilizam sua utilização segura e/ou econômica, recomendando-se a CONDENAÇÃO do bem para fins de baixa patrimonial.`;
  const cLines = doc.splitTextToSize(conclusaoTxt, pw - 28);
  doc.text(cLines, 14, y);
  y += cLines.length * 4 + 4;
  doc.setFont("helvetica", "bold");
  doc.text(`Parecer técnico: ${laudo.parecer || "-"}`, 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Data da inspeção: ${fmtDate(laudo.data_inspecao) || "-"}`, 14, y);
  doc.text(`Local: ${laudo.local_inspecao || "-"}`, pw / 2, y);
  y += 15;

  // Assinatura
  if (assinatura) {
    // Bloco de assinatura eletrônica com QR Code
    if (y > ph - 55) { doc.addPage(); drawTimbrado(doc, pw, empresa, logo); y = 38; }
    const verifyUrl = `${window.location.origin}/verificar-assinatura/${assinatura.codigo_verificador}`;
    const qrDataUrl = await gerarQrDataUrl(verifyUrl);

    const boxX = 14, boxW = pw - 28, boxH = 42;
    doc.setDrawColor(30, 58, 107);
    doc.setLineWidth(0.4);
    doc.setFillColor(245, 248, 255);
    doc.rect(boxX, y, boxW, boxH, "FD");

    // QR Code à direita
    const qrSize = 32;
    const qrX = boxX + boxW - qrSize - 4;
    const qrY = y + (boxH - qrSize) / 2;
    if (qrDataUrl) {
      try { doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize); } catch { /* ignore */ }
    }

    // Texto à esquerda
    const tx = boxX + 4;
    let ty = y + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 107);
    doc.text("ASSINADO ELETRONICAMENTE", tx, ty);
    doc.setTextColor(0);
    ty += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Responsável Técnico", tx, ty);
    ty += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${assinatura.signatario_nome}`, tx, ty);
    if (assinatura.responsavel_tecnico_nome && assinatura.responsavel_tecnico_nome !== assinatura.signatario_nome) {
      ty += 3.5;
      doc.text(`RT: ${assinatura.responsavel_tecnico_nome}${assinatura.responsavel_tecnico_registro ? ` — ${assinatura.responsavel_tecnico_registro}` : ""}`, tx, ty);
    } else if (assinatura.responsavel_tecnico_registro) {
      ty += 3.5;
      doc.text(`Registro: ${assinatura.responsavel_tecnico_registro}`, tx, ty);
    }
    if (assinatura.signatario_cargo) {
      ty += 3.5;
      doc.text(`Cargo: ${assinatura.signatario_cargo}`, tx, ty);
    }
    ty += 3.5;
    const dh = new Date(assinatura.signed_at).toLocaleString("pt-BR");
    doc.text(`Data/Hora: ${dh}${assinatura.ip_origem ? `  ·  IP: ${assinatura.ip_origem}` : ""}`, tx, ty);
    ty += 3.5;
    doc.setFontSize(6.5);
    doc.setTextColor(80);
    doc.text(assinatura.base_legal, tx, ty, { maxWidth: boxW - qrSize - 12 });
    ty += 3;
    doc.setFontSize(6.5);
    doc.text(`Código: ${assinatura.codigo_verificador}`, tx, ty);
    ty += 3;
    doc.text(`Hash SHA-256: ${assinatura.hash_documento.substring(0, 48)}...`, tx, ty);
    doc.setTextColor(0);

    // Rótulo abaixo do QR
    doc.setFontSize(6);
    doc.setTextColor(80);
    doc.text("Escaneie para verificar", qrX + qrSize / 2, qrY + qrSize + 2.5, { align: "center" });
    doc.setTextColor(0);

    y += boxH + 4;
  } else {
    // Assinatura manuscrita (não assinado eletronicamente ainda)
    if (y > ph - 30) { doc.addPage(); drawTimbrado(doc, pw, empresa, logo); y = 38; }
    doc.setDrawColor(0);
    doc.line(pw / 2 - 40, y, pw / 2 + 40, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Responsável Técnico", pw / 2, y, { align: "center" });
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(laudo.responsavel_tecnico || "-", pw / 2, y, { align: "center" });
    if (laudo.registro_profissional) {
      y += 4;
      doc.text(`Registro: ${laudo.registro_profissional}`, pw / 2, y, { align: "center" });
    }
  }

  // Anexos - Fotos (4 por página)
  if (laudo.fotos && laudo.fotos.length > 0) {
    doc.addPage();
    drawTimbrado(doc, pw, empresa, logo);
    y = 38;
    sectionTitle("ANEXO I — FOTOGRAFIAS");
    let count = 0;
    const cellW = (pw - 28 - 6) / 2;
    const cellH = 70;
    let cx = 14;
    let cy = y;
    for (const foto of laudo.fotos) {
      const img = await loadImageWithMarcadores(foto);
      if (!img) continue;
      const col = count % 2;
      const row = Math.floor((count % 4) / 2);
      cx = 14 + col * (cellW + 6);
      cy = y + row * (cellH + 6);
      // fit
      const ratio = img.w / img.h;
      let iw = cellW, ih = cellW / ratio;
      if (ih > cellH - 12) { ih = cellH - 12; iw = ih * ratio; }
      const ix = cx + (cellW - iw) / 2;
      doc.addImage(img.dataUrl, "JPEG", ix, cy, iw, ih);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const descLines = doc.splitTextToSize(foto.descricao || `Foto ${count + 1}`, cellW);
      doc.text(descLines.slice(0, 2), cx, cy + ih + 3);
      // Legendas
      if (foto.marcadores && foto.marcadores.length > 0) {
        const leg = foto.marcadores.map(m => `${m.n}. ${m.legenda || "-"}`).join(" | ");
        const legLines = doc.splitTextToSize(leg, cellW);
        doc.setFont("helvetica", "italic");
        doc.text(legLines.slice(0, 2), cx, cy + ih + 8);
      }
      count++;
      if (count % 4 === 0 && count < laudo.fotos.length) {
        doc.addPage();
        drawTimbrado(doc, pw, empresa, logo);
        y = 38;
        sectionTitle("ANEXO I — FOTOGRAFIAS (cont.)");
      }
    }
  }

  // Anexos - Orçamentos e outros
  if ((laudo.anexos_orcamentos?.length || 0) + (laudo.outros_anexos?.length || 0) > 0) {
    doc.addPage();
    drawTimbrado(doc, pw, empresa, logo);
    y = 38;
    sectionTitle("ANEXO II — DOCUMENTOS ANEXOS");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    if (laudo.anexos_orcamentos?.length) {
      doc.setFont("helvetica", "bold");
      doc.text("Orçamentos de reparo:", 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      laudo.anexos_orcamentos.forEach(a => { doc.text(`• ${a.nome}`, 18, y); y += 4; });
      y += 3;
    }
    if (laudo.outros_anexos?.length) {
      doc.setFont("helvetica", "bold");
      doc.text("Outros anexos:", 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      laudo.outros_anexos.forEach(a => { doc.text(`• ${a.nome}`, 18, y); y += 4; });
    }
    if (laudo.observacoes_outros) {
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      const oLines = doc.splitTextToSize(laudo.observacoes_outros, pw - 28);
      doc.text(oLines, 14, y);
    }
  }

  drawRodape(doc, numeroFmt, empresa);

  doc.save(`Laudo_Condenacao_${numeroFmt.replace("/", "-")}_${(laudo.equipamento_tag || "equipamento").replace(/\s+/g, "_")}.pdf`);
}
