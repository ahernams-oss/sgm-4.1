import type { jsPDF } from "jspdf";
import type { PmocPlano, PmocAtividade } from "@/contexts/PmocContext";
import type { Equipamento } from "@/contexts/EquipamentosContext";

export interface OsPmocRow {
  id: string; numero: number; plano_id: string; atividade_id: string;
  equipamento_id: string; equipamento_nome: string; unidade: string;
  local_descricao: string; descricao: string; tipo: string; status: string;
  data_abertura: string; data_conclusao: string | null; tecnico_responsavel: string;
  evidencias: string[] | null; observacoes: string; aprovado_por: string;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PER_MESES: [string, number, string][] = [
  ["Mensal", 1, "M"], ["Bimestral", 2, "B"], ["Trimestral", 3, "T"], ["Semestral", 6, "S"], ["Anual", 12, "A"],
];
const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function letraPlanejada(idx: number, periodicidades: Set<string>): string {
  const n = idx + 1;
  const due = PER_MESES.filter(([p, m]) => periodicidades.has(norm(p)) && n % m === 0);
  if (!due.length) {
    if (periodicidades.has("quinzenal")) return "Q";
    if (periodicidades.has("semanal")) return "Sem";
    return "";
  }
  const maior = due[due.length - 1];
  if (maior[2] === "A" && due.some((d) => d[2] === "S")) return "S/A";
  return maior[2];
}

const fmtData = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "");

async function loadImageAsDataUrl(url: string): Promise<string | null> {
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

export async function downloadPdfOsPmocEquipamento(opts: {
  equipamento?: Equipamento; equipamentoNome: string; plano?: PmocPlano;
  atividades: PmocAtividade[]; ordens: OsPmocRow[]; inicio?: string;
  empresaLogoUrl?: string;
}) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc: jsPDF = new JsPDF({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const e = opts.equipamento;
  const azul: [number, number, number] = [31, 56, 100];
  const azulCab: [number, number, number] = [30, 58, 107];
  const ml = 14, mr = 14;

  // ===== Cabeçalho padrão LASANT (faixa azul à direita + logo à esquerda) =====
  const headerH = 34;
  const blueStartX = pw * 0.42;
  doc.setFillColor(...azulCab);
  doc.rect(blueStartX, 0, pw - blueStartX, headerH, "F");

  const logoData = await loadImageAsDataUrl(opts.empresaLogoUrl || "/Logo_Lasant.png");
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", ml, 4, 42, 26);
    } catch {
      doc.setTextColor(...azulCab);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LASANT", ml, 20);
    }
  } else {
    doc.setTextColor(...azulCab);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LASANT", ml, 20);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("O.S. PMOC", pw - mr, 13, { align: "right" });
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text("Controle de Manutenção do Equipamento", pw - mr, 19, { align: "right" });
  doc.setFontSize(8.5);
  doc.text(
    `Cliente: ${e?.clienteNome || opts.ordens[0]?.unidade || "—"}  |  Plano: ${opts.plano?.titulo || "—"}`,
    pw - mr, 25, { align: "right" },
  );
  doc.text(
    `Emitido em: ${new Date().toLocaleDateString("pt-BR")}`,
    pw - mr, 30, { align: "right" },
  );

  doc.setTextColor(40, 40, 40);

  const v = (x?: string) => (x && String(x).trim()) || "—";
  autoTable(doc, {
    startY: 26,
    head: [[{ content: "Relação dos Ambientes Climatizados", colSpan: 2, styles: { halign: "center" } }]],
    body: [
      ["Setor:", v(e?.setorDescricao)],
      ["Nº de Ocupantes Fixos/Flutuantes:", "—"],
      ["Área Climatizada Total:", "—"],
      ["Marca/Modelo", v([e?.fabricante, e?.modelo].filter(Boolean).join("/"))],
      ["TAG", v(e?.tag)],
      ["Tipo de equipamento (ACJ/Split)", v(e?.subgrupo || e?.grupo || e?.equipamento || opts.equipamentoNome)],
      ["Carga Térmica:", v(e?.capacidadeBtu)],
      ["Potencia Nominal do Equipamento:", v(e?.potencia)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: azul, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 80 }, 1: { halign: "center" } },
    margin: { left: 14, right: 14 },
  });

  const per = new Set(opts.atividades.map((a) => norm(a.periodicidade)));
  const base = opts.inicio ? new Date(opts.inicio + "T12:00:00") : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const linhas: string[][] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const osMes = opts.ordens.filter((o) => {
      const dt = new Date(o.data_conclusao || o.data_abertura);
      return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth() && o.status !== "Cancelada";
    });
    const tipos = [...new Set(osMes.map((o) => o.tipo))].join(", ");
    const datas = [...new Set(osMes.map((o) => fmtData(o.data_conclusao || o.data_abertura)))].join(", ");
    const exec = [...new Set(osMes.map((o) => o.tecnico_responsavel).filter(Boolean))].join(", ");
    linhas.push([`${MESES[d.getMonth()]}/${d.getFullYear()}`, letraPlanejada(i, per), "", tipos, datas, exec, ""]);
  }

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [
      [{ content: "Controle das Manutenções", colSpan: 7, styles: { halign: "center", fillColor: azul, textColor: [255, 255, 255] } }],
      ["Mês PMOC", "Atividade Planejada", "Visto do Mecânico", "Tipo de Manutenção", "Data da execução", "Matrícula do executor", "Visto da Unidade"],
    ],
    body: linhas,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0], halign: "center", minCellHeight: 7 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "normal" },
    margin: { left: 14, right: 14 },
  });

  const y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(7.5);
  doc.text("Legenda: Sem = Semanal · Q = Quinzenal · M = Mensal · B = Bimestral · T = Trimestral · S = Semestral · A = Anual", 14, y);

  const nome = (e?.tag || opts.equipamentoNome || "equipamento").replace(/[^\w-]+/g, "_");
  doc.save(`OS_PMOC_${nome}.pdf`);
}
