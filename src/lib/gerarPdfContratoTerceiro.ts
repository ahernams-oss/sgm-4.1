import type { ContratoTerceiro } from "@/contexts/ContratosTerceirosContext";
import type { Empresa } from "@/contexts/EmpresaContext";

import type { jsPDF } from "jspdf";
const getJsPDF = async () => (await import("jspdf")).jsPDF;

const fmtMoney = (n?: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (s?: string | null) => {
  if (!s) return "___/___/______";
  const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR");
};

const numeroAno = (numero?: number, createdAt?: string) => {
  const ano = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  return `${String(numero || 0).padStart(4, "0")}/${ano}`;
};

const diffDias = (ini?: string | null, fim?: string | null) => {
  if (!ini || !fim) return "___";
  const a = new Date(ini + "T00:00:00").getTime();
  const b = new Date(fim + "T00:00:00").getTime();
  return String(Math.max(0, Math.round((b - a) / 86400000)));
};

const dataPorExtenso = (s?: string | null) => {
  const d = s ? new Date(s + (s.length === 10 ? "T00:00:00" : "")) : new Date();
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
};

// ===== Number to Portuguese extenso (Real) =====
const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function extensoGrupo(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c) parts.push(centenas[c]);
  if (r) {
    if (r < 20) parts.push(unidades[r]);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u ? `${dezenas[d]} e ${unidades[u]}` : dezenas[d]);
    }
  }
  return parts.join(" e ");
}

function extensoInt(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (milhoes) parts.push(`${milhoes === 1 ? "um milhão" : extensoGrupo(milhoes) + " milhões"}`);
  if (milhares) parts.push(`${milhares === 1 ? "mil" : extensoGrupo(milhares) + " mil"}`);
  if (resto) parts.push(extensoGrupo(resto));
  return parts.join(" e ");
}

