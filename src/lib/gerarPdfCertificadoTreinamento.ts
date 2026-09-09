

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;
export interface CertificadoTreinamentoDados {
  funcionario: string;
  cpf: string;
  titulo: string;
  tipo: string;
  cargaHoraria?: string;
  nota?: string | null;
  concluidoEm?: string | null;
  codigo?: string;
  assinadoEm?: string | null;
  assinaturaHash?: string | null;
  assinaturaIp?: string | null;
  respAssinadoEm?: string | null;
  respAssinanteNome?: string | null;
  respAssinanteCargo?: string | null;
  respAssinaturaHash?: string | null;
}

export interface EmpresaCertificado {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  cidade?: string;
  uf?: string;
  logoUrl?: string;
}

const DARK_BLUE: [number, number, number] = [30, 58, 107];
const GOLD: [number, number, number] = [176, 141, 62];

const fmtData = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

const fmtCpf = (c: string) => {
  const d = (c || "").replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : c;
};

async function carregarLogo(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarPdfCertificadoTreinamento(
  dados: CertificadoTreinamentoDados,
  empresa?: EmpresaCertificado,
): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Moldura
  doc.setDrawColor(...DARK_BLUE);
  doc.setLineWidth(2);
  doc.rect(8, 8, pw - 16, ph - 16);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.rect(12, 12, pw - 24, ph - 24);

  // Logo
  const logo = await carregarLogo(empresa?.logoUrl);
  if (logo) {
    try {
      doc.addImage(logo, "PNG", pw / 2 - 20, 18, 40, 16, undefined, "FAST");
    } catch {
      /* ignora logo inválido */
    }
  }

  let y = logo ? 46 : 34;

  doc.setTextColor(...DARK_BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text((empresa?.razaoSocial || empresa?.nomeFantasia || "").toUpperCase(), pw / 2, y, { align: "center" });
  if (empresa?.cnpj) {
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`CNPJ: ${empresa.cnpj}`, pw / 2, y, { align: "center" });
  }

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text("CERTIFICADO", pw / 2, y, { align: "center" });
  y += 7;
  doc.setTextColor(...GOLD);
  doc.setFontSize(11);
  doc.text("DE PARTICIPAÇÃO EM TREINAMENTO", pw / 2, y, { align: "center" });

  y += 16;
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Certificamos que", pw / 2, y, { align: "center" });

  y += 11;
  doc.setTextColor(...DARK_BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(dados.funcionario.toUpperCase(), pw / 2, y, { align: "center", maxWidth: pw - 60 });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(`CPF: ${fmtCpf(dados.cpf)}`, pw / 2, y, { align: "center" });

  y += 12;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  const detalhes = [
    `concluiu com aproveitamento o treinamento de ${dados.tipo.toLowerCase()}`,
    `"${dados.titulo}"${dados.cargaHoraria ? `, com carga horária de ${dados.cargaHoraria}` : ""}${
      dados.nota ? `, obtendo nota ${dados.nota}` : ""
    }, em ${fmtData(dados.concluidoEm)}.`,
  ];
  detalhes.forEach((linha) => {
    const wrapped = doc.splitTextToSize(linha, pw - 80) as string[];
    wrapped.forEach((l) => {
      doc.text(l, pw / 2, y, { align: "center" });
      y += 7;
    });
  });

  // Validação eletrônica (SHA-256) ou linha de assinatura
  if (dados.assinadoEm && dados.assinaturaHash) {
    const vy = ph - 46;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.rect(24, vy - 6, pw - 48, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...DARK_BLUE);
    doc.text("VALIDADO ELETRONICAMENTE PELO TITULAR", pw / 2, vy, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `${dados.funcionario} — CPF ${fmtCpf(dados.cpf)} — em ${new Date(dados.assinadoEm).toLocaleString("pt-BR")}${
        dados.assinaturaIp ? ` — IP ${dados.assinaturaIp}` : ""
      }`,
      pw / 2,
      vy + 6,
      { align: "center" },
    );
    doc.text("Código de verificação SHA-256:", pw / 2, vy + 12, { align: "center" });
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.text(dados.assinaturaHash, pw / 2, vy + 17, { align: "center", maxWidth: pw - 60 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(130, 130, 130);
    doc.text("Assinatura eletrônica com aceite e autenticação de senha — MP 2.200-2/2001.", pw / 2, vy + 22, { align: "center" });
    if (dados.respAssinadoEm && dados.respAssinanteNome) {
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      doc.text(
        `Responsável: ${dados.respAssinanteNome}${dados.respAssinanteCargo ? ` (${dados.respAssinanteCargo})` : ""} — assinado eletronicamente em ${new Date(dados.respAssinadoEm).toLocaleString("pt-BR")}`,
        pw / 2,
        vy - 10,
        { align: "center" },
      );
    }
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    const local2 = [empresa?.cidade, empresa?.uf].filter(Boolean).join("/");
    doc.text(
      `${local2 ? `${local2}, ` : ""}emitido em ${new Date().toLocaleDateString("pt-BR")}${
        dados.codigo ? ` — Código: ${dados.codigo}` : ""
      }`,
      pw / 2,
      ph - 12,
      { align: "center" },
    );
    return doc;
  }

  // Assinatura do responsável
  const assY = ph - 40;
  if (dados.respAssinadoEm && dados.respAssinaturaHash) {
    doc.setDrawColor(...DARK_BLUE);
    doc.setLineWidth(0.3);
    doc.line(pw / 2 - 55, assY, pw / 2 + 55, assY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...DARK_BLUE);
    doc.text(dados.respAssinanteNome || empresa?.razaoSocial || "Responsável Técnico", pw / 2, assY + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `${dados.respAssinanteCargo ? `${dados.respAssinanteCargo} — ` : ""}Assinado eletronicamente em ${new Date(dados.respAssinadoEm).toLocaleString("pt-BR")}`,
      pw / 2,
      assY + 10,
      { align: "center" },
    );
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`SHA-256: ${dados.respAssinaturaHash}`, pw / 2, assY + 14.5, { align: "center", maxWidth: pw - 60 });
    doc.setFont("helvetica", "normal");
  } else {
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(pw / 2 - 45, assY, pw / 2 + 45, assY);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(empresa?.razaoSocial || "Responsável Técnico", pw / 2, assY + 5, { align: "center" });
    doc.setFontSize(8);
    doc.text("Responsável pelo treinamento", pw / 2, assY + 10, { align: "center" });
  }

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const local = [empresa?.cidade, empresa?.uf].filter(Boolean).join("/");
  doc.text(
    `${local ? `${local}, ` : ""}emitido em ${new Date().toLocaleDateString("pt-BR")}${
      dados.codigo ? ` — Código de verificação: ${dados.codigo}` : ""
    }`,
    pw / 2,
    ph - 18,
    { align: "center" },
  );

  return doc;
}

export async function imprimirCertificadoTreinamento(
  dados: CertificadoTreinamentoDados,
  empresa?: EmpresaCertificado,
) {
  const doc = await gerarPdfCertificadoTreinamento(dados, empresa);
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}

export async function baixarCertificadoTreinamento(
  dados: CertificadoTreinamentoDados,
  empresa?: EmpresaCertificado,
) {
  const doc = await gerarPdfCertificadoTreinamento(dados, empresa);
  const nome = `certificado-${dados.funcionario.toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(nome);
}
