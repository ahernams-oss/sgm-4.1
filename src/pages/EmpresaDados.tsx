import { useState, useEffect, useRef, useCallback } from "react";
import { useEmpresa, Empresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, Save, MapPin, Phone, Mail, Globe, Trash2, Landmark, MessageCircle, ShieldCheck, FileKey2, Eye, EyeOff, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { usePermissao } from "@/hooks/usePermissao";
import { supabase } from "@/integrations/supabase/client";


export default function EmpresaDados() {
  const { empresa, loading, saveEmpresa, uploadLogo, uploadCertificadoA1, removerCertificadoA1 } = useEmpresa();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeEditar = tem("empresa.editar");
  const fileRef = useRef<HTMLInputElement>(null);
  const certRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Empresa>(empresa);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [validandoCert, setValidandoCert] = useState(false);
  const [validacaoCert, setValidacaoCert] = useState<{
    ok: boolean; status?: string; titular?: string; emissor?: string; cnpj?: string | null;
    validTo?: string; diasRestantes?: number; erros?: string[]; avisos?: string[]; error?: string;
  } | null>(null);
  const [buscandoSefaz, setBuscandoSefaz] = useState(false);
  const [resultadoSefaz, setResultadoSefaz] = useState<any>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!loading && !dirtyRef.current) {
      setForm(empresa);
      initialLoadDone.current = true;
    }
  }, [empresa, loading]);

  const autoSave = useCallback(async (updatedForm: Empresa) => {
    if (!podeEditar) return;
    if (!updatedForm.razaoSocial?.trim()) return;
    setAutoSaveStatus("saving");
    try {
      await saveEmpresa(updatedForm);
      dirtyRef.current = false;
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch {
      setAutoSaveStatus("idle");
    }
  }, [saveEmpresa, podeEditar]);

  const update = (field: keyof Empresa, value: string) => {
    if (!podeEditar) return;
    dirtyRef.current = true;
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setAutoSaveStatus("pending");
      debounceRef.current = setTimeout(() => autoSave(next), 1500);
      return next;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!podeEditar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione um arquivo de imagem", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setForm(prev => ({ ...prev, logoUrl: url }));
      toast({ title: "Logo enviada com sucesso" });
    } catch {
      toast({ title: "Erro ao enviar logo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!podeEditar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    const file = e.target.files?.[0];
    if (!file) return;
    const nome = file.name.toLowerCase();
    if (!nome.endsWith(".pfx") && !nome.endsWith(".p12")) {
      toast({ title: "Selecione um arquivo .pfx ou .p12", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx 5MB)", variant: "destructive" });
      return;
    }
    setUploadingCert(true);
    try {
      const { url, nome: nomeArq } = await uploadCertificadoA1(file);
      const next = { ...form, certificadoA1Url: url, certificadoA1Nome: nomeArq };
      setForm(next);
      await saveEmpresa(next);
      toast({ title: "Certificado A1 enviado com sucesso" });
    } catch (err) {
      toast({ title: "Erro ao enviar certificado", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setUploadingCert(false);
      if (certRef.current) certRef.current.value = "";
    }
  };

  const handleRemoverCert = async () => {
    if (!podeEditar) return;
    if (!confirm("Deseja remover o certificado digital?")) return;
    try {
      await removerCertificadoA1();
      const next = { ...form, certificadoA1Url: "", certificadoA1Nome: "", certificadoA1Senha: "", certificadoA1Validade: "" };
      setForm(next);
      await saveEmpresa(next);
      toast({ title: "Certificado removido" });
    } catch {
      toast({ title: "Erro ao remover certificado", variant: "destructive" });
    }
  };

  const handleValidarCertificado = async () => {
    if (!form.certificadoA1Url) {
      toast({ title: "Envie o certificado .pfx primeiro", variant: "destructive" });
      return;
    }
    if (!form.certificadoA1Senha) {
      toast({ title: "Informe a senha do certificado", variant: "destructive" });
      return;
    }
    setValidandoCert(true);
    setValidacaoCert(null);
    try {
      // Garante que dados em edição estão salvos antes de validar
      if (dirtyRef.current) {
        await saveEmpresa(form);
        dirtyRef.current = false;
      }
      const { data, error } = await supabase.functions.invoke("validar-certificado-a1", {
        body: {
          empresaId: form.id || empresa.id,
          storagePath: form.certificadoA1Url,
          senha: form.certificadoA1Senha,
          uf: form.nfeUfAutor,
          ambiente: form.nfeAmbiente,
        },
      });
      if (error) throw error;
      setValidacaoCert(data);
      if (data?.ok) {
        // Persiste a senha no cofre (empresa_credenciais) somente após validação bem-sucedida
        await supabase.functions.invoke("empresa-certificado-a1?action=set-senha", {
          body: { empresaId: form.id || empresa.id, senha: form.certificadoA1Senha },
        });
        toast({ title: "Certificado válido", description: data.avisos?.length ? "Atenção aos avisos exibidos." : "Pronto para consultar a SEFAZ." });
        if (data.validTo) {
          setForm(prev => ({ ...prev, certificadoA1Validade: String(data.validTo).slice(0, 10) }));
        }
      } else {
        toast({ title: "Certificado não validado", description: data?.error || data?.erros?.[0] || "Verifique os dados.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro na validação", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setValidandoCert(false);
    }
  };

  const handleTestarSefaz = async () => {
    setBuscandoSefaz(true);
    setResultadoSefaz(null);
    try {
      if (dirtyRef.current) { await saveEmpresa(form); dirtyRef.current = false; }
      const { data, error } = await supabase.functions.invoke("brasilnfe-diagnostico", {
        body: { tipoDocumentoFiscal: 0 },
      });
      if (error) throw error;
      setResultadoSefaz(data);
      if (data?.ok) {
        toast({ title: "Brasil NFe respondeu", description: `${data.totalDocumentos} NFe(s) recebida(s)` });
      } else {
        toast({ title: "Falha na consulta", description: data?.error || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao consultar Brasil NFe", description: String((err as Error).message), variant: "destructive" });
    } finally {
      setBuscandoSefaz(false);
    }
  };

  const handleSave = async () => {
    if (!podeEditar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!form.razaoSocial.trim()) {
      toast({ title: "Informe a Razão Social", variant: "destructive" });
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaving(true);
    try {
      await saveEmpresa(form);
      dirtyRef.current = false;
    } catch {
      toast({ title: "Erro ao salvar dados", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const buscarCep = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
          complemento: data.complemento || prev.complemento,
        }));
      }
    } catch { /* ignore */ }
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  const Field = ({ label, field, placeholder, icon: Icon }: {
    label: string; field: keyof Empresa; placeholder?: string; icon?: any;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {Icon && <Icon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />}
        <Input
          value={form[field] as string}
          onChange={e => update(field, e.target.value)}
          placeholder={placeholder}
          className={Icon ? "pl-9" : ""}
        />
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Dados da Empresa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure as informações da sua empresa que serão usadas em documentos e relatórios
          </p>
        </div>
        <div className="flex items-center gap-3">
          {autoSaveStatus === "pending" && (
            <span className="text-xs text-muted-foreground animate-pulse">Alterações pendentes...</span>
          )}
          {autoSaveStatus === "saving" && (
            <span className="text-xs text-muted-foreground animate-pulse">Salvando...</span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="text-xs text-primary">✓ Salvo</span>
          )}
          <Button onClick={handleSave} disabled={saving || !podeEditar} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Logo Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Logomarca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="w-40 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-1 opacity-40" />
                  <span className="text-xs">Sem logo</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Enviar Logo"}
              </Button>
              {form.logoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm(prev => ({ ...prev, logoUrl: "" }))}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Formatos: PNG, JPG, SVG. Tamanho recomendado: 400x200px
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Razão Social *" field="razaoSocial" placeholder="Razão social da empresa" />
            <Field label="Nome Fantasia" field="nomeFantasia" placeholder="Nome fantasia" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="CNPJ" field="cnpj" placeholder="00.000.000/0000-00" />
            <Field label="Inscrição Estadual" field="inscricaoEstadual" placeholder="Inscrição estadual" />
            <Field label="Inscrição Municipal" field="inscricaoMunicipal" placeholder="Inscrição municipal" />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">CEP</Label>
              <Input
                value={form.cep}
                onChange={e => update("cep", e.target.value)}
                onBlur={buscarCep}
                placeholder="00000-000"
              />
            </div>
            <div className="md:col-span-2">
              <Field label="Logradouro" field="logradouro" placeholder="Rua, Av..." />
            </div>
            <Field label="Número" field="numero" placeholder="Nº" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Complemento" field="complemento" placeholder="Sala, andar..." />
            <Field label="Bairro" field="bairro" placeholder="Bairro" />
            <Field label="Cidade" field="cidade" placeholder="Cidade" />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">UF</Label>
              <Input
                value={form.uf}
                onChange={e => update("uf", e.target.value)}
                placeholder="UF"
                maxLength={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Dados Bancários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Banco" field="banco" placeholder="Nome do banco" icon={Landmark} />
            <Field label="Agência" field="agencia" placeholder="0000" />
            <Field label="Conta" field="conta" placeholder="00000-0" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de Conta</Label>
              <select
                value={form.tipoConta}
                onChange={e => update("tipoConta", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione...</option>
                <option value="Corrente">Corrente</option>
                <option value="Poupança">Poupança</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Field label="Chave PIX" field="chavePix" placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> Contato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Telefone" field="telefone" placeholder="(00) 0000-0000" icon={Phone} />
            <Field label="Celular" field="celular" placeholder="(00) 00000-0000" icon={Phone} />
            <Field label="Contato" field="contato" placeholder="Nome do contato" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="E-mail" field="email" placeholder="email@empresa.com" icon={Mail} />
            <Field label="E-mail Compras" field="emailCompras" placeholder="compras@empresa.com" icon={Mail} />
            <Field label="Site" field="site" placeholder="www.empresa.com.br" icon={Globe} />
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="E-mail Envio RH" field="emailRh" placeholder="rh@empresa.com" icon={Mail} />
            <Field label="E-mail Envio Engenharia e Manutenção" field="emailEngenharia" placeholder="engenharia@empresa.com" icon={Mail} />
            <Field label="E-mail Envio Estoque" field="emailEstoque" placeholder="estoque@empresa.com" icon={Mail} />
            <Field label="E-mail Envio Relatórios" field="emailRelatorios" placeholder="relatorios@empresa.com" icon={Mail} />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> WhatsApp para Disparos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Informe número (com DDI/DDD) ou string de grupo do WhatsApp para envio automático de mensagens.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="WhatsApp Compras" field="whatsappCompras" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp RH" field="whatsappRh" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp Engenharia e Manutenção" field="whatsappEngenharia" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp Comercial" field="whatsappComercial" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp Faturamento" field="whatsappFaturamento" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp SEGTRAB" field="whatsappSegtrab" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp Seleção" field="whatsappSelecao" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp Diretoria" field="whatsappDiretoria" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
            <Field label="WhatsApp Coordenação" field="whatsappCoordenacao" placeholder="55119... ou ID do grupo" icon={MessageCircle} />
          </div>

        </CardContent>
      </Card>

      {/* Certificado Digital A1 - NFe */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Certificado Digital A1 — NFe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Faça upload do certificado digital <strong>A1 (.pfx ou .p12)</strong> da empresa para que o sistema possa consultar
            automaticamente as Notas Fiscais Eletrônicas emitidas contra o CNPJ da Lasant na SEFAZ.
            O arquivo é armazenado de forma <strong>privada</strong> e usado apenas pelo backend.
          </p>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileKey2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  {form.certificadoA1Url ? (
                    <>
                      <div className="text-sm font-medium truncate">{form.certificadoA1Nome || "Certificado.pfx"}</div>
                      <div className="text-xs text-muted-foreground">
                        Certificado armazenado com segurança
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium">Nenhum certificado enviado</div>
                      <div className="text-xs text-muted-foreground">Envie o arquivo .pfx para começar</div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  ref={certRef}
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12"
                  className="hidden"
                  onChange={handleCertUpload}
                />
                <Button variant="outline" size="sm" onClick={() => certRef.current?.click()} disabled={uploadingCert || !podeEditar} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {uploadingCert ? "Enviando..." : (form.certificadoA1Url ? "Substituir" : "Enviar Certificado")}
                </Button>
                {form.certificadoA1Url && (
                  <Button variant="ghost" size="sm" onClick={handleRemoverCert} disabled={!podeEditar} className="gap-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-medium text-muted-foreground">Senha do Certificado</Label>
              <div className="relative">
                <Input
                  type={showSenha ? "text" : "password"}
                  value={form.certificadoA1Senha}
                  onChange={e => update("certificadoA1Senha", e.target.value)}
                  placeholder="Senha do .pfx"
                  className="pr-9"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Validade do Certificado</Label>
              <Input
                type="date"
                value={form.certificadoA1Validade}
                onChange={e => update("certificadoA1Validade", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">UF de Autorização</Label>
              <Input
                value={form.nfeUfAutor}
                onChange={e => update("nfeUfAutor", e.target.value.toUpperCase())}
                placeholder="Ex: SP"
                maxLength={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Ambiente SEFAZ</Label>
              <select
                value={form.nfeAmbiente}
                onChange={e => update("nfeAmbiente", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="homologacao">Homologação (testes)</option>
                <option value="producao">Produção</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Recomendado iniciar em <strong>Homologação</strong> antes de migrar para Produção.
              </p>
            </div>
          </div>

          {/* Validação do Certificado */}
          <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <div className="font-medium">Validação do Certificado</div>
                <div className="text-xs text-muted-foreground">
                  Verifica senha, expiração, CNPJ titular, UF e ambiente antes de liberar a consulta à SEFAZ.
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={handleValidarCertificado}
                disabled={validandoCert || !form.certificadoA1Url || !form.certificadoA1Senha || !podeEditar}
                className="gap-2"
              >
                {validandoCert ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {validandoCert ? "Validando..." : "Validar Certificado"}
              </Button>
            </div>

            {form.certificadoA1Status && !validacaoCert && (
              <div className="text-xs text-muted-foreground">
                Última validação: <strong>{form.certificadoA1Status}</strong>
                {form.certificadoA1ValidadoEm && <> em {new Date(form.certificadoA1ValidadoEm).toLocaleString("pt-BR")}</>}
                {form.certificadoA1Titular && <> · Titular: {form.certificadoA1Titular}</>}
                {form.certificadoA1Cnpj && <> · CNPJ: {form.certificadoA1Cnpj}</>}
              </div>
            )}

            {validacaoCert && (
              <div className={`rounded-md border p-3 text-sm space-y-2 ${
                validacaoCert.ok
                  ? (validacaoCert.avisos?.length ? "border-yellow-500/40 bg-yellow-500/5" : "border-green-500/40 bg-green-500/5")
                  : "border-destructive/40 bg-destructive/5"
              }`}>
                <div className="flex items-center gap-2 font-medium">
                  {validacaoCert.ok
                    ? (validacaoCert.avisos?.length
                        ? <><AlertTriangle className="h-4 w-4 text-yellow-600" /> Válido com avisos</>
                        : <><CheckCircle2 className="h-4 w-4 text-green-600" /> Certificado válido — pronto para SEFAZ</>)
                    : <><XCircle className="h-4 w-4 text-destructive" /> Certificado inválido</>
                  }
                </div>
                {(validacaoCert.titular || validacaoCert.cnpj) && (
                  <div className="text-xs grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                    {validacaoCert.titular && <div><span className="text-muted-foreground">Titular:</span> {validacaoCert.titular}</div>}
                    {validacaoCert.cnpj && <div><span className="text-muted-foreground">CNPJ:</span> {validacaoCert.cnpj}</div>}
                    {validacaoCert.emissor && <div className="md:col-span-2"><span className="text-muted-foreground">Emissor:</span> {validacaoCert.emissor}</div>}
                    {validacaoCert.validTo && (
                      <div>
                        <span className="text-muted-foreground">Expira:</span>{" "}
                        {new Date(validacaoCert.validTo).toLocaleDateString("pt-BR")}
                        {typeof validacaoCert.diasRestantes === "number" && validacaoCert.diasRestantes >= 0 &&
                          <> ({validacaoCert.diasRestantes} dia{validacaoCert.diasRestantes === 1 ? "" : "s"})</>
                        }
                      </div>
                    )}
                  </div>
                )}
                {validacaoCert.erros && validacaoCert.erros.length > 0 && (
                  <ul className="text-xs list-disc pl-5 text-destructive space-y-0.5">
                    {validacaoCert.erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
                {validacaoCert.avisos && validacaoCert.avisos.length > 0 && (
                  <ul className="text-xs list-disc pl-5 text-yellow-700 space-y-0.5">
                    {validacaoCert.avisos.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
                {validacaoCert.error && !validacaoCert.erros?.length && (
                  <div className="text-xs text-destructive">{validacaoCert.error}</div>
                )}
              </div>
            )}
          </div>

          {/* Teste de busca SEFAZ */}
          <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <div className="font-medium">Teste de Consulta SEFAZ (NFeDistribuicaoDFe)</div>
                <div className="text-xs text-muted-foreground">
                  Faz uma chamada real à SEFAZ no ambiente configurado usando mTLS com o certificado A1.
                  Em <strong>Homologação</strong> normalmente retorna <code>cStat 137</code> (nenhum documento) — isso confirma o canal funcionando.
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestarSefaz}
                disabled={buscandoSefaz || !podeEditar}
                className="gap-2"
              >
                {buscandoSefaz ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {buscandoSefaz ? "Consultando..." : "Testar busca NFe (Brasil NFe)"}
              </Button>
            </div>

            {resultadoSefaz && (
              <div className={`rounded-md border p-3 text-sm space-y-2 ${
                resultadoSefaz.ok ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"
              }`}>
                <div className="flex items-center gap-2 font-medium">
                  {resultadoSefaz.ok
                    ? <><CheckCircle2 className="h-4 w-4 text-green-600" /> Brasil NFe respondeu (HTTP {resultadoSefaz.httpStatus})</>
                    : <><XCircle className="h-4 w-4 text-destructive" /> Falha na consulta (HTTP {resultadoSefaz.httpStatus})</>}
                </div>
                <div className="text-xs grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                  {resultadoSefaz.provider && <div><span className="text-muted-foreground">Provedor:</span> {resultadoSefaz.provider}</div>}
                  {resultadoSefaz.ambiente && <div><span className="text-muted-foreground">Ambiente:</span> {resultadoSefaz.ambiente}</div>}
                  {resultadoSefaz.cnpj && <div><span className="text-muted-foreground">CNPJ:</span> {resultadoSefaz.cnpj}</div>}
                  {typeof resultadoSefaz.totalDocumentos === "number" && (
                    <div><span className="text-muted-foreground">NFe(s) recebida(s):</span> <strong>{resultadoSefaz.totalDocumentos}</strong></div>
                  )}
                </div>
                {resultadoSefaz.error && (
                  <div className="text-xs text-destructive break-all">{resultadoSefaz.error}</div>
                )}
                {resultadoSefaz.preview && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver resposta (prévia)</summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] whitespace-pre-wrap break-all">{JSON.stringify(resultadoSefaz.preview, null, 2)}</pre>
                  </details>
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>


    </div>
  );
}
