import type { Cliente, Contrato, Faturamento } from "@/contexts/ClientesContext";
import type { OrdemServico } from "@/contexts/OrdensServicoContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (s?: string) => s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "";

const SIGLAS: Record<string, string> = {
  "ELETRICA": "EL", "ELÉTRICA": "EL",
  "ELETRO-MECANICA": "EM", "ELETRO-MECÂNICA": "EM", "ELETROMECANICA": "EM", "ELETROMECÂNICA": "EM",
  "ESQUADRIAS": "ES",
  "GASES MEDICINAIS": "GM",
  "HIDROSANITARIA": "HS", "HIDROSANITÁRIA": "HS", "HIDRO-SANITARIA": "HS", "HIDRO-SANITÁRIA": "HS",
  "PINTURA": "PI",
  "OBRAS CIVIS": "OC",
  "PROTECAO CONTRA INCENDIO": "PCI", "PROTEÇÃO CONTRA INCENDIO": "PCI", "PROTEÇÃO CONTRA INCÊNDIO": "PCI",
};

function siglaFromCategoria(cat: string): { sigla: string; nome: string } {
  if (!cat) return { sigla: "-", nome: "—" };
  const parts = cat.split(" - ");
  const nome = (parts[1] || parts[0] || cat).trim();
  const key = nome.toUpperCase();
  const sigla = SIGLAS[key] || nome.substring(0, 2).toUpperCase();
  return { sigla, nome: `${sigla} - ${nome.toUpperCase()}` };
}

function valorOS(os: OrdemServico): number {
  const bdi = Number(os.bdi || 0);
  const totalMat = (os.materiais || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0);
  const totalEst = (os.materiaisEstoque || []).reduce((s: number, m: any) => s + (Number(m.valorTotal) || 0), 0);
  const subtotal = totalMat + totalEst;
  return subtotal * (1 + bdi / 100);
}

interface Params {
  cliente: Cliente;
  contrato: Contrato;
  faturamento: Faturamento;
  ordens: OrdemServico[];
  empresaNome?: string;
}

const PADRAO: Array<[string, string]> = [
  ["EL", "EL - ELÉTRICA"],
  ["EM", "EM - ELETRO-MECÂNICA"],
  ["ES", "ES - ESQUADRIAS"],
  ["GM", "GM - GASES MEDICINAIS"],
  ["HS", "HS - HIDROSANITÁRIA"],
  ["PI", "PI - PINTURA"],
  ["OC", "OC - OBRAS CIVIS"],
  ["PCI", "PCI - PROTEÇÃO CONTRA INCÊNDIO"],
];

