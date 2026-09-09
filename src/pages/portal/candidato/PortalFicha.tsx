import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { CONSELHOS_CLASSE } from "@/components/ConselhoClasseSection";
import { portalCall } from "@/lib/portalClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { isValidCPF, maskCPF, onlyDigits } from "@/lib/validators";


interface ProgressGroup { label: string; weight: number; items?: string[]; check?: boolean; }

const UF_OPTIONS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

interface Dep { nome: string; parentesco: string; nascimento: string; cpf?: string; salario_familia?: boolean; incapacidade_trabalho?: boolean; }
interface Contato { nome: string; parentesco: string; telefone: string; }

const ESCOLARIDADE_OPTIONS = [
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Completo",
  "Ensino Médio Incompleto",
  "Ensino Médio Completo",
  "Superior Incompleto",
  "Superior Completo",
  "Pós-Graduação/MBA Incompleto",
  "Pós-Graduação/MBA Completo",
  "Mestrado Incompleto",
  "Mestrado Completo",
  "Doutorado Incompleto",
  "Doutorado Completo",
  "Pós-Doutorado",
];

const PARENTESCO_OPTIONS = [
  "Esposa(o)",
  "Filho(a)",
  "Enteado(a)",
  "Pai",
  "Mãe",
  "Avô",
  "Avó",
];

const TIPO_CONTA_OPTIONS = [
  "Conta Salário",
  "Conta Corrente",
  "Conta Poupança",
];

const F = ({ l, v, on, type = "text", ph }: any) => (
  <div><Label className="text-xs">{l}</Label><Input type={type} value={v ?? ""} placeholder={ph} onChange={(e) => on(e.target.value)} /></div>
);

function calcProgresso(dp: any, docs: any, end: any, bc: any, deps: Dep[], ces: Contato[]) {
  const groups: ProgressGroup[] = [
    {
      label: "Dados Pessoais",
      weight: 35,
      items: [dp.nome, dp.dataNasc, dp.sexo, dp.estadoCivil, dp.nacionalidade, dp.naturalidade, dp.nomeMae, dp.telefone, dp.email, dp.escolaridade, dp.cursoFormacao, dp.foto],
    },
    {
      label: "Documentos",
      weight: 20,
      items: [docs.cpf, docs.rgNumero, docs.rgOrgao, docs.rgUf, docs.rgEmissao, docs.ctpsNumero, docs.ctpsSerie, docs.ctpsUf, docs.ctpsEmissao, docs.pisPasep, docs.tituloEleitor, docs.tituloZona, docs.tituloSecao, docs.cnhNumero, docs.cnhCategoria, docs.cnhValidade, docs.cnhPrimeira, docs.certidaoTipo, docs.certidaoNumero, docs.certidaoEmissao, docs.conselhoClasse, docs.conselhoNumero, docs.conselhoDataExpedicao, docs.conselhoUf],
    },
    {
      label: "Endereço",
      weight: 15,
      items: [end.cep, end.logradouro, end.numero, end.bairro, end.cidade, end.uf],
    },
    {
      label: "Dados Bancários",
      weight: 15,
      items: [bc.banco, bc.agencia, bc.conta, bc.tipoConta, bc.chavePix],
    },
    {
      label: "Dependentes",
      weight: 7.5,
      check: deps.length > 0 && deps.some((d) => d.nome && d.parentesco && d.nascimento),
    },
    {
      label: "Contatos de Emergência",
      weight: 7.5,
      check: ces.length > 0 && ces.some((c) => c.nome && c.parentesco && c.telefone),
    },
  ];

  let total = 0;
  for (const g of groups) {
    if (g.check !== undefined) {
      total += g.weight * (g.check ? 1 : 0);
    } else if (g.items && g.items.length > 0) {
      const filled = g.items.filter((v) => v !== undefined && v !== "" && v !== null).length;
      total += g.weight * (filled / g.items.length);
    }
  }
  return Math.min(100, Math.round(total));
}

