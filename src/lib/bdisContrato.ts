export const CAMPOS_BDI_CONTRATO = [
  { chave: "bdiGeral", nome: "BDI Geral" },
  { chave: "bdiMaterial", nome: "BDI Material" },
  { chave: "bdiServicos", nome: "BDI Serviços" },
  { chave: "bdiEspecial", nome: "BDI Especial" },
] as const;

export type CampoBdiContrato = typeof CAMPOS_BDI_CONTRATO[number]["chave"];
export type BdisContrato = Partial<Record<CampoBdiContrato, string>>;

export function validarBdisContrato(valores: BdisContrato) {
  const erros: Partial<Record<CampoBdiContrato, string>> = {};
  for (const { chave, nome } of CAMPOS_BDI_CONTRATO) {
    const valor = valores[chave]?.trim() ?? "";
    if (!valor) continue;
    const numero = Number(valor.replace(",", "."));
    if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
      erros[chave] = `${nome} deve ser um percentual entre 0 e 100.`;
    }
  }
  return erros;
}