async function renderPagina(
  doc: jsPDF,
  titulo: string,
  cliente: Cliente,
  contrato: Contrato,
  faturamento: Faturamento,
  empresaNome: string | undefined,
  osList: OrdemServico[],
  ini: string,
  fim: string,
) {
  const pw = doc.internal.pageSize.getWidth();

  // Cabeçalho institucional
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.text("Coordenadoria Técnica de Avaliação de Tecnologia em Saúde e Insumos Estratégicos", 14, 10);
  doc.text("Coordenação de Engenharia e Arquitetura", 14, 14);
  doc.text("S/IVISA-RIO/CTATS/CEA", 14, 18);

  // Título
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 24, pw, 12, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(titulo, pw / 2, 32, { align: "center" });

  // Subtítulo unidade
  doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  const unidade = `UNIDADE DA SMS: ${(empresaNome || "").toUpperCase()}     ${cliente.nome.toUpperCase()}`;
  doc.text(unidade, 14, 44);

  // Bloco Processo / Contrato / Período
  let y = 50;
  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    margin: { left: 8, right: 8 },
    tableWidth: "auto",
    styles: { fontSize: 8, cellPadding: 1.5 },
    body: [
      [
        { content: "PROCESSO Nº", styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "center" } },
        { content: contrato.numeroProcesso || "—", styles: { halign: "center" } },
        { content: "CONTRATO Nº", styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "center" } },
        { content: contrato.numero || "—", styles: { halign: "center" } },
        { content: "PERÍODO", styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "center" } },
        { content: `${fmtDate(ini)} a ${fmtDate(fim)}`, styles: { halign: "center" } },
      ],
      [
        { content: "MEDIÇÃO", styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "center" } },
        { content: faturamento.numeroMedicao ? `${faturamento.numeroMedicao}ª` : "—", styles: { halign: "center" } },
        { content: "ETAPA", styles: { fontStyle: "bold", fillColor: [240, 240, 240], halign: "center" } },
        { content: faturamento.numeroMedicao ? `${faturamento.numeroMedicao}ª` : "—", styles: { halign: "center" } },
        { content: "", styles: { fillColor: [255, 255, 255] } },
        { content: "", styles: { fillColor: [255, 255, 255] } },
      ],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Agrupar
  const grupos = new Map<string, { sigla: string; nome: string; numeros: number[]; qtd: number; valor: number }>();
  for (const os of osList) {
    const { sigla, nome } = siglaFromCategoria(os.categoria || "");
    const g = grupos.get(sigla) || { sigla, nome, numeros: [], qtd: 0, valor: 0 };
    if (os.numero) g.numeros.push(os.numero);
    g.qtd += 1;
    g.valor += valorOS(os);
    grupos.set(sigla, g);
  }
  for (const [s, n] of PADRAO) if (!grupos.has(s)) grupos.set(s, { sigla: s, nome: n, numeros: [], qtd: 0, valor: 0 });

  const localUnidade = cliente.nome.toUpperCase();
  const dataRef = fmtDate(fim) || fmtDate(ini) || new Date().toLocaleDateString("pt-BR");

  const linhas: any[] = [];
  let totalQtd = 0; let totalValor = 0;
  const ordemKeys = [...PADRAO.map(p => p[0]), ...Array.from(grupos.keys()).filter(k => !PADRAO.some(p => p[0] === k))];
  for (const key of ordemKeys) {
    const g = grupos.get(key); if (!g) continue;
    const numerosTxt = g.numeros.length ? g.numeros.sort((a, b) => a - b).join(" ") : "0";
    linhas.push([
      localUnidade,
      dataRef,
      numerosTxt,
      g.sigla,
      g.nome,
      String(g.qtd),
      g.valor > 0 ? `R$ ${fmt(g.valor)}` : "R$ -",
      "CONCLUÍDO",
    ]);
    totalQtd += g.qtd; totalValor += g.valor;
  }

  (await getAutoTable())(doc, {
    startY: y,
    theme: "grid",
    margin: { left: 8, right: 8 },
    tableWidth: "auto",
    styles: { fontSize: 7, cellPadding: 1.2, valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: [169, 169, 169], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 88 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 48 },
      5: { cellWidth: 12, halign: "center" },
      6: { cellWidth: 24, halign: "right" },
      7: { cellWidth: 21, halign: "center" },
    },
    head: [[
      "LOCAL DA UNIDADE HOSPITALAR", "DATA", "Nº DE O.S.", "ITEM", "SERVIÇOS (RESUMO)", "QT OS", "VALOR", "SITUAÇÃO",
    ]],
    body: linhas,
    foot: [[
      { content: "TOTAL", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: [220, 220, 220], textColor: [0, 0, 0] } },
      { content: String(totalQtd), styles: { fontStyle: "bold", halign: "center", fillColor: [220, 220, 220], textColor: [0, 0, 0] } },
      { content: `R$ ${fmt(totalValor)}`, styles: { fontStyle: "bold", halign: "right", fillColor: [220, 220, 220], textColor: [0, 0, 0] } },
      { content: "", styles: { fillColor: [220, 220, 220] } },
    ]],
  });

  // Legenda
  const finalY = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
  doc.text("LEGENDA:", 14, finalY);
  doc.setFont("helvetica", "normal");
  const col1 = ["AT - Aluguel de Transformador", "EL - Elétrica", "EM - Eletro-Mecânica", "OT - Outros"];
  const col2 = ["ETE - Estação de Tratamento de Esgoto", "GM - Gases Medicinais", "HS - Hidrosanitária", "OC - Obras Civis"];
  col1.forEach((t, i) => doc.text(t, 14, finalY + 5 + i * 4));
  col2.forEach((t, i) => doc.text(t, 90, finalY + 5 + i * 4));

  doc.setFont("helvetica", "bold");
  doc.text("Situação:", 170, finalY);
  doc.setFont("helvetica", "normal");
  ["Andamento", "Cancelado", "Concluído", "Medido"].forEach((t, i) => doc.text(t, 170, finalY + 5 + i * 4));

  // Rodapé
  doc.setFontSize(8); doc.setTextColor(80, 80, 80);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, doc.internal.pageSize.getHeight() - 6);
  doc.text(`NF ${faturamento.numeroNf || "—"}`, pw - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
}

export async function gerarPdfMedicaoControle({ cliente, contrato, faturamento, ordens, empresaNome }: Params): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a4" });

  const ini = faturamento.periodoInicio || "";
  const fim = faturamento.periodoFim || "";
  const inRange = (d: string) => {
    if (!d) return false;
    const dd = d.substring(0, 10);
    return (!ini || dd >= ini) && (!fim || dd <= fim);
  };
  const osFiltradas = (ordens || []).filter(o => o.clienteId === cliente.id && (
    inRange(o.dataTermino) || inRange(o.dataInicio) || inRange((o.createdAt || "").substring(0, 10))
  ) && o.situacao !== "Aberta");

  const tipoDesc = (o: OrdemServico) => (o.tipoOs?.descricao || "").toLowerCase();
  const corretivas = osFiltradas.filter(o => tipoDesc(o).includes("corret"));
  const preventivas = osFiltradas.filter(o => tipoDesc(o).includes("prevent"));

  // Página 1: GERAL
  renderPagina(doc, "PLANILHA 3: CONTROLE GERAL DE OS's GERAL", cliente, contrato, faturamento, empresaNome, osFiltradas, ini, fim);

  // Página 2: CORRETIVAS
  doc.addPage();
  renderPagina(doc, "PLANILHA 3: CONTROLE GERAL DE OS's CORRETIVAS", cliente, contrato, faturamento, empresaNome, corretivas, ini, fim);

  // Página 3: PREVENTIVAS
  doc.addPage();
  renderPagina(doc, "PLANILHA 3: CONTROLE GERAL DE OS's PREVENTIVAS", cliente, contrato, faturamento, empresaNome, preventivas, ini, fim);

  return doc;
}
