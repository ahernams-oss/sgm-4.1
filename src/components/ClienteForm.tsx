import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { isValidCPF, isValidCNPJ, maskCPF, maskCNPJ, onlyDigits } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Upload, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/contexts/ClientesContext";
import { useOsModelos } from "@/contexts/OsModelosContext";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const ESFERA_OPTIONS = ["Federal", "Estadual", "Municipal", "Privada"];

type FormData = Omit<Cliente, "id" | "informacoesFinanceiras" | "locais" | "locaisEntrega" | "contratos">;

const emptyForm: FormData = {
  tipo: "Cliente", nome: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "",
  inscricaoMunicipal: "", esfera: "", descricao: "", cap: "", email: "", emailEngenharia: "",
  emailOsCc: "", emailOsBcc: "", emailSsCc: "", emailSsBcc: "", emailCompras: "",
  telefones: [""], telefoneCelular: "", celulares: "", telefonesWhatsapp: "",
  cep: "", bairro: "", logradouro: "", numero: "", complemento: "", uf: "", cidade: "",
  endereco: "", dataInicioContrato: "", relLinha1: "", relLinha2: "", relLinha3: "",
  relLinha4: "", contato: "", grupoWhatsapp: "", logoUrl: "", modeloOsId: "",
};

interface ClienteFormProps {
  editingId: string | null;
  initialData?: FormData;
  onSubmit: (data: FormData, editingId: string | null) => void;
  onCancel: () => void;
  tipoFixo?: "Cliente" | "Fornecedor";
  embedded?: boolean;
}