export default function PortalFicha() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("rascunho");

  const [dp, setDp] = useState<any>({ nome: "", dataNasc: "", sexo: "", estadoCivil: "", nacionalidade: "Brasileira", naturalidade: "", nomeMae: "", nomePai: "", telefone: "", email: "", escolaridade: "", cursoFormacao: "", foto: "", uniforme: { camisa: "", calca: "", calcado: "", peso: "", altura: "" } });
  const [docs, setDocs] = useState<any>({
    cpf: "", rgNumero: "", rgOrgao: "", rgUf: "", rgEmissao: "",
    ctpsNumero: "", ctpsSerie: "", ctpsUf: "", ctpsEmissao: "",
    pisPasep: "", tituloEleitor: "", tituloZona: "", tituloSecao: "",
    cnhNumero: "", cnhCategoria: "", cnhValidade: "", cnhPrimeira: "",
    reservistaNumero: "", reservistaCategoria: "",
    passaporteNumero: "", passaporteValidade: "",
    certidaoNumero: "", certidaoTipo: "", certidaoEmissao: "",
    conselhoClasse: "", conselhoNumero: "", conselhoDataExpedicao: "", conselhoUf: "",
  });
  const [end, setEnd] = useState<any>({ cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });
  const [bc, setBc] = useState<any>({ banco: "", agencia: "", conta: "", tipoConta: "", chavePix: "" });
  const [deps, setDeps] = useState<Dep[]>([]);
  const [ces, setCes] = useState<Contato[]>([]);
  const [pensao, setPensao] = useState<any>({
    possui: false, processo: "", percentualOuValor: "",
    beneficiarios: [] as any[],
    contaBancaria: "", dataInicio: "", dataTermino: "",
    empresaAnteriorDescontava: "", podeApresentarCopia: "", observacoes: "", anexos: [] as any[],
  });
  const novoBeneficiario = () => ({ nome: "", cpf: "", representanteNome: "", representanteCpf: "", processo: "", percentualOuValor: "" });



  useEffect(() => {
    portalCall<{ ficha: any; prefill?: { nome?: string; cpf?: string; dataNascimento?: string } }>("cand-ficha-get").then(({ ficha, prefill }) => {
      const pf = prefill || {};
      const cpfMasked = pf.cpf ? maskCPF(pf.cpf) : "";
      if (ficha) {
        const { documentos, ...rest } = (ficha.dados_pessoais || {});
        const migrated = { escolaridade: documentos?.escolaridade ?? rest.escolaridade ?? "", cursoFormacao: documentos?.cursoFormacao ?? rest.cursoFormacao ?? "" };
        setDp({
          ...dp,
          ...rest,
          ...migrated,
          nome: rest.nome || pf.nome || "",
          dataNasc: rest.dataNasc || pf.dataNascimento || "",
        });
        const { escolaridade, cursoFormacao, ...restDocs } = documentos || {};
        setDocs({ ...docs, ...restDocs, cpf: restDocs?.cpf || cpfMasked });
        setEnd({ ...end, ...(ficha.endereco || {}) });
        setBc({ ...bc, ...(ficha.bancarios || {}) });
        setDeps(ficha.dependentes || []); setCes(ficha.contatos_emergencia || []);
        if (rest.pensao_alimenticia) {
          const pa = { ...rest.pensao_alimenticia };
          // Migração: formato antigo (1 alimentando / 1 anexo) → listas
          if (!Array.isArray(pa.beneficiarios)) {
            pa.beneficiarios = (pa.alimentandoNome || pa.alimentandoCpf || pa.representanteNome)
              ? [{
                  nome: pa.alimentandoNome || "", cpf: pa.alimentandoCpf || "",
                  representanteNome: pa.representanteNome || "", representanteCpf: pa.representanteCpf || "",
                  processo: pa.processo || "", percentualOuValor: pa.percentualOuValor || "",
                }]
              : [];
          }
          if (!Array.isArray(pa.anexos)) pa.anexos = pa.anexo ? [pa.anexo] : [];
          setPensao((p: any) => ({ ...p, ...pa }));
        }

        setStatus(ficha.status || "rascunho");
      } else {
        // Primeiro acesso: pré-preenche a partir do cadastro do candidato
        setDp({ ...dp, nome: pf.nome || "", dataNasc: pf.dataNascimento || "" });
        setDocs({ ...docs, cpf: cpfMasked });
      }
    }).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const cpfInvalido = docs.cpf && !isValidCPF(docs.cpf);

  const maskCEP = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 8);
    return digits.length > 5 ? digits.replace(/^(\d{5})(\d)/, "$1-$2") : digits;
  };

  const buscarCep = async (raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado."); return; }
      setEnd((prev: any) => ({
        ...prev,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.localidade || prev.cidade,
        uf: data.uf || prev.uf,
      }));
    } catch { toast.error("Erro ao buscar CEP."); }
  };
  const depsCpfInvalidos = deps.some((d) => d.cpf && !isValidCPF(d.cpf));
  const progresso = calcProgresso(dp, docs, end, bc, deps, ces);

  const salvar = async (enviar = false) => {
    if (enviar) {
      if (!docs.cpf || !isValidCPF(docs.cpf)) {
        toast.error("Informe um CPF válido antes de enviar.");
        return;
      }
      if (depsCpfInvalidos) {
        toast.error("Há CPF de dependente inválido.");
        return;
      }
      if (pensao.possui) {
        const bens = pensao.beneficiarios || [];
        if (bens.length === 0 || bens.some((b: any) => !b.nome?.trim())) {
          toast.error("Informe o nome de cada alimentando da pensão alimentícia.");
          return;
        }
        if (bens.some((b: any) => b.cpf && !isValidCPF(b.cpf)) || bens.some((b: any) => b.representanteCpf && !isValidCPF(b.representanteCpf))) {
          toast.error("Há CPF inválido no bloco de pensão alimentícia.");
          return;
        }
        if (!pensao.processo?.trim() && bens.some((b: any) => !b.processo?.trim())) {
          toast.error("Informe o número do processo/documento da pensão alimentícia.");
          return;
        }
        if (!pensao.percentualOuValor?.trim() && bens.some((b: any) => !b.percentualOuValor?.trim())) {
          toast.error("Informe o percentual ou valor determinado da pensão alimentícia.");
          return;
        }
      }
    }

    setSaving(true);
    try {
      await portalCall("cand-ficha-save", { dados_pessoais: { ...dp, documentos: docs, pensao_alimenticia: pensao }, endereco: end, bancarios: bc, dependentes: deps, contatos_emergencia: ces, enviar });
      toast.success(enviar ? "Ficha enviada para análise do RH." : "Rascunho salvo.");
      if (enviar) setStatus("enviada");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };




  return (
    <PortalLayout requireTipo="candidato">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Ficha Cadastral</h1>
        <span className="text-xs px-2 py-1 rounded bg-muted">{status.toUpperCase()}</span>
      </div>
      {!loading && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Preenchimento da ficha</span>
              <span className={`text-sm font-bold ${progresso === 100 ? "text-emerald-600" : "text-primary"}`}>{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {progresso === 100 ? "Todos os campos obrigatórios estão preenchidos." : "Complete os campos abaixo para aumentar o progresso."}
            </p>
          </CardContent>
        </Card>
      )}
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="md:w-48 flex-shrink-0 flex flex-col items-center gap-2">
                  <Label className="text-xs self-start">Foto</Label>
                  <div className="w-40 h-52 border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center">
                    {dp.foto ? (
                      <img src={dp.foto} alt="Foto do candidato" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground text-center px-2">Sem foto</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <input
                      id="foto-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 3 * 1024 * 1024) { toast.error("Imagem deve ter até 3MB."); return; }
                        const r = new FileReader();
                        r.onload = () => setDp({ ...dp, foto: r.result as string });
                        r.readAsDataURL(f);
                      }}
                    />
                    <input
                      id="foto-camera"
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 3 * 1024 * 1024) { toast.error("Imagem deve ter até 3MB."); return; }
                        const r = new FileReader();
                        r.onload = () => setDp({ ...dp, foto: r.result as string });
                        r.readAsDataURL(f);
                      }}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById("foto-upload")?.click()}>Enviar arquivo</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById("foto-camera")?.click()}>Tirar foto</Button>
                    {dp.foto && (
                      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setDp({ ...dp, foto: "" })}>Remover</Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <F l="Nome completo" v={dp.nome} on={(v: string) => setDp({ ...dp, nome: v })} />
                  <F l="Data de nascimento" type="date" v={dp.dataNasc} on={(v: string) => setDp({ ...dp, dataNasc: v })} />
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Sexo</Label>
                    <Select value={dp.sexo || ""} onValueChange={(v) => setDp({ ...dp, sexo: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Feminino", "Masculino"].map((op) => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Estado civil</Label>
                    <Select value={dp.estadoCivil || ""} onValueChange={(v) => setDp({ ...dp, estadoCivil: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Solteiro(a)", "Casado(a)", "Separado(a) Judicialmente", "Divorciado(a)", "Viúvo(a)"].map((op) => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <F l="Nacionalidade" v={dp.nacionalidade} on={(v: string) => setDp({ ...dp, nacionalidade: v })} />
                  <F l="Naturalidade" v={dp.naturalidade} on={(v: string) => setDp({ ...dp, naturalidade: v })} />
                  <F l="Nome da mãe" v={dp.nomeMae} on={(v: string) => setDp({ ...dp, nomeMae: v })} />
                  <F l="Nome do pai" v={dp.nomePai} on={(v: string) => setDp({ ...dp, nomePai: v })} />
                  <F l="Telefone/WhatsApp" v={dp.telefone} on={(v: string) => setDp({ ...dp, telefone: v })} />
                  <F l="E-mail" v={dp.email} on={(v: string) => setDp({ ...dp, email: v })} />
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Escolaridade</Label>
                    <Select value={dp.escolaridade || ""} onValueChange={(v) => setDp({ ...dp, escolaridade: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESCOLARIDADE_OPTIONS.map((op) => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <F l="Curso / Formação" v={dp.cursoFormacao} on={(v: string) => setDp({ ...dp, cursoFormacao: v })} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Identificação</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">CPF</Label>
                    <Input
                      value={docs.cpf ?? ""}
                      onChange={(e) => setDocs({ ...docs, cpf: maskCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      maxLength={14}
                      className={cpfInvalido ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {cpfInvalido && <p className="text-[11px] text-destructive mt-1">CPF inválido</p>}
                    {docs.cpf && !cpfInvalido && onlyDigits(docs.cpf).length === 11 && (
                      <p className="text-[11px] text-emerald-600 mt-1">CPF válido</p>
                    )}
                  </div>
                  <F l="RG - Número" v={docs.rgNumero} on={(v: string) => setDocs({ ...docs, rgNumero: v })} />
                  <F l="RG - Órgão emissor" v={docs.rgOrgao} on={(v: string) => setDocs({ ...docs, rgOrgao: v })} />
                  <div>
                    <Label className="text-xs">RG - UF</Label>
                    <Select value={docs.rgUf || ""} onValueChange={(v) => setDocs({ ...docs, rgUf: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <F l="RG - Data de emissão" type="date" v={docs.rgEmissao} on={(v: string) => setDocs({ ...docs, rgEmissao: v })} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Carteira de Trabalho (CTPS)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <F l="Número" v={docs.ctpsNumero} on={(v: string) => setDocs({ ...docs, ctpsNumero: v })} />
                  <F l="Série" v={docs.ctpsSerie} on={(v: string) => setDocs({ ...docs, ctpsSerie: v })} />
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Select value={docs.ctpsUf || ""} onValueChange={(v) => setDocs({ ...docs, ctpsUf: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <F l="Data de emissão" type="date" v={docs.ctpsEmissao} on={(v: string) => setDocs({ ...docs, ctpsEmissao: v })} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">PIS / Título de Eleitor</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <F l="PIS/PASEP" v={docs.pisPasep} on={(v: string) => setDocs({ ...docs, pisPasep: v })} />
                  <F l="Título de Eleitor" v={docs.tituloEleitor} on={(v: string) => setDocs({ ...docs, tituloEleitor: v })} />
                  <F l="Zona" v={docs.tituloZona} on={(v: string) => setDocs({ ...docs, tituloZona: v })} />
                  <F l="Seção" v={docs.tituloSecao} on={(v: string) => setDocs({ ...docs, tituloSecao: v })} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">CNH</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <F l="Número" v={docs.cnhNumero} on={(v: string) => setDocs({ ...docs, cnhNumero: v })} />
                  <F l="Categoria" v={docs.cnhCategoria} on={(v: string) => setDocs({ ...docs, cnhCategoria: v })} />
                  <F l="Validade" type="date" v={docs.cnhValidade} on={(v: string) => setDocs({ ...docs, cnhValidade: v })} />
                  <F l="1ª Habilitação" type="date" v={docs.cnhPrimeira} on={(v: string) => setDocs({ ...docs, cnhPrimeira: v })} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Reservista / Passaporte</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <F l="Reservista - Número" v={docs.reservistaNumero} on={(v: string) => setDocs({ ...docs, reservistaNumero: v })} />
                  <F l="Reservista - Categoria" v={docs.reservistaCategoria} on={(v: string) => setDocs({ ...docs, reservistaCategoria: v })} />
                  <F l="Passaporte - Número" v={docs.passaporteNumero} on={(v: string) => setDocs({ ...docs, passaporteNumero: v })} />
                  <F l="Passaporte - Validade" type="date" v={docs.passaporteValidade} on={(v: string) => setDocs({ ...docs, passaporteValidade: v })} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Conselho de Classe</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Conselho</Label>
                    <Select value={docs.conselhoClasse || ""} onValueChange={(v) => setDocs({ ...docs, conselhoClasse: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {CONSELHOS_CLASSE.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <F l="Nº de Registro" v={docs.conselhoNumero} on={(v: string) => setDocs({ ...docs, conselhoNumero: v })} />
                  <F l="Data de Expedição" type="date" v={docs.conselhoDataExpedicao} on={(v: string) => setDocs({ ...docs, conselhoDataExpedicao: v })} />
                  <div>
                    <Label className="text-xs">UF de Expedição</Label>
                    <Select value={docs.conselhoUf || ""} onValueChange={(v) => setDocs({ ...docs, conselhoUf: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Anexe a carteira do conselho na aba Documentos (tipo "Carteira do Conselho de Classe").</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Certidão</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Certidão - Tipo</Label>
                    <Select value={docs.certidaoTipo || ""} onValueChange={(v) => setDocs({ ...docs, certidaoTipo: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Certidão de Nascimento">Certidão de Nascimento</SelectItem>
                        <SelectItem value="Certidão de Casamento">Certidão de Casamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <F l="Certidão - Número/Matrícula" v={docs.certidaoNumero} on={(v: string) => setDocs({ ...docs, certidaoNumero: v })} />
                  <F l="Certidão - Data de emissão" type="date" v={docs.certidaoEmissao} on={(v: string) => setDocs({ ...docs, certidaoEmissao: v })} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Endereço</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">CEP</Label>
                <Input
                  value={end.cep ?? ""}
                  onChange={(e) => setEnd({ ...end, cep: maskCEP(e.target.value) })}
                  onBlur={(e) => buscarCep(e.target.value)}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                />
              </div>
              <F l="Logradouro" v={end.logradouro} on={(v: string) => setEnd({ ...end, logradouro: v })} />
              <F l="Número" v={end.numero} on={(v: string) => setEnd({ ...end, numero: v })} />
              <F l="Complemento" v={end.complemento} on={(v: string) => setEnd({ ...end, complemento: v })} />
              <F l="Bairro" v={end.bairro} on={(v: string) => setEnd({ ...end, bairro: v })} />
              <F l="Cidade" v={end.cidade} on={(v: string) => setEnd({ ...end, cidade: v })} />
              <div>
                <Label className="text-xs">UF</Label>
                <Select value={end.uf || ""} onValueChange={(v) => setEnd({ ...end, uf: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Dados Bancários</CardTitle>
              <p className="text-sm text-destructive font-medium">Preencha com muita atenção!</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <F l="Banco" v={bc.banco} on={(v: string) => setBc({ ...bc, banco: v })} />
              <F l="Agência" v={bc.agencia} on={(v: string) => setBc({ ...bc, agencia: v })} />
              <F l="Conta" v={bc.conta} on={(v: string) => setBc({ ...bc, conta: v })} />
              <div>
                <Label className="text-xs">Tipo de conta</Label>
                <Select value={bc.tipoConta || ""} onValueChange={(v) => setBc({ ...bc, tipoConta: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPO_CONTA_OPTIONS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <F l="Chave PIX" v={bc.chavePix} on={(v: string) => setBc({ ...bc, chavePix: v })} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Uniforme</CardTitle>
              <p className="text-xs text-muted-foreground">Informações para dimensionamento de uniformes e EPIs.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <F l="Tam. Camisa" v={dp.uniforme?.camisa || ""} on={(v: string) => setDp({ ...dp, uniforme: { ...(dp.uniforme || {}), camisa: v } })} ph="P, M, G..." />
              <F l="Tam. Calça" v={dp.uniforme?.calca || ""} on={(v: string) => setDp({ ...dp, uniforme: { ...(dp.uniforme || {}), calca: v } })} ph="38, 40, 42" />
              <F l="Tam. Calçado" v={dp.uniforme?.calcado || ""} on={(v: string) => setDp({ ...dp, uniforme: { ...(dp.uniforme || {}), calcado: v } })} ph="39, 40, 41" />
              <F l="Peso (kg)" v={dp.uniforme?.peso || ""} on={(v: string) => setDp({ ...dp, uniforme: { ...(dp.uniforme || {}), peso: v } })} ph="Ex: 75" />
              <F l="Altura (cm)" v={dp.uniforme?.altura || ""} on={(v: string) => setDp({ ...dp, uniforme: { ...(dp.uniforme || {}), altura: v } })} ph="Ex: 175" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dependentes</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDeps([...deps, { nome: "", parentesco: "", nascimento: "", cpf: "" }])}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {deps.map((d, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                    <div className="md:col-span-2"><Label className="text-xs">Nome</Label><Input value={d.nome} onChange={(e) => { const n = [...deps]; n[i].nome = e.target.value; setDeps(n); }} /></div>
                    <div>
                      <Label className="text-xs">Parentesco</Label>
                      <Select value={d.parentesco || ""} onValueChange={(v) => { const n = [...deps]; n[i].parentesco = v; setDeps(n); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {PARENTESCO_OPTIONS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Nascimento</Label><Input type="date" value={d.nascimento} onChange={(e) => { const n = [...deps]; n[i].nascimento = e.target.value; setDeps(n); }} /></div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="CPF"
                        value={d.cpf ?? ""}
                        inputMode="numeric"
                        maxLength={14}
                        onChange={(e) => { const n = [...deps]; n[i].cpf = maskCPF(e.target.value); setDeps(n); }}
                        className={d.cpf && !isValidCPF(d.cpf) ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      <Button size="icon" variant="ghost" onClick={() => setDeps(deps.filter((_, x) => x !== i))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:gap-6">
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={!!d.salario_familia}
                        onCheckedChange={(c) => { const n = [...deps]; n[i].salario_familia = !!c; setDeps(n); }}
                      />
                      <span>Possui direito a salário-família</span>
                    </label>
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={!!d.incapacidade_trabalho}
                        onCheckedChange={(c) => { const n = [...deps]; n[i].incapacidade_trabalho = !!c; setDeps(n); }}
                      />
                      <span>Possui incapacidade para o trabalho (quando necessário para fins legais ou de benefício)</span>
                    </label>
                  </div>
                </div>
              ))}
              {deps.length === 0 && <p className="text-xs text-muted-foreground">Nenhum dependente.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Pensão Alimentícia</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox checked={!!pensao.possui} onCheckedChange={(c) => setPensao({ ...pensao, possui: !!c })} />
                <span>Existe decisão judicial, acordo homologado, escritura pública ou ordem formal que deva ser cumprida pela empresa para desconto de pensão alimentícia em folha?</span>
              </label>
              {pensao.possui && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div><Label className="text-xs">Número do processo ou documento (geral)</Label><Input value={pensao.processo} onChange={(e) => setPensao({ ...pensao, processo: e.target.value })} /></div>
                    <div><Label className="text-xs">Percentual (%) ou valor determinado (geral)</Label><Input value={pensao.percentualOuValor} onChange={(e) => setPensao({ ...pensao, percentualOuValor: e.target.value })} placeholder="Ex.: 30% ou R$ 800,00" /></div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Alimentandos ({(pensao.beneficiarios || []).length})</Label>
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => setPensao((p: any) => ({ ...p, beneficiarios: [...(p.beneficiarios || []), novoBeneficiario()] }))}>
                        <Plus className="w-4 h-4 mr-1" />Adicionar alimentando
                      </Button>
                    </div>
                    {(pensao.beneficiarios || []).map((b: any, i: number) => {
                      const upd = (patch: any) => setPensao((p: any) => ({
                        ...p, beneficiarios: (p.beneficiarios || []).map((x: any, j: number) => (j === i ? { ...x, ...patch } : x)),
                      }));
                      return (
                        <div key={i} className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Alimentando {i + 1}</span>
                            <Button type="button" variant="ghost" size="sm" className="text-destructive"
                              onClick={() => setPensao((p: any) => ({ ...p, beneficiarios: (p.beneficiarios || []).filter((_: any, j: number) => j !== i) }))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div><Label className="text-xs">Nome do alimentando</Label><Input value={b.nome || ""} onChange={(e) => upd({ nome: e.target.value })} /></div>
                            <div>
                              <Label className="text-xs">CPF do alimentando</Label>
                              <Input value={b.cpf || ""} inputMode="numeric" maxLength={14}
                                onChange={(e) => upd({ cpf: maskCPF(e.target.value) })}
                                className={b.cpf && !isValidCPF(b.cpf) ? "border-destructive focus-visible:ring-destructive" : ""} />
                            </div>
                            <div><Label className="text-xs">Nome do representante legal</Label><Input value={b.representanteNome || ""} onChange={(e) => upd({ representanteNome: e.target.value })} /></div>
                            <div>
                              <Label className="text-xs">CPF do representante legal</Label>
                              <Input value={b.representanteCpf || ""} inputMode="numeric" maxLength={14}
                                onChange={(e) => upd({ representanteCpf: maskCPF(e.target.value) })}
                                className={b.representanteCpf && !isValidCPF(b.representanteCpf) ? "border-destructive focus-visible:ring-destructive" : ""} />
                            </div>
                            <div><Label className="text-xs">Processo/documento deste alimentando</Label><Input value={b.processo || ""} onChange={(e) => upd({ processo: e.target.value })} placeholder="Opcional se já informado acima" /></div>
                            <div><Label className="text-xs">Percentual (%) ou valor</Label><Input value={b.percentualOuValor || ""} onChange={(e) => upd({ percentualOuValor: e.target.value })} placeholder="Ex.: 20% ou R$ 500,00" /></div>
                          </div>
                        </div>
                      );
                    })}
                    {(pensao.beneficiarios || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum alimentando informado. Clique em "Adicionar alimentando".</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="md:col-span-2"><Label className="text-xs">Conta bancária indicada no documento</Label><Input value={pensao.contaBancaria} onChange={(e) => setPensao({ ...pensao, contaBancaria: e.target.value })} placeholder="Banco, agência, conta e titular" /></div>
                    <div><Label className="text-xs">Data de início do desconto</Label><Input type="date" value={pensao.dataInicio} onChange={(e) => setPensao({ ...pensao, dataInicio: e.target.value })} /></div>
                    <div><Label className="text-xs">Data de término do desconto</Label><Input type="date" value={pensao.dataTermino} onChange={(e) => setPensao({ ...pensao, dataTermino: e.target.value })} /></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">A empresa anterior já realizava o desconto?</Label>
                      <Select value={pensao.empresaAnteriorDescontava || ""} onValueChange={(v) => setPensao({ ...pensao, empresaAnteriorDescontava: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Não sei informar">Não sei informar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Pode apresentar cópia integral e atualizada do documento?</Label>
                      <Select value={pensao.podeApresentarCopia || ""} onValueChange={(v) => setPensao({ ...pensao, podeApresentarCopia: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Providenciarei">Providenciarei</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {pensao.podeApresentarCopia === "Sim" && (
                    <div className="rounded-md border p-3 space-y-2">
                      <Label className="text-xs">Anexar cópias dos documentos (PDF, JPG ou PNG — até 3 arquivos, 5MB cada)</Label>
                      {(pensao.anexos || []).map((a: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-sm truncate">{a.nome}</span>
                          <Button type="button" variant="ghost" size="sm" className="text-destructive"
                            onClick={() => setPensao((p: any) => ({ ...p, anexos: (p.anexos || []).filter((_: any, j: number) => j !== i) }))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {(pensao.anexos || []).length < 3 && (
                        <Input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = "";
                            if (!files.length) return;
                            const atuais = (pensao.anexos || []).length;
                            const livres = 3 - atuais;
                            if (files.length > livres) toast.error(`Somente ${livres} arquivo(s) restante(s). Os excedentes foram ignorados.`);
                            files.slice(0, livres).forEach((f) => {
                              const okType = ["application/pdf", "image/jpeg", "image/png"].includes(f.type);
                              if (!okType) { toast.error(`${f.name}: formato inválido. Envie PDF, JPG ou PNG.`); return; }
                              if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name}: arquivo excede 5MB.`); return; }
                              const r = new FileReader();
                              r.onload = () => setPensao((p: any) => {
                                const lista = p.anexos || [];
                                if (lista.length >= 3) return p;
                                return { ...p, anexos: [...lista, { nome: f.name, tipo: f.type, base64: String(r.result) }] };
                              });
                              r.readAsDataURL(f);
                            });
                          }}
                        />
                      )}
                    </div>
                  )}
                  <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={pensao.observacoes} onChange={(e) => setPensao({ ...pensao, observacoes: e.target.value })} /></div>

                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contatos de Emergência</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setCes([...ces, { nome: "", parentesco: "", telefone: "" }])}><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {ces.map((c, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  <div><Label className="text-xs">Nome</Label><Input value={c.nome} onChange={(e) => { const n = [...ces]; n[i].nome = e.target.value; setCes(n); }} /></div>
                  <div>
                    <Label className="text-xs">Parentesco</Label>
                    <Select value={c.parentesco || ""} onValueChange={(v) => { const n = [...ces]; n[i].parentesco = v; setCes(n); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {PARENTESCO_OPTIONS.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Telefone</Label><Input value={c.telefone} onChange={(e) => { const n = [...ces]; n[i].telefone = e.target.value; setCes(n); }} /></div>
                  <div><Button size="icon" variant="ghost" onClick={() => setCes(ces.filter((_, x) => x !== i))}><Trash2 className="w-4 h-4 text-destructive" /></Button></div>
                </div>
              ))}
              {ces.length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato.</p>}
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2 sticky bottom-4">
            <Button variant="outline" onClick={() => salvar(false)} disabled={saving}>Salvar rascunho</Button>
            <Button onClick={() => salvar(true)} disabled={saving}>Enviar para o RH</Button>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
