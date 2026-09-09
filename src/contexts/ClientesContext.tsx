import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAll, insertRow, updateRow, deleteRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";


export interface InformacaoFinanceira { id: string; banco: string; agencia: string; conta: string; chavePix: string; }
export interface Setor {
  id: string; descricao: string; ativo: boolean;
  ocupantesFixos?: string; ocupantesFlutuantes?: string;
  largura?: string; comprimento?: string; altura?: string;
  critico?: boolean;
}
export interface Pavimento { id: string; descricao: string; ativo: boolean; setores: Setor[]; }
export interface LocalCliente {
  id: string; descricao: string; cep: string; bairro: string; logradouro: string;
  numero: string; complemento: string; uf: string; cidade: string;
  latitude: string; longitude: string; areaTotal: string; areaConstruida: string;
  contato: string; telContato: string;
  relLinha1: string; relLinha2: string; relLinha3: string; relLinha4: string;
  pavimentos: Pavimento[];
}
export interface LocalEntrega {
  id: string; local: string; cep: string; bairro: string; logradouro: string;
  numero: string; complemento: string; uf: string; cidade: string;
  contato: string; telContato: string;
  relLinha1: string; relLinha2: string; relLinha3: string; relLinha4: string;
}
export interface Faturamento {
  id: string;
  periodoInicio: string;
  periodoFim: string;
  dataEmissaoNf: string;
  xmlNfNome: string;
  xmlNfConteudo: string;
  numeroNf: string;
  processoNf?: string;
  chaveNf: string;
  numeroMedicao: string;
  descricao: string;
  valorBruto: string;
  valorLiquido: string;
  valorFolha: string;
  valeTransporte?: string;
  valeAlimentacao?: string;
  custoFixo?: string;
  foraFolha?: string;
  provisaoFerias?: string;
  provisao13?: string;
  valorVariavel?: string;
  anexoNfUrl: string;
  anexoNfNome: string;
  pago: boolean;
  dataPagamento: string;
}
export interface Empenho {
  id: string;
  numero: string;
  processo?: string;
  data?: string;
  valor?: string;
}
export interface Contrato {
  id: string; numero: string; numeroProcesso?: string; descricao: string; dataInicio: string; dataFim: string;
  bdi: string; descontoLicitacao?: string; valorBase: string; valorBase2: string; valorBase3: string;
  maoDeObraMensal?: string; maoDeObraAnual?: string; maoDeObraContratual?: string;
  mesSco: string; anoSco: string;
  valorContrato?: string;
  inss?: string; pis?: string; cofins?: string; csll?: string; irrf?: string; iss?: string; cbs?: string; ibs?: string;
  meta1?: string; meta2?: string; meta3?: string;
  faturamentos: Faturamento[];
  empenhos?: Empenho[];
}

export interface LinhaFornecimento {
  id: string; materialId: string; codigo: string; descricao: string;
  tipo: "Material" | "Serviço" | "Grupo de Compras"; unidadeMedida: string; observacao?: string;
}
export interface Cliente {

  id: string; codigo?: number; tipo: "Cliente" | "Fornecedor"; nome: string; nomeFantasia: string;
  cnpj: string; inscricaoEstadual: string; inscricaoMunicipal: string; esfera: string; descricao: string; cap: string;
  email: string; emailEngenharia: string; emailOsCc: string; emailOsBcc: string;
  emailSsCc: string; emailSsBcc: string; emailCompras: string;
  telefones: string[]; telefoneCelular: string; celulares: string; telefonesWhatsapp: string;
  cep: string; bairro: string; logradouro: string; numero: string; complemento: string;
  uf: string; cidade: string; endereco: string;
  dataInicioContrato: string;
  relLinha1: string; relLinha2: string; relLinha3: string; relLinha4: string;
  contato: string; grupoWhatsapp: string;
  logoUrl: string;
  modeloOsId: string;
  informacoesFinanceiras: InformacaoFinanceira[];
  locais: LocalCliente[];
  locaisEntrega: LocalEntrega[];
  contratos: Contrato[];
  linhasFornecimento?: LinhaFornecimento[];

}

interface ClientesContextType {
  clientes: Cliente[]; addCliente: (c: Omit<Cliente, "id">) => void;
  updateCliente: (id: string, c: Partial<Omit<Cliente, "id">>) => Promise<boolean>;
  deleteCliente: (id: string) => void;
}

const ClientesContext = createContext<ClientesContextType | undefined>(undefined);
const QK = ["clientes"] as const;

