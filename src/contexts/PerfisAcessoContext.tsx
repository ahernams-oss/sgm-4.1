import { createContext, useContext, ReactNode, type Context } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";

const PERFIS_QK = ["perfis_acesso"] as const;

export interface PermissaoModulo {
  key: string;
  label: string;
}

export interface GrupoPermissao {
  grupo: string;
  modulos: {
    key: string;
    label: string;
    acoes?: PermissaoModulo[];
    statusTransicoes?: PermissaoModulo[];
    flags?: PermissaoModulo[];
  }[];
}

export const MODULOS_SISTEMA: GrupoPermissao[] = [
  {
    grupo: "Gestão de Pessoas",
    modulos: [
      {
        key: "dashboard_gp",
        label: "Dashboard",
        acoes: [
          { key: "dashboard_gp.visualizar", label: "Pode Visualizar Dashboard de RH" },
          { key: "dashboard_gp.exportar_pdf", label: "Pode Exportar PDF do Dashboard" },
        ],
      },
      {
        key: "requisicao_colaboradores",
        label: "Requisição de Pessoal",
        acoes: [
          { key: "requisicao_colaboradores.criar", label: "Pode Criar Requisição de Pessoal" },
          { key: "requisicao_colaboradores.editar", label: "Pode Editar Requisição de Pessoal" },
          { key: "requisicao_colaboradores.excluir", label: "Pode Excluir Requisição de Pessoal" },
          { key: "requisicao_colaboradores.exportar_pdf", label: "Pode Exportar PDF da Requisição" },
        ],
        statusTransicoes: [
          { key: "requisicao_colaboradores.status.pendente", label: "Pode Marcar Requisição como Pendente" },
          { key: "requisicao_colaboradores.status.em_analise", label: "Pode Colocar Requisição em Análise" },
          { key: "requisicao_colaboradores.status.aprovada", label: "Pode Aprovar Requisição" },
          { key: "requisicao_colaboradores.status.reprovada", label: "Pode Reprovar Requisição" },
          { key: "requisicao_colaboradores.status.concluida", label: "Pode Concluir Requisição" },
          { key: "requisicao_colaboradores.status.suspensa", label: "Pode Suspender Requisição Aprovada" },
        ],
      },
      {
        key: "processos_seletivos",
        label: "Processos Seletivos",
        acoes: [
          { key: "processos_seletivos.criar", label: "Pode Iniciar Processo Seletivo" },
          { key: "processos_seletivos.editar", label: "Pode Editar Processo Seletivo" },
          { key: "processos_seletivos.adicionar_candidato", label: "Pode Adicionar Candidato" },
          { key: "processos_seletivos.avaliar_candidato", label: "Pode Avaliar Candidato" },
        ],
        statusTransicoes: [
          { key: "processos_seletivos.status.pendente", label: "Pode Marcar Candidato como Pendente" },
          { key: "processos_seletivos.status.aprovado", label: "Pode Aprovar Candidato" },
          { key: "processos_seletivos.status.reprovado", label: "Pode Reprovar Candidato" },
          { key: "processos_seletivos.status.neutro", label: "Pode Marcar Candidato como Neutro" },
        ],
        flags: [
          { key: "processos_seletivos.flag.entrevista_psicologica", label: "Pode Conduzir Entrevista Psicológica" },
          { key: "processos_seletivos.flag.entrevista_tecnica", label: "Pode Conduzir Entrevista Técnica" },
          { key: "processos_seletivos.flag.liberacao", label: "Pode Liberar Candidato" },
          { key: "processos_seletivos.flag.contratacao", label: "Pode Efetivar Contratação" },
        ],
      },
      {
        key: "funcionarios",
        label: "Funcionários",
        acoes: [
          { key: "funcionarios.criar", label: "Pode Cadastrar Funcionário" },
          { key: "funcionarios.editar", label: "Pode Editar Funcionário" },
          { key: "funcionarios.excluir", label: "Pode Excluir Funcionário" },
          { key: "funcionarios.exportar_pdf", label: "Pode Exportar PDF de Funcionário" },
          { key: "funcionarios.gerenciar_epis", label: "Pode Gerenciar EPIs do Funcionário" },
          { key: "funcionarios.enviar_link_recebimento_epi", label: "Pode Enviar Link de Recebimento de EPI (Facial)" },
          { key: "funcionarios.gerenciar_nrs", label: "Pode Gerenciar NRs do Funcionário" },
          { key: "funcionarios.gerenciar_lancamentos", label: "Pode Gerenciar Lançamentos (advertências, etc.)" },
          { key: "funcionarios.gerenciar_exames", label: "Pode Gerenciar Exames Periódicos" },
          { key: "funcionarios.gerenciar_promocoes", label: "Pode Gerenciar Promoções" },
          { key: "funcionarios.aprovar_promocoes", label: "Pode Aprovar Promoções (com senha)" },
          { key: "funcionarios.transferir_cliente", label: "Pode Transferir Cliente/Unidade (com senha)" },
        ],
        statusTransicoes: [
          { key: "funcionarios.status.ativo", label: "Pode Marcar Funcionário como Ativo" },
          { key: "funcionarios.status.inativo", label: "Pode Marcar Funcionário como Inativo" },
          { key: "funcionarios.status.ferias", label: "Pode Colocar Funcionário em Férias" },
          { key: "funcionarios.status.afastado", label: "Pode Afastar Funcionário" },
        ],
        flags: [
          { key: "funcionarios.flag.pcd", label: "Pode Gerenciar Funcionários PCD" },
          { key: "funcionarios.flag.dependentes", label: "Pode Gerenciar Dependentes" },
          { key: "funcionarios.flag.passagens", label: "Pode Gerenciar Passagens" },
        ],
      },
      {
        key: "epi_recebimento_facial",
        label: "Recebimento de EPIs (Facial)",
        acoes: [
          { key: "epi_recebimento_facial.visualizar", label: "Pode Visualizar Relatório de Recebimento Facial" },
          { key: "epi_recebimento_facial.exportar", label: "Pode Exportar Relatório de Recebimento Facial" },
        ],
      },
      {
        key: "mapa_funcionarios",
        label: "Mapa de Funcionários",
        acoes: [
          { key: "mapa_funcionarios.visualizar", label: "Pode Visualizar Mapa de Funcionários" },
          { key: "mapa_funcionarios.exportar_pdf", label: "Pode Exportar PDF do Mapa" },
          { key: "mapa_funcionarios.exportar_excel", label: "Pode Exportar Excel do Mapa" },
        ],
      },
      {
        key: "avaliacoes_desempenho",
        label: "Avaliações de Desempenho",
        acoes: [
          { key: "avaliacoes_desempenho.visualizar", label: "Pode Visualizar Avaliações" },
          { key: "avaliacoes_desempenho.criar", label: "Pode Lançar Avaliação" },
          { key: "avaliacoes_desempenho.editar", label: "Pode Editar Avaliação" },
          { key: "avaliacoes_desempenho.excluir", label: "Pode Excluir Avaliação" },
        ],
      },
      {
        key: "rh_holerites",
        label: "Holerites (Importação e Processados)",
        acoes: [
          { key: "rh_holerites.importar", label: "Pode Importar Holerites (PDF/Excel)" },
          { key: "rh_holerites.processar", label: "Pode Processar Lote de Holerites" },
          { key: "rh_holerites.publicar", label: "Pode Publicar/Despublicar Holerites no Portal" },
          { key: "rh_holerites.imprimir", label: "Pode Imprimir/Baixar PDF de Holerites" },
        ],
      },
      {
        key: "rh_treinamentos",
        label: "Treinamentos",
        acoes: [
          { key: "rh_treinamentos.criar", label: "Pode Cadastrar Treinamento" },
          { key: "rh_treinamentos.editar", label: "Pode Editar Treinamento" },
          { key: "rh_treinamentos.excluir", label: "Pode Excluir Treinamento" },
          { key: "rh_treinamentos.assinar_certificado", label: "Pode Assinar Certificado Eletronicamente" },
          { key: "rh_treinamentos.imprimir_certificado", label: "Pode Imprimir/Baixar Certificado (PDF)" },
        ],
      },
      {
        key: "rh_solicitacoes_portal",
        label: "Solicitações do Portal (RH)",
        acoes: [
          { key: "rh_solicitacoes_portal.visualizar", label: "Pode Visualizar Solicitações do Portal" },
          { key: "rh_solicitacoes_portal.responder", label: "Pode Responder/Concluir Solicitações" },
        ],
      },
      {
        key: "epis_devolucoes",
        label: "Devolução de EPIs",
        acoes: [
          { key: "epis_devolucoes.registrar", label: "Pode Registrar Devolução de EPI" },
          { key: "epis_devolucoes.exportar", label: "Pode Exportar Relatório de Devoluções" },
        ],
      },
    ],
  },
  {
    grupo: "Compras e Suprimentos",
    modulos: [
      {
        key: "dashboard_compras",
        label: "Dashboard Compras",
        acoes: [
          { key: "dashboard_compras.visualizar", label: "Pode Visualizar Dashboard de Compras" },
        ],
      },
      {
        key: "requisicoes_compras",
        label: "Requisições de Compras (RCS)",
        acoes: [
          { key: "requisicoes_compras.criar", label: "Pode Criar RCS" },
          { key: "requisicoes_compras.editar", label: "Pode Editar RCS" },
          { key: "requisicoes_compras.excluir", label: "Pode Excluir RCS" },
          { key: "requisicoes_compras.anexar", label: "Pode Gerenciar Anexos da RCS" },
        ],
        statusTransicoes: [
          { key: "requisicoes_compras.status.rascunho", label: "Pode Salvar RCS como Rascunho" },
          { key: "requisicoes_compras.status.enviada", label: "Pode Enviar RCS" },
          { key: "requisicoes_compras.status.em_cotacao", label: "Pode Colocar RCS em Cotação" },
          { key: "requisicoes_compras.status.aguardando_aprovacao", label: "Pode Encaminhar RCS para Aprovação" },
          { key: "requisicoes_compras.status.aprovada", label: "Pode Aprovar RCS" },
          { key: "requisicoes_compras.status.reprovada", label: "Pode Reprovar RCS" },
          { key: "requisicoes_compras.status.pedido_emitido", label: "Pode Emitir Pedido a partir da RCS" },
          { key: "requisicoes_compras.status.em_entrega", label: "Pode Marcar RCS em Entrega" },
          { key: "requisicoes_compras.status.recebida_parcial", label: "Pode Marcar RCS como Recebida Parcial" },
          { key: "requisicoes_compras.status.recebida", label: "Pode Marcar RCS como Recebida" },
          { key: "requisicoes_compras.status.concluida", label: "Pode Concluir RCS" },
          { key: "requisicoes_compras.status.cancelada", label: "Pode Cancelar RCS" },
        ],
        flags: [
          { key: "requisicoes_compras.flag.urgencia_alta", label: "Pode Marcar RCS como Urgência Alta" },
          { key: "requisicoes_compras.flag.urgencia_urgente", label: "Pode Marcar RCS como Urgente" },
        ],
      },
      {
        key: "cotacoes",
        label: "Cotações",
        acoes: [
          { key: "cotacoes.criar", label: "Pode Criar Cotação" },
          { key: "cotacoes.editar", label: "Pode Editar Cotação" },
          { key: "cotacoes.adicionar_proposta", label: "Pode Adicionar Proposta de Fornecedor" },
          { key: "cotacoes.editar_proposta", label: "Pode Editar Proposta de Fornecedor" },
          { key: "cotacoes.remover_proposta", label: "Pode Remover Proposta de Fornecedor" },
          { key: "cotacoes.finalizar", label: "Pode Finalizar Cotação" },
          { key: "cotacoes.enviar_convite", label: "Pode Enviar Convite a Fornecedor" },
        ],
        statusTransicoes: [
          { key: "cotacoes.status.em_andamento", label: "Pode Manter Cotação Em Andamento" },
          { key: "cotacoes.status.aguardando_aprovacao", label: "Pode Encaminhar Cotação para Aprovação" },
          { key: "cotacoes.status.finalizada", label: "Pode Finalizar Cotação" },
          { key: "cotacoes.status.cancelada", label: "Pode Cancelar Cotação" },
        ],
      },
      {
        key: "pedidos_compra",
        label: "Ordens de Compra (PC)",
        acoes: [
          { key: "pedidos_compra.criar", label: "Pode Criar Ordem de Compra" },
          { key: "pedidos_compra.editar", label: "Pode Editar Ordem de Compra" },
          { key: "pedidos_compra.cancelar", label: "Pode Cancelar Ordem de Compra" },
        ],
        statusTransicoes: [
          { key: "pedidos_compra.status.emitido", label: "Pode Emitir PC" },
          { key: "pedidos_compra.status.comprado", label: "Pode Marcar PC como Comprado" },
          { key: "pedidos_compra.status.em_entrega", label: "Pode Marcar PC em Entrega" },
          { key: "pedidos_compra.status.entregue_parcial", label: "Pode Marcar PC como Entregue Parcial" },
          { key: "pedidos_compra.status.entregue", label: "Pode Marcar PC como Entregue" },
          { key: "pedidos_compra.status.cancelado", label: "Pode Cancelar PC" },
        ],
      },
      {
        key: "recebimento",
        label: "Recebimento",
        acoes: [
          { key: "recebimento.registrar", label: "Pode Registrar Recebimento" },
          { key: "recebimento.anexar_nf", label: "Pode Anexar Nota Fiscal" },
        ],
        flags: [
          { key: "recebimento.flag.total", label: "Pode Registrar Recebimento Total" },
          { key: "recebimento.flag.parcial", label: "Pode Registrar Recebimento Parcial" },
        ],
      },
      {
        key: "estoque",
        label: "Estoque",
        acoes: [
          { key: "estoque.registrar_entrada", label: "Pode Registrar Entrada de Estoque" },
          { key: "estoque.registrar_saida", label: "Pode Registrar Saída de Estoque" },
          { key: "estoque.registrar_ajuste", label: "Pode Registrar Ajuste de Estoque" },
          { key: "estoque.criar_inventario", label: "Pode Criar Inventário" },
          { key: "estoque.finalizar_inventario", label: "Pode Finalizar Inventário" },
          { key: "estoque.transferir_locais", label: "Pode Transferir entre Locais" },
        ],
        flags: [
          { key: "estoque.flag.alerta_minimo", label: "Pode Visualizar Alertas de Estoque Mínimo" },
        ],
      },
      {
        key: "categorias_compras",
        label: "Categorias de Compras",
        acoes: [
          { key: "categorias_compras.criar", label: "Pode Criar Categoria de Compras" },
          { key: "categorias_compras.editar", label: "Pode Editar Categoria de Compras" },
          { key: "categorias_compras.excluir", label: "Pode Excluir Categoria de Compras" },
        ],
      },
      {
        key: "materiais_servicos",
        label: "Materiais e Serviços",
        acoes: [
          { key: "materiais_servicos.criar", label: "Pode Cadastrar Material/Serviço" },
          { key: "materiais_servicos.editar", label: "Pode Editar Material/Serviço" },
          { key: "materiais_servicos.excluir", label: "Pode Excluir Material/Serviço" },
          { key: "materiais_servicos.exportar", label: "Pode Exportar Relatório de Materiais/Serviços" },
        ],
      },
      {
        key: "fabricantes",
        label: "Fabricantes",
        acoes: [
          { key: "fabricantes.criar", label: "Pode Cadastrar Fabricante" },
          { key: "fabricantes.editar", label: "Pode Editar Fabricante" },
          { key: "fabricantes.excluir", label: "Pode Excluir Fabricante" },
        ],
      },
      {
        key: "pregao",
        label: "Pregão Eletrônico",
        acoes: [
          { key: "pregao.criar", label: "Pode Criar Pregão" },
          { key: "pregao.editar", label: "Pode Editar Pregão" },
          { key: "pregao.excluir", label: "Pode Excluir Pregão" },
          { key: "pregao.gerenciar_itens", label: "Pode Gerenciar Itens do Pregão" },
          { key: "pregao.gerenciar_participantes", label: "Pode Gerenciar Participantes/Fornecedores" },
          { key: "pregao.gerenciar_habilitacao", label: "Pode Gerenciar Habilitação" },
          { key: "pregao.sala_disputa", label: "Pode Operar a Sala de Disputa (Lances)" },
          { key: "pregao.exportar_ata", label: "Pode Exportar Ata/Resultado (PDF)" },
        ],
      },
    ],
  },
  {
    grupo: "Cadastros",
    modulos: [
      {
        key: "clientes",
        label: "Clientes",
        acoes: [
          { key: "clientes.criar", label: "Cadastrar cliente" },
          { key: "clientes.editar", label: "Editar cliente" },
          { key: "clientes.excluir", label: "Excluir cliente" },
          { key: "clientes.gerenciar_locais", label: "Gerenciar locais" },
          { key: "clientes.gerenciar_contratos", label: "Gerenciar contratos" },
          { key: "clientes.importar", label: "Importar clientes" },
          { key: "clientes.ver_valor_folha", label: "Visualizar Valor Folha (Faturamento)" },
        ],
      },
      {
        key: "fornecedores",
        label: "Fornecedores",
        acoes: [
          { key: "fornecedores.criar", label: "Cadastrar fornecedor" },
          { key: "fornecedores.editar", label: "Editar fornecedor" },
          { key: "fornecedores.excluir", label: "Excluir fornecedor" },
          { key: "fornecedores.importar", label: "Importar fornecedores" },
        ],
      },
      {
        key: "cargos",
        label: "Cargos",
        acoes: [
          { key: "cargos.criar", label: "Cadastrar cargo" },
          { key: "cargos.editar", label: "Editar cargo" },
          { key: "cargos.excluir", label: "Excluir cargo" },
          { key: "cargos.gerenciar_salarios", label: "Gerenciar salários" },
          { key: "cargos.gerenciar_nrs", label: "Gerenciar NRs" },
          { key: "cargos.gerenciar_anexos", label: "Gerenciar anexos" },
        ],
      },
      {
        key: "sco",
        label: "SCO / Orçamentos",
        acoes: [
          { key: "sco.criar", label: "Cadastrar SCO" },
          { key: "sco.editar", label: "Editar SCO" },
          { key: "sco.excluir", label: "Excluir SCO" },
          { key: "sco.importar", label: "Importar SCO" },
          { key: "orcamentos_sco.criar", label: "Criar orçamento SCO" },
          { key: "orcamentos_sco.editar", label: "Editar orçamento SCO" },
          { key: "orcamentos_sco.excluir", label: "Excluir orçamento SCO" },
          { key: "orcamentos_sco.exportar", label: "Exportar orçamento (Excel/PDF)" },
          { key: "orcamentos_sco.importar_catalogo", label: "Importar Catálogo FGV" },
          { key: "orcamentos_sco.visualizar_catalogo", label: "Visualizar Catálogo de Preços" },
        ],
      },
      {
        key: "i0",
        label: "I0",
        acoes: [
          { key: "i0.criar", label: "Cadastrar I0" },
          { key: "i0.editar", label: "Editar I0" },
          { key: "i0.excluir", label: "Excluir I0" },
        ],
      },
      {
        key: "equipamentos",
        label: "Equipamentos",
        acoes: [
          { key: "equipamentos.criar", label: "Cadastrar equipamento" },
          { key: "equipamentos.editar", label: "Editar equipamento" },
          { key: "equipamentos.excluir", label: "Excluir equipamento" },
          { key: "equipamentos.importar", label: "Importar equipamentos" },
          { key: "equipamentos.exportar", label: "Exportar relatório" },
        ],
      },
      {
        key: "categorias_servicos",
        label: "Categorias de Serviços",
        acoes: [
          { key: "categorias_servicos.criar", label: "Criar categoria" },
          { key: "categorias_servicos.editar", label: "Editar categoria" },
          { key: "categorias_servicos.excluir", label: "Excluir categoria" },
        ],
      },
      {
        key: "servicos",
        label: "Serviços",
        acoes: [
          { key: "servicos.criar", label: "Cadastrar serviço" },
          { key: "servicos.editar", label: "Editar serviço" },
          { key: "servicos.excluir", label: "Excluir serviço" },
        ],
      },
      {
        key: "epis_catalogo",
        label: "Catálogo de EPIs",
        acoes: [
          { key: "epis_catalogo.criar", label: "Cadastrar EPI no catálogo" },
          { key: "epis_catalogo.editar", label: "Editar EPI do catálogo" },
          { key: "epis_catalogo.excluir", label: "Excluir EPI do catálogo" },
        ],
      },
      {
        key: "nrs_catalogo",
        label: "Catálogo de NRs",
        acoes: [
          { key: "nrs_catalogo.criar", label: "Cadastrar NR" },
          { key: "nrs_catalogo.editar", label: "Editar NR" },
          { key: "nrs_catalogo.excluir", label: "Excluir NR" },
        ],
      },
    ],
  },
  {
    grupo: "Engenharia",
    modulos: [
      {
        key: "dashboard_ssos",
        label: "Dashboard SS / OS",
        acoes: [
          { key: "dashboard_ssos.visualizar", label: "Visualizar Dashboard SS / OS" },
          { key: "dashboard_ssos.exportar_pdf", label: "Exportar PDF do Dashboard SS / OS" },
        ],
      },
      {
        key: "dashboard_medicoes",
        label: "Dashboard Medições",
        acoes: [
          { key: "dashboard_medicoes.visualizar", label: "Visualizar Dashboard Medições" },
          { key: "dashboard_medicoes.exportar_pdf", label: "Exportar PDF do Dashboard Medições" },
        ],
      },
      {
        key: "solicitacao_servicos",
        label: "Solicitação de Serviços (SS)",
        acoes: [
          { key: "solicitacao_servicos.criar", label: "Pode Criar SS" },
          { key: "solicitacao_servicos.editar", label: "Pode Editar SS" },
          { key: "solicitacao_servicos.excluir", label: "Pode Excluir SS" },
          { key: "solicitacao_servicos.exportar_pdf", label: "Pode Exportar PDF da SS" },
          { key: "solicitacao_servicos.aprovar_lote", label: "Pode Aprovar SS em Lote" },
        ],
        statusTransicoes: [
          { key: "solicitacao_servicos.status.aberta", label: "Pode Abrir SS" },
          { key: "solicitacao_servicos.status.em_analise", label: "Pode Colocar SS em Análise" },
          { key: "solicitacao_servicos.status.aprovada", label: "Pode Aprovar SS" },
          { key: "solicitacao_servicos.status.reprovada", label: "Pode Reprovar SS" },
          { key: "solicitacao_servicos.status.concluida", label: "Pode Concluir SS" },
          { key: "solicitacao_servicos.status.cancelada", label: "Pode Cancelar SS" },
        ],
      },
      {
        key: "ordem_servico",
        label: "Ordem de Serviço (OS)",
        acoes: [
          { key: "ordem_servico.criar", label: "Pode Criar OS" },
          { key: "ordem_servico.editar", label: "Pode Editar OS" },
          { key: "ordem_servico.excluir", label: "Pode Excluir OS" },
          { key: "ordem_servico.exportar_pdf", label: "Pode Exportar PDF da OS" },
          { key: "ordem_servico.gerenciar_orcamento", label: "Pode Gerenciar Orçamento da OS" },
          { key: "ordem_servico.gerenciar_anexos", label: "Pode Gerenciar Anexos da OS" },
          { key: "ordem_servico.gerenciar_historico", label: "Pode Visualizar Histórico/Workflow da OS" },
        ],
        statusTransicoes: [
          { key: "ordem_servico.status.aberta", label: "Pode Abrir OS" },
          { key: "ordem_servico.status.em_execucao", label: "Pode Executar OS" },
          { key: "ordem_servico.status.confirmada", label: "Pode Confirmar OS (Serviço Confirmado)" },
          { key: "ordem_servico.status.reprovada", label: "Pode Reprovar OS (Serviço Não Aprovado)" },
          { key: "ordem_servico.status.validada", label: "Pode Validar OS" },
          { key: "ordem_servico.status.faturada", label: "Pode Faturar OS" },
          { key: "ordem_servico.status.concluida", label: "Pode Concluir OS" },
          { key: "ordem_servico.status.cancelada", label: "Pode Cancelar OS" },
        ],
      },
      {
        key: "medicoes",
        label: "Medições de Serviços",
        acoes: [
          { key: "medicoes.criar", label: "Criar medição" },
          { key: "medicoes.editar", label: "Editar medição" },
          { key: "medicoes.excluir", label: "Excluir medição" },
          { key: "medicoes.aprovar", label: "Aprovar medição" },
          { key: "medicoes.exportar_pdf", label: "Exportar PDF" },
          { key: "medicoes.exportar_excel", label: "Exportar Excel" },
          { key: "medicoes.exportar_pagamento", label: "Exportar Pagamento Bancário" },
        ],
      },
      {
        key: "cronograma",
        label: "Cronograma Físico-Financeiro",
        acoes: [
          { key: "cronograma.criar", label: "Criar cronograma" },
          { key: "cronograma.editar", label: "Editar cronograma" },
          { key: "cronograma.excluir", label: "Excluir cronograma" },
          { key: "cronograma.exportar_pdf", label: "Exportar PDF" },
          { key: "cronograma.exportar_excel", label: "Exportar Excel" },
        ],
      },
      {
        key: "eventograma",
        label: "Eventograma",
        acoes: [
          { key: "eventograma.criar", label: "Criar eventograma" },
          { key: "eventograma.editar", label: "Editar eventograma" },
          { key: "eventograma.excluir", label: "Excluir eventograma" },
          { key: "eventograma.exportar_pdf", label: "Exportar PDF" },
          { key: "eventograma.exportar_excel", label: "Exportar Excel" },
        ],
      },
      {
        key: "rdo",
        label: "RDO - Diário de Obras",
        acoes: [
          { key: "rdo.criar", label: "Criar RDO" },
          { key: "rdo.editar", label: "Editar RDO" },
          { key: "rdo.excluir", label: "Excluir RDO" },
          { key: "rdo.exportar_pdf", label: "Exportar PDF" },
          { key: "rdo.exportar_pdf_imagens", label: "Exportar PDF com Imagens" },
          { key: "rdo.assinar_responsavel", label: "Assinar como Responsável Técnico" },
          { key: "rdo.assinar_fiscalizacao", label: "Assinar como Fiscalização" },
        ],
      },
      {
        key: "plano_manutencao",
        label: "Plano de Manutenção",
        acoes: [
          { key: "plano_manutencao.criar", label: "Criar plano" },
          { key: "plano_manutencao.editar", label: "Editar plano" },
          { key: "plano_manutencao.excluir", label: "Excluir plano" },
          { key: "plano_manutencao.gerar_os", label: "Gerar OS a partir do plano" },
          { key: "plano_manutencao.exportar", label: "Exportar relatório" },
        ],
      },
      {
        key: "pmoc",
        label: "PMOC",
        acoes: [
          { key: "pmoc.criar", label: "Criar PMOC" },
          { key: "pmoc.editar", label: "Editar PMOC" },
          { key: "pmoc.excluir", label: "Excluir PMOC" },
          { key: "pmoc.exportar_pdf", label: "Exportar PDF" },
          { key: "pmoc.exportar_excel", label: "Exportar Excel" },
          { key: "pmoc.confirmar_execucao", label: "Confirmar execução de manutenção" },
        ],
      },
      {
        key: "bim",
        label: "BIM - Modelos 3D",
        acoes: [
          { key: "bim.criar", label: "Cadastrar modelo" },
          { key: "bim.editar", label: "Editar modelo" },
          { key: "bim.excluir", label: "Excluir modelo" },
          { key: "bim.gerenciar_pranchas", label: "Gerenciar pranchas" },
          { key: "bim.gerenciar_quantitativos", label: "Gerenciar quantitativos" },
          { key: "bim.visualizar_3d", label: "Visualizar modelo 3D" },
        ],
      },
      {
        key: "responsaveis_tecnicos",
        label: "Responsáveis Técnicos",
        acoes: [
          { key: "responsaveis_tecnicos.criar", label: "Cadastrar responsável" },
          { key: "responsaveis_tecnicos.editar", label: "Editar responsável" },
          { key: "responsaveis_tecnicos.excluir", label: "Excluir responsável" },
        ],
      },
      {
        key: "boletim_medicao",
        label: "Boletim de Medições",
        acoes: [
          { key: "boletim_medicao.criar", label: "Criar boletim de medição" },
          { key: "boletim_medicao.editar", label: "Editar boletim de medição" },
          { key: "boletim_medicao.excluir", label: "Excluir boletim de medição" },
          { key: "boletim_medicao.assinar", label: "Assinar boletim (assinatura eletrônica)" },
          { key: "boletim_medicao.exportar_pdf", label: "Exportar PDF" },
          { key: "boletim_medicao.exportar_excel", label: "Exportar Excel" },
        ],
      },
      {
        key: "contratos_terceiros",
        label: "Contratos de Terceiros",
        acoes: [
          { key: "contratos_terceiros.criar", label: "Criar contrato de terceiro" },
          { key: "contratos_terceiros.editar", label: "Editar contrato de terceiro" },
          { key: "contratos_terceiros.excluir", label: "Excluir contrato de terceiro" },
          { key: "contratos_terceiros.gerenciar_aditivos", label: "Gerenciar aditivos" },
          { key: "contratos_terceiros.gerenciar_anexos", label: "Gerenciar anexos" },
          { key: "contratos_terceiros.exportar_pdf", label: "Exportar PDF" },
        ],
      },
      {
        key: "os_assinatura",
        label: "Assinatura / Ações em Lote de OS",
        acoes: [
          { key: "os.assinar_fiscal", label: "Pode Assinar OS como Fiscal do Contrato" },
          { key: "os.assinar_solicitante", label: "Pode Assinar OS como Solicitante (acesso ao cliente)" },
          { key: "os.assinar_lote", label: "Pode Acessar Assinatura de OS em Lote" },
          { key: "os.confirmar_lote", label: "Pode Confirmar OS em Lote" },
          { key: "os.validar_lote", label: "Pode Validar OS em Lote" },
          { key: "os.imprimir_lote", label: "Pode Imprimir OS em Lote" },
        ],
      },
      {
        key: "pc_assinatura",
        label: "Assinatura de Ordens de Compra",
        acoes: [
          { key: "pc.assinar", label: "Assinar PC" },
          { key: "pc.assinar_lote", label: "Assinar PC em Lote" },
        ],
      },
      {
        key: "base_conhecimento",
        label: "Base de Conhecimento",
        acoes: [
          { key: "base_conhecimento.visualizar", label: "Visualizar artigos e FAQ" },
          { key: "base_conhecimento.criar_artigo", label: "Criar artigo" },
          { key: "base_conhecimento.editar_artigo", label: "Editar artigo" },
          { key: "base_conhecimento.excluir_artigo", label: "Excluir artigo" },
          { key: "base_conhecimento.criar_faq", label: "Criar FAQ" },
          { key: "base_conhecimento.editar_faq", label: "Editar FAQ" },
          { key: "base_conhecimento.excluir_faq", label: "Excluir FAQ" },
          { key: "base_conhecimento.gerenciar_categorias", label: "Gerenciar categorias" },
          { key: "base_conhecimento.gerenciar_anexos", label: "Gerenciar anexos" },
        ],
      },
    ],
  },
  {
    grupo: "Licitações",
    modulos: [
      {
        key: "licitacoes",
        label: "Licitações",
        acoes: [
          { key: "licitacoes.criar", label: "Cadastrar licitação" },
          { key: "licitacoes.editar", label: "Editar licitação" },
          { key: "licitacoes.excluir", label: "Excluir licitação" },
          { key: "licitacoes.gerenciar_anexos", label: "Gerenciar anexos" },
          { key: "licitacoes.extrair_datas_ia", label: "Extrair datas via IA" },
        ],
        statusTransicoes: [
          { key: "licitacoes.status.acompanhando", label: "Acompanhando" },
          { key: "licitacoes.status.participando", label: "Participando" },
          { key: "licitacoes.status.vencida", label: "Vencida" },
          { key: "licitacoes.status.perdida", label: "Perdida" },
          { key: "licitacoes.status.cancelada", label: "Cancelada" },
        ],
      },
    ],
  },
  {
    grupo: "Jurídico",
    modulos: [
      {
        key: "juridico",
        label: "Processos Trabalhistas",
        acoes: [
          { key: "juridico.criar", label: "Cadastrar processo" },
          { key: "juridico.editar", label: "Editar processo" },
          { key: "juridico.excluir", label: "Excluir processo" },
          { key: "juridico.gerenciar_audiencias", label: "Gerenciar audiências" },
          { key: "juridico.gerenciar_anexos", label: "Gerenciar anexos" },
          { key: "juridico.gerenciar_contatos", label: "Gerenciar contatos de notificação" },
          { key: "juridico.lancar_decisao", label: "Pode Lançar Decisão Judicial (com senha)" },
          { key: "juridico.lancar_acordo", label: "Pode Lançar Acordo (com senha)" },
          { key: "juridico.integrar_contas_pagar", label: "Pode Integrar Decisão/Acordo ao Contas a Pagar" },
          { key: "juridico.exportar_relatorio", label: "Pode Exportar Relatórios do Jurídico" },
        ],
      },
    ],
  },
  {
    grupo: "Patrimônio",
    modulos: [
      {
        key: "ferramentas",
        label: "Ferramentas",
        acoes: [
          { key: "ferramentas.criar", label: "Cadastrar ferramenta" },
          { key: "ferramentas.editar", label: "Editar ferramenta" },
          { key: "ferramentas.excluir", label: "Excluir ferramenta" },
          { key: "ferramentas.gerenciar_emprestimos", label: "Gerenciar empréstimos" },
          { key: "ferramentas.aprovar_emprestimo", label: "Aprovar empréstimo" },
          { key: "ferramentas.vincular_funcionario", label: "Vincular a funcionário" },
        ],
      },
    ],
  },
  {
    grupo: "Qualidade",
    modulos: [
      {
        key: "evidencias",
        label: "Evidências",
        acoes: [
          { key: "evidencias.criar", label: "Cadastrar evidência" },
          { key: "evidencias.editar", label: "Editar evidência" },
          { key: "evidencias.excluir", label: "Excluir evidência" },
          { key: "evidencias.gerenciar_anexos", label: "Gerenciar anexos" },
        ],
      },
      {
        key: "checklists",
        label: "Checklists",
        acoes: [
          { key: "checklists.criar", label: "Criar checklist" },
          { key: "checklists.editar", label: "Editar checklist" },
          { key: "checklists.excluir", label: "Excluir checklist" },
          { key: "checklists.preencher", label: "Preencher checklist" },
          { key: "checklists.aprovar", label: "Aprovar preenchimento" },
        ],
      },
    ],
  },
  {
    grupo: "Comunicação",
    modulos: [
      {
        key: "comunicacao_mensagens",
        label: "Mensagens",
        acoes: [
          { key: "comunicacao_mensagens.criar_conversa", label: "Iniciar conversa" },
          { key: "comunicacao_mensagens.enviar", label: "Enviar mensagem" },
          { key: "comunicacao_mensagens.criar_grupo", label: "Criar grupo" },
        ],
      },
      {
        key: "comunicacao_avisos",
        label: "Avisos",
        acoes: [
          { key: "comunicacao_avisos.criar", label: "Publicar aviso" },
          { key: "comunicacao_avisos.editar", label: "Editar aviso" },
          { key: "comunicacao_avisos.excluir", label: "Excluir aviso" },
        ],
      },
      {
        key: "comunicacao_notificacoes",
        label: "Notificações",
        acoes: [
          { key: "comunicacao_notificacoes.criar", label: "Criar notificação" },
          { key: "comunicacao_notificacoes.excluir", label: "Excluir notificação" },
          { key: "comunicacao_notificacoes.marcar_lida", label: "Marcar como lida" },
        ],
      },
      {
        key: "comunicacao_whatsapp",
        label: "Notificação WhatsApp",
        acoes: [
          { key: "comunicacao_whatsapp.criar", label: "Criar campanha" },
          { key: "comunicacao_whatsapp.editar", label: "Editar campanha" },
          { key: "comunicacao_whatsapp.excluir", label: "Excluir campanha" },
          { key: "comunicacao_whatsapp.enviar", label: "Enviar agora" },
        ],
      },
      {
        key: "chat_duda",
        label: "Assistente Duda (IA)",
        acoes: [
          { key: "chat_duda.usar", label: "Conversar com a Duda" },
          { key: "chat_duda.exportar", label: "Exportar relatórios da Duda" },
        ],
      },
    ],
  },
  {
    grupo: "Administração",
    modulos: [
      {
        key: "empresa",
        label: "Dados da Empresa",
        acoes: [
          { key: "empresa.visualizar", label: "Visualizar dados" },
          { key: "empresa.editar", label: "Editar dados" },
          { key: "empresa.gerenciar_logo", label: "Gerenciar logotipo" },
          { key: "empresa.gerenciar_dados_bancarios", label: "Gerenciar dados bancários" },
        ],
      },
      {
        key: "usuarios",
        label: "Usuários",
        acoes: [
          { key: "usuarios.criar", label: "Cadastrar usuário" },
          { key: "usuarios.editar", label: "Editar usuário" },
          { key: "usuarios.excluir", label: "Excluir usuário" },
          { key: "usuarios.gerenciar_acessos", label: "Gerenciar acessos por cliente" },
          { key: "usuarios.gerenciar_limites", label: "Gerenciar limites de aprovação" },
          { key: "usuarios.resetar_senha", label: "Resetar senha de usuário" },
        ],
      },
      {
        key: "perfis_acesso",
        label: "Perfis de Acesso",
        acoes: [
          { key: "perfis_acesso.criar", label: "Criar perfil" },
          { key: "perfis_acesso.editar", label: "Editar perfil" },
          { key: "perfis_acesso.excluir", label: "Excluir perfil" },
          { key: "perfis_acesso.duplicar", label: "Duplicar perfil" },
        ],
      },
      {
        key: "auditoria",
        label: "Auditoria",
        acoes: [
          { key: "auditoria.visualizar", label: "Visualizar painel de auditoria" },
        ],
      },
      {
        key: "monitor_tv",
        label: "Monitor TV",
        acoes: [
          { key: "monitor_tv.visualizar", label: "Acessar Monitor TV" },
        ],
      },
      {
        key: "gerencial_dashboard",
        label: "Dashboard Multisistêmico",
        acoes: [
          { key: "gerencial_dashboard.visualizar", label: "Pode Acessar Dashboard Multisistêmico" },
        ],
      },
      {
        key: "gerencial_mapa_clientes",
        label: "Mapa de Clientes - RJ",
        acoes: [
          { key: "gerencial_mapa_clientes.visualizar", label: "Pode Acessar Mapa de Clientes" },
        ],
      },
      {
        key: "gerencial_relatorios",
        label: "Relatórios Gerenciais",
        acoes: [
          { key: "gerencial_relatorios.visualizar", label: "Pode Visualizar Relatórios Gerenciais" },
          { key: "gerencial_relatorios.exportar_pdf", label: "Pode Exportar PDF dos Relatórios Gerenciais" },
          { key: "gerencial_relatorios.exportar_excel", label: "Pode Exportar Excel dos Relatórios Gerenciais" },
        ],
      },
      {
        key: "gerencial_multidim",
        label: "Relatórios Multidimensional (Cubo)",
        acoes: [
          { key: "gerencial_multidim.visualizar", label: "Pode Acessar Análise Multidimensional (Cubo)" },
          { key: "gerencial_multidim.exportar_pdf", label: "Pode Exportar PDF do Cubo" },
          { key: "gerencial_multidim.exportar_excel", label: "Pode Exportar Excel do Cubo" },
        ],
      },
    ],
  },
  {
    grupo: "Financeiro",
    modulos: [
      { key: "faturamentos", label: "Faturamentos (por Contrato)", acoes: [
        { key: "faturamentos.criar", label: "Pode Lançar Faturamento" },
        { key: "faturamentos.editar", label: "Pode Editar Faturamento" },
        { key: "faturamentos.excluir", label: "Pode Excluir Faturamento" },
        { key: "faturamentos.visualizar", label: "Pode Visualizar Acompanhamento de Faturamentos" },
        { key: "faturamentos.transferir_saldo", label: "Pode Transferir Saldos entre Contratos" },
      ]},
      { key: "financeiro.dashboard", label: "Dashboard Financeiro", acoes: [{ key: "financeiro.dashboard.visualizar", label: "Pode Visualizar Dashboard Financeiro" }] },
      { key: "financeiro.contas_pagar", label: "Contas a Pagar", acoes: [
        { key: "financeiro.contas_pagar.criar", label: "Pode Criar Conta a Pagar" },
        { key: "financeiro.contas_pagar.editar", label: "Pode Editar Conta a Pagar" },
        { key: "financeiro.contas_pagar.excluir", label: "Pode Excluir Conta a Pagar" },
        { key: "financeiro.contas_pagar.baixar", label: "Pode Dar Baixa em Conta a Pagar (Pagamento)" },
      ]},
      { key: "financeiro.contas_receber", label: "Contas a Receber", acoes: [
        { key: "financeiro.contas_receber.criar", label: "Pode Criar Conta a Receber" },
        { key: "financeiro.contas_receber.editar", label: "Pode Editar Conta a Receber" },
        { key: "financeiro.contas_receber.excluir", label: "Pode Excluir Conta a Receber" },
        { key: "financeiro.contas_receber.baixar", label: "Pode Dar Baixa em Conta a Receber (Recebimento)" },
      ]},
      { key: "financeiro.contas_bancarias", label: "Contas Bancárias", acoes: [
        { key: "financeiro.contas_bancarias.criar", label: "Pode Criar Conta Bancária" },
        { key: "financeiro.contas_bancarias.editar", label: "Pode Editar Conta Bancária" },
        { key: "financeiro.contas_bancarias.excluir", label: "Pode Excluir Conta Bancária" },
        { key: "financeiro.contas_bancarias.transferir", label: "Pode Realizar Transferências Bancárias" },
      ]},
      { key: "financeiro.plano_contas", label: "Plano de Contas", acoes: [
        { key: "financeiro.plano_contas.gerenciar", label: "Pode Gerenciar Plano de Contas" },
      ]},
      { key: "financeiro.centros_custo", label: "Centros de Custo", acoes: [
        { key: "financeiro.centros_custo.gerenciar", label: "Pode Gerenciar Centros de Custo" },
      ]},
      { key: "financeiro.fluxo_caixa", label: "Fluxo de Caixa", acoes: [
        { key: "financeiro.fluxo_caixa.visualizar", label: "Pode Visualizar Fluxo de Caixa" },
        { key: "financeiro.fluxo_caixa.exportar", label: "Pode Exportar Fluxo de Caixa (Excel/PDF)" },
      ]},
      { key: "financeiro.dre", label: "DRE Gerencial", acoes: [
        { key: "financeiro.dre.visualizar", label: "Pode Visualizar DRE" },
        { key: "financeiro.dre.exportar_pdf", label: "Pode Exportar PDF da DRE" },
      ]},
      { key: "financeiro.conciliacao", label: "Conciliação Bancária", acoes: [
        { key: "financeiro.conciliacao.importar_ofx", label: "Pode Importar Arquivo OFX" },
        { key: "financeiro.conciliacao.conciliar", label: "Pode Conciliar Movimentos Bancários" },
      ]},
      { key: "financeiro.lancamentos", label: "Lançamentos", acoes: [
        { key: "financeiro.lancamentos.visualizar", label: "Pode Visualizar Lançamentos Financeiros" },
        { key: "financeiro.lancamentos.estornar", label: "Pode Estornar Lançamento" },
      ]},
      { key: "financeiro.condicoes_pagamento", label: "Condições de Pagamento", acoes: [
        { key: "financeiro.condicoes_pagamento.visualizar", label: "Pode Visualizar Condições de Pagamento" },
        { key: "financeiro.condicoes_pagamento.criar", label: "Pode Criar Condição de Pagamento" },
        { key: "financeiro.condicoes_pagamento.editar", label: "Pode Editar Condição de Pagamento" },
        { key: "financeiro.condicoes_pagamento.excluir", label: "Pode Excluir Condição de Pagamento" },
      ]},
      { key: "financeiro.relatorios", label: "Relatórios Financeiros", acoes: [
        { key: "financeiro.relatorios.visualizar", label: "Pode Visualizar Relatórios Financeiros" },
        { key: "financeiro.relatorios.exportar_pdf", label: "Pode Exportar PDF dos Relatórios" },
        { key: "financeiro.relatorios.exportar_excel", label: "Pode Exportar Excel dos Relatórios" },
        { key: "financeiro.relatorios.filtrar_centro_custo", label: "Pode Filtrar Relatórios por Centro de Custo" },
      ]},
      { key: "financeiro.nfes_recebidas", label: "NFes Recebidas", acoes: [
        { key: "financeiro.nfes_recebidas.visualizar", label: "Pode Visualizar NFes Recebidas" },
        { key: "financeiro.nfes_recebidas.importar", label: "Pode Importar NFes da SEFAZ (Focus)" },
        { key: "financeiro.nfes_recebidas.baixar_xml", label: "Pode Baixar XML da NFe" },
        { key: "financeiro.nfes_recebidas.baixar_danfe", label: "Pode Baixar DANFE (PDF)" },
        { key: "financeiro.nfes_recebidas.vincular_pc", label: "Pode Vincular NFe ao Ordem de Compra" },
      ]},
    ],
  },
];

