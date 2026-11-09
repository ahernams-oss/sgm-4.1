const formato = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function valorExecucaoNfse(valor: string): number {
  const numero = Number(valor.replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
}

export function somarValoresExecucaoNfse(maoObra: string, material: string): string {
  const centavos = Math.round(valorExecucaoNfse(maoObra) * 100) + Math.round(valorExecucaoNfse(material) * 100);
  return formato.format(centavos / 100);
}

export function formatarValorExecucaoNfse(valor: string): string {
  return valor.trim() ? formato.format(valorExecucaoNfse(valor)) : "";
}

export function deducoesExecucaoNfse(material: string, beneficios: string): string {
  const centavos = Math.round(valorExecucaoNfse(material) * 100) + Math.round(valorExecucaoNfse(beneficios) * 100);
  return formato.format(centavos / 100);
}

export function preencherValoresExecucaoNfse(texto: string, maoObra: string, material: string, beneficios?: string): string {
  const preencher = (atual: string, campo: string, valor: string) => {
    const trecho = new RegExp(`(${campo}\\s*(?:→|->|:|-)?\\s*R\\$\\s*)(?:[\\d.,]+|[-_]+)`, "gi");
    return atual.replace(trecho, (_, prefixo: string) => `${prefixo}${valor.trim() ? formato.format(valorExecucaoNfse(valor)) : "-------------"}`);
  };
  const atualizado = preencher(
    preencher(texto, "VALOR\\s+M[AÃ]O\\s+DE\\s+OBRA", maoObra),
    "MATERIAL\\s+APLICADO(?:\\s+E\\s+SERVI[CÇ]OS\\s+EXTRAS)?", material,
  );
  return beneficios === undefined ? atualizado : preencher(atualizado, "BENEF[IÍ]CIOS\\s+E\\s+INSUMOS", beneficios);
}
export interface RetencoesTextoNfse { inss: string; pis: string; cofins: string; csll: string }

export function preencherRetencoesNfse(texto: string, r: RetencoesTextoNfse): string {
  const preencher = (atual: string, campo: string, valor: string) => {
    const trecho = new RegExp(`(${campo}\\s*-?\\s*[\\d.,]+\\s*%\\s*(?:→|->|:|-)?\\s*R\\$\\s*)(?:[\\d.,]+|[-_]+)`, "gi");
    return atual.replace(trecho, (_, prefixo: string) => `${prefixo}${valor.trim() ? formato.format(valorExecucaoNfse(valor)) : "-----------"}`);
  };
  let t = preencher(texto, "RETEN[CÇ][AÃ]O\\s+INSS", r.inss);
  t = preencher(t, "\\bPIS", r.pis);
  t = preencher(t, "\\bCOFINS", r.cofins);
  return preencher(t, "\\bCSLL", r.csll);
}
