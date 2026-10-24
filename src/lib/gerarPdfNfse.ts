import type { NfseEmitida } from "@/contexts/NfsesContext";

export function podeGerarPdfNfse(nota: Pick<NfseEmitida, "status">) {
  return nota.status === "emitida" || nota.status === "cancelada";
}

export function numeroFiscalNfse(xml: string | null) {
  // Fiscal number is not the DPS number. Support national and ABRASF XMLs.
  const nacional = xml?.match(/<(?:[\w.-]+:)?nNFSe\b[^>]*>\s*(\d+)\s*<\//i);
  const info = xml?.match(/<(?:[\w.-]+:)?InfNfse\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?InfNfse>/i);
  return nacional?.[1] || info?.[1]?.match(/<(?:[\w.-]+:)?Numero\b[^>]*>\s*(\d+)\s*<\//i)?.[1] || null;
}

const texto = (v: unknown) => v == null || v === "" ? "Não informado" : String(v);
const moeda = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (v: string | null) => {
  if (!v) return "Não informada";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split("-").reverse().join("/");
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

export async function criarPdfNfse(nota: NfseEmitida) {
  if (!podeGerarPdfNfse(nota)) throw new Error("O PDF está disponível somente para notas emitidas ou canceladas.");
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  const numero = numeroFiscalNfse(nota.xml_nfse);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NOTA FISCAL DE SERVIÇOS ELETRÔNICA", 14, 20);
  doc.setFontSize(10);
  doc.text("Representação dos dados da NFS-e • SGM Lasant", 14, 27);
  const linhas: string[][] = [];
  if (nota.ambiente !== 1) linhas.push(["AMBIENTE", "HOMOLOGAÇÃO - SEM VALOR FISCAL"]);
  linhas.push(["Situação", nota.status === "cancelada" ? "CANCELADA" : "Emitida"]);
  linhas.push(["Número da NFS-e", numero || "Não disponível no XML armazenado"]);
  linhas.push(["DPS / Série", `${nota.numero_dps} / ${nota.serie}`]);
  linhas.push(["Emissão / Competência", `${data(nota.data_emissao)} / ${data(nota.data_competencia)}`]);
  linhas.push(["Chave / Código de verificação", texto(nota.chave_acesso)]);
  linhas.push(["Protocolo", texto(nota.protocolo)]);
  linhas.push(["PRESTADOR", texto(nota.prestador?.razaoSocial)]);
  linhas.push(["CNPJ / Inscrição municipal", `${texto(nota.prestador?.cnpj)} / ${texto(nota.prestador?.im)}`]);
  linhas.push(["TOMADOR", texto(nota.tomador?.razaoSocial)]);
  linhas.push(["CPF/CNPJ / Inscrição municipal", `${texto(nota.tomador?.documento)} / ${texto(nota.tomador?.inscricaoMunicipal)}`]);
  const e = nota.tomador?.endereco || {};
  linhas.push(["Endereço do tomador", [e.logradouro, e.numero, e.complemento, e.bairro, e.municipio, e.uf, e.cep].filter(Boolean).join(" - ") || "Não informado"]);
  linhas.push(["Contato", texto(nota.tomador?.email)]);
  linhas.push(["SERVIÇO", texto(nota.servico?.descricao)]);
  linhas.push(["Tributação nacional / municipal", `${texto(nota.servico?.codigoTributacaoNacional)} / ${texto(nota.servico?.codigoTributacaoMunicipio)}`]);
  linhas.push(["Município de prestação (IBGE)", texto(nota.prestador?.codigoMunicipio)]);
  linhas.push(["Valor dos serviços", moeda(nota.valor_servico)]);
  linhas.push(["ISS / Alíquota", `${moeda(nota.valor_iss)} / ${texto(nota.tributos?.aliquotaIss)}%`]);
  linhas.push(["ISS retido", nota.tributos?.issRetido ? "Sim" : "Não"]);
  linhas.push(["Valor líquido", moeda(nota.valor_liquido)]);
  if (nota.status === "cancelada") linhas.push(["Cancelamento", `${data(nota.data_cancelamento)}\n${texto(nota.motivo_cancelamento)}`]);
  autoTable(doc, {
    startY: 33, margin: { top: 14, left: 14, right: 14, bottom: 24 },
    body: linhas, theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" }, 1: { cellWidth: 127 } },
    rowPageBreak: "auto",
  });
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Representação para consulta. Não substitui o XML autorizado nem o DANFSe oficial.", 14, 282);
    doc.text(`Página ${p} de ${total}`, 196, 288, { align: "right" });
  }
  return doc;
}

export async function baixarPdfNfse(nota: NfseEmitida) {
  const doc = await criarPdfNfse(nota);
  const identificador = numeroFiscalNfse(nota.xml_nfse) || `dps-${nota.numero_dps}`;
  doc.save(`nfse-${identificador}-${nota.ambiente === 1 ? "producao" : "homologacao"}.pdf`);
}