// Adiciona módulo de Inteligência de Compras ao grupo Compras e Suprimentos
(() => {
  const compras = MODULOS_SISTEMA.find(g => g.grupo === "Compras e Suprimentos");
  if (compras && !compras.modulos.some(m => m.key === "inteligencia_compras")) {
    compras.modulos.push({
      key: "inteligencia_compras",
      label: "Inteligência de Compras",
      acoes: [
        { key: "inteligencia_compras.visualizar", label: "Pode Visualizar Inteligência de Compras" },
        { key: "inteligencia_compras.aglutinar", label: "Pode Aglutinar Itens e Gerar RC Consolidada" },
      ],
    });
  }
  const compras2 = MODULOS_SISTEMA.find(g => g.grupo === "Compras e Suprimentos");
  if (compras2 && !compras2.modulos.some(m => m.key === "relatorios_estoque")) {
    compras2.modulos.push({
      key: "relatorios_estoque",
      label: "Relatórios de Estoque",
      acoes: [
        { key: "relatorios_estoque.visualizar", label: "Pode Visualizar Relatórios de Estoque" },
        { key: "relatorios_estoque.exportar", label: "Pode Exportar Relatório de Estoque" },
      ],
    });
  }
  const compras3 = MODULOS_SISTEMA.find(g => g.grupo === "Compras e Suprimentos");
  if (compras3 && !compras3.modulos.some(m => m.key === "pregao")) {
    compras3.modulos.push({
      key: "pregao",
      label: "Pregão Eletrônico",
      acoes: [
        { key: "pregao.visualizar", label: "Pode Visualizar Pregões" },
        { key: "pregao.criar", label: "Pode Criar Pregão" },
        { key: "pregao.editar", label: "Pode Editar Pregão" },
        { key: "pregao.excluir", label: "Pode Excluir Pregão (Rascunho)" },
        { key: "pregao.pregoeiro", label: "Pode Atuar como Pregoeiro (Conduzir Disputa)" },
        { key: "pregao.habilitar", label: "Pode Habilitar Fornecedor Vencedor" },
        { key: "pregao.homologar", label: "Pode Homologar Pregão" },
      ],
    });
  }
})();

