// Geração de hash SHA-256 do conteúdo essencial do RDO para garantir integridade
import type { Rdo } from "@/contexts/RdosContext";

export async function gerarHashRdo(rdo: Partial<Rdo>): Promise<string> {
  const conteudo = JSON.stringify({
    numero: rdo.numero,
    data_rdo: rdo.data_rdo,
    cliente_id: rdo.cliente_id,
    cliente_nome: rdo.cliente_nome,
    obra: rdo.obra,
    responsavel: rdo.responsavel,
    clima_manha: rdo.clima_manha,
    clima_tarde: rdo.clima_tarde,
    clima_noite: rdo.clima_noite,
    condicao_manha: rdo.condicao_manha,
    condicao_tarde: rdo.condicao_tarde,
    condicao_noite: rdo.condicao_noite,
    efetivo: rdo.efetivo,
    equipamentos: rdo.equipamentos,
    atividades: rdo.atividades,
    avanco_fisico_geral: rdo.avanco_fisico_geral,
    ocorrencias: rdo.ocorrencias,
    observacoes: rdo.observacoes,
  });
  const buffer = new TextEncoder().encode(conteudo);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
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
