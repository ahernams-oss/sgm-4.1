export const SMART_ETAPAS = ["Disponível", "Em execução", "Aguardando Confirmação", "Concluída"] as const;
export type SmartEtapa = typeof SMART_ETAPAS[number];
export const SMART_MAX_FOTOS = 6;
export const SMART_MAX_BYTES = 8 * 1024 * 1024;
export interface SmartExecucao {
  id: string; atividade_id: string; equipamento_id: string | null; status: string;
  observacoes: string | null; fotos: string[]; registrado_por: string | null;
  data_execucao: string; created_at: string; smart?: boolean;
}
export function etapaSmart(status?: string): SmartEtapa {
  if (status === "Em execução") return "Em execução";
  if (status === "Pendente") return "Aguardando Confirmação";
  if (status === "Confirmada") return "Concluída";
  return "Disponível";
}
export function podeIniciarSmart(proxima?: string | null, agora = new Date()): boolean {
  if (!proxima) return true;
  const limite = new Date(`${proxima.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(limite.getTime())) return false;
  limite.setDate(limite.getDate() - 2);
  return agora >= limite;
}
export function proximaSmart(periodicidade: string, agora = new Date()): string {
  const data = new Date(agora);
  const dias: Record<string, number> = { "Diária": 1, Semanal: 7, Quinzenal: 15 };
  const meses: Record<string, number> = { Mensal: 1, Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12 };
  if (dias[periodicidade]) data.setDate(data.getDate() + dias[periodicidade]);
  else data.setMonth(data.getMonth() + (meses[periodicidade] || 1));
  return data.toISOString();
}
export function validarFotoSmart(tipo: string, bytes: number, quantidade: number): string | null {
  if (quantidade >= SMART_MAX_FOTOS) return "Máximo de seis fotos por manutenção.";
  if (!tipo.startsWith("image/")) return "Selecione uma imagem.";
  if (bytes > SMART_MAX_BYTES) return "Cada foto deve ter até 8 MB.";
  return null;
}