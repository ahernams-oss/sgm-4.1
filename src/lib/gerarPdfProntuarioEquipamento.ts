import { supabase } from "@/integrations/supabase/client";
import type { Equipamento } from "@/contexts/EquipamentosContext";
import { drawHeader, rodape, getLogo, infoEquipamentoBlock } from "@/lib/gerarPdfPmocEquipamento";
import { resolverImagemImpressaoOs } from "@/lib/dadosImpressaoOs";
import { historicoProntuario, resumoProntuario, fotosOsProntuario, dataOsProntuario, type OsProntuario } from "@/lib/prontuarioEquipamento";

const AZUL: [number, number, number] = [30, 58, 107];
const fmt = (d: string) => (d ? d.split("-").reverse().join("/") : "—");

async function carregarFoto(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const src = await resolverImagemImpressaoOs(url);
    const blob = await (await fetch(src)).blob();
    const bmp = await createImageBitmap(blob);
    const max = 1200;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", 0.8), w: c.width, h: c.height };
  } catch {
    return null;
  }
}

/** Prontuário completo do equipamento: todas as O.S. PMOC com fotos. Retorna a quantidade de O.S. */
export async function gerarPdfProntuarioEquipamento(equip: Equipamento | null, equipamentoId: string, equipNome: string): Promise<number> {
  const { data, error } = await (supabase as any).from("pmoc_ordens_servico").select("*").eq("equipamento_id", equipamentoId);
  if (error) throw new Error(error.message);
  const hist = historicoProntuario((data || []) as OsProntuario[], equipamentoId);
  const resumo = resumoProntuario(hist);

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const logo = await getLogo();
  const doc = new jsPDF({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const titulo = "Prontuário do Equipamento";
  const novaPagina = async () => { doc.addPage(); await drawHeader(doc, pw, logo, titulo, equipNome); return 34; };

  await drawHeader(doc, pw, logo, titulo, equipNome);
  let y = await infoEquipamentoBlock(doc, pw, equip, undefined, 34);

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: 10 },
    head: [["Intervenções", "Concluídas", "Fotos", "Primeira", "Última"]],
    body: [[String(resumo.total), String(resumo.concluidas), String(resumo.fotos), fmt(resumo.primeira), fmt(resumo.ultima)]],
    theme: "grid",
    headStyles: { fillColor: AZUL, fontSize: 9 },
    styles: { fontSize: 9, halign: "center" },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  if (!hist.length) {
    doc.setFontSize(10); doc.text("Nenhuma intervenção registrada para este equipamento.", 10, y);
  }

  for (const o of hist) {
    if (y > ph - 60) y = await novaPagina();
    doc.setFillColor(240, 243, 250);
    doc.rect(10, y, pw - 20, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...AZUL);
    doc.text(`OS-PMOC-${String(o.numero).padStart(4, "0")}  •  ${fmt(dataOsProntuario(o))}  •  ${o.status || ""}`, 12, y + 5.5);
    doc.setTextColor(30);
    autoTable(doc, {
      startY: y + 9,
      margin: { left: 10, right: 10 },
      body: [
        ["Serviço", o.descricao || "—"],
        ["Tipo", o.tipo || "—"],
        ["Executor", o.tecnico_responsavel || "—"],
        ["Confirmado por", o.aprovado_por || "—"],
        ["Observações", o.observacoes || "—"],
      ],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    const fotos = fotosOsProntuario(o);
    const cols = 3, gap = 4, w = (pw - 20 - gap * (cols - 1)) / cols, h = w * 0.75;
    for (let i = 0; i < fotos.length; i++) {
      const col = i % cols;
      if (col === 0 && y + h > ph - 14) y = await novaPagina();
      const x = 10 + col * (w + gap);
      const img = await carregarFoto(fotos[i]);
      doc.setDrawColor(200); doc.rect(x, y, w, h);
      if (img) {
        const k = Math.min(w / img.w, h / img.h);
        const iw = img.w * k, ih = img.h * k;
        doc.addImage(img.data, "JPEG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      } else {
        doc.setFontSize(8); doc.setTextColor(150); doc.text("Foto indisponível", x + w / 2, y + h / 2, { align: "center" }); doc.setTextColor(30);
      }
      if (col === cols - 1 || i === fotos.length - 1) y += h + gap;
    }
    y += 4;
  }

  rodape(doc);
  const nome = (equip?.tag || equipNome || "equipamento").replace(/[^\w-]+/g, "_");
  doc.save(`prontuario-${nome}.pdf`);
  return hist.length;
}