const rowToCliente = (r: any): Cliente => ({
  id: r.id, codigo: r.codigo ?? undefined, tipo: r.tipo || "Cliente", nome: r.nome ?? "", nomeFantasia: r.nome_fantasia ?? "",
  cnpj: r.cnpj ?? "", inscricaoEstadual: r.inscricao_estadual ?? "",
  inscricaoMunicipal: r.inscricao_municipal ?? "", esfera: r.esfera ?? "", descricao: r.descricao ?? "", cap: r.cap ?? "",
  email: r.email ?? "", emailEngenharia: r.email_engenharia ?? "",
  emailOsCc: r.email_os_cc ?? "", emailOsBcc: r.email_os_bcc ?? "",
  emailSsCc: r.email_ss_cc ?? "", emailSsBcc: r.email_ss_bcc ?? "", emailCompras: r.email_compras ?? "",
  telefones: r.telefones ?? [], telefoneCelular: r.telefone_celular ?? "",
  celulares: r.celulares ?? "", telefonesWhatsapp: r.telefones_whatsapp ?? "",
  cep: r.cep ?? "", bairro: r.bairro ?? "", logradouro: r.logradouro ?? "",
  numero: r.numero ?? "", complemento: r.complemento ?? "", uf: r.uf ?? "", cidade: r.cidade ?? "",
  endereco: r.endereco ?? "", dataInicioContrato: r.data_inicio_contrato ?? "",
  relLinha1: r.rel_linha1 ?? "", relLinha2: r.rel_linha2 ?? "",
  relLinha3: r.rel_linha3 ?? "", relLinha4: r.rel_linha4 ?? "",
  contato: r.contato ?? "", grupoWhatsapp: r.grupo_whatsapp ?? "",
  logoUrl: r.logo_url ?? "",
  modeloOsId: r.modelo_os_id ?? "",
  informacoesFinanceiras: r.informacoes_financeiras ?? [],
  locais: r.locais ?? [], locaisEntrega: r.locais_entrega ?? [], contratos: r.contratos ?? [],
  linhasFornecimento: r.linhas_fornecimento ?? [],

});

const clienteToRow = (c: Omit<Cliente, "id">) => ({
  tipo: c.tipo, nome: c.nome, nome_fantasia: c.nomeFantasia,
  cnpj: c.cnpj, inscricao_estadual: c.inscricaoEstadual,
  inscricao_municipal: c.inscricaoMunicipal, esfera: c.esfera, descricao: c.descricao, cap: c.cap,
  email: c.email, email_engenharia: c.emailEngenharia,
  email_os_cc: c.emailOsCc, email_os_bcc: c.emailOsBcc,
  email_ss_cc: c.emailSsCc, email_ss_bcc: c.emailSsBcc, email_compras: c.emailCompras,
  telefones: c.telefones as any, telefone_celular: c.telefoneCelular,
  celulares: c.celulares, telefones_whatsapp: c.telefonesWhatsapp,
  cep: c.cep, bairro: c.bairro, logradouro: c.logradouro,
  numero: c.numero, complemento: c.complemento, uf: c.uf, cidade: c.cidade,
  endereco: c.endereco, data_inicio_contrato: c.dataInicioContrato,
  rel_linha1: c.relLinha1, rel_linha2: c.relLinha2, rel_linha3: c.relLinha3, rel_linha4: c.relLinha4,
  contato: c.contato, grupo_whatsapp: c.grupoWhatsapp,
  logo_url: c.logoUrl,
  modelo_os_id: c.modeloOsId || null,
  informacoes_financeiras: c.informacoesFinanceiras as any,
  locais: c.locais as any, locais_entrega: c.locaisEntrega as any, contratos: c.contratos as any,
  linhas_fornecimento: (c.linhasFornecimento ?? []) as any,

});

export function ClientesProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Clientes");
  const qc = useQueryClient();
  const { data: clientes = [] } = useQuery({
    enabled: __active,
    queryKey: QK,
    queryFn: async () => (await fetchAll("clientes", "nome")).map(rowToCliente),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const addCliente = async (c: Omit<Cliente, "id">) => {
    await insertRow("clientes", clienteToRow(c));
    invalidate();
  };

  const syncClienteCache = (cliente: Cliente) => {
    qc.setQueryData<Cliente[]>(QK, (old = []) => {
      const exists = old.some((c) => c.id === cliente.id);
      return exists ? old.map((c) => (c.id === cliente.id ? cliente : c)) : [...old, cliente];
    });
  };

  const refreshClienteCache = async (id: string): Promise<Cliente | null> => {
    const { data: row, error } = await (supabase as any)
      .from("clientes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return null;
    const cliente = rowToCliente(row);
    syncClienteCache(cliente);
    return cliente;
  };

  const updateCliente = async (id: string, data: Partial<Omit<Cliente, "id">>): Promise<boolean> => {
    const latestClientes = qc.getQueryData<Cliente[]>(QK) ?? clientes;
    let current = latestClientes.find(c => c.id === id);
    if (!current) {
      // Cache pode estar vazio/desatualizado — busca o registro direto do banco.
      current = await refreshClienteCache(id);
      if (!current) return false;
    }
    const merged = { ...current, ...data };
    const { id: _, ...rest } = merged;
    syncClienteCache(merged); // atualização otimista imediata
    const ok = await updateRow("clientes", id, clienteToRow(rest));
    if (!ok) {
      await refreshClienteCache(id); // desfaz a alteração otimista com o dado real
      return false;
    }
    // Reidrata do banco para manter o cache idêntico ao que foi persistido.
    await refreshClienteCache(id);
    await invalidate();
    return true;
  };



  const deleteCliente = async (id: string) => { await deleteRow("clientes", id); invalidate(); };

  return (
    <ClientesContext.Provider value={{ clientes, addCliente, updateCliente, deleteCliente }}>
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes() {
  useActivateProvider("Clientes");
  const ctx = useContext(ClientesContext);
  if (!ctx) throw new Error("useClientes must be used within ClientesProvider");
  return ctx;
}
