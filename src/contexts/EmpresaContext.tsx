import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useProviderGate, useActivateProvider } from "@/lib/providerGate";
import { fetchAll, insertRow, updateRow } from "@/lib/supabaseHelper";
import { supabase } from "@/integrations/supabase/client";

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  celular: string;
  email: string;
  emailCompras: string;
  emailRh: string;
  emailEngenharia: string;
  emailEstoque: string;
  emailRelatorios: string;
  contato: string;
  site: string;
  logoUrl: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  chavePix: string;
  whatsappCompras: string;
  whatsappRh: string;
  whatsappEngenharia: string;
  whatsappComercial: string;
  whatsappFaturamento: string;
  whatsappSegtrab: string;
  whatsappSelecao: string;
  whatsappDiretoria: string;
  whatsappCoordenacao: string;


  certificadoA1Url: string;
  certificadoA1Nome: string;
  certificadoA1Validade: string;
  certificadoA1Senha: string;
  nfeAmbiente: "homologacao" | "producao" | "";
  nfeUfAutor: string;
  certificadoA1Cnpj: string;
  certificadoA1Titular: string;
  certificadoA1Emissor: string;
  certificadoA1ValidadoEm: string;
  certificadoA1Status: string;
}

const EMPTY: Empresa = {
  id: "", razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "",
  inscricaoMunicipal: "", logradouro: "", numero: "", complemento: "", bairro: "",
  cidade: "", uf: "", cep: "", telefone: "", celular: "", email: "", emailCompras: "",
  contato: "", site: "", logoUrl: "", emailRh: "", emailEngenharia: "",
  emailEstoque: "", emailRelatorios: "", banco: "", agencia: "", conta: "",
  tipoConta: "", chavePix: "",
  whatsappCompras: "", whatsappRh: "", whatsappEngenharia: "",
  whatsappComercial: "", whatsappFaturamento: "", whatsappSegtrab: "", whatsappSelecao: "", whatsappDiretoria: "", whatsappCoordenacao: "",
  certificadoA1Url: "", certificadoA1Nome: "", certificadoA1Validade: "",

  certificadoA1Senha: "", nfeAmbiente: "homologacao", nfeUfAutor: "",
  certificadoA1Cnpj: "", certificadoA1Titular: "", certificadoA1Emissor: "",
  certificadoA1ValidadoEm: "", certificadoA1Status: "",
};

