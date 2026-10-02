import type { jsPDF } from "jspdf";
import type { Candidato, ProcessoSeletivo } from "@/contexts/ProcessoSeletivoContext";
import type { EtapaCandidato } from "@/contexts/ProcessoSeletivoContext";

export interface RequisicaoRel {
  numero: number | string;
  cargoNome?: string;
  unidade?: string;
  dataCriacao?: string;
  status?: string;
}

const AZUL: [number, number, number] = [31, 56, 100];
const AZUL_CAB: [number, number, number] = [30, 58, 107];
const ML = 14;
const MR = 14;

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

/** Cabeçalho padrão LASANT (faixa azul à direita + logotipo à esquerda). Retorna o Y inicial do conteúdo. */
async function desenharCabecalhoPadrao(
  doc: jsPDF,
  opts: { titulo: string; subtitulo: string; linhas: string[]; empresaLogoUrl?: string },
): Promise<number> {
  const pw = doc.internal.pageSize.getWidth();
  const headerH = 34;
  const blueStartX = pw * 0.42;
  doc.setFillColor(...AZUL_CAB);
  doc.rect(blueStartX, 0, pw - blueStartX, headerH, "F");

  const logoData = await loadImageAsDataUrl(opts.empresaLogoUrl || "/Logo_Lasant.png");
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", ML, 4, 42, 26);
    } catch {
      doc.setTextColor(...AZUL_CAB);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LASANT", ML, 20);
    }
  } else {
    doc.setTextColor(...AZUL_CAB);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("LASANT", ML, 20);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.titulo, pw - MR, 13, { align: "right" });
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(opts.subtitulo, pw - MR, 19, { align: "right" });
  doc.setFontSize(8.5);
  opts.linhas.forEach((l, i) => {
    doc.text(l, pw - MR, 25 + i * 5, { align: "right" });
  });

  doc.setTextColor(40, 40, 40);
  return headerH + 10;
}

