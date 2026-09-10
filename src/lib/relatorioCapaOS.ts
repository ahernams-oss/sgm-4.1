import type { jsPDF } from "jspdf";
import capaAsset from "@/assets/capa-relatorio-os.jpg.asset.json";
import finalAsset from "@/assets/final-relatorio-os.jpg.asset.json";

async function loadImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(b);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
      img.onerror = () => resolve({ w: 4, h: 3 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

export interface CapaOSInfo {
  cliente?: string;
  contrato?: string;
  periodo?: string;
}

/**
 * Insere a capa (página 1) e a lâmina final de encerramento nos relatórios
 * de Ordens de Serviço. Deve ser chamada logo antes de doc.save().
 */
export async function adicionarCapaELaminaOS(doc: jsPDF, info: CapaOSInfo) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  const capa = await loadImage(capaAsset.url);
  if (capa) {
    doc.insertPage(1);
    doc.setPage(1);
    const scale = Math.min(pw / capa.w, ph / capa.h);
    const coverW = capa.w * scale;
    const coverH = capa.h * scale;
    const coverX = (pw - coverW) / 2;
    const coverY = (ph - coverH) / 2;
    try { doc.addImage(capa.dataUrl, "JPEG", coverX, coverY, coverW, coverH); } catch { /* ignore */ }

    doc.setTextColor(20, 33, 61);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(7, 10 * scale));

    const put = (text: string, imageX: number, imageY: number) => {
      if (!text) return;
      doc.text(text, coverX + imageX * scale, coverY + imageY * scale, { maxWidth: 380 * scale });
    };

    // Coordenadas medidas sobre a capa (1055x1491): valores iniciam
    // logo após o rótulo, sobre a linha de preenchimento.
    put(info.cliente || "", 170, 609);
    put(info.contrato || "", 186, 668);
    put(info.periodo || "", 174, 727);

    doc.setTextColor(30, 30, 30);
  }

  const final = await loadImage(finalAsset.url);
  if (final) {
    doc.addPage();
    const scale = Math.min(pw / final.w, ph / final.h);
    const w = final.w * scale;
    const h = final.h * scale;
    try { doc.addImage(final.dataUrl, "JPEG", (pw - w) / 2, (ph - h) / 2, w, h); } catch { /* ignore */ }
  }
}
