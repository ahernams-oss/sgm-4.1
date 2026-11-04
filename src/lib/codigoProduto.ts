/** Conteúdo gravado no código de barras (Code128) e no QR Code de um produto: o próprio código do cadastro. */
export const conteudoCodigoProduto = (codigo: string) => codigo.trim();

/** Normaliza o texto lido por um leitor (USB ou câmera) para o código do produto.
 *  Aceita espaços, quebras de linha e o prefixo opcional "MAT:". */
export function lerCodigoProduto(lido: string): string {
  return lido.replace(/[\r\n\t]/g, "").trim().replace(/^MAT:/i, "").trim();
}

/** Encontra o produto cujo código coincide com a leitura (ignora zeros à esquerda). */
export function encontrarPorCodigo<T extends { codigo: string }>(itens: T[], lido: string): T | undefined {
  const c = lerCodigoProduto(lido);
  if (!c) return undefined;
  const semZeros = (v: string) => v.replace(/^0+(?=\d)/, "");
  return itens.find(i => i.codigo === c) ?? itens.find(i => semZeros(i.codigo) === semZeros(c));
}