// Collect all permission keys
export const ALL_MODULE_KEYS = MODULOS_SISTEMA.flatMap(g => g.modulos.map(m => m.key));
export const ALL_PERMISSION_KEYS = MODULOS_SISTEMA.flatMap(g =>
  g.modulos.flatMap(m => [
    m.key,
    ...(m.acoes?.map(a => a.key) ?? []),
    ...(m.statusTransicoes?.map(s => s.key) ?? []),
    ...(m.flags?.map(f => f.key) ?? []),
  ])
);

export type Permissoes = Record<string, boolean>;

export interface PerfilAcesso {
  id: string;
  nome: string;
  descricao: string;
  permissoes: Permissoes;
}

interface PerfisAcessoContextType {
  perfis: PerfilAcesso[];
  addPerfil: (p: Omit<PerfilAcesso, "id">) => Promise<void>;
  updatePerfil: (id: string, p: Omit<PerfilAcesso, "id">) => Promise<void>;
  deletePerfil: (id: string) => Promise<void>;
}

const getPerfisAcessoContext = (): Context<PerfisAcessoContextType | undefined> => {
  const globalScope = globalThis as typeof globalThis & {
    __PerfisAcessoContext?: Context<PerfisAcessoContextType | undefined>;
  };

  if (!globalScope.__PerfisAcessoContext) {
    globalScope.__PerfisAcessoContext = createContext<PerfisAcessoContextType | undefined>(undefined);
  }

  return globalScope.__PerfisAcessoContext;
};

