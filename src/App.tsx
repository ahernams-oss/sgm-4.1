import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "@/lib/router-compat";
import { ReactNode, Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";

import { CargosProvider } from "@/contexts/CargosContext";
import { RequisicaoProvider } from "@/contexts/RequisicaoContext";
import { ClientesProvider } from "@/contexts/ClientesContext";
import { FuncionariosProvider } from "@/contexts/FuncionariosContext";
import { LancamentosProvider } from "@/contexts/LancamentosContext";
import { UsuariosProvider } from "@/contexts/UsuariosContext";
import { ProcessoSeletivoProvider } from "@/contexts/ProcessoSeletivoContext";
import { ScoProvider } from "@/contexts/ScoContext";
import { I0Provider } from "@/contexts/I0Context";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CategoriasComprasProvider } from "@/contexts/CategoriasComprasContext";
import { MateriaisServicosProvider } from "@/contexts/MateriaisServicosContext";
import { MaterialScoVinculosProvider } from "@/contexts/MaterialScoVinculosContext";
import { RequisicaoComprasProvider } from "@/contexts/RequisicaoComprasContext";
import { CotacaoComprasProvider } from "@/contexts/CotacaoComprasContext";
import { PedidoCompraProvider } from "@/contexts/PedidoCompraContext";
import { RecebimentoProvider } from "@/contexts/RecebimentoContext";
import { EstoqueProvider } from "@/contexts/EstoqueContext";
import { FabricantesProvider } from "@/contexts/FabricantesContext";
import { PerfisAcessoProvider } from "@/contexts/PerfisAcessoContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { LicitacoesProvider } from "@/contexts/LicitacoesContext";
import { MedicoesProvider } from "@/contexts/MedicoesContext";
import { FerramentasProvider } from "@/contexts/FerramentasContext";
import { PregaoProvider } from "@/contexts/PregaoContext";
import { EpisDevolucoesProvider } from "./contexts/EpisDevolucoesContext";
import { EpisCatalogoProvider } from "@/contexts/EpisCatalogoContext";
import { NrsCatalogoProvider } from "@/contexts/NrsCatalogoContext";
import { PortalAuthProvider } from "@/contexts/PortalAuthContext";

