// Geração de hash SHA-256 do conteúdo essencial do Laudo de Condenação
import type { LaudoCondenacao } from "@/contexts/LaudosCondenacaoContext";

const s = (v: any) => (v === null || v === undefined ? "" : String(v));
const n = (v: any) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const arr = (v: any) => (Array.isArray(v) ? v.map((x) => s(x)) : []);

export async function gerarHashLaudo(l: Partial<LaudoCondenacao> | any): Promise<string> {
  const conteudo = JSON.stringify({
    numero: n(l.numero),
    equipamento_id: s(l.equipamento_id),
    equipamento_tag: s(l.equipamento_tag),
    equipamento_nome: s(l.equipamento_nome),
    tipo: s(l.tipo),
    marca: s(l.marca),
    modelo: s(l.modelo),
    serie: s(l.serie),
    patrimonio: s(l.patrimonio),
    ano_fabricacao: s(l.ano_fabricacao),
    data_aquisicao: s(l.data_aquisicao),
    localizacao: s(l.localizacao),
    estado_conservacao: s(l.estado_conservacao),
    data_emissao: s(l.data_emissao),
    data_inspecao: s(l.data_inspecao),
    local_inspecao: s(l.local_inspecao),
    responsavel_tecnico: s(l.responsavel_tecnico),
    registro_profissional: s(l.registro_profissional),
    historico: s(l.historico),
    insp_condicoes_fisicas: s(l.insp_condicoes_fisicas),
    insp_condicoes_eletricas: s(l.insp_condicoes_eletricas),
    insp_condicoes_mecanicas: s(l.insp_condicoes_mecanicas),
    insp_funcionalidade: s(l.insp_funcionalidade),
    motivos_condenacao: arr(l.motivos_condenacao),
    custo_reparo: n(l.custo_reparo),
    valor_residual: n(l.valor_residual),
    valor_novo_equivalente: n(l.valor_novo_equivalente),
    parecer: s(l.parecer),
    conclusao_condicoes: s(l.conclusao_condicoes),
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
