import { enviarWhatsApp } from "@/lib/whatsapp";
import type { Cliente } from "@/contexts/ClientesContext";
import type { Pregao, PregaoParticipante } from "@/contexts/PregaoContext";
import { formatNumeroAno } from "@/lib/formatNumero";

function telefoneFornecedor(f: Cliente | undefined): string | null {
  if (!f) return null;
  const tel = f.telefonesWhatsapp || f.telefoneCelular || f.celulares || (f.telefones && f.telefones[0]) || "";
  const digits = tel.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export async function notificarPublicacaoPregao(pregao: Pregao, fornecedores: Cliente[]) {
  const numero = formatNumeroAno(pregao.numero, pregao.createdAt);
  const msg = [
    `🔔 *Novo Pregão Eletrônico publicado*`,
    `*Nº ${numero}*`,
    `Objeto: ${pregao.objeto}`,
    `Modalidade: ${pregao.modalidade}`,
    pregao.dataInicioDisputa ? `Início da disputa: ${new Date(pregao.dataInicioDisputa).toLocaleString("pt-BR")}` : "",
    ``,
    `Acesse o Portal do Fornecedor para se credenciar.`,
  ].filter(Boolean).join("\n");

  const results: Array<{ fornecedor: string; ok: boolean }> = [];
  for (const f of fornecedores) {
    const tel = telefoneFornecedor(f);
    if (!tel) continue;
    const r = await enviarWhatsApp(tel, msg);
    results.push({ fornecedor: f.nome, ok: r.success });
  }
  return results;
}

export async function notificarHabilitacao(pregao: Pregao, participante: PregaoParticipante, fornecedor: Cliente | undefined) {
  const tel = telefoneFornecedor(fornecedor);
  if (!tel) return { success: false, error: "Telefone não cadastrado" };
  const numero = formatNumeroAno(pregao.numero, pregao.createdAt);
  const msg = [
    `📋 *Convocação para Habilitação*`,
    `Pregão ${numero}`,
    `Sua proposta foi classificada como vencedora provisória.`,
    `Envie os documentos exigidos pelo Portal do Fornecedor.`,
  ].join("\n");
  return enviarWhatsApp(tel, msg);
}

export async function notificarResultadoHomologado(pregao: Pregao, vencedores: Array<{ participante: PregaoParticipante; fornecedor: Cliente | undefined; valor: number }>) {
  const numero = formatNumeroAno(pregao.numero, pregao.createdAt);
  const results: Array<{ fornecedor: string; ok: boolean }> = [];
  for (const v of vencedores) {
    const tel = telefoneFornecedor(v.fornecedor);
    if (!tel) continue;
    const msg = [
      `🏆 *Pregão ${numero} — Homologado*`,
      `Parabéns! Você foi declarado vencedor.`,
      `Valor adjudicado: ${v.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    ].join("\n");
    const r = await enviarWhatsApp(tel, msg);
    results.push({ fornecedor: v.fornecedor?.nome || v.participante.fornecedorNome, ok: r.success });
  }
  return results;
}
