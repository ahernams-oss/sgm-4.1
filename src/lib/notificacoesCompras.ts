import { enviarWhatsApp } from "./whatsapp";

export interface NotificarComprasInput {
  jid: string;
  clienteNome: string;
  pedido: string;
  statusLabel: string;
  tipo?: string;
  dataSolicitacao?: string;
  dataExtraLabel?: string;
  dataExtraValor?: string;
  solicitante?: string;
  prioridade?: string;
  obs?: string;
  entregaPrevista?: string;
}

const prioridadeMap: Record<string, string> = {
  Baixa: "BAIXA - 7 DIAS",
  Normal: "NORMAL - 96 HORAS",
  Alta: "ALTA - 48 HORAS",
  Urgente: "URGENTE - 24 HORAS",
};

export function formatarPrioridade(urgencia?: string): string {
  if (!urgencia) return "";
  return prioridadeMap[urgencia] || urgencia.toUpperCase();
}

export function formatarDataHora(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  } catch { return ""; }
}

export function formatarData(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  } catch { return ""; }
}

export function formatarPedido(numero: number, dataIso?: string): string {
  const ano = dataIso ? new Date(dataIso).getFullYear() : new Date().getFullYear();
  return `${numero}/${ano}`;
}

export async function notificarCompras(input: NotificarComprasInput): Promise<void> {
  const jid = (input.jid || "").trim();
  if (!jid) return;
  // Aceita JID de grupo ou número; helper enviarWhatsApp/edge function trata os dois
  const linhas: string[] = [];
  linhas.push(`*${input.clienteNome.toUpperCase()}*`, "");
  linhas.push(`PEDIDO: ${input.pedido}`, "");
  linhas.push(`STATUS: ${input.statusLabel}`, "");
  if (input.tipo) linhas.push(`Tipo de solicitação: ${input.tipo}`, "");
  if (input.dataSolicitacao) linhas.push(`Data da Solicitação: ${input.dataSolicitacao}`);
  if (input.dataExtraLabel && input.dataExtraValor) {
    linhas.push(`${input.dataExtraLabel}: ${input.dataExtraValor}`);
  }
  if (input.dataSolicitacao || (input.dataExtraLabel && input.dataExtraValor)) linhas.push("");
  if (input.solicitante) linhas.push(`Solicitante: ${input.solicitante}`, "");
  if (input.prioridade) linhas.push(`Prioridade: ${input.prioridade}`, "");
  if (input.obs) linhas.push(`Obs.: ${input.obs}`, "");
  if (input.entregaPrevista) linhas.push(`Entrega Prevista: ${input.entregaPrevista}`);
  try {
    await enviarWhatsApp(jid, linhas.join("\n"));
  } catch (e) {
    console.error("[notificarCompras] falha ao enviar WhatsApp:", e);
  }
}
