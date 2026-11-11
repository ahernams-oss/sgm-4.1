export const ABAS_FUNCIONARIOS = [
  { value: "pessoal", label: "Dados Pessoais" },
  { value: "endereco", label: "Endereço" },
  { value: "profissional", label: "Dados Profissionais" },
  { value: "bancario", label: "Dados Bancários" },
  { value: "documentos", label: "Documentos" },
  { value: "uniforme", label: "Uniforme" },
  { value: "passagem", label: "Passagem" },
  { value: "dependentes", label: "Dependentes" },
  { value: "epis", label: "EPIs" },
  { value: "nrs", label: "NRs" },
  { value: "exames", label: "Exames Periódicos" },
  { value: "ferias", label: "Férias" },
  { value: "promocoes", label: "Promoções" },
  { value: "anexos_docs", label: "Anexos" },
  { value: "pensao", label: "Pensão / Emergência" },
  { value: "observacoes", label: "Observações" },
] as const;

export const permissoesAbasFuncionarios = ABAS_FUNCIONARIOS.map(aba => ({
  key: `funcionarios.abas.${aba.value}`,
  label: aba.label,
}));

export function podeAcessarAbaFuncionario(tem: (key: string) => boolean, value: string): boolean {
  return ABAS_FUNCIONARIOS.some(aba => aba.value === value) && tem(`funcionarios.abas.${value}`);
}