interface EmpresaContextType {
  empresa: Empresa;
  loading: boolean;
  saveEmpresa: (data: Empresa) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  uploadCertificadoA1: (file: File) => Promise<{ url: string; nome: string }>;
  removerCertificadoA1: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const rowToEmpresa = (r: any): Empresa => ({
  id: r.id,
  razaoSocial: r.razao_social ?? "",
  nomeFantasia: r.nome_fantasia ?? "",
  cnpj: r.cnpj ?? "",
  inscricaoEstadual: r.inscricao_estadual ?? "",
  inscricaoMunicipal: r.inscricao_municipal ?? "",
  logradouro: r.logradouro ?? "",
  numero: r.numero ?? "",
  complemento: r.complemento ?? "",
  bairro: r.bairro ?? "",
  cidade: r.cidade ?? "",
  uf: r.uf ?? "",
  cep: r.cep ?? "",
  telefone: r.telefone ?? "",
  celular: r.celular ?? "",
  email: r.email ?? "",
  emailCompras: r.email_compras ?? "",
  emailRh: r.email_rh ?? "",
  emailEngenharia: r.email_engenharia ?? "",
  emailEstoque: r.email_estoque ?? "",
  emailRelatorios: r.email_relatorios ?? "",
  contato: r.contato ?? "",
  site: r.site ?? "",
  logoUrl: r.logo_url ?? "",
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "",
  chavePix: "",

  whatsappCompras: r.whatsapp_compras ?? "",
  whatsappRh: r.whatsapp_rh ?? "",
  whatsappEngenharia: r.whatsapp_engenharia ?? "",
  whatsappComercial: r.whatsapp_comercial ?? "",
  whatsappFaturamento: r.whatsapp_faturamento ?? "",
  whatsappSegtrab: (r as { whatsapp_segtrab?: string | null }).whatsapp_segtrab ?? "",
  whatsappSelecao: (r as { whatsapp_selecao?: string | null }).whatsapp_selecao ?? "",
  whatsappDiretoria: (r as { whatsapp_diretoria?: string | null }).whatsapp_diretoria ?? "",
  whatsappCoordenacao: (r as { whatsapp_coordenacao?: string | null }).whatsapp_coordenacao ?? "",
  certificadoA1Url: r.certificado_a1_url ?? "",

  certificadoA1Nome: r.certificado_a1_nome ?? "",
  certificadoA1Validade: r.certificado_a1_validade ?? "",
  certificadoA1Senha: "",
  nfeAmbiente: (r.nfe_ambiente ?? "homologacao") as Empresa["nfeAmbiente"],
  nfeUfAutor: r.nfe_uf_autor ?? "",
  certificadoA1Cnpj: r.certificado_a1_cnpj ?? "",
  certificadoA1Titular: r.certificado_a1_titular ?? "",
  certificadoA1Emissor: r.certificado_a1_emissor ?? "",
  certificadoA1ValidadoEm: r.certificado_a1_validado_em ?? "",
  certificadoA1Status: r.certificado_a1_status ?? "",
});

const empresaToRow = (e: Empresa) => ({
  razao_social: e.razaoSocial,
  nome_fantasia: e.nomeFantasia,
  cnpj: e.cnpj,
  inscricao_estadual: e.inscricaoEstadual,
  inscricao_municipal: e.inscricaoMunicipal,
  logradouro: e.logradouro,
  numero: e.numero,
  complemento: e.complemento,
  bairro: e.bairro,
  cidade: e.cidade,
  uf: e.uf,
  cep: e.cep,
  telefone: e.telefone,
  celular: e.celular,
  email: e.email,
  email_compras: e.emailCompras,
  email_rh: e.emailRh,
  email_engenharia: e.emailEngenharia,
  email_estoque: e.emailEstoque,
  email_relatorios: e.emailRelatorios,
  contato: e.contato,
  site: e.site,
  logo_url: e.logoUrl,
  // banco/agencia/conta/tipo_conta/chave_pix são gravados em empresa_dados_bancarios via edge function

  whatsapp_compras: e.whatsappCompras,
  whatsapp_rh: e.whatsappRh,
  whatsapp_engenharia: e.whatsappEngenharia,
  whatsapp_comercial: e.whatsappComercial,
  whatsapp_faturamento: e.whatsappFaturamento,
  whatsapp_segtrab: e.whatsappSegtrab,
  whatsapp_selecao: e.whatsappSelecao,
  whatsapp_diretoria: e.whatsappDiretoria,
  whatsapp_coordenacao: e.whatsappCoordenacao,
  certificado_a1_url: e.certificadoA1Url,

  certificado_a1_nome: e.certificadoA1Nome,
  certificado_a1_validade: e.certificadoA1Validade || null,
  nfe_ambiente: e.nfeAmbiente || "homologacao",
  nfe_uf_autor: e.nfeUfAutor,
});

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const __active = useProviderGate("Empresa");
  const [empresa, setEmpresa] = useState<Empresa>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAll("empresa", "created_at");
    if (data.length > 0) {
      const base = rowToEmpresa(data[0]);
      try {
        const { data: bank } = await supabase.functions.invoke(
          `empresa-dados-bancarios?action=get&empresaId=${base.id}`,
          { method: "GET" as any },
        );
        if (bank?.ok && bank.dados) {
          base.banco = bank.dados.banco ?? "";
          base.agencia = bank.dados.agencia ?? "";
          base.conta = bank.dados.conta ?? "";
          base.tipoConta = bank.dados.tipo_conta ?? "";
          base.chavePix = bank.dados.chave_pix ?? "";
        }
      } catch (e) {
        console.warn("[Empresa] Falha ao carregar dados bancários:", e);
      }
      setEmpresa(base);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (__active) load(); }, [load, __active]);

  const saveEmpresa = async (data: Empresa) => {
    let empresaId = data.id;
    if (empresaId) {
      await updateRow("empresa", empresaId, empresaToRow(data));
    } else {
      const inserted = await insertRow("empresa", empresaToRow(data));
      empresaId = (inserted as any)?.id ?? empresaId;
    }
    if (empresaId) {
      try {
        await supabase.functions.invoke("empresa-dados-bancarios?action=save", {
          body: {
            empresaId,
            banco: data.banco,
            agencia: data.agencia,
            conta: data.conta,
            tipo_conta: data.tipoConta,
            chave_pix: data.chavePix,
          },
        });
      } catch (e) {
        console.error("[Empresa] Falha ao salvar dados bancários:", e);
      }
    }
    await load();
  };


  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "png";
    const fileName = `logo_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("empresa-logo")
      .upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("empresa-logo").getPublicUrl(fileName);
    return pub.publicUrl;
  };

  const uploadCertificadoA1 = async (file: File): Promise<{ url: string; nome: string }> => {
    const empresaId = empresa.id;
    if (!empresaId) throw new Error("Salve os dados da empresa antes de enviar o certificado.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("empresaId", empresaId);
    const { data, error } = await supabase.functions.invoke("empresa-certificado-a1?action=upload", { body: fd });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "Falha no upload do certificado");
    return { url: data.url, nome: data.nome };
  };

  const removerCertificadoA1 = async () => {
    if (!empresa.id) return;
    await supabase.functions.invoke("empresa-certificado-a1?action=remove", {
      body: { empresaId: empresa.id, path: empresa.certificadoA1Url || "" },
    });
  };

  return (
    <EmpresaContext.Provider value={{ empresa, loading, saveEmpresa, uploadLogo, uploadCertificadoA1, removerCertificadoA1 }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  useActivateProvider("Empresa");
  const ctx = useContext(EmpresaContext);
  if (!ctx) throw new Error("useEmpresa must be used within EmpresaProvider");
  return ctx;
}
