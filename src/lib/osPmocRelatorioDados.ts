import type { OrdemServico } from "@/contexts/OrdensServicoContext";
import type { Equipamento } from "@/contexts/EquipamentosContext";
import type { OsPmocRow } from "@/lib/gerarPdfOsPmoc";

export const formatNumeroOsPmoc = (numero: number) => `OS-PMOC-${String(numero).padStart(4, "0")}`;

/** Usa exclusivamente a O.S. PMOC selecionada, nunca uma O.S. convencional de mesmo número. */
export function dadosOsPmoc(ordem: OsPmocRow, equipamento?: Equipamento): OrdemServico {
  return {
    id: ordem.id, numero: ordem.numero, solicitacaoId: "", solicitacaoNumero: 0,
    nCliente: "", clienteId: equipamento?.clienteId || "", clienteNome: equipamento?.clienteNome || ordem.unidade,
    situacao: ordem.status, dataInicio: ordem.data_conclusao?.slice(0, 10) || "", horaInicio: "",
    dataTermino: ordem.data_conclusao?.slice(0, 10) || "", horaTermino: "", prioridade: "", complexidade: "Baixa",
    solicitante: "", matricula: "", ramal: "", telefone: "",
    localId: equipamento?.localId || "", localDescricao: equipamento?.localDescricao || ordem.local_descricao || ordem.unidade,
    pavimentoId: equipamento?.pavimentoId || "", pavimentoDescricao: equipamento?.pavimentoDescricao || "",
    setorId: equipamento?.setorId || "", setorDescricao: equipamento?.setorDescricao || "",
    categoria: ordem.tipo, servico: ordem.tipo, descricaoServicos: ordem.descricao,
    ressalvaAprovacao: "", descricaoConclusao: "", materiais: [], materiaisEstoque: [], profissionais: [], anexos: [], fotos: [],
    observacoes: ordem.observacoes ? [{ id: ordem.id, descricao: ordem.observacoes, usuario: "", data: "" }] : [],
    observacoesFiscalizacao: [], bdi: 0, tipoOs: { cod: 0, descricao: ordem.tipo, sigla: "" },
    operadorId: "", operadorNome: ordem.tecnico_responsavel, createdAt: ordem.data_abertura,
    historico: ordem.aprovado_por && ordem.data_aprovacao
      ? [{ situacao: "Validada", data: ordem.data_aprovacao, usuario: ordem.aprovado_por }] : [],
    impresso: false, impressoEm: "", impressoPor: "", dataFaturamento: "", faturadoPor: "", faturadoEm: "",
  };
}