import { EvidenciasProvider } from "@/contexts/EvidenciasContext";
import { ChecklistsProvider } from "@/contexts/ChecklistsContext";
import { EquipamentosProvider } from "@/contexts/EquipamentosContext";
import { LaudosCondenacaoProvider } from "@/contexts/LaudosCondenacaoContext";
import { LaudosAssinaturasProvider } from "@/contexts/LaudosAssinaturasContext";
import { PmocProvider } from "@/contexts/PmocContext";
import { CategoriasServicosProvider } from "@/contexts/CategoriasServicosContext";
import { ServicosProvider } from "@/contexts/ServicosContext";
import { OsModelosProvider } from "@/contexts/OsModelosContext";
import { SolicitacoesServicosProvider } from "@/contexts/SolicitacoesServicosContext";
import { OrdensServicoProvider } from "@/contexts/OrdensServicoContext";
import { OrcamentosProvider } from "@/contexts/OrcamentosContext";
import { ComunicacaoProvider } from "@/contexts/ComunicacaoContext";
import { ProcessosTrabalhalistasProvider } from "@/contexts/ProcessosTrabalhistas";
import { RdosProvider } from "@/contexts/RdosContext";
import { RdoAssinaturasProvider } from "@/contexts/RdoAssinaturasContext";
import { ObrasProvider } from "@/contexts/ObrasContext";
import { OsAssinaturasProvider } from "@/contexts/OsAssinaturasContext";
import { BoletimAssinaturasProvider } from "@/contexts/BoletimAssinaturasContext";
import { PcAssinaturasProvider } from "@/contexts/PcAssinaturasContext";
import { ResponsaveisTecnicosProvider } from "@/contexts/ResponsaveisTecnicosContext";
import { PlanosManutencaoProvider } from "@/contexts/PlanosManutencaoContext";
import { KnowledgeBaseProvider } from "@/contexts/KnowledgeBaseContext";
import { BimProvider } from "@/contexts/BimContext";
import { CronogramasProvider } from "@/contexts/CronogramasContext";
import { BoletinsMedicaoProvider } from "@/contexts/BoletinsMedicaoContext";
import { EventogramasProvider } from "@/contexts/EventogramasContext";
import { OrcamentosScoProvider } from "@/contexts/OrcamentosScoContext";
import { FinanceiroProvider } from "@/contexts/FinanceiroContext";
import { NfsesProvider } from "@/contexts/NfsesContext";
import { RotaProtegida } from "@/components/RotaProtegida";
const OAuthConsent = lazy(() => import("@/pages/OAuthConsent"));
const Index = lazy(() => import("./pages/Index.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Clientes = lazy(() => import("./pages/Clientes.tsx"));
const TransferenciasSaldoContrato = lazy(() => import("./pages/TransferenciasSaldoContrato.tsx"));
const Fornecedores = lazy(() => import("./pages/Fornecedores.tsx"));
const Cargos = lazy(() => import("./pages/Cargos.tsx"));
const Funcionarios = lazy(() => import("./pages/Funcionarios.tsx"));
const MapaFuncionarios = lazy(() => import("./pages/MapaFuncionarios.tsx"));
const MapaPlantoes = lazy(() => import("./pages/MapaPlantoes.tsx"));
const MapaFerias = lazy(() => import("./pages/MapaFerias.tsx"));
const MapaUniformes = lazy(() => import("./pages/MapaUniformes.tsx"));
const Usuarios = lazy(() => import("./pages/Usuarios.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha.tsx"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha.tsx"));
const ProcessoSeletivo = lazy(() => import("./pages/ProcessoSeletivo.tsx"));
const ProcessosSeletivos = lazy(() => import("./pages/ProcessosSeletivos.tsx"));
const Sco = lazy(() => import("./pages/Sco.tsx"));
const I0Page = lazy(() => import("./pages/I0.tsx"));
const CategoriasCompras = lazy(() => import("./pages/CategoriasCompras.tsx"));
const MateriaisServicos = lazy(() => import("./pages/MateriaisServicos.tsx"));
const RequisicaoComprasPage = lazy(() => import("./pages/RequisicaoCompras.tsx"));
const DashboardCompras = lazy(() => import("./pages/DashboardCompras.tsx"));
const CotacaoComprasPage = lazy(() => import("./pages/CotacaoCompras.tsx"));
const PedidoCompraPage = lazy(() => import("./pages/PedidoCompra.tsx"));
const InteligenciaComprasPage = lazy(() => import("./pages/InteligenciaCompras.tsx"));
const AssinarLotePcPage = lazy(() => import("./pages/AssinarLotePc.tsx"));
const AprovarLoteCotacoesPage = lazy(() => import("./pages/AprovarLoteCotacoes.tsx"));
const PropostaFornecedorPage = lazy(() => import("./pages/PropostaFornecedor.tsx"));
const PortalFornecedorPage = lazy(() => import("./pages/PortalFornecedor.tsx"));
const PregaoSalaFornecedorPage = lazy(() => import("./pages/portal-fornecedor/PregaoSalaFornecedor.tsx"));
const RecebimentoComprasPage = lazy(() => import("./pages/RecebimentoCompras.tsx"));
const EstoquePage = lazy(() => import("./pages/Estoque.tsx"));
const RelatoriosEstoquePage = lazy(() => import("./pages/RelatoriosEstoque.tsx"));
const PerfisAcessoPage = lazy(() => import("./pages/PerfisAcesso.tsx"));
const AuditoriaPage = lazy(() => import("./pages/Auditoria.tsx"));
const EmpresaDadosPage = lazy(() => import("./pages/EmpresaDados.tsx"));
const BancoPrecosPage = lazy(() => import("./pages/BancoPrecos.tsx"));
const Trust = lazy(() => import("./pages/Trust.tsx"));
const PregoesPage = lazy(() => import("./pages/pregao/Pregoes.tsx"));
const PregaoFormPage = lazy(() => import("./pages/pregao/PregaoForm.tsx"));
const PregaoSalaPage = lazy(() => import("./pages/pregao/PregaoSala.tsx"));
const PregaoHabilitacaoPage = lazy(() => import("./pages/pregao/PregaoHabilitacao.tsx"));
const PregaoResultadoPage = lazy(() => import("./pages/pregao/PregaoResultado.tsx"));
const FabricantesPage = lazy(() => import("./pages/Fabricantes.tsx"));
const EpisPage = lazy(() => import("./pages/EpisPage.tsx"));
const EpisCatalogoPage = lazy(() => import("./pages/EpisCatalogo.tsx"));
const NrsCatalogoPage = lazy(() => import("./pages/NrsCatalogo.tsx"));
const ReceberEpis = lazy(() => import("./pages/ReceberEpis.tsx"));
const DevolverEpis = lazy(() => import("./pages/DevolverEpis.tsx"));
const RelatorioRecebimentoEpis = lazy(() => import("./pages/RelatorioRecebimentoEpis.tsx"));
const EpisDevolucoes = lazy(() => import("./pages/EpisDevolucoes.tsx"));
const ProntuarioEpis = lazy(() => import("./pages/ProntuarioEpis.tsx"));
const ExamesPage = lazy(() => import("./pages/ExamesPage.tsx"));
const UnsubscribePage = lazy(() => import("./pages/Unsubscribe.tsx"));
const PortalCandidato = lazy(() => import("./pages/PortalCandidato.tsx"));
const SolicitacoesPortalRH = lazy(() => import("./pages/rh/SolicitacoesPortal"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalCadastrarSenha = lazy(() => import("./pages/portal/PortalCadastrarSenha"));
const PortalEsqueciSenha = lazy(() => import("./pages/portal/PortalEsqueciSenha"));
const PortalFuncHome = lazy(() => import("./pages/portal/funcionario/PortalFuncHome"));
const PortalHolerites = lazy(() => import("./pages/portal/funcionario/PortalHolerites"));
const PortalFuncEpis = lazy(() => import("./pages/portal/funcionario/PortalFuncEpis"));
const PortalFuncDocumentos = lazy(() => import("./pages/portal/funcionario/PortalFuncDocumentos"));
const PortalPerfil = lazy(() => import("./pages/portal/funcionario/PortalPerfil"));
const PortalFuncFerias = lazy(() => import("./pages/portal/funcionario/PortalFuncFerias"));
const PortalFuncTreinamentos = lazy(() => import("./pages/portal/funcionario/PortalFuncTreinamentos"));
const PortalFuncSolicitacoes = lazy(() => import("./pages/portal/funcionario/PortalFuncSolicitacoes"));
const PortalFuncAvisos = lazy(() => import("./pages/portal/funcionario/PortalFuncAvisos"));
const PortalCandHome = lazy(() => import("./pages/portal/candidato/PortalCandHome"));
const PortalFicha = lazy(() => import("./pages/portal/candidato/PortalFicha"));
const PortalCandDocumentos = lazy(() => import("./pages/portal/candidato/PortalCandDocumentos"));
const PortalTermos = lazy(() => import("./pages/portal/candidato/PortalTermos"));
const PortalAdmissional = lazy(() => import("./pages/portal/candidato/PortalAdmissional"));
const EquipamentoPublico = lazy(() => import("./pages/EquipamentoPublico.tsx"));
const Instalar = lazy(() => import("./pages/Instalar.tsx"));
const OrcamentosMobile = lazy(() => import("./pages/mobile/OrcamentosMobile.tsx"));
const InstalarOrcamentos = lazy(() => import("./pages/mobile/InstalarOrcamentos.tsx"));
const LicitacoesPage = lazy(() => import("./pages/Licitacoes.tsx"));
const MedicoesServicosPage = lazy(() => import("./pages/MedicoesServicos.tsx"));
const DashboardMedicoesPage = lazy(() => import("./pages/DashboardMedicoes.tsx"));
const DashboardSSOSPage = lazy(() => import("./pages/DashboardSSOS.tsx"));
const DashboardSolicitacoesPage = lazy(() => import("./pages/DashboardSolicitacoes.tsx"));
const FerramentasPage = lazy(() => import("./pages/Ferramentas.tsx"));
const EvidenciasPage = lazy(() => import("./pages/Evidencias.tsx"));
const ChecklistsPage = lazy(() => import("./pages/Checklists.tsx"));
const EquipamentosPage = lazy(() => import("./pages/Equipamentos.tsx"));
const PmocPage = lazy(() => import("./pages/Pmoc.tsx"));
const PmocGerenciarOperacaoPage = lazy(() => import("./pages/PmocGerenciarOperacao.tsx"));
const CategoriasServicosPage = lazy(() => import("./pages/CategoriasServicosPage.tsx"));
const ServicosPage = lazy(() => import("./pages/ServicosPage.tsx"));
const OsModelosPage = lazy(() => import("./pages/OsModelos.tsx"));
const SolicitacaoServicosPage = lazy(() => import("@/pages/SolicitacaoServicos"));
const OrdensServicoPage = lazy(() => import("@/pages/OrdensServico"));
const AprovarLoteSS = lazy(() => import("@/pages/AprovarLoteSS"));
const ImportarHolerites = lazy(() => import("@/pages/ImportarHolerites"));
const HoleritesProcessados = lazy(() => import("@/pages/rh/HoleritesProcessados"));
const Treinamentos = lazy(() => import("@/pages/Treinamentos"));
const ComunicacaoMensagensPage = lazy(() => import("./pages/ComunicacaoMensagens"));
const ComunicacaoAvisosPage = lazy(() => import("./pages/ComunicacaoAvisos"));
const ComunicacaoNotificacoesPage = lazy(() => import("./pages/ComunicacaoNotificacoes"));
const ComunicacaoWhatsappPage = lazy(() => import("./pages/ComunicacaoWhatsapp"));
const ComunicacaoGruposWhatsappPage = lazy(() => import("./pages/ComunicacaoGruposWhatsapp"));
const JuridicoPage = lazy(() => import("./pages/Juridico"));
const ChatDudaPage = lazy(() => import("./pages/ChatDuda"));
const RdoPage = lazy(() => import("./pages/Rdo.tsx"));
const AssinarLoteOsPage = lazy(() => import("./pages/AssinarLoteOs.tsx"));
const ConfirmarLoteOsPage = lazy(() => import("./pages/ConfirmarLoteOs.tsx"));
const ValidarLoteOsPage = lazy(() => import("./pages/ValidarLoteOs.tsx"));
const FaturarLoteOsPage = lazy(() => import("./pages/FaturarLoteOs.tsx"));
const ImprimirLoteOsPage = lazy(() => import("./pages/ImprimirLoteOs.tsx"));
const VerificarAssinaturaPage = lazy(() => import("./pages/VerificarAssinatura.tsx"));
const ResponsaveisTecnicosPage = lazy(() => import("./pages/ResponsaveisTecnicos.tsx"));
const PlanoManutencaoPage = lazy(() => import("./pages/PlanoManutencao.tsx"));
const BaseConhecimentoPage = lazy(() => import("./pages/BaseConhecimento.tsx"));
const MonitorTV = lazy(() => import("./pages/MonitorTV.tsx"));
const CronogramaPage = lazy(() => import("./pages/Cronograma.tsx"));
const BimPage = lazy(() => import("./pages/Bim.tsx"));
const ContratosTerceirosPage = lazy(() => import("./pages/ContratosTerceiros.tsx"));
const EventogramaPage = lazy(() => import("./pages/Eventograma.tsx"));
const BoletimMedicaoPage = lazy(() => import("./pages/BoletimMedicao.tsx"));
const OrcamentosSco = lazy(() => import("./pages/OrcamentosSco.tsx"));
const OrcamentoScoForm = lazy(() => import("./pages/OrcamentoScoForm.tsx"));
const ImportarCatalogoSco = lazy(() => import("./pages/ImportarCatalogoSco.tsx"));
const CatalogoSco = lazy(() => import("./pages/CatalogoSco.tsx"));
const AvaliacoesDesempenhoPage = lazy(() => import("./pages/AvaliacoesDesempenho.tsx"));
const DashboardFinanceiro = lazy(() => import("./pages/financeiro/DashboardFinanceiro.tsx"));
const ContasPagar = lazy(() => import("./pages/financeiro/ContasPagar.tsx"));
const ContasReceber = lazy(() => import("./pages/financeiro/ContasReceber.tsx"));
const ContasBancarias = lazy(() => import("./pages/financeiro/ContasBancarias.tsx"));
const PlanoContas = lazy(() => import("./pages/financeiro/PlanoContas.tsx"));
const CentrosCusto = lazy(() => import("./pages/financeiro/CentrosCusto.tsx"));
const FluxoCaixa = lazy(() => import("./pages/financeiro/FluxoCaixa.tsx"));
const Dre = lazy(() => import("./pages/financeiro/Dre.tsx"));
const Conciliacao = lazy(() => import("./pages/financeiro/Conciliacao.tsx"));
const Lancamentos = lazy(() => import("./pages/financeiro/Lancamentos.tsx"));
const RelatoriosFinanceiros = lazy(() => import("./pages/financeiro/RelatoriosFinanceiros.tsx"));
const CondicoesPagamento = lazy(() => import("./pages/financeiro/CondicoesPagamento.tsx"));
const NfesRecebidas = lazy(() => import("./pages/financeiro/NfesRecebidas.tsx"));
const NfseEmitir = lazy(() => import("./pages/financeiro/NfseEmitir.tsx"));
const Faturamentos = lazy(() => import("./pages/financeiro/Faturamentos.tsx"));
const RelatoriosGerenciais = lazy(() => import("./pages/gerencial/RelatoriosGerenciais.tsx"));
const RelatoriosMultidimensional = lazy(() => import("./pages/gerencial/RelatoriosMultidimensional.tsx"));
const DashboardMultisistemico = lazy(() => import("./pages/gerencial/DashboardMultisistemico.tsx"));
const PainelFaturamentoClientes = lazy(() => import("./pages/gerencial/PainelFaturamentoClientes.tsx"));
const MapaClientes = lazy(() => import("./pages/gerencial/MapaClientes.tsx"));

function PageLoader() {
  return (
    <div className="flex h-[60vh] w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function ProtectedAppRoutes() {
  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/requisicao-pessoal" element={<RotaProtegida perm="requisicao_colaboradores"><Index /></RotaProtegida>} />

        <Route path="/dashboard" element={<RotaProtegida perm="dashboard_gp"><Dashboard /></RotaProtegida>} />
        <Route path="/clientes" element={<RotaProtegida perm="clientes"><OrdensServicoProvider><Clientes /></OrdensServicoProvider></RotaProtegida>} />
        <Route path="/clientes/transferencias-saldo" element={<RotaProtegida perm="faturamentos" requireAcessoTotal><TransferenciasSaldoContrato /></RotaProtegida>} />
        <Route path="/fornecedores" element={<RotaProtegida perm="fornecedores"><Fornecedores /></RotaProtegida>} />
        <Route path="/cargos" element={<RotaProtegida perm="cargos"><Cargos /></RotaProtegida>} />
        <Route path="/funcionarios" element={<RotaProtegida perm="funcionarios"><Funcionarios /></RotaProtegida>} />
        <Route path="/epis" element={<RotaProtegida perm="funcionarios"><EpisPage /></RotaProtegida>} />
        <Route path="/cadastros/nrs" element={<RotaProtegida perm="nrs_catalogo"><NrsCatalogoProvider><NrsCatalogoPage /></NrsCatalogoProvider></RotaProtegida>} />
        <Route path="/epis/catalogo" element={<RotaProtegida perm="epis_catalogo"><EpisCatalogoPage /></RotaProtegida>} />
        <Route path="/epis/recebimentos" element={<RotaProtegida perm="epi_recebimento_facial"><RelatorioRecebimentoEpis /></RotaProtegida>} />
        <Route path="/epis/devolucoes" element={<RotaProtegida perm="epis_devolucoes"><EpisDevolucoesProvider><EpisDevolucoes /></EpisDevolucoesProvider></RotaProtegida>} />
        <Route path="/epis/prontuario" element={<RotaProtegida perm="funcionarios"><EpisDevolucoesProvider><ProntuarioEpis /></EpisDevolucoesProvider></RotaProtegida>} />
        <Route path="/rh/treinamentos" element={<RotaProtegida perm="rh_treinamentos"><Treinamentos /></RotaProtegida>} />
        <Route path="/rh/solicitacoes-portal" element={<RotaProtegida perm="rh_solicitacoes_portal"><SolicitacoesPortalRH /></RotaProtegida>} />
        <Route path="/rh/importar-holerites" element={<RotaProtegida perm="rh_holerites"><ImportarHolerites /></RotaProtegida>} />
        <Route path="/rh/holerites-processados" element={<RotaProtegida perm="rh_holerites"><HoleritesProcessados /></RotaProtegida>} />
        <Route path="/exames" element={<RotaProtegida perm="funcionarios"><ExamesPage /></RotaProtegida>} />
        <Route path="/mapa-funcionarios" element={<RotaProtegida perm="mapa_funcionarios"><MapaFuncionarios /></RotaProtegida>} />
        <Route path="/mapa-plantoes" element={<RotaProtegida perm="mapa_funcionarios"><MapaPlantoes /></RotaProtegida>} />
        <Route path="/mapa-ferias" element={<RotaProtegida perm="mapa_funcionarios"><MapaFerias /></RotaProtegida>} />
        <Route path="/mapa-uniformes" element={<RotaProtegida perm="mapa_funcionarios"><MapaUniformes /></RotaProtegida>} />
        <Route path="/avaliacoes-desempenho" element={<RotaProtegida perm="avaliacoes_desempenho"><AvaliacoesDesempenhoPage /></RotaProtegida>} />
        <Route path="/usuarios" element={<RotaProtegida perm="usuarios"><Usuarios /></RotaProtegida>} />
        <Route path="/perfis-acesso" element={<RotaProtegida perm="perfis_acesso"><PerfisAcessoPage /></RotaProtegida>} />
        <Route path="/auditoria" element={<RotaProtegida perm="auditoria"><AuditoriaPage /></RotaProtegida>} />
        <Route path="/empresa" element={<RotaProtegida perm="empresa"><EmpresaDadosPage /></RotaProtegida>} />
        <Route path="/processo-seletivo/:requisicaoId" element={<RotaProtegida perm="processos_seletivos"><ProcessoSeletivo /></RotaProtegida>} />
        <Route path="/processos-seletivos" element={<RotaProtegida perm="processos_seletivos"><ProcessosSeletivos /></RotaProtegida>} />
        <Route path="/sco" element={<RotaProtegida perm="sco"><Sco /></RotaProtegida>} />
        <Route path="/i0" element={<RotaProtegida perm="i0"><I0Page /></RotaProtegida>} />
        <Route path="/compras/categorias" element={<RotaProtegida perm="categorias_compras"><CategoriasCompras /></RotaProtegida>} />
        <Route path="/compras/materiais" element={<RotaProtegida perm="materiais_servicos"><MateriaisServicos /></RotaProtegida>} />
        <Route path="/compras/requisicoes" element={<RotaProtegida perm="requisicoes_compras"><RequisicaoComprasPage /></RotaProtegida>} />
        <Route path="/compras/cotacoes" element={<RotaProtegida perm="cotacoes"><CotacaoComprasPage /></RotaProtegida>} />
        <Route path="/compras/pedidos" element={<RotaProtegida perm="pedidos_compra"><PedidoCompraPage /></RotaProtegida>} />
        <Route path="/compras/inteligencia" element={<RotaProtegida perm="requisicoes_compras"><InteligenciaComprasPage /></RotaProtegida>} />
        <Route path="/compras/assinar-lote-pc" element={<RotaProtegida perm="pedidos_compra"><AssinarLotePcPage /></RotaProtegida>} />
        <Route path="/compras/aprovar-lote-cotacoes" element={<RotaProtegida perm="cotacoes"><AprovarLoteCotacoesPage /></RotaProtegida>} />
        <Route path="/compras/recebimento" element={<RotaProtegida perm="recebimento"><RecebimentoComprasPage /></RotaProtegida>} />
        <Route path="/compras/estoque" element={<RotaProtegida perm="estoque"><EstoquePage /></RotaProtegida>} />
        <Route path="/compras/relatorios-estoque" element={<RotaProtegida perm="estoque"><RelatoriosEstoquePage /></RotaProtegida>} />
        <Route path="/compras/dashboard" element={<RotaProtegida perm="dashboard_compras"><DashboardCompras /></RotaProtegida>} />
        <Route path="/compras/banco-precos" element={<RotaProtegida perm="pedidos_compra"><BancoPrecosPage /></RotaProtegida>} />
        <Route path="/compras/fabricantes" element={<RotaProtegida perm="fabricantes"><FabricantesPage /></RotaProtegida>} />
        <Route path="/compras/pregao" element={<RotaProtegida perm="pregao"><PregoesPage /></RotaProtegida>} />
        <Route path="/compras/pregao/novo" element={<RotaProtegida perm="pregao"><PregaoFormPage /></RotaProtegida>} />
        <Route path="/compras/pregao/:id" element={<RotaProtegida perm="pregao"><PregaoFormPage /></RotaProtegida>} />
        <Route path="/compras/pregao/:id/sala" element={<RotaProtegida perm="pregao"><PregaoSalaPage /></RotaProtegida>} />
        <Route path="/compras/pregao/:id/habilitacao" element={<RotaProtegida perm="pregao"><PregaoHabilitacaoPage /></RotaProtegida>} />
        <Route path="/compras/pregao/:id/resultado" element={<RotaProtegida perm="pregao"><PregaoResultadoPage /></RotaProtegida>} />
        <Route path="/licitacoes" element={<RotaProtegida perm="licitacoes"><LicitacoesPage /></RotaProtegida>} />
        <Route path="/engenharia/dashboard-medicoes" element={<RotaProtegida perm="dashboard_medicoes"><DashboardMedicoesPage /></RotaProtegida>} />
        <Route
          path="/engenharia/dashboard"
          element={
            <RotaProtegida perm="dashboard_ssos">
              <SolicitacoesServicosProvider>
                <OrdensServicoProvider>
                  <OrcamentosProvider>
                    <DashboardSSOSPage />
                  </OrcamentosProvider>
                </OrdensServicoProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/dashboard-solicitacoes"
          element={
            <RotaProtegida perm="solicitacao_servicos">
              <SolicitacoesServicosProvider>
                <OrdensServicoProvider>
                  <OrcamentosProvider>
                    <DashboardSolicitacoesPage />
                  </OrcamentosProvider>
                </OrdensServicoProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route path="/engenharia/contratos-terceiros" element={<RotaProtegida perm="contratos_terceiros"><ContratosTerceirosPage /></RotaProtegida>} />
        <Route path="/engenharia/medicoes" element={<RotaProtegida perm="medicoes"><MedicoesProvider><MedicoesServicosPage /></MedicoesProvider></RotaProtegida>} />

        <Route path="/patrimonio/ferramentas" element={<RotaProtegida perm="ferramentas"><FerramentasPage /></RotaProtegida>} />
        <Route path="/qualidade/evidencias" element={<RotaProtegida perm="evidencias"><EvidenciasPage /></RotaProtegida>} />
        <Route path="/qualidade/checklists" element={<RotaProtegida perm="checklists"><ChecklistsPage /></RotaProtegida>} />
        <Route path="/cadastros/equipamentos" element={<RotaProtegida perm="equipamentos"><EquipamentosPage /></RotaProtegida>} />
        <Route path="/pmoc" element={<RotaProtegida perm="pmoc"><PmocPage /></RotaProtegida>} />
        <Route path="/pmoc/gerenciar-operacao" element={<RotaProtegida perm="pmoc"><PmocGerenciarOperacaoPage /></RotaProtegida>} />
        <Route path="/engenharia/plano-manutencao" element={<RotaProtegida perm="plano_manutencao"><PlanoManutencaoPage /></RotaProtegida>} />
        <Route path="/engenharia/base-conhecimento" element={<RotaProtegida perm="base_conhecimento"><BaseConhecimentoPage /></RotaProtegida>} />
        <Route path="/cadastros/categorias-servicos" element={<RotaProtegida perm="categorias_servicos"><CategoriasServicosPage /></RotaProtegida>} />
        <Route path="/cadastros/servicos" element={<RotaProtegida perm="servicos"><ServicosPage /></RotaProtegida>} />
        <Route path="/cadastros/modelos-os" element={<RotaProtegida><OsModelosPage /></RotaProtegida>} />
        <Route
          path="/engenharia/solicitacao-servicos"
          element={
            <RotaProtegida perm="solicitacao_servicos">
              <SolicitacoesServicosProvider>
                <OrdensServicoProvider>
                  <OrcamentosProvider>
                    <SolicitacaoServicosPage />
                  </OrcamentosProvider>
                </OrdensServicoProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/aprovar-lote-ss"
          element={
            <RotaProtegida perm="solicitacao_servicos">
              <SolicitacoesServicosProvider>
                <OrcamentosProvider>
                  <OrdensServicoProvider>
                    <AprovarLoteSS />
                  </OrdensServicoProvider>
                </OrcamentosProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/assinar-lote-os"
          element={
            <RotaProtegida perm="ordem_servico">
              <OrdensServicoProvider>
                <AssinarLoteOsPage />
              </OrdensServicoProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/confirmar-lote-os"
          element={
            <RotaProtegida perm="ordem_servico">
              <SolicitacoesServicosProvider>
                <OrdensServicoProvider>
                  <ConfirmarLoteOsPage />
                </OrdensServicoProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/validar-lote-os"
          element={
            <RotaProtegida perm="ordem_servico">
              <OrdensServicoProvider>
                <ValidarLoteOsPage />
              </OrdensServicoProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/faturar-lote-os"
          element={
            <RotaProtegida perm="ordem_servico">
              <OrdensServicoProvider>
                <FaturarLoteOsPage />
              </OrdensServicoProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/imprimir-lote-os"
          element={
            <RotaProtegida perm="ordem_servico">
              <OrdensServicoProvider>
                <OrcamentosProvider>
                  <ImprimirLoteOsPage />
                </OrcamentosProvider>
              </OrdensServicoProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/engenharia/ordem-servico"
          element={
            <RotaProtegida perm="ordem_servico">
              <OrdensServicoProvider>
                <OrcamentosProvider>
                  <OrdensServicoPage />
                </OrcamentosProvider>
              </OrdensServicoProvider>
            </RotaProtegida>
          }
        />
        <Route path="/engenharia/rdo" element={<RotaProtegida perm="rdo"><RdoPage /></RotaProtegida>} />
        <Route path="/engenharia/cronograma" element={<RotaProtegida perm="cronograma"><CronogramaPage /></RotaProtegida>} />
        <Route path="/engenharia/eventograma" element={<RotaProtegida perm="eventograma"><EventogramaPage /></RotaProtegida>} />
        <Route path="/engenharia/boletim-medicao" element={<RotaProtegida perm="boletim_medicao"><BoletinsMedicaoProvider><BoletimMedicaoPage /></BoletinsMedicaoProvider></RotaProtegida>} />
        <Route path="/obras/bim" element={<RotaProtegida perm="bim"><BimPage /></RotaProtegida>} />
        <Route path="/engenharia/responsaveis-tecnicos" element={<RotaProtegida perm="responsaveis_tecnicos"><ResponsaveisTecnicosPage /></RotaProtegida>} />
        <Route path="/cadastros/responsaveis-tecnicos" element={<RotaProtegida perm="responsaveis_tecnicos"><ResponsaveisTecnicosPage /></RotaProtegida>} />
        <Route path="/comunicacao/mensagens" element={<RotaProtegida perm="comunicacao_mensagens"><ComunicacaoMensagensPage /></RotaProtegida>} />
        <Route path="/comunicacao/avisos" element={<RotaProtegida perm="comunicacao_avisos"><ComunicacaoAvisosPage /></RotaProtegida>} />
        <Route path="/comunicacao/notificacoes" element={<RotaProtegida perm="comunicacao_notificacoes"><ComunicacaoNotificacoesPage /></RotaProtegida>} />
        <Route path="/comunicacao/whatsapp" element={<RotaProtegida perm="comunicacao_whatsapp"><ComunicacaoWhatsappPage /></RotaProtegida>} />
        <Route path="/comunicacao/grupos-whatsapp" element={<RotaProtegida perm="comunicacao_whatsapp"><ComunicacaoGruposWhatsappPage /></RotaProtegida>} />
        <Route path="/juridico" element={<RotaProtegida perm="juridico"><JuridicoPage /></RotaProtegida>} />
        <Route path="/chat-duda" element={<RotaProtegida perm="chat_duda"><ChatDudaPage /></RotaProtegida>} />
        <Route path="/orcamentos" element={<RotaProtegida perm="orcamentos_sco"><OrcamentosSco /></RotaProtegida>} />
        <Route path="/orcamentos/novo" element={<RotaProtegida perm="orcamentos_sco"><OrcamentoScoForm /></RotaProtegida>} />
        <Route path="/orcamentos/:id" element={<RotaProtegida perm="orcamentos_sco"><OrcamentoScoForm /></RotaProtegida>} />
        <Route path="/orcamentos/catalogo" element={<RotaProtegida perm="orcamentos_sco"><CatalogoSco /></RotaProtegida>} />
        <Route path="/orcamentos/importar-catalogo" element={<RotaProtegida perm="orcamentos_sco"><ImportarCatalogoSco /></RotaProtegida>} />
        <Route path="/financeiro/dashboard" element={<RotaProtegida perm="financeiro.dashboard"><DashboardFinanceiro /></RotaProtegida>} />
        <Route path="/financeiro/contas-pagar" element={<RotaProtegida perm="financeiro.contas_pagar"><ContasPagar /></RotaProtegida>} />
        <Route path="/financeiro/contas-receber" element={<RotaProtegida perm="financeiro.contas_receber"><ContasReceber /></RotaProtegida>} />
        <Route path="/financeiro/contas-bancarias" element={<RotaProtegida perm="financeiro.contas_bancarias"><ContasBancarias /></RotaProtegida>} />
        <Route path="/financeiro/plano-contas" element={<RotaProtegida perm="financeiro.plano_contas"><PlanoContas /></RotaProtegida>} />
        <Route path="/financeiro/centros-custo" element={<RotaProtegida perm="financeiro.centros_custo"><CentrosCusto /></RotaProtegida>} />
        <Route path="/financeiro/fluxo-caixa" element={<RotaProtegida perm="financeiro.fluxo_caixa"><FluxoCaixa /></RotaProtegida>} />
        <Route path="/financeiro/dre" element={<RotaProtegida perm="financeiro.dre"><Dre /></RotaProtegida>} />
        <Route path="/financeiro/conciliacao" element={<RotaProtegida perm="financeiro.conciliacao"><Conciliacao /></RotaProtegida>} />
        <Route path="/financeiro/lancamentos" element={<RotaProtegida perm="financeiro.lancamentos"><Lancamentos /></RotaProtegida>} />
        <Route path="/financeiro/relatorios" element={<RotaProtegida perm="financeiro.relatorios"><RelatoriosFinanceiros /></RotaProtegida>} />
        <Route path="/financeiro/condicoes-pagamento" element={<RotaProtegida perm="financeiro.condicoes_pagamento"><CondicoesPagamento /></RotaProtegida>} />
        <Route path="/financeiro/nfes-recebidas" element={<RotaProtegida perm="financeiro.nfes_recebidas"><NfesRecebidas /></RotaProtegida>} />
        <Route path="/financeiro/nfse" element={<RotaProtegida perm="financeiro.nfes_recebidas"><NfseEmitir /></RotaProtegida>} />
        <Route path="/financeiro/faturamentos" element={<RotaProtegida perm="faturamentos"><Faturamentos /></RotaProtegida>} />
        <Route
          path="/gerencial/relatorios"
          element={
            <RotaProtegida perm="gerencial_relatorios">
              <SolicitacoesServicosProvider>
                <OrdensServicoProvider>
                  <RelatoriosGerenciais />
                </OrdensServicoProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/gerencial/dashboard"
          element={
            <RotaProtegida perm="gerencial_dashboard">
              <SolicitacoesServicosProvider>
                <OrdensServicoProvider>
                  <DashboardMultisistemico />
                </OrdensServicoProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/gerencial/multidimensional"
          element={
            <RotaProtegida perm="gerencial_multidim">
              <SolicitacoesServicosProvider>
                <OrdensServicoProvider>
                  <OrcamentosProvider>
                    <RelatoriosMultidimensional />
                  </OrcamentosProvider>
                </OrdensServicoProvider>
              </SolicitacoesServicosProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/gerencial/painel-faturamento"
          element={
            <RotaProtegida perm="gerencial_relatorios">
              <OrdensServicoProvider>
                <PainelFaturamentoClientes />
              </OrdensServicoProvider>
            </RotaProtegida>
          }
        />
        <Route
          path="/gerencial/mapa-clientes"
          element={
            <RotaProtegida perm="gerencial_mapa_clientes">
              <MapaClientes />
            </RotaProtegida>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes></Suspense>
    </AppLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}><Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <ProtectedAppRoutes />
          </RequireAuth>
        }
      />
    </Routes></Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ClientesProvider>
    <CargosProvider>
    <EpisCatalogoProvider>
    <NrsCatalogoProvider>
    <FuncionariosProvider>
    <LancamentosProvider>
    <UsuariosProvider>
    <RequisicaoProvider>
    <ProcessoSeletivoProvider>
    <ScoProvider>
    <I0Provider>
    <CategoriasComprasProvider>
    <MateriaisServicosProvider>
    <MaterialScoVinculosProvider>
    <RequisicaoComprasProvider>
    <CotacaoComprasProvider>
    <PedidoCompraProvider>
    <EstoqueProvider>
    <RecebimentoProvider>
    <FabricantesProvider>
    <PregaoProvider>
    <PerfisAcessoProvider>
    <EmpresaProvider>
    <LicitacoesProvider>
    <MedicoesProvider>
    <OrcamentosProvider>
    <FerramentasProvider>
    <EvidenciasProvider>
    <ChecklistsProvider>
    <EquipamentosProvider>
    <LaudosCondenacaoProvider>
    <LaudosAssinaturasProvider>
    <PmocProvider>
    <CategoriasServicosProvider>
    <ServicosProvider>
    <OsModelosProvider>
    <ComunicacaoProvider>
    <ProcessosTrabalhalistasProvider>
    <ResponsaveisTecnicosProvider>
    <PlanosManutencaoProvider>
    <KnowledgeBaseProvider>
    <ObrasProvider>
    <RdosProvider>
    <RdoAssinaturasProvider>
    <CronogramasProvider>
    <EventogramasProvider>
    <BimProvider>
    <OrcamentosScoProvider>
    <OsAssinaturasProvider>
    <BoletimAssinaturasProvider>
    <PcAssinaturasProvider>
    <FinanceiroProvider>
    <NfsesProvider>
    <AuthProvider> {/* auth wrapper */}
    <PortalAuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}><Routes>
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="/cotacao/proposta/:token" element={<PropostaFornecedorPage />} />

          <Route path="/portal-fornecedor" element={<PortalFornecedorPage />} />
          <Route path="/portal-fornecedor/pregao/:id/sala" element={<PregaoSalaFornecedorPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/portal-candidato/:processoId/:candidatoId" element={<PortalCandidato />} />
          <Route path="/equipamento/:id" element={<EquipamentoPublico />} />
          <Route path="/receber-epis/:token" element={<ReceberEpis />} />
          <Route path="/devolver-epis/:token" element={<DevolverEpis />} />
          <Route path="/instalar" element={<Instalar />} />
          <Route path="/app/orcamentos/instalar" element={<InstalarOrcamentos />} />
          <Route
            path="/app/orcamentos"
            element={
              <RequireAuth>
                <SolicitacoesServicosProvider>
                  <OrdensServicoProvider>
                    <OrcamentosProvider>
                      <OrcamentosMobile />
                    </OrcamentosProvider>
                  </OrdensServicoProvider>
                </SolicitacoesServicosProvider>
              </RequireAuth>
            }
          />

          <Route path="/verificar-assinatura" element={<VerificarAssinaturaPage />} />
          <Route path="/verificar-assinatura/:codigo" element={<VerificarAssinaturaPage />} />

          {/* Portal do Funcionário / Candidato */}
          <Route path="/portal" element={<PortalLogin />} />
          <Route path="/portal/cadastrar-senha" element={<PortalCadastrarSenha />} />
          <Route path="/portal/esqueci-senha" element={<PortalEsqueciSenha />} />
          <Route path="/portal/funcionario" element={<PortalFuncHome />} />
          <Route path="/portal/funcionario/holerites" element={<PortalHolerites />} />
          <Route path="/portal/funcionario/epis" element={<PortalFuncEpis />} />
          <Route path="/portal/funcionario/documentos" element={<PortalFuncDocumentos />} />
          <Route path="/portal/funcionario/perfil" element={<PortalPerfil />} />
          <Route path="/portal/funcionario/ferias" element={<PortalFuncFerias />} />
          <Route path="/portal/funcionario/treinamentos" element={<PortalFuncTreinamentos />} />
          <Route path="/portal/funcionario/solicitacoes" element={<PortalFuncSolicitacoes />} />
          <Route path="/portal/funcionario/avisos" element={<PortalFuncAvisos />} />
          <Route path="/portal/candidato" element={<PortalCandHome />} />
          <Route path="/portal/candidato/ficha" element={<PortalFicha />} />
          <Route path="/portal/candidato/documentos" element={<PortalCandDocumentos />} />
          <Route path="/portal/candidato/termos" element={<PortalTermos />} />
          <Route path="/portal/candidato/admissional" element={<PortalAdmissional />} />

          <Route
            path="/monitor-tv"
            element={
              <RequireAuth>
                <SolicitacoesServicosProvider>
                  <OrdensServicoProvider>
                    <MonitorTV />
                  </OrdensServicoProvider>
                </SolicitacoesServicosProvider>
              </RequireAuth>
            }
          />
          <Route path="/*" element={<AppRoutes />} />
        </Routes></Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </PortalAuthProvider>
    </AuthProvider>
    </NfsesProvider>
    </FinanceiroProvider>
    </PcAssinaturasProvider>
    </BoletimAssinaturasProvider>
    </OsAssinaturasProvider>
    </OrcamentosScoProvider>
    </BimProvider>
    </EventogramasProvider>
    </CronogramasProvider>
    </RdoAssinaturasProvider>
    </RdosProvider>
    </ObrasProvider>
    </KnowledgeBaseProvider>
    </PlanosManutencaoProvider>
    </ResponsaveisTecnicosProvider>
    </ProcessosTrabalhalistasProvider>
    </ComunicacaoProvider>
    </OsModelosProvider>
    </ServicosProvider>
    </CategoriasServicosProvider>
    </PmocProvider>
    </LaudosAssinaturasProvider>
    </LaudosCondenacaoProvider>
    </EquipamentosProvider>
    </ChecklistsProvider>
    </EvidenciasProvider>
    </FerramentasProvider>
    </OrcamentosProvider>
    </MedicoesProvider>
    </LicitacoesProvider>
    </EmpresaProvider>
    </PerfisAcessoProvider>
    </PregaoProvider>
    </FabricantesProvider>
    </RecebimentoProvider>
    </EstoqueProvider>
    </PedidoCompraProvider>
    </CotacaoComprasProvider>
    </RequisicaoComprasProvider>
    </MaterialScoVinculosProvider>
    </MateriaisServicosProvider>
    </CategoriasComprasProvider>
    </I0Provider>
    </ScoProvider>
    </ProcessoSeletivoProvider>
    </RequisicaoProvider>
    </UsuariosProvider>
    </LancamentosProvider>
    </FuncionariosProvider>
    </NrsCatalogoProvider>
    </EpisCatalogoProvider>
    </CargosProvider>
    </ClientesProvider>
  </QueryClientProvider>
);

export default App;