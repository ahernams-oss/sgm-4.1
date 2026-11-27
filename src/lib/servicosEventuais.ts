import { z } from "zod";

export const servicoEventualSchema = z.object({
  cliente_id: z.string().uuid("Selecione o cliente."),
  contrato_id: z.string().trim().min(1, "Selecione o contrato."),
  grupo: z.string().trim().max(500),
  subgrupo: z.string().trim().max(500),
  item: z.string().trim().min(1, "Informe o item.").max(50),
  discriminacao: z.string().trim().min(1, "Informe a discriminação.").max(10000),
  unidade: z.string().trim().min(1, "Informe a unidade.").max(50),
  quantidade: z.number().finite().nonnegative(),
  preco_unitario: z.number().finite().nonnegative(),
  citl_percentual: z.number().finite().min(0).max(100),
  referencia: z.string().trim().max(2000),
});
export type ServicoEventualEntrada = z.infer<typeof servicoEventualSchema>;

export function numeroEventual(valor: string): number {
  const texto = valor.trim().replace(/R\$\s*/g, "").replace(/\s/g, "");
  if (!texto) return 0;
  return Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
}

const centavos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function valoresEventuais(quantidade: number, preco: number, citl: number) {
  const unitarioComCitl = centavos(preco * (1 + citl / 100));
  return { unitarioComCitl, totalSemCitl: centavos(quantidade * preco), totalComCitl: centavos(quantidade * unitarioComCitl) };
}

export function contratoEventualValido(clienteId: string, contratoId: string, clientes: { id: string; contratos: { id: string }[] }[]) {
  return clientes.some(c => c.id === clienteId && c.contratos.some(ct => ct.id === contratoId));
}

export function normalizarBuscaEventual(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

export function filtrarEventuaisPorNome<T extends { item: string; discriminacao: string; grupo: string; subgrupo: string }>(itens: T[], busca: string) {
  const termo = normalizarBuscaEventual(busca);
  if (!termo) return itens;
  return itens.filter(item => normalizarBuscaEventual(`${item.item} ${item.discriminacao} ${item.grupo} ${item.subgrupo}`).includes(termo));
}

export function validarQuantidadeEventual(disponivel: number, quantidade: number) {
  if (!Number.isFinite(disponivel) || disponivel < 0) return "O saldo deste item está negativo ou inválido. Regularize o cadastro antes de adicioná-lo.";
  if (disponivel === 0) return "Este item está com saldo zerado e não pode ser adicionado.";
  if (!Number.isFinite(quantidade) || quantidade <= 0) return "Informe uma quantidade maior que zero.";
  if (quantidade > disponivel) return `A quantidade informada supera o saldo disponível (${disponivel.toLocaleString("pt-BR")}).`;
  return null;
}
