import type { jsPDF } from "jspdf";
import fundoAsset from "@/assets/certificado-treinamento.jpg.asset.json";

const getJsPDF = async () => (await import("jspdf")).jsPDF;

export interface AssinaturaCert {
  nome?: string | null;
  cargo?: string | null;
  em?: string | null;
  hash?: string | null;
}

export interface CertificadoTreinamentoDados {
  funcionario: string;
  cpf: string;
  titulo: string;
  tipo: string;
  cargaHoraria?: string | number | null;
  realizadoEm?: string | null;
  local?: string | null;
  nota?: string | null;
  concluidoEm?: string | null;
  codigo?: string;
  assinadoEm?: string | null;
  assinaturaHash?: string | null;
  assinaturaIp?: string | null;
  instrutor?: AssinaturaCert;
  coordenacao?: AssinaturaCert;
  // compatibilidade
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

const AZUL: [number, number, number] = [22, 45, 100];

const dataLocal = (d?: string | null) => {
  if (!d) return null;
  const s = d.length === 10 ? `${d}T12:00:00` : d;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
};
const fmtData = (d?: string | null) => dataLocal(d)?.toLocaleDateString("pt-BR") ?? "";
const fmtDH = (d?: string | null) => dataLocal(d)?.toLocaleString("pt-BR") ?? "";

async function carregarImagem(url?: string): Promise<string | null> {
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
  _empresa?: EmpresaCertificado,
): Promise<jsPDF> {
  const doc = new (await getJsPDF())({ compress: true, orientation: "landscape", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(); // 297
  const ph = doc.internal.pageSize.getHeight(); // 210

  const fundo = await carregarImagem(fundoAsset.url);
  if (fundo) doc.addImage(fundo, "JPEG", 0, 0, pw, ph, undefined, "FAST");

  doc.setTextColor(...AZUL);

  // Nome
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(dados.funcionario.toUpperCase(), pw / 2, 90.5, { align: "center", maxWidth: 185 });

  // Curso
  doc.setFontSize(15);
  doc.text(dados.titulo, pw / 2, 111.5, { align: "center", maxWidth: 185 });

  // Carga horária e realizado em
  doc.setFontSize(13);
  const ch = dados.cargaHoraria != null && dados.cargaHoraria !== "" ? String(dados.cargaHoraria).replace(".", ",") : "";
  if (ch) doc.text(ch, 114, 122.5, { align: "center" });
  const realizado = fmtData(dados.realizadoEm);
  if (realizado) doc.text(realizado, 213.5, 122.5, { align: "center" });

  // Local
  doc.setFont("times", "normal");
  if (dados.local) doc.text(dados.local, 98, 156, { maxWidth: 115 });

  // Data (conclusão)
  const dc = dataLocal(dados.concluidoEm);
  if (dc) {
    doc.text(String(dc.getDate()).padStart(2, "0"), 104, 165.3, { align: "center" });
    doc.text(String(dc.getMonth() + 1).padStart(2, "0"), 126, 165.3, { align: "center" });
    doc.text(String(dc.getFullYear()), 154, 165.3, { align: "center" });
  }

  // Assinaturas
  const coord: AssinaturaCert = dados.coordenacao?.em
    ? dados.coordenacao
    : { nome: dados.respAssinanteNome, cargo: dados.respAssinanteCargo, em: dados.respAssinadoEm, hash: dados.respAssinaturaHash };
  const func: AssinaturaCert = { nome: dados.funcionario, em: dados.assinadoEm, hash: dados.assinaturaHash };

  const bloco = (a: AssinaturaCert | undefined, cx: number) => {
    if (!a?.em) return;
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...AZUL);
    doc.text(a.nome || "", cx, 177.5, { align: "center", maxWidth: 70 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text(`Assinado eletronicamente em ${fmtDH(a.em)}`, cx, 189, { align: "center" });
    if (a.hash) doc.text(`SHA-256: ${a.hash.slice(0, 32)}`, cx, 191.8, { align: "center" });
  };
  bloco(dados.instrutor, 60);
  bloco(coord, 145);
  bloco(func, 230);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${dados.codigo ? `Código de verificação: ${dados.codigo} — ` : ""}Assinaturas eletrônicas com autenticação de senha (MP 2.200-2/2001)`,
    pw / 2,
    199,
    { align: "center" },
  );

  return doc;
}

export async function imprimirCertificadoTreinamento(dados: CertificadoTreinamentoDados, empresa?: EmpresaCertificado) {
  const doc = await gerarPdfCertificadoTreinamento(dados, empresa);
  window.open(doc.output("bloburl") as unknown as string, "_blank");
}

export async function baixarCertificadoTreinamento(dados: CertificadoTreinamentoDados, empresa?: EmpresaCertificado) {
  const doc = await gerarPdfCertificadoTreinamento(dados, empresa);
  doc.save(`certificado-${dados.funcionario.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}
