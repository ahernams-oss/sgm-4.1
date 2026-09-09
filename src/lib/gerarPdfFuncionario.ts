import { Funcionario } from "@/contexts/FuncionariosContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
const getAutoTable = async () => (await import("jspdf-autotable")).default;

interface PdfOptions {
  cargoNome?: string;
  clienteNome?: string;
}

export async function gerarPdfFuncionario(func: Funcionario, opts: PdfOptions = {}) {
  const doc = new (await getJsPDF())({ compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 58, 107);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Ficha do Funcionário", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(func.nome || "", 14, 22);
  doc.setFontSize(9);
  doc.text(`Status: ${func.status || "Ativo"}`, pageWidth - 14, 14, { align: "right" });

  doc.setTextColor(30, 30, 30);
  let y = 44;

  const addSection = async (title: string, rows: [string, string][]) => {
    const filteredRows = rows.filter(([, val]) => val && val.trim() !== "");
    if (filteredRows.length === 0) return;

    if (y > 260) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 236, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.text(title, 16, y + 2);
    y += 10;

    (await getAutoTable())(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [],
      body: filteredRows,
      theme: "plain",
      styles: { fontSize: 8.5, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55, textColor: [80, 80, 80] },
        1: { cellWidth: "auto" },
      },
      didDrawPage: () => {},
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  };

  // Dados Pessoais
  addSection("Dados Pessoais", [
    ["Nome", func.nome],
    ["CPF", func.cpf],
    ["RG", func.rg],
    ["Órgão Emissor", func.orgaoEmissor],
    ["Data de Nascimento", func.dataNascimento],
    ["Sexo", func.sexo],
    ["Estado Civil", func.estadoCivil],
    ["Nacionalidade", func.nacionalidade],
    ["Naturalidade", func.naturalidade],
    ["Nome da Mãe", func.nomeMae],
    ["Nome do Pai", func.nomePai],
    ["Telefone", func.telefone],
    ["E-mail", func.email],
    ["PCD", func.pcd ? `Sim - ${func.tipoPcd}` : "Não"],
  ]);

  // Endereço
  addSection("Endereço", [
    ["CEP", func.cep],
    ["Logradouro", func.logradouro],
    ["Número", func.numero],
    ["Complemento", func.complemento],
    ["Bairro", func.bairro],
    ["Cidade", func.cidade],
    ["UF", func.uf],
  ]);

  // Dados Profissionais
  addSection("Dados Profissionais", [
    ["Cargo", opts.cargoNome || func.cargoId],
    ["Cliente", opts.clienteNome || func.clienteId],
    ["Data de Admissão", func.dataAdmissao],
    ["Data de Demissão", func.dataDemissao],
    ["Tipo de Contrato", func.tipoContrato],
    ["Salário", func.salario ? `R$ ${func.salario}` : ""],
    ["Jornada de Trabalho", func.jornadaTrabalho],
    ["CTPS", func.ctps],
    ["Série CTPS", func.serieCtps],
    ["PIS", func.pis],
  ]);

  // Dados Bancários
  addSection("Dados Bancários", [
    ["Banco", func.banco],
    ["Agência", func.agencia],
    ["Conta", func.conta],
    ["Tipo de Conta", func.tipoConta],
    ["Chave PIX", func.chavePix],
  ]);

  // Documentos
  addSection("Documentos", [
    ["Título de Eleitor", func.tituloEleitor],
    ["Zona Eleitoral", func.zonaEleitoral],
    ["Seção Eleitoral", func.secaoEleitoral],
    ["CNH", func.cnh],
    ["Categoria CNH", func.categoriaCnh],
    ["Validade CNH", func.validadeCnh],
    ["Certificado Reservista", func.certificadoReservista],
  ]);

  // Uniforme
  addSection("Uniforme", [
    ["Tamanho Camisa", func.tamanhoCamisa],
    ["Tamanho Calça", func.tamanhoCalca],
    ["Tamanho Calçado", func.tamanhoCalcado],
    ["Peso", func.peso ? `${func.peso} kg` : ""],
    ["Altura", func.altura ? `${func.altura} m` : ""],
  ]);

  // Passagens
  if (func.passagens && func.passagens.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 236, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.text("Passagens", 16, y + 2);
    y += 10;

    (await getAutoTable())(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["Tipo Transporte", "Itinerário", "Valor", "Qtd", "Total"]],
      body: func.passagens.map((p) => [
        p.tipoTransporte,
        p.itinerario,
        `R$ ${parseFloat(p.valorPassagem.replace(",", ".")).toFixed(2)}`,
        String(p.quantidade),
        `R$ ${p.total.toFixed(2)}`,
      ]),
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    const totalPassagens = func.passagens.reduce((s, p) => s + p.total, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Total diário: R$ ${totalPassagens.toFixed(2)}`, pageWidth - 14, y, { align: "right" });
    y += 10;
  }

  // Dependentes
  if (func.dependentes && func.dependentes.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(230, 236, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.text("Dependentes", 16, y + 2);
    y += 10;

    (await getAutoTable())(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [["Nome", "CPF", "Data Nasc.", "Parentesco", "Anexos"]],
      body: func.dependentes.map((d) => [
        d.nome,
        d.cpf || "—",
        d.dataNascimento || "—",
        d.grauParentesco,
        d.anexos?.length ? `${d.anexos.length} documento(s)` : "Nenhum",
      ]),
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 107], textColor: [255, 255, 255], fontStyle: "bold" },
    });

    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Observações
  if (func.observacoes?.trim()) {
    if (y > 260) { doc.addPage(); y = 20; }
    addSection("Observações", [["", func.observacoes]]);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, doc.internal.pageSize.getHeight() - 8);
  }

  doc.save(`Funcionario_${func.nome.replace(/\s+/g, "_")}.pdf`);
}
