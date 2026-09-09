// Geração de hash SHA-256 do conteúdo essencial do Boletim de Medição
import type { BoletimMedicao } from "@/contexts/BoletinsMedicaoContext";

export async function gerarHashBoletim(b: Partial<BoletimMedicao>): Promise<string> {
  const conteudo = JSON.stringify({
    numero: b.numero,
    ano: b.ano,
    cliente_id: b.cliente_id,
    cliente_nome: b.cliente_nome,
    contrato_numero: b.contrato_numero,
    processo_numero: b.processo_numero,
    objeto: b.objeto,
    obra: b.obra,
    responsavel_tecnico: b.responsavel_tecnico,
    valor_total_contrato: Number(b.valor_total_contrato) || 0,
    data_emissao: b.data_emissao,
    frentes: (b.frentes || []).map((f) => ({
      nome: f.nome,
      valor_contrato: Number(f.valor_contrato) || 0,
      medicoes: (f.medicoes || []).map((m) => ({
        numero: m.numero,
        periodo_inicio: m.periodo_inicio,
        periodo_fim: m.periodo_fim,
        valor: Number(m.valor) || 0,
      })),
    })),
    observacoes: b.observacoes,
  });
  const buffer = new TextEncoder().encode(conteudo);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((x) => x.toString(16).padStart(2, "0"))
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
