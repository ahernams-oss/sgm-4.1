import type { OrdemServico } from "@/contexts/OrdensServicoContext";

export function criarOrdemServicoVazia(): OrdemServico {
  return {
    id: "", numero: 0, solicitacaoId: "", solicitacaoNumero: 0,
    nCliente: "", clienteId: "", clienteNome: "", situacao: "",
    dataInicio: "", horaInicio: "", dataTermino: "", horaTermino: "",
    prioridade: "", complexidade: "Baixa", solicitante: "", matricula: "",
    ramal: "", telefone: "", localId: "", localDescricao: "",
    pavimentoId: "", pavimentoDescricao: "", setorId: "", setorDescricao: "",
    categoria: "", servico: "", descricaoServicos: "", ressalvaAprovacao: "",
    descricaoConclusao: "", materiais: [], materiaisEstoque: [], profissionais: [],
    anexos: [], fotos: [], observacoes: [], observacoesFiscalizacao: [], bdi: 0,
    tipoOs: { cod: 0, descricao: "", sigla: "" }, operadorId: "", operadorNome: "",
    createdAt: "", historico: [], impresso: false, impressoEm: "", impressoPor: "",
    dataFaturamento: "", faturadoPor: "", faturadoEm: "",
  };
}