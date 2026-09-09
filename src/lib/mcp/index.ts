import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarClientes from "./tools/listar-clientes";
import listarOrdensServico from "./tools/listar-ordens-servico";
import listarSolicitacoesServico from "./tools/listar-solicitacoes-servico";
import listarRequisicoesCompras from "./tools/listar-requisicoes-compras";
import listarFuncionarios from "./tools/listar-funcionarios";
import consultarEstoque from "./tools/consultar-estoque";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lasant-sgm-4-0",
  title: "Lasant SGM 4.0",
  version: "0.1.0",
  instructions:
    "Ferramentas somente-leitura do SGM (Sistema de Gestão e Manutenção da Lasant): clientes, ordens de serviço (OS), solicitações de serviço (SS), requisições de compras (RCS), funcionários e estoque. Use-as para consultar dados reais do sistema; nunca invente registros.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarClientes,
    listarOrdensServico,
    listarSolicitacoesServico,
    listarRequisicoesCompras,
    listarFuncionarios,
    consultarEstoque,
  ],
});