async function rodapePaginas(doc: jsPDF, processoNum: string) {
  const pages = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Processo Seletivo Nº ${processoNum}`, ML, ph - 8);
    doc.text(`Página ${i} de ${pages}`, pw - MR, ph - 8, { align: "right" });
  }
}

const fmtData = (s?: string | null) => {
  if (!s) return "—";
  const str = String(s).trim();
  if (!str) return "—";
  if (str.includes("/")) return str;
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toLocaleDateString("pt-BR");
};

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  neutro: "Neutro",
  reprovado: "Reprovado",
};

const etapaLabels: Record<EtapaCandidato, string> = {
  entrevista_psicologica: "Entrevista Psicológica",
  entrevista_tecnica: "Entrevista Técnica",
  liberacao: "Liberação",
  contratacao: "Contratação",
};

export const getEtapaStatusRel = (c: Candidato, etapa: EtapaCandidato): string => {
  if (etapa === "entrevista_psicologica") return c.statusPsicologico || "pendente";
  if (etapa === "entrevista_tecnica") return c.statusTecnico || "pendente";
  if (etapa === "liberacao") return c.statusLiberacao || "pendente";
  return "aprovado";
};

const v = (x?: string | null) => (x && String(x).trim()) || "—";

interface CabecalhoOpts {
  processo: ProcessoSeletivo;
  requisicao: RequisicaoRel;
  empresaLogoUrl?: string;
  subtitulo?: string;
}

function cabecalhoLinhas({ processo, requisicao }: CabecalhoOpts): string[] {
  const numPs = processo.numero
    ? `${String(processo.numero).padStart(2, "0")}-${new Date(processo.dataCriacao || Date.now()).getFullYear()}`
    : "—";
  return [
    `Cargo: ${requisicao.cargoNome || "—"}  |  Unidade: ${requisicao.unidade || "—"}`,
    `RP Nº ${requisicao.numero ?? "—"}  |  Processo Nº ${numPs}`,
    `Emitido em: ${new Date().toLocaleDateString("pt-BR")}`,
  ];
}

function secao(
  doc: jsPDF,
  titulo: string,
  linhas: [string, string][],
  startY: number,
  pw: number,
): number {
  const autoTable = (window as any).__psAutoTable;
  const rows: any[] = [[{ content: titulo, colSpan: 2, styles: { halign: "left" } }]];
  linhas.forEach(([k, val]) => rows.push([k, val]));
  autoTable(doc, {
    startY,
    body: rows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 62, fontStyle: "bold" } },
    margin: { left: ML, right: MR },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === 0) {
        data.cell.styles.fillColor = AZUL;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  void pw;
  return (doc as any).lastAutoTable.finalY + 6;
}

/** Injeta o default do jspdf-autotable para uso dentro de secao(). */
async function prepararAutoTable() {
  const autoTable = (await import("jspdf-autotable")).default;
  (window as any).__psAutoTable = autoTable;
}

export interface PdfProcessoOpts extends CabecalhoOpts {
  candidato: Candidato;
}

/** Ficha completa do candidato (todas as etapas do processo seletivo). */
export async function downloadPdfFichaCandidato(opts: PdfProcessoOpts): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  await prepararAutoTable();
  const doc: jsPDF = new JsPDF({ compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const c = opts.candidato;

  let y = await desenharCabecalhoPadrao(doc, {
    titulo: "Processo Seletivo",
    subtitulo: opts.subtitulo || "Ficha do Candidato",
    linhas: cabecalhoLinhas(opts),
    empresaLogoUrl: opts.empresaLogoUrl,
  });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...AZUL);
  doc.text(c.nome, ML, y);
  y += 4;

  y = secao(doc, "Dados Pessoais", [
    ["E-mail", v(c.email)],
    ["Telefone", v(c.telefone)],
    ["CPF", v(c.cpf)],
    ["Data de Nascimento", fmtData(c.dataNascimento)],
    ["Idade", v(c.idade)],
    ["Estado Civil", v(c.estadoCivil)],
    ["Experiências Anteriores", v(c.experienciasAnteriores)],
  ], y, pw);

  y = secao(doc, "Workflow do Processo", (
    [
      ["entrevista_psicologica", c.dataEntrevistaPsicologica],
      ["entrevista_tecnica", c.dataEntrevistaTecnica],
      ["liberacao", c.dataLiberacao],
      ["contratacao", c.dataContratacao],
    ] as [EtapaCandidato, string | undefined][]
  ).map(([etapa, data]) => [
    etapaLabels[etapa],
    `${statusLabel[getEtapaStatusRel(c, etapa)] || "Pendente"}  ·  ${fmtData(data)}`,
  ]), y, pw);

  y = secao(doc, "Entrevista Psicológica", [
    ["Status", statusLabel[c.statusPsicologico] || "Pendente"],
    ["Data", fmtData(c.dataEntrevistaPsicologica)],
    ["Parecer da Psicóloga", v(c.parecerPsicologo)],
  ], y, pw);

  y = secao(doc, "Agendamento da Entrevista Técnica", [
    ["Data", fmtData(c.agendamentoData)],
    ["Horário", v(c.agendamentoHora)],
    ["Local", v(c.agendamentoLocal)],
    ["WhatsApp enviado em", c.agendamentoEnviadoEm ? new Date(c.agendamentoEnviadoEm).toLocaleString("pt-BR") : "—"],
  ], y, pw);

  y = secao(doc, "Entrevista Técnica", [
    ["Avaliador", v(c.avaliadorTecnico)],
    ["Status", statusLabel[c.statusTecnico] || "Pendente"],
    ["Data", fmtData(c.dataEntrevistaTecnica)],
    ["Parecer Técnico", v(c.parecerTecnico)],
  ], y, pw);

  y = secao(doc, "Liberação", [
    ["Status", statusLabel[c.statusLiberacao] || "Pendente"],
    ["Liberado por", v(c.liberadoPor)],
    ["Data", fmtData(c.dataLiberacao)],
  ], y, pw);

  const docsContr = (c.documentos || []);
  const entregues = docsContr.filter((d) => d.entregue);
  const faltantes = docsContr.filter((d) => !d.entregue && !d.naoPossui);
  y = secao(doc, "Contratação — Documentos", [
    ["Documentos entregues", entregues.length ? entregues.map((d) => d.nome).join(", ") : "—"],
    ["Documentos pendentes", faltantes.length ? faltantes.map((d) => d.nome).join(", ") : "—"],
    ["Contratação finalizada", c.contratacaoFinalizada ? "Sim" : "Não"],
    ["Anexos do candidato", c.anexos?.length ? `${c.anexos.length} arquivo(s): ${c.anexos.map((a) => a.nome).join(", ")}` : "—"],
  ], y, pw);

  const ex = c.exameAdmissional;
  y = secao(doc, "Exame Admissional", [
    ["Data do Exame", fmtData(ex?.dataExame)],
    ["Resultado", ex?.resultado === "apto" ? "Apto" : ex?.resultado === "inapto" ? "Inapto" : "Pendente"],
    ["Observações", v(ex?.observacoes)],
  ], y, pw);

  const db = c.dadosBancarios;
  y = secao(doc, "Dados Bancários", [
    ["Banco", v(db?.banco)],
    ["Agência", v(db?.agencia)],
    ["Conta", v(db?.conta)],
    ["Tipo de Conta", v(db?.tipoConta)],
    ["PIS/PASEP", v(db?.pisPasep)],
    ["Chave PIX", v(db?.pix)],
  ], y, pw);

  y = secao(doc, "LGPD", [
    ["Aceite do candidato", c.lgpdAceite ? "Sim" : "Não"],
    ["Data do aceite", c.lgpdAceiteData ? new Date(c.lgpdAceiteData).toLocaleString("pt-BR") : "—"],
  ], y, pw);

  await rodapePaginas(doc, opts.processo.numero ? String(opts.processo.numero) : "—");
  const nomeArq = `ficha-candidato-${(c.nome || "candidato").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  doc.save(nomeArq);
}

/** Relatório geral do processo: todos os candidatos e a situação de cada etapa. */
export async function downloadPdfProcessoSeletivo(opts: CabecalhoOpts): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc: jsPDF = new JsPDF({ compress: true });

  let y = await desenharCabecalhoPadrao(doc, {
    titulo: "Processo Seletivo",
    subtitulo: "Relatório Geral do Processo",
    linhas: cabecalhoLinhas(opts),
    empresaLogoUrl: opts.empresaLogoUrl,
  });

  const candidatos = opts.processo.candidatos;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${candidatos.length} candidato(s) no processo  ·  Requisição de ${fmtData(opts.requisicao.dataCriacao)}`,
    ML, y,
  );
  y += 6;

  const etapas: EtapaCandidato[] = ["entrevista_psicologica", "entrevista_tecnica", "liberacao", "contratacao"];
  const head = [["Candidato", "Etapa Atual", "Psicológica", "Técnica", "Liberação", "Contratação"]];
  const body = candidatos.map((c) => [
    c.nome,
    etapaLabels[c.etapaAtual] + (c.contratacaoFinalizada ? " (finalizada)" : ""),
    ...etapas.map((et) => {
      const st = statusLabel[getEtapaStatusRel(c, et)] || "Pendente";
      const data =
        et === "entrevista_psicologica" ? c.dataEntrevistaPsicologica :
        et === "entrevista_tecnica" ? c.dataEntrevistaTecnica :
        et === "liberacao" ? c.dataLiberacao : c.dataContratacao;
      return `${st}\n${fmtData(data)}`;
    }),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 42, fontStyle: "bold" }, 1: { cellWidth: 32 } },
    margin: { left: ML, right: MR },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Resumo individual: pareceres
  for (const c of candidatos) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...AZUL);
    doc.text(c.nome, ML, y);
    y += 2;
    y = secao(doc, "Avaliações", [
      ["Parecer da Psicóloga", `${statusLabel[c.statusPsicologico] || "Pendente"} — ${v(c.parecerPsicologo)}`],
      ["Parecer Técnico", `${c.avaliadorTecnico || "Sem avaliador"} — ${statusLabel[c.statusTecnico] || "Pendente"} — ${v(c.parecerTecnico)}`],
      ["Liberação", `${c.liberadoPor || "—"} — ${statusLabel[c.statusLiberacao] || "Pendente"}`],
      ["Agendamento", c.agendamentoData ? `${fmtData(c.agendamentoData)} ${c.agendamentoHora || ""} · ${c.agendamentoLocal || ""}` : "Sem agendamento"],
    ], y, doc.internal.pageSize.getWidth());
  }

  await rodapePaginas(doc, opts.processo.numero ? String(opts.processo.numero) : "—");
  doc.save("processo-seletivo-relatorio-geral.pdf");
}
