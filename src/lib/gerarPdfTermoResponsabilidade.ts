

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;
interface FerramentaInfo {
  codigo: string;
  descricao: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  patrimonio: string;
  estadoConservacao: string;
  valorAquisicao: number;
}

interface TermoData {
  empresa: { razaoSocial: string; cnpj: string; logradouro: string; numero: string; bairro: string; cidade: string; uf: string; };
  funcionario: { nome: string; cpf: string; cargo: string; setor: string; };
  ferramentas: FerramentaInfo[];
  dataVinculo: string;
}

export async function downloadPdfTermoResponsabilidade(data: TermoData) {
  const doc = new (await getJsPDF())({ compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TERMO DE RESPONSABILIDADE", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(10);
  doc.text("ENTREGA DE FERRAMENTA / EQUIPAMENTO", pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("EMPRESA:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.empresa.razaoSocial, 40, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("CNPJ:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.empresa.cnpj || "-", 30, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DADOS DO FUNCIONÁRIO", 14, y);
  y += 2;
  doc.setDrawColor(0);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  doc.setFontSize(9);
  const funcData = [
    ["Nome:", data.funcionario.nome, "CPF:", data.funcionario.cpf],
    ["Cargo:", data.funcionario.cargo, "Setor:", data.funcionario.setor],
  ];
  funcData.forEach(row => {
    doc.setFont("helvetica", "bold");
    doc.text(row[0], 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(row[1] || "-", 35, y);
    doc.setFont("helvetica", "bold");
    doc.text(row[2], 110, y);
    doc.setFont("helvetica", "normal");
    doc.text(row[3] || "-", 125, y);
    y += 5;
  });
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FERRAMENTAS / EQUIPAMENTOS", 14, y);
  y += 2;
  doc.line(14, y, pageWidth - 14, y);
  y += 4;

  const bodyRows = data.ferramentas.map(f => [
    f.codigo,
    f.descricao,
    f.marca || "-",
    f.modelo || "-",
    f.numeroSerie || "-",
    f.patrimonio || "-",
    f.estadoConservacao,
    f.valorAquisicao ? `R$ ${f.valorAquisicao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-",
  ]);

  (await getAutoTable())(doc, {
    startY: y,
    head: [["Código", "Descrição", "Marca", "Modelo", "Nº Série", "Patrimônio", "Estado", "Valor"]],
    body: bodyRows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 122], fontStyle: "bold", fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const termos = [
    "Declaro ter recebido a(s) ferramenta(s)/equipamento(s) acima descrito(s), em perfeito estado de conservação e funcionamento, comprometendo-me a:",
    "",
    "1. Utilizar a(s) ferramenta(s)/equipamento(s) exclusivamente para as atividades profissionais relacionadas ao meu cargo;",
    "2. Zelar pela conservação, guarda e manutenção da(s) ferramenta(s)/equipamento(s) recebido(s);",
    "3. Comunicar imediatamente ao meu superior qualquer defeito, avaria ou extravio;",
    "4. Devolver a(s) ferramenta(s)/equipamento(s) em perfeito estado de conservação quando solicitado ou no término do vínculo empregatício;",
    "5. Responsabilizar-me pelo ressarcimento em caso de perda, extravio ou dano causado por mau uso ou negligência, conforme art. 462 da CLT.",
  ];

  termos.forEach(t => {
    if (t === "") { y += 3; return; }
    const lines = doc.splitTextToSize(t, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4;
  });

  y += 15;

  doc.setFont("helvetica", "normal");
  const dataFormatada = data.dataVinculo
    ? new Date(data.dataVinculo + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const cidadeEstado = data.empresa.cidade && data.empresa.uf
    ? `${data.empresa.cidade}/${data.empresa.uf}`
    : "Local";

  doc.text(`${cidadeEstado}, ${dataFormatada}`, pageWidth / 2, y, { align: "center" });
  y += 25;

  const col1 = pageWidth / 4;
  const col2 = (pageWidth / 4) * 3;

  doc.line(col1 - 35, y, col1 + 35, y);
  doc.text("Funcionário", col1, y + 5, { align: "center" });
  doc.setFontSize(7);
  doc.text(data.funcionario.nome, col1, y + 9, { align: "center" });

  doc.setFontSize(9);
  doc.line(col2 - 35, y, col2 + 35, y);
  doc.text("Responsável pela Entrega", col2, y + 5, { align: "center" });

  const firstCode = data.ferramentas[0]?.codigo || "MULTI";
  doc.save(`Termo_Responsabilidade_${data.funcionario.nome.replace(/\s+/g, "_")}_${firstCode}.pdf`);
}
