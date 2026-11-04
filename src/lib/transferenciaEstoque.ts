export interface ItemTransferencia {
  materialId: string;
  materialCodigo: string;
  materialDescricao: string;
  unidadeMedida: string;
  localOrigem: string;
  quantidade: number;
}

/** Valida itens de transferência contra o saldo atual; retorna lista de erros (vazia = ok). */
export function validarTransferencia(
  itens: ItemTransferencia[],
  localDestino: string,
  saldo: (materialId: string, local: string) => number,
): string[] {
  const erros: string[] = [];
  if (!localDestino.trim()) erros.push("Informe o local de destino.");
  if (!itens.length) erros.push("Informe ao menos um item com quantidade.");
  const usado = new Map<string, number>();
  for (const i of itens) {
    if (!(i.quantidade > 0)) { erros.push(`${i.materialDescricao}: quantidade inválida.`); continue; }
    if (!i.localOrigem) { erros.push(`${i.materialDescricao}: escolha o local de origem.`); continue; }
    if (i.localOrigem === localDestino) { erros.push(`${i.materialDescricao}: origem igual ao destino.`); continue; }
    const k = `${i.materialId}__${i.localOrigem}`;
    const total = (usado.get(k) ?? 0) + i.quantidade;
    usado.set(k, total);
    const disp = saldo(i.materialId, i.localOrigem);
    if (total > disp) erros.push(`${i.materialDescricao}: saldo insuficiente em ${i.localOrigem} (disponível ${disp}).`);
  }
  return erros;
}
