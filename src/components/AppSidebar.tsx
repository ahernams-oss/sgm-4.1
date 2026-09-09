import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  Users,
  Briefcase,
  UserCheck,
  Shield,
  LogOut,
  ClipboardCheck,
  Receipt,
  Truck,
  LayoutDashboard,
  CalendarClock,
  FileSpreadsheet,
  DollarSign,
  ShoppingCart,
  Tags,
  Package,
  BarChart3,
  Scale,
  FileCheck,
  PackageCheck,
  Factory,
  Warehouse,
  KeyRound,
  Building2,
  HardHat,
  Stethoscope,
  FileBarChart,
  Gavel,
  Ruler,
  Wrench,
  ShieldCheck,
  Monitor,
  Fan,
  MessageSquare,
  Megaphone,
  Bell,
  BotMessageSquare,
  Box,
  History,
  Sparkles,
  CreditCard,
  FileText,
  GanttChartSquare,
  MapPin,
  Shirt,
  FileSignature,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissao } from "@/hooks/usePermissao";

import { NavLink } from "@/components/NavLink";
import { useLocation } from "@/lib/router-compat";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect } from "react";

const menuItems = [
  {
    group: "Gestão de Pessoas",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, perm: "dashboard_gp" },
      { title: "Requisição de Pessoal", url: "/requisicao-pessoal", icon: ClipboardList, perm: "requisicao_colaboradores" },
      { title: "Processos Seletivos", url: "/processos-seletivos", icon: ClipboardCheck, perm: "processos_seletivos" },
      { title: "Funcionários", url: "/funcionarios", icon: UserCheck, perm: "funcionarios" },
      { title: "EPIs", url: "/epis", icon: HardHat, perm: "funcionarios" },
      { title: "Recebimento de EPIs (Facial)", url: "/epis/recebimentos", icon: HardHat, perm: "epi_recebimento_facial" },
      { title: "Devolução de EPIs", url: "/epis/devolucoes", icon: HardHat, perm: "epis_devolucoes" },
      { title: "Prontuário de EPIs", url: "/epis/prontuario", icon: HardHat, perm: "funcionarios" },
      { title: "Exames Periódicos", url: "/exames", icon: Stethoscope, perm: "funcionarios" },
      { title: "Mapa de Funcionários", url: "/mapa-funcionarios", icon: CalendarClock, perm: "mapa_funcionarios" },
      { title: "Mapa de Plantões", url: "/mapa-plantoes", icon: CalendarClock, perm: "mapa_funcionarios" },
      { title: "Mapa de Férias", url: "/mapa-ferias", icon: CalendarClock, perm: "mapa_funcionarios" },
      { title: "Mapa de Uniformes", url: "/mapa-uniformes", icon: Shirt, perm: "mapa_funcionarios" },
      { title: "Avaliações de Desempenho", url: "/avaliacoes-desempenho", icon: ClipboardCheck, perm: "avaliacoes_desempenho" },
      { title: "Treinamentos", url: "/rh/treinamentos", icon: GraduationCap, perm: "rh_treinamentos" },
      { title: "Solicitações do Portal", url: "/rh/solicitacoes-portal", icon: FileText, perm: "rh_solicitacoes_portal" },
      { title: "Importar Holerites", url: "/rh/importar-holerites", icon: FileText, perm: "rh_holerites" },
      { title: "Holerites Processados", url: "/rh/holerites-processados", icon: FileText, perm: "rh_holerites" },
    ],
  },
  {
    group: "Patrimônio",
    items: [{ title: "Ferramentas", url: "/patrimonio/ferramentas", icon: Wrench, perm: "ferramentas" }],
  },
  {
    group: "Engenharia e Manutenção",
    items: [
      { title: "Dashboard SS / OS", url: "/engenharia/dashboard", icon: BarChart3, perm: "dashboard_ssos" },
      
      { title: "Plano de Manutenção", url: "/engenharia/plano-manutencao", icon: Wrench, perm: "plano_manutencao" },
      { title: "Base de Conhecimento", url: "/engenharia/base-conhecimento", icon: BookOpen, perm: "base_conhecimento" },
    ],
  },
  {
    group: "Solicitações de Serviço",
    items: [
      { title: "Dashboard Solicitações", url: "/engenharia/dashboard-solicitacoes", icon: BarChart3, perm: "solicitacao_servicos" },
      { title: "Solicitação de Serviços", url: "/engenharia/solicitacao-servicos", icon: ClipboardList, perm: "solicitacao_servicos" },
      { title: "Aprovar SS em Lote", url: "/engenharia/aprovar-lote-ss", icon: ClipboardCheck, perm: "solicitacao_servicos.aprovar_lote" },
    ],
  },
  {
    group: "Ordens de Serviço",
    items: [
      { title: "Ordem de Serviço", url: "/engenharia/ordem-servico", icon: Wrench, perm: "ordem_servico" },
      { title: "Confirmar OS em Lote", url: "/engenharia/confirmar-lote-os", icon: ClipboardCheck, perm: "os.confirmar_lote" },
      { title: "Validar OS em Lote", url: "/engenharia/validar-lote-os", icon: ClipboardCheck, perm: "os.validar_lote" },
      { title: "Assinar OS em Lote", url: "/engenharia/assinar-lote-os", icon: ClipboardCheck, perm: "os.assinar_lote" },
      { title: "Faturar OS em Lote", url: "/engenharia/faturar-lote-os", icon: Receipt, perm: "ordem_servico.status.faturada" },
      { title: "Imprimir OS em Lote", url: "/engenharia/imprimir-lote-os", icon: ClipboardCheck, perm: "os.imprimir_lote" },
    ],
  },
  {
    group: "Obras",
    items: [
      { title: "Dashboard Medições", url: "/engenharia/dashboard-medicoes", icon: BarChart3, perm: "dashboard_medicoes" },
      { title: "RDO - Diário de Obras", url: "/engenharia/rdo", icon: FileSpreadsheet, perm: "rdo" },
      { title: "Cronograma Físico-Financeiro", url: "/engenharia/cronograma", icon: CalendarClock, perm: "cronograma" },
      { title: "Boletim de Medições", url: "/engenharia/boletim-medicao", icon: FileBarChart, perm: "boletim_medicao" },
      { title: "Eventograma", url: "/engenharia/eventograma", icon: GanttChartSquare, perm: "eventograma" },
      { title: "Contratos de Terceiro", url: "/engenharia/contratos-terceiros", icon: FileSignature, perm: "contratos_terceiros" },
      { title: "Medição de Terceiros", url: "/engenharia/medicoes", icon: Ruler, perm: "medicoes" },
      { title: "BIM - Modelagem 3D", url: "/obras/bim", icon: Box, perm: "bim" },
    ],
  },
  {
    group: "Orçamentos",
    items: [
      { title: "Orçamentos SCO", url: "/orcamentos", icon: FileSpreadsheet, perm: "sco" },
      { title: "Catálogo de Preços", url: "/orcamentos/catalogo", icon: BookOpen, perm: "sco" },
      { title: "Importar Catálogo FGV", url: "/orcamentos/importar-catalogo", icon: PackageCheck, perm: "sco" },
    ],
  },
  {
    group: "Compras e Suprimentos",
    items: [
      { title: "Dashboard Compras", url: "/compras/dashboard", icon: LayoutDashboard, perm: "dashboard_compras" },
      { title: "Requisições de Compras", url: "/compras/requisicoes", icon: ShoppingCart, perm: "requisicoes_compras" },
      { title: "Cotações", url: "/compras/cotacoes", icon: Scale, perm: "cotacoes" },
      { title: "Ordens de Compra", url: "/compras/pedidos", icon: FileCheck, perm: "pedidos_compra" },
      { title: "Aprovação em Lote (Menor Preço)", url: "/compras/aprovar-lote-cotacoes", icon: CheckCircle2, perm: "cotacoes" },
      { title: "Assinar PC em Lote", url: "/compras/assinar-lote-pc", icon: ShieldCheck, perm: "pc_assinatura" },
      { title: "Inteligência de Compras", url: "/compras/inteligencia", icon: Sparkles, perm: "requisicoes_compras" },
      { title: "Recebimento", url: "/compras/recebimento", icon: PackageCheck, perm: "recebimento" },
      { title: "Banco de Preços", url: "/compras/banco-precos", icon: DollarSign, perm: "pedidos_compra" },
      { title: "Estoque", url: "/compras/estoque", icon: Warehouse, perm: "estoque" },
      { title: "Relatórios de Estoque", url: "/compras/relatorios-estoque", icon: FileBarChart, perm: "estoque" },
      { title: "Pregão Eletrônico", url: "/compras/pregao", icon: Gavel, perm: "pregao" },
    ],
  },
  {
    group: "Licitações",
    items: [{ title: "Licitações", url: "/licitacoes", icon: Gavel, perm: "licitacoes" }],
  },
  {
    group: "Jurídico",
    items: [{ title: "Contencioso Jurídico", url: "/juridico", icon: Scale, perm: "juridico" }],
  },
  {
    group: "Comunicação",
    items: [
      { title: "Mensagens", url: "/comunicacao/mensagens", icon: MessageSquare, perm: "comunicacao_mensagens" },
      { title: "Avisos e Comunicados", url: "/comunicacao/avisos", icon: Megaphone, perm: "comunicacao_avisos" },
      { title: "Notificações de Tarefas", url: "/comunicacao/notificacoes", icon: Bell, perm: "comunicacao_notificacoes" },
      { title: "Notificação WhatsApp", url: "/comunicacao/whatsapp", icon: MessageSquare, perm: "comunicacao_whatsapp" },
      { title: "Grupos WhatsApp", url: "/comunicacao/grupos-whatsapp", icon: Users, perm: "comunicacao_whatsapp" },
    ],
  },
  {
    group: "PMOC",
    items: [
      { title: "PMOC", url: "/pmoc", icon: Fan, perm: "pmoc" },
      { title: "Gerenciar Operação", url: "/pmoc/gerenciar-operacao", icon: Fan, perm: "pmoc" },
    ],
  },
  {
    group: "Qualidade",
    items: [
      { title: "Registro de Evidências", url: "/qualidade/evidencias", icon: ShieldCheck, perm: "evidencias" },
      { title: "Checklists", url: "/qualidade/checklists", icon: ClipboardCheck, perm: "checklists" },
    ],
  },
  {
    group: "Assistente IA",
    items: [{ title: "Duda - Assistente", url: "/chat-duda", icon: BotMessageSquare, perm: "chat_duda" }],
  },
  {
    group: "Financeiro",
    items: [
      { title: "Dashboard Financeiro", url: "/financeiro/dashboard", icon: LayoutDashboard, perm: "financeiro.dashboard" },
      { title: "Contas a Pagar", url: "/financeiro/contas-pagar", icon: DollarSign, perm: "financeiro.contas_pagar" },
      { title: "Contas a Receber", url: "/financeiro/contas-receber", icon: DollarSign, perm: "financeiro.contas_receber" },
      { title: "Contas Bancárias", url: "/financeiro/contas-bancarias", icon: Building2, perm: "financeiro.contas_bancarias" },
      { title: "Plano de Contas", url: "/financeiro/plano-contas", icon: BookOpen, perm: "financeiro.plano_contas" },
      { title: "Centros de Custo", url: "/financeiro/centros-custo", icon: Tags, perm: "financeiro.centros_custo" },
      { title: "Fluxo de Caixa", url: "/financeiro/fluxo-caixa", icon: BarChart3, perm: "financeiro.fluxo_caixa" },
      { title: "DRE Gerencial", url: "/financeiro/dre", icon: FileBarChart, perm: "financeiro.dre" },
      { title: "Conciliação Bancária", url: "/financeiro/conciliacao", icon: FileCheck, perm: "financeiro.conciliacao" },
      { title: "Lançamentos", url: "/financeiro/lancamentos", icon: ClipboardList, perm: "financeiro.lancamentos" },
      { title: "Condições de Pagamento", url: "/financeiro/condicoes-pagamento", icon: CreditCard, perm: "financeiro.condicoes_pagamento" },
      { title: "NFes Recebidas", url: "/financeiro/nfes-recebidas", icon: FileText, perm: "financeiro.nfes_recebidas" },
      { title: "Relatórios Financeiros", url: "/financeiro/relatorios", icon: FileBarChart, perm: "financeiro.relatorios" },
    ],
  },
  {
    group: "Faturamento",
    items: [
      { title: "Faturamento (por Contrato)", url: "/clientes?tab=faturamento", icon: DollarSign, perm: "clientes" },
      { title: "Acompanhamento de Faturamentos", url: "/financeiro/faturamentos", icon: FileBarChart, perm: "faturamentos" },
      { title: "Transferência de Saldos (Contratos)", url: "/clientes/transferencias-saldo", icon: Users, perm: "faturamentos", requiresAcessoTotal: true },
      { title: "NFS-e Emitidas", url: "/financeiro/nfse", icon: FileText, perm: "financeiro.nfes_recebidas" },
    ],
  },
  {
    group: "Gerencial",
    items: [
      { title: "Painel TV (Tempo Real)", url: "/monitor-tv", icon: Monitor, perm: "monitor_tv" },
      { title: "Dashboard Multisistêmico", url: "/gerencial/dashboard", icon: LayoutDashboard, perm: "gerencial_dashboard" },
      { title: "Painel de Faturamento", url: "/gerencial/painel-faturamento", icon: Receipt, perm: "gerencial_relatorios" },
      { title: "Relatórios Gerenciais", url: "/gerencial/relatorios", icon: FileBarChart, perm: "gerencial_relatorios" },
      { title: "Relatórios Multidimensional", url: "/gerencial/multidimensional", icon: BarChart3, perm: "gerencial_multidim" },
      { title: "Mapa de Clientes - RJ", url: "/gerencial/mapa-clientes", icon: MapPin, perm: "gerencial_mapa_clientes" },
    ],
  },

  {
    group: "Cadastros",
    items: [
      { title: "Dados da Empresa", url: "/empresa", icon: Building2, perm: "empresa" },
      { title: "Clientes", url: "/clientes", icon: Users, perm: "clientes" },
      { title: "Equipamentos", url: "/cadastros/equipamentos", icon: Monitor, perm: "equipamentos" },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck, perm: "fornecedores" },
      { title: "Cargos", url: "/cargos", icon: Briefcase, perm: "cargos" },
      { title: "Catálogo de EPIs", url: "/epis/catalogo", icon: HardHat, perm: "epis_catalogo" },
      { title: "Cadastro de NRs", url: "/cadastros/nrs", icon: ShieldCheck, perm: "nrs_catalogo" },
      { title: "Categorias de Serviços", url: "/cadastros/categorias-servicos", icon: Tags, perm: "categorias_servicos" },
      { title: "Serviços", url: "/cadastros/servicos", icon: Wrench, perm: "servicos" },
      { title: "Modelo de OS", url: "/cadastros/modelos-os", icon: FileText },
      { title: "Responsáveis Técnicos", url: "/cadastros/responsaveis-tecnicos", icon: UserCheck, perm: "responsaveis_tecnicos" },
      { title: "SCO", url: "/sco", icon: FileSpreadsheet, perm: "sco" },
      { title: "I0", url: "/i0", icon: DollarSign, perm: "sco" },
      { title: "Materiais e Serviços", url: "/compras/materiais", icon: Package, perm: "materiais_servicos" },
      { title: "Categorias de Compras", url: "/compras/categorias", icon: Tags, perm: "categorias_compras" },
      { title: "Fabricantes", url: "/compras/fabricantes", icon: Factory, perm: "fabricantes" },
    ],
  },
];
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { usuarioLogado, logout } = useAuth();
  const { temModulo, acessoTotal, isDiretor } = usePermissao();

  const visibleGroups = menuItems
    .map((g) => ({
      ...g,
      items: g.items.filter((it: any) => (!it.perm || temModulo(it.perm)) && (!it.requiresAcessoTotal || acessoTotal)),
    }))
    .filter((g) => g.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("sidebar:openGroups");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      visibleGroups.forEach((g) => {
        const hasActive = g.items.some((it) => location.pathname === it.url.split("?")[0]);
        if (hasActive) next[g.group] = true;
        else if (next[g.group] === undefined) next[g.group] = true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try { localStorage.setItem("sidebar:openGroups", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <img src="/Logo_Lasant.png" alt="Lasant Construções" className="h-8 w-auto shrink-0 border rounded-sm bg-white object-contain" />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-2xl font-serif font-semibold text-sidebar-foreground leading-none mx-[6px]">SGM</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => {
          const isOpen = openGroups[group.group] ?? true;
          return (
            <Collapsible
              key={group.group}
              open={collapsed ? true : isOpen}
              onOpenChange={() => !collapsed && toggleGroup(group.group)}
            >
              <SidebarGroup>
                {!collapsed && (
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="font-bold cursor-pointer flex items-center justify-between hover:bg-sidebar-accent/30 rounded-md transition-colors text-[hsl(225,73%,40%)]">
                      <span>{group.group}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                      />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end
                              className="hover:bg-sidebar-accent/50 font-semibold"
                              activeClassName="bg-sidebar-accent text-primary font-medium"
                            >
                              <item.icon className="mr-2 h-4 w-4" />
                              {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {(acessoTotal || temModulo("usuarios")) && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/usuarios"
                  end
                  className="hover:bg-sidebar-accent/50"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Usuários</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {(acessoTotal || temModulo("perfis_acesso")) && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/perfis-acesso"
                  end
                  className="hover:bg-sidebar-accent/50"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Perfis de Acesso</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {(isDiretor || temModulo("auditoria")) && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/auditoria"
                  end
                  className="hover:bg-sidebar-accent/50"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <History className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Auditoria</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>

        {usuarioLogado && (
          <div className="px-3 pb-3 pt-1">
            <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
              <div className="flex-1 min-w-0">
                {!collapsed && (
                  <>
                    <p className="text-xs font-medium text-sidebar-foreground truncate">{usuarioLogado.nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{usuarioLogado.email}</p>
                  </>
                )}
              </div>
              <button
                onClick={logout}
                className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
