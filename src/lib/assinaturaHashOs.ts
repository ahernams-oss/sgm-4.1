// Geração de hash SHA-256 do conteúdo essencial da OS para garantir integridade
import type { OrdemServico } from "@/contexts/OrdensServicoContext";

const s = (v: any) => (v === null || v === undefined ? "" : String(v));
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const arr = (v: any) => (Array.isArray(v) ? v : []);
// aceita chave em camelCase ou snake_case
const pick = (o: any, camel: string, snake: string) =>
  o?.[camel] !== undefined ? o[camel] : o?.[snake];

export async function gerarHashOs(os: Partial<OrdemServico> | any): Promise<string> {
  const conteudo = JSON.stringify({
    numero: n(os.numero),
    solicitacaoNumero: n(pick(os, "solicitacaoNumero", "solicitacao_numero")),
    clienteId: s(pick(os, "clienteId", "cliente_id")),
    clienteNome: s(pick(os, "clienteNome", "cliente_nome")),
    situacao: s(os.situacao),
    dataInicio: s(pick(os, "dataInicio", "data_inicio")),
    dataTermino: s(pick(os, "dataTermino", "data_termino")),
    prioridade: s(os.prioridade),
    solicitante: s(os.solicitante),
    matricula: s(os.matricula),
    localDescricao: s(pick(os, "localDescricao", "local_descricao")),
    pavimentoDescricao: s(pick(os, "pavimentoDescricao", "pavimento_descricao")),
    setorDescricao: s(pick(os, "setorDescricao", "setor_descricao")),
    categoria: s(os.categoria),
    servico: s(os.servico),
    descricaoServicos: s(pick(os, "descricaoServicos", "descricao_servicos")),
    descricaoConclusao: s(pick(os, "descricaoConclusao", "descricao_conclusao")),
    materiais: arr(os.materiais),
    materiaisEstoque: arr(pick(os, "materiaisEstoque", "materiais_estoque")),
    profissionais: arr(os.profissionais),
    bdi: n(os.bdi),
    tipoOs: pick(os, "tipoOs", "tipo_os") ?? null,
  });
  const buffer = new TextEncoder().encode(conteudo);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function obterIpOrigem(): Promise<string> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    return j.ip || "";
  } catch {
    return "";
  }
}
