/** Conteúdo gravado no código de barras (Code128) e no QR Code de um produto: o próprio código do cadastro. */
export const conteudoCodigoProduto = (codigo: string) => codigo.trim();

/** Código completo do produto: código da categoria (ex.: 07.07.01) + código do cadastro (ex.: 000001).
 *  Sem categoria cadastrada, cai para o código do cadastro sozinho. */
export const codigoCompletoProduto = (codigo: string, codigoCategoria?: string) => {
  const c = codigo.trim();
  const cat = (codigoCategoria ?? "").trim().replace(/\.+$/, "");
  if (!cat) return c;
  return `${cat}.${c.replace(/^\.+/, "")}`;
};

/** Normaliza o texto lido por um leitor (USB ou câmera) para o código do produto.
 *  Aceita espaços, quebras de linha e o prefixo opcional "MAT:". */
export function lerCodigoProduto(lido: string): string {
  return lido.replace(/[\r\n\t]/g, "").trim().replace(/^MAT:/i, "").trim();
}

/** Encontra o produto pela leitura: aceita o código completo (categoria + código),
 *  o código do cadastro, e ainda ignora zeros à esquerda do código do cadastro. */
export function encontrarPorCodigo<T extends { codigo: string; codigoCompleto?: string }>(itens: T[], lido: string): T | undefined {
  const c = lerCodigoProduto(lido);
  if (!c) return undefined;
  const semZeros = (v: string) => v.replace(/^0+(?=\d)/, "");
  return itens.find(i => i.codigoCompleto === c)
    ?? itens.find(i => i.codigo === c)
    ?? itens.find(i => semZeros(i.codigo) === semZeros(c));
}