export default function ClienteForm({ editingId, initialData, onSubmit, onCancel, tipoFixo, embedded }: ClienteFormProps) {
  const [form, setForm] = useState<FormData>(initialData || emptyForm);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { modelos } = useOsModelos();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("A logo deve ter no máximo 500KB.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `cliente-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("empresa-logo").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("empresa-logo").getPublicUrl(path);
      setForm((prev) => ({ ...prev, logoUrl: data.publicUrl }));
      toast.success("Logo carregada com sucesso.");
    } catch (err: any) {
      toast.error("Erro ao enviar logo: " + (err?.message || "desconhecido"));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const telefones = form.telefones.length > 0 ? form.telefones : [""];

  const updateTelefone = (index: number, value: string) => {
    const updated = [...telefones];
    updated[index] = value;
    setForm((prev) => ({ ...prev, telefones: updated }));
  };

  const addTelefone = () => setForm((prev) => ({ ...prev, telefones: [...prev.telefones, ""] }));
  const removeTelefone = (index: number) =>
    setForm((prev) => ({ ...prev, telefones: prev.telefones.filter((_, i) => i !== index) }));

  const buscarCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setForm((prev) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
      }));
    } catch {
      toast.error("Erro ao buscar CEP.");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = onlyDigits(form.cnpj);
    if (doc.length > 0) {
      const ok = doc.length === 11 ? isValidCPF(doc) : doc.length === 14 ? isValidCNPJ(doc) : false;
      if (!ok) {
        toast.error("CNPJ/CPF inválido. Verifique o número informado.");
        return;
      }
    }
    onSubmit({ ...form, telefones: form.telefones.filter((t) => t.trim() !== "") }, editingId);
    if (!editingId) {
      setForm(tipoFixo ? { ...emptyForm, tipo: tipoFixo } : emptyForm);
    }
  };

  const label = tipoFixo || "Cliente";

  return (
    <form onSubmit={handleSubmit} className={embedded ? "" : "section-card animate-fade-up mb-6"} style={embedded ? undefined : { animationDelay: "80ms" }}>
      {!embedded && <h2 className="section-title">{editingId ? `Editar ${label}` : `Novo ${label}`}</h2>}

      {/* Tipo */}
      {!tipoFixo && (
        <div className="mb-4">
          <label className="field-label">Tipo</label>
          <Select value={form.tipo} onValueChange={(v) => update("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Cliente">Cliente</SelectItem>
              <SelectItem value="Fornecedor">Fornecedor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Dados da Empresa */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6">Dados da Empresa</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="field-label">Razão Social / Nome Empresa</label>
          <Input placeholder="Ex: Construtora ABC Ltda" value={form.nome} onChange={(e) => update("nome", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Nome Fantasia</label>
          <Input placeholder="Nome Fantasia" value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} />
        </div>
        <div>
          <label className="field-label">CAP</label>
          <Input placeholder="CAP" value={form.cap} onChange={(e) => update("cap", e.target.value)} />
        </div>
        <div>
          <label className="field-label">CNPJ / CPF</label>
          <Input
            placeholder="Ex: 12.345.678/0001-90"
            value={form.cnpj}
            onChange={(e) => {
              const d = onlyDigits(e.target.value);
              update("cnpj", d.length <= 11 ? maskCPF(d) : maskCNPJ(d));
            }}
            maxLength={18}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="field-label">Inscrição Estadual</label>
          <Input placeholder="Inscrição Estadual" value={form.inscricaoEstadual} onChange={(e) => update("inscricaoEstadual", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Inscrição Municipal</label>
          <Input placeholder="Inscrição Municipal" value={form.inscricaoMunicipal} onChange={(e) => update("inscricaoMunicipal", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Esfera</label>
          <Select value={form.esfera} onValueChange={(v) => update("esfera", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ESFERA_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Modelo de OS</label>
          <Select value={form.modeloOsId || "__none__"} onValueChange={(v) => update("modeloOsId", v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhum</SelectItem>
              {modelos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Descrição</label>
          <Textarea placeholder="Descrição do cliente" value={form.descricao} onChange={(e) => update("descricao", e.target.value)} rows={3} />
        </div>
        <div>
          <label className="field-label">Pessoa de Contato</label>
          <Input placeholder="Ex: Maria Silva" value={form.contato} onChange={(e) => update("contato", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Data de Início do Contrato</label>
          <Input type="date" value={form.dataInicioContrato} onChange={(e) => update("dataInicioContrato", e.target.value)} />
        </div>
      </div>

      {/* Endereço */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6">Endereço</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="field-label">CEP</label>
          <Input placeholder="Ex: 01001-000" value={form.cep} onChange={(e) => update("cep", e.target.value)} onBlur={(e) => buscarCep(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Logradouro</label>
          <Input placeholder="Rua, Av, etc." value={form.logradouro} onChange={(e) => update("logradouro", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Nº</label>
          <Input placeholder="Nº" value={form.numero} onChange={(e) => update("numero", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Complemento</label>
          <Input placeholder="Sala, Andar, etc." value={form.complemento} onChange={(e) => update("complemento", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Bairro</label>
          <Input placeholder="Bairro" value={form.bairro} onChange={(e) => update("bairro", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Cidade</label>
          <Input placeholder="Cidade" value={form.cidade} onChange={(e) => update("cidade", e.target.value)} />
        </div>
        <div>
          <label className="field-label">UF</label>
          <Select value={form.uf} onValueChange={(v) => update("uf", v)}>
            <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              {UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Telefones */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6">Telefones</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="field-label">Telefones Fixos</label>
          <div className="space-y-2">
            {telefones.map((tel, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input placeholder="Ex: (11) 3333-4444" value={tel} onChange={(e) => updateTelefone(idx, e.target.value)} />
                {telefones.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTelefone(idx)} className="shrink-0 text-destructive hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addTelefone} className="gap-1">
              <Plus className="h-3 w-3" /> Adicionar telefone
            </Button>
          </div>
        </div>
        <div>
          <label className="field-label">Telefone Celular</label>
          <Input placeholder="Ex: (11) 99999-0000" value={form.telefoneCelular} onChange={(e) => update("telefoneCelular", e.target.value)} />
        </div>
        <div>
          <label className="field-label">Celulares (outros)</label>
          <Input placeholder="Celulares adicionais" value={form.celulares} onChange={(e) => update("celulares", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Telefones WhatsApp</label>
          <Input placeholder="Formato: DD999999999,DD999999999" value={form.telefonesWhatsapp} onChange={(e) => update("telefonesWhatsapp", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Código do Grupo de WhatsApp (JID)</label>
          <Input placeholder="Ex: 1203630000000000@g.us" value={form.grupoWhatsapp} onChange={(e) => update("grupoWhatsapp", e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">Informe o JID do grupo (formato <code>120363xxxxxxx@g.us</code>), não o link de convite.</p>
        </div>
      </div>

      {/* E-mails */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6">E-mails</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="field-label">E-mail Principal</label>
          <Input type="email" placeholder="contato@empresa.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div>
          <label className="field-label">E-mail Engenharia</label>
          <Input type="email" placeholder="engenharia@empresa.com" value={form.emailEngenharia} onChange={(e) => update("emailEngenharia", e.target.value)} />
        </div>
        {tipoFixo !== "Fornecedor" && (
          <>
            <div>
              <label className="field-label">E-mail OS CC</label>
              <Input type="email" placeholder="os-cc@empresa.com" value={form.emailOsCc} onChange={(e) => update("emailOsCc", e.target.value)} />
            </div>
            <div>
              <label className="field-label">E-mail OS BCC</label>
              <Input type="email" placeholder="os-bcc@empresa.com" value={form.emailOsBcc} onChange={(e) => update("emailOsBcc", e.target.value)} />
            </div>
            <div>
              <label className="field-label">E-mail SS CC</label>
              <Input type="email" placeholder="ss-cc@empresa.com" value={form.emailSsCc} onChange={(e) => update("emailSsCc", e.target.value)} />
            </div>
            <div>
              <label className="field-label">E-mail SS BCC</label>
              <Input type="email" placeholder="ss-bcc@empresa.com" value={form.emailSsBcc} onChange={(e) => update("emailSsBcc", e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className="field-label">E-mail Compras</label>
          <Input type="email" placeholder="compras@empresa.com" value={form.emailCompras} onChange={(e) => update("emailCompras", e.target.value)} />
        </div>
      </div>

      {/* Impressão OS - apenas para Clientes */}
      {tipoFixo !== "Fornecedor" && (
        <>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6">Impressão de OS - Cabeçalho</h3>
          <div className="mb-4">
            <label className="field-label">Logo do Cliente (máx. 500KB)</label>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="h-16 w-auto max-w-[160px] object-contain border rounded bg-white p-1" />
              ) : (
                <div className="h-16 w-32 border border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">Sem logo</div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <Button type="button" variant="outline" size="sm" className="gap-1" disabled={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                <Upload className="h-3 w-3" /> {uploadingLogo ? "Enviando..." : (form.logoUrl ? "Trocar logo" : "Enviar logo")}
              </Button>
              {form.logoUrl && (
                <Button type="button" variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => setForm((p) => ({ ...p, logoUrl: "" }))}>
                  <Trash2 className="h-3 w-3" /> Remover
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Linha 1</label>
              <Input value={form.relLinha1} onChange={(e) => update("relLinha1", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Linha 2</label>
              <Input value={form.relLinha2} onChange={(e) => update("relLinha2", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Linha 3</label>
              <Input value={form.relLinha3} onChange={(e) => update("relLinha3", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Linha 4</label>
              <Input value={form.relLinha4} onChange={(e) => update("relLinha4", e.target.value)} />
            </div>
          </div>
        </>
      )}

      {/* Buttons */}
      <div className="flex gap-2 mt-6">
        <Button type="submit" className="gap-2">
          <Plus className="h-4 w-4" />
          {editingId ? "Salvar Alterações" : `Adicionar ${label}`}
        </Button>
        {editingId && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        )}
      </div>
    </form>
  );
}

export { emptyForm };
export type { FormData };