const PerfisAcessoContext = getPerfisAcessoContext();

const rowToPerfil = (r: any): PerfilAcesso => ({
  id: r.id,
  nome: r.nome ?? "",
  descricao: r.descricao ?? "",
  permissoes: (r.permissoes as Permissoes) ?? {},
});

const perfilToRow = (p: Omit<PerfilAcesso, "id">) => ({
  nome: p.nome,
  descricao: p.descricao,
  permissoes: p.permissoes as any,
});

export function PerfisAcessoProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("PerfisAcesso");
  const qc = useQueryClient();
  const { data: perfis = [] } = useQuery({
    enabled: __active,
    queryKey: PERFIS_QK,
    queryFn: async () => (await fetchAll("perfis_acesso", "nome")).map(rowToPerfil),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: PERFIS_QK });

  const addPerfil = async (p: Omit<PerfilAcesso, "id">) => { await insertRow("perfis_acesso", perfilToRow(p)); invalidate(); };
  const updatePerfil = async (id: string, data: Omit<PerfilAcesso, "id">) => { await updateRow("perfis_acesso", id, perfilToRow(data)); invalidate(); };
  const deletePerfil = async (id: string) => { await deleteRow("perfis_acesso", id); invalidate(); };

  return (
    <PerfisAcessoContext.Provider value={{ perfis, addPerfil, updatePerfil, deletePerfil }}>
      {children}
    </PerfisAcessoContext.Provider>
  );
}

export function usePerfisAcesso() {
  useActivateProvider("PerfisAcesso");
  const ctx = useContext(PerfisAcessoContext);
  if (!ctx) throw new Error("usePerfisAcesso must be used within PerfisAcessoProvider");
  return ctx;
}
