// Mensagens de WhatsApp enviadas a cada passo de uma Requisição de Pessoal.
// Module browser-safe: no server imports, so the same text is used by the UI and the tests.

export interface DadosRequisicaoMensagem {
  numero: number | string;
  cargoNome: string;
  unidade: string;
  status: string;
  agora: string;
  solicitante?: string;
  aprovadoPor?: string;
  observacao?: string;
}

const texto = (valor?: string) => (String(valor ?? "").trim() || "-");

export function mensagemNovaRequisicao(dados: DadosRequisicaoMensagem) {
  return (
    `*Nova Requisição de Pessoal*\n\n` +
    `RP Nº: ${dados.numero}\n` +
    `Cargo: ${texto(dados.cargoNome)}\n` +
    `Unidade: ${texto(dados.unidade)}\n` +
    `Solicitante: ${texto(dados.solicitante)}\n` +
    `Data: ${dados.agora}\n` +
    `Status: ${dados.status}`
  );
}

export function mensagemAtualizacaoStatus(dados: DadosRequisicaoMensagem) {
  return (
    `*Atualização de Requisição de Pessoal*\n\n` +
    `RP Nº: ${dados.numero}\n` +
    `Cargo: ${texto(dados.cargoNome)}\n` +
    `Unidade: ${texto(dados.unidade)}\n` +
    `Status: ${dados.status}\n` +
    (dados.aprovadoPor ? `Por: ${dados.aprovadoPor}\n` : "") +
    (dados.observacao ? `Justificativa: ${dados.observacao}\n` : "") +
    `Data: ${dados.agora}`
  );
}