function valorExtenso(v: number): string {
  const inteiro = Math.floor(v);
  const centavos = Math.round((v - inteiro) * 100);
  const partes: string[] = [];
  if (inteiro > 0) partes.push(`${extensoInt(inteiro)} ${inteiro === 1 ? "real" : "reais"}`);
  if (centavos > 0) partes.push(`${extensoInt(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (!partes.length) return "zero reais";
  const texto = partes.join(" e ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ===== PDF =====
export async function gerarPdfContratoTerceiro(c: ContratoTerceiro, empresa?: Empresa) {
  const doc = new (await getJsPDF())({ compress: true, unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 20;
  const mr = 20;
  const contentW = pw - ml - mr;
  let y = 20;

  const ensureSpace = async (need: number) => {
    if (y + need > ph - 25) {
      doc.addPage();
      y = 20;
      await drawHeader();
    }
  };

  const drawHeader = async () => {
    const logoUrl = (empresa as any)?.logoUrl;
    if (logoUrl) {
      try {
        const res = await fetch(logoUrl);
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result as string);
          r.readAsDataURL(blob);
        });
        const ext = (dataUrl.match(/data:image\/(\w+);/)?.[1] || "PNG").toUpperCase();
        doc.addImage(dataUrl, ext, ml, 8, 35, 12);
      } catch { /* ignore */ }
    }
    y = 25;
  };

  const writeParagraph = async (text: string, opts: { bold?: boolean; align?: "left" | "center" | "justify"; size?: number; spacingAfter?: number } = {}) => {
    const size = opts.size ?? 10;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, contentW);
    const lineH = size * 0.45;
    await ensureSpace(lines.length * lineH);
    if (opts.align === "center") {
      doc.text(lines, pw / 2, y, { align: "center" });
    } else if (opts.align === "justify") {
      // Manual justify
      lines.forEach((ln: string, i: number) => {
        if (i === lines.length - 1) {
          doc.text(ln, ml, y + i * lineH);
        } else {
          const words = ln.split(" ").filter(Boolean);
          if (words.length <= 1) {
            doc.text(ln, ml, y + i * lineH);
            return;
          }
          const textW = doc.getTextWidth(words.join(" "));
          const spaceExtra = (contentW - textW) / (words.length - 1);
          let x = ml;
          words.forEach((w, j) => {
            doc.text(w, x, y + i * lineH);
            x += doc.getTextWidth(w) + doc.getTextWidth(" ") + spaceExtra;
            void j;
          });
        }
      });
    } else {
      doc.text(lines, ml, y);
    }
    y += lines.length * lineH + (opts.spacingAfter ?? 2);
  };

  const writeMixed = async (segments: { text: string; bold?: boolean }[]) => {
    // Render inline mixed bold/normal as a justified-ish paragraph by joining text
    // but preserving bold variable values. Implementation: build wrapped lines manually.
    const size = 10;
    doc.setFontSize(size);
    const lineH = size * 0.45;
    // tokens: words tagged with bold
    const tokens: { word: string; bold: boolean }[] = [];
    segments.forEach((s) => {
      const parts = s.text.split(/(\s+)/).filter((p) => p.length > 0);
      parts.forEach((p) => {
        if (/^\s+$/.test(p)) {
          if (tokens.length) tokens[tokens.length - 1].word += " ";
        } else {
          tokens.push({ word: p, bold: !!s.bold });
        }
      });
    });

    const measure = (t: { word: string; bold: boolean }) => {
      doc.setFont("helvetica", t.bold ? "bold" : "normal");
      return doc.getTextWidth(t.word);
    };

    const lines: { word: string; bold: boolean }[][] = [];
    let current: { word: string; bold: boolean }[] = [];
    let currentW = 0;
    tokens.forEach((t) => {
      const w = measure(t);
      if (currentW + w > contentW && current.length) {
        lines.push(current);
        current = [];
        currentW = 0;
      }
      current.push(t);
      currentW += w;
    });
    if (current.length) lines.push(current);

    await ensureSpace(lines.length * lineH + 2);
    lines.forEach((ln, i) => {
      let x = ml;
      ln.forEach((t) => {
        doc.setFont("helvetica", t.bold ? "bold" : "normal");
        doc.text(t.word, x, y + i * lineH);
        x += doc.getTextWidth(t.word);
      });
    });
    y += lines.length * lineH + 3;
  };

  // ===== Render =====
  await drawHeader();

  // Número do contrato
  await writeParagraph(`CONTRATO Nº: ${numeroAno(c.numero, c.created_at)}`, { bold: true, align: "center", size: 11, spacingAfter: 6 });

  // CONTRATANTE (fixed Lasant) — based on template
  await writeMixed([
    { text: "LASANT CONSTRUÇÕES LTDA", bold: true },
    { text: ", pessoa jurídica de direito privado, inscrita no CNPJ sob nº 16.432.951/0001-70, com sede na Rua das Azaleias, nº 213, Vila Valqueire, Rio de Janeiro/RJ, neste ato representada pelo seu sócio Jorge de Oliveira Santos Junior, doravante denominada simplesmente " },
    { text: "CONTRATANTE", bold: true },
    { text: "." },
  ]);

  // CONTRATADA
  await writeParagraph("CONTRATADA:", { bold: true, spacingAfter: 2 });
  const fornEnd = (c as any).fornecedor_endereco || "_______________________";
  await writeMixed([
    { text: c.fornecedor_nome || "_______________________", bold: true },
    { text: `, pessoa jurídica de direito privado, inscrita no CNPJ sob nº ${c.fornecedor_cnpj || "___"}, com sede em ${fornEnd}, doravante denominada simplesmente CONTRATADA.` },
  ]);

  await writeParagraph("As partes acima identificadas têm, entre si, justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições seguintes:", { align: "justify", spacingAfter: 4 });

  // CLAUSULA 1 - OBJETO
  await writeParagraph("CLÁUSULA 1ª – DO OBJETO", { bold: true, spacingAfter: 2 });
  await writeMixed([
    { text: "O presente contrato tem por objeto a " },
    { text: c.objeto || "_______________________", bold: true },
    { text: ". Os serviços serão realizados com materiais e técnicas adequadas, visando garantir uniformidade, aderência, durabilidade e padrão, conforme especificações acordadas entre as partes." },
  ]);

  // CLAUSULA 2 - PRAZO
  await writeParagraph("CLÁUSULA 2ª – DO PRAZO", { bold: true, spacingAfter: 2 });
  await writeParagraph(
    `O prazo para execução dos serviços será de ${diffDias(c.data_inicio, c.data_fim)} dias, com início em ${fmtDate(c.data_inicio)} e término previsto em ${fmtDate(c.data_fim)}, podendo ser prorrogado mediante acordo entre as partes.`,
    { align: "justify", spacingAfter: 4 },
  );

  // CLAUSULA 3 - VALOR
  await writeParagraph("CLÁUSULA 3ª – DO VALOR E FORMA DE PAGAMENTO", { bold: true, spacingAfter: 2 });
  await writeParagraph(
    `O valor global estimado do presente contrato é de ${fmtMoney(c.valor)} (${valorExtenso(Number(c.valor) || 0)}), correspondente à execução integral dos serviços descritos na Cláusula 1ª.`,
    { align: "justify" },
  );
  await writeParagraph("Os pagamentos pelos serviços executados serão realizados de acordo com as medições dos serviços efetivamente prestado, previamente conferidos e aprovados pela CONTRATANTE.", { align: "justify" });
  await writeParagraph("As medições deverão ser apresentadas pela CONTRATADA conforme os critérios operacionais definidos pela CONTRATANTE, contendo o detalhamento dos serviços executados no período correspondente.", { align: "justify" });
  await writeParagraph("Os pagamentos ocorrerão nos dias 15 (quinze) e 25 (vinte e cinco) de cada mês, observando-se a data de entrega da medição e a respectiva aprovação pela CONTRATANTE.", { align: "justify" });
  await writeMixed([
    { text: "Parágrafo Primeiro: ", bold: true },
    { text: "As medições entregues e aprovadas dentro dos prazos operacionais da CONTRATANTE serão incluídas no ciclo de pagamento subsequente correspondente." },
  ]);
  await writeMixed([
    { text: "Parágrafo Segundo: ", bold: true },
    { text: "Havendo divergência na medição apresentada, a CONTRATANTE poderá solicitar correções, ficando o pagamento suspenso até a regularização das inconsistências identificadas." },
  ]);

  // CLAUSULA 4
  await writeParagraph("CLÁUSULA 4ª – DAS OBRIGAÇÕES DA CONTRATADA", { bold: true, spacingAfter: 2 });
  await writeParagraph("A CONTRATADA se compromete a:", { spacingAfter: 2 });
  const obrigContratada = [
    "I – Executar os serviços com zelo, qualidade técnica, prazo estabelecido pelo contratante e dentro das normas aplicáveis;",
    "II – Fornecer mão de obra, ferramentas e equipamentos necessários, salvo disposição em contrário;",
    "III – Cumprir os prazos acordados;",
    "IV – Responsabilizar-se integralmente por encargos trabalhistas, previdenciários, fiscais e comerciais decorrentes da execução dos serviços.",
    "V – O contratado se obriga a manter o sigilo sobre as operações, estratégias, matérias e informações da contratante, mesmo após a conclusão do serviço. Não podendo também ser contratado por qualquer outra empresa pública ou privada para executar o serviço no mesmo local designado pelo contratante.",
    "VI – Os materiais, dados, informações inerentes ao contratante ou seus clientes deverão ser utilizados pela contratada ou por seus associados, estritamente para o cumprimento dos serviços solicitados pelo contratante, sendo proibido a comercialização ou para outros fins diversos da prestação do serviço deste contrato.",
    "VII – O contratado deve fornecer todos os documentos fiscais e pagamentos gerais referente aos seus funcionários à contratante mensalmente.",
    "VIII – Fiscalizar seus funcionários durante o período trabalhado para que façam o correto e regular uso do EPI´S e equipamentos de segurança.",
  ];
  for (const t of obrigContratada) await writeParagraph(t, { align: "justify", spacingAfter: 1.5 });

  // CLAUSULA 5
  await writeParagraph("CLÁUSULA 5ª – DAS OBRIGAÇÕES DA CONTRATANTE", { bold: true, spacingAfter: 2 });
  await writeParagraph("A CONTRATANTE se compromete a:", { spacingAfter: 2 });
  for (const t of [
    "I – Efetuar os pagamentos conforme estipulado;",
    "II – Fornecer acesso ao local da execução dos serviços;",
    "III – Disponibilizar materiais, informações e condições necessárias para execução dos serviços.",
  ]) await writeParagraph(t, { align: "justify", spacingAfter: 1.5 });

  // CLAUSULA 6 - RESCISAO
  await writeParagraph("CLÁUSULA 6ª – DA RESCISÃO", { bold: true, spacingAfter: 2 });
  await writeParagraph("O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 dias, ou imediatamente em caso de descumprimento de qualquer cláusula contratual.", { align: "justify" });
  await writeMixed([
    { text: "Parágrafo Primeiro: ", bold: true },
    { text: "Caso a parte rescinda o contrato imotivadamente antes do prazo estabelecido de aviso prévio de 30 dias, deverá pagar uma multa correspondente 20% (vinte por cento) do valor da medição pendente até o fim do contrato." },
  ]);
  await writeMixed([
    { text: "Parágrafo Segundo: ", bold: true },
    { text: "Haverá rescisão imediata do contrato, independentemente de aviso prévio, nos casos de:" },
  ]);
  for (const t of [
    "a) Descumprimento de normas de segurança;",
    "b) Utilização irregular de mão de obra;",
    "c) Inadimplemento de obrigações trabalhistas, previdenciárias ou fiscais;",
    "d) Quebra de sigilo ou uso indevido de informações da CONTRATANTE ou de seus clientes;",
    "e) Reincidência em falhas operacionais ou contratuais.",
  ]) await writeParagraph(t, { align: "justify", spacingAfter: 1.5 });
  await writeMixed([
    { text: "Parágrafo Terceiro: ", bold: true },
    { text: "A aplicação das penalidades previstas nesta cláusula não exclui a responsabilidade da CONTRATADA por eventuais perdas e danos causados à CONTRATANTE ou a terceiros." },
  ]);

  // CLAUSULA 7
  await writeParagraph("CLÁUSULA 7ª – DAS PENALIDADES", { bold: true, spacingAfter: 2 });
  await writeParagraph("O descumprimento de quaisquer obrigações previstas neste contrato poderá sujeitar a CONTRATADA, conforme a gravidade da infração, às seguintes penalidades:", { align: "justify" });
  for (const t of [
    "I – Advertência formal;",
    "II – Suspensão temporária de pagamentos até a regularização das pendências contratuais, trabalhistas, fiscais ou operacionais;",
    "III – Multa compensatória correspondente a até 10% (dez por cento) do valor da medição pendente ou do valor total do contrato, conforme a natureza da infração;",
    "IV – Rescisão antecipada do contrato com multa estabelecida na cláusula 6ª.",
  ]) await writeParagraph(t, { align: "justify", spacingAfter: 1.5 });
  await writeMixed([
    { text: "Parágrafo Único: ", bold: true },
    { text: "A tolerância eventual da CONTRATANTE quanto ao descumprimento de obrigações contratuais não implicará novação ou renúncia de direitos." },
  ]);

  // CLAUSULA 8 - FORO
  await writeParagraph("CLÁUSULA 8ª – DO FORO", { bold: true, spacingAfter: 2 });
  await writeParagraph("Fica eleito o foro da comarca do Rio de Janeiro/RJ, com renúncia de qualquer outro, por mais privilegiado que seja, para dirimir eventuais controvérsias oriundas deste contrato.", { align: "justify" });
  await writeParagraph("E por estarem justas e contratadas, firmam o presente instrumento em duas vias de igual teor.", { align: "justify", spacingAfter: 6 });

  // Local e data
  await writeParagraph(`Rio de Janeiro/RJ, ${dataPorExtenso(c.data_inicio || undefined)}`, { align: "center", spacingAfter: 14 });

  // Assinaturas CONTRATANTE / CONTRATADA
  await ensureSpace(30);
  const colW = contentW / 2 - 5;
  doc.line(ml, y, ml + colW, y);
  doc.line(pw - mr - colW, y, pw - mr, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("LASANT CONSTRUÇÕES LTDA", ml + colW / 2, y, { align: "center" });
  doc.text(c.fornecedor_nome || "FORNECEDOR", pw - mr - colW / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text("CONTRATANTE", ml + colW / 2, y, { align: "center" });
  doc.text("CONTRATADA", pw - mr - colW / 2, y, { align: "center" });
  y += 14;

  // Testemunhas
  await ensureSpace(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TESTEMUNHA 1", ml, y);
  doc.text("TESTEMUNHA 2", pw - mr - colW, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("NOME: ____________________________", ml, y);
  doc.text("NOME: ____________________________", pw - mr - colW, y);
  y += 5;
  doc.text("CPF:  ____________________________", ml, y);
  doc.text("CPF:  ____________________________", pw - mr - colW, y);

  doc.save(`Contrato_${numeroAno(c.numero, c.created_at).replace("/", "-")}.pdf`);
}
