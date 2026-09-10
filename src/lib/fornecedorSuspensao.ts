import type { Cliente } from "@/contexts/ClientesContext";

/**
 * Um fornecedor está suspenso quando a marcação está ativa e,
 * havendo data de término, ela ainda não passou.
 */
export function isFornecedorSuspenso(f?: Partial<Cliente> | null): boolean {
  if (!f?.suspenso) return false;
  if (!f.suspensaoAte) return true;
  const hoje = new Date().toISOString().slice(0, 10);
  return f.suspensaoAte >= hoje;
}

export function textoSuspensao(f?: Partial<Cliente> | null): string {
  if (!isFornecedorSuspenso(f)) return "";
  const partes: string[] = [];
  if (f?.suspensaoMotivo) partes.push(f.suspensaoMotivo);
  if (f?.suspensaoAte) {
    const [a, m, d] = f.suspensaoAte.split("-");
    partes.push(`até ${d}/${m}/${a}`);
  }
  if (f?.suspensaoPor) partes.push(`por ${f.suspensaoPor}`);
  return partes.join(" — ");
}
