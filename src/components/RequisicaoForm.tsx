import { lerArquivoBase64 } from "@/lib/compressFile";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Paperclip, Send, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useClientes } from "@/contexts/ClientesContext";
import FormSection from "@/components/FormSection";
import CheckboxGroup from "@/components/CheckboxGroup";
import RadioGroupCustom from "@/components/RadioGroupCustom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCargos } from "@/contexts/CargosContext";
import { useRequisicoes } from "@/contexts/RequisicaoContext";
import { useAuth } from "@/contexts/AuthContext";

const jornadaOptions = ["Diarista", "Plantão Diurno - PAR", "Plantão Diurno - ÍMPAR", "Plantão Noturno - PAR", "Plantão Noturno - ÍMPAR"];
const contratacaoOptions = ["Efetivo", "Temporário"];
const tipoContratacaoOptions = ["Padrão", "PCD", "Temporário", "Estagiário", "Jovem Aprendiz"];
const internoExternoOptions = ["Interno", "Externo"];
const origemOptions = ["Afastamento", "Desligamento", "Aumento de Quadro", "Promoção", "Outros"];
const formacaoOptions = ["Ensino Fundamental", "Ensino Médio", "Ensino Superior", "Curso Técnico", "Outros"];
const experienciaOptions = ["Não Necessita", "Até 1 ano", "De 1 a 3 anos", "De 3 a 5 anos", "Acima de 5 anos"];

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

interface Indicado {
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  dataNascimento: string;
  arquivo: File | null;
}

const emptyIndicado = (): Indicado => ({ nome: "", telefone: "", email: "", cpf: "", dataNascimento: "", arquivo: null });

const fileToBase64 = (file: File) => lerArquivoBase64(file);

const RequisicaoForm = ({ onSuccess }: { onSuccess?: () => void }) => {
  const { cargos } = useCargos();
  const { addRequisicao } = useRequisicoes();
  const { clientes } = useClientes();
  const { usuarioLogado } = useAuth();
  const [cargoOpen, setCargoOpen] = useState(false);
  const [form, setForm] = useState({
    headcount: "",
    orcamento: "",
    tipoVaga: "",
    unidade: "",
    cargo: "",
    jornada: "",
    cargaHoraria: "",
    tipoContratacao: [] as string[],
    tipoContratacaoDetalhe: "",
    internoExterno: "",
    origemVaga: "",
    motivoOutros: "",
    // Colaborador substituído
    matricula: "",
    nomeSubstituido: "",
    cargoSubstituido: "",
    salarioSubstituido: "",
    dataDesligamento: "",
    // Qualificação
    formacao: [] as string[],
    formacaoDetalhe: "",
    experiencia: "",
    conhecimentoInformatica: "",
    atividadesCargo: "",
    salarioVaga: "",
    desejaIndicar: "",
  });

  const [indicados, setIndicados] = useState<Indicado[]>([emptyIndicado()]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (field: string, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isAumentoQuadro = form.origemVaga === "Aumento de Quadro";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unidade || !form.cargo) {
      toast.error("Preencha ao menos a Unidade e o Cargo.");
      return;
    }
    const cargoObj = cargos.find((c) => c.id === form.cargo);

    let indicadosPayload: {
      nome: string; telefone: string; email: string; cpf: string; dataNascimento: string;
      curriculo?: { nome: string; tipo: string; base64: string } | null;
    }[] = [];
    if (form.desejaIndicar === "Sim") {
      const preenchidos = indicados.filter((i) => i.nome.trim());
      const cpfsVistos = new Set<string>();
      for (const i of preenchidos) {
        const cpfDigits = i.cpf.replace(/\D/g, "");
        if (cpfDigits.length !== 11) {
          toast.error(`Informe um CPF válido para o indicado "${i.nome}".`);
          return;
        }
        if (cpfsVistos.has(cpfDigits)) {
          toast.error(`O CPF do indicado "${i.nome}" já foi informado em outro indicado.`);
          return;
        }
        cpfsVistos.add(cpfDigits);
        if (!i.dataNascimento) {
          toast.error(`Informe a data de nascimento do indicado "${i.nome}".`);
          return;
        }
        let curriculo: { nome: string; tipo: string; base64: string } | null = null;
        if (i.arquivo) {
          if (i.arquivo.size > 2 * 1024 * 1024) {
            toast.error(`O currículo de "${i.nome}" excede 2MB.`);
            return;
          }
          curriculo = { nome: i.arquivo.name, tipo: i.arquivo.type, base64: await fileToBase64(i.arquivo) };
        }
        indicadosPayload.push({
          nome: i.nome.trim(), telefone: i.telefone, email: i.email,
          cpf: cpfDigits, dataNascimento: i.dataNascimento, curriculo,
        });
      }
    }

    addRequisicao({
      headcount: form.headcount,
      orcamento: form.orcamento,
      tipoVaga: form.tipoVaga,
      unidade: form.unidade,
      cargoId: form.cargo,
      cargoNome: cargoObj ? `${cargoObj.nome}${cargoObj.nivel ? ` — Nível ${cargoObj.nivel}` : ""}` : form.cargo,
      jornada: form.jornada,
      cargaHoraria: form.cargaHoraria,
      tipoContratacao: form.tipoContratacao,
      tipoContratacaoDetalhe: form.tipoContratacaoDetalhe,
      internoExterno: form.internoExterno,
      origemVaga: form.origemVaga,
      motivoOutros: form.motivoOutros,
      matricula: form.matricula,
      nomeSubstituido: form.nomeSubstituido,
      cargoSubstituido: form.cargoSubstituido,
      salarioSubstituido: form.salarioSubstituido,
      dataDesligamento: form.dataDesligamento,
      formacao: form.formacao,
      formacaoDetalhe: form.formacaoDetalhe,
      experiencia: form.experiencia,
      conhecimentoInformatica: form.conhecimentoInformatica,
      atividadesCargo: form.atividadesCargo,
      salarioVaga: form.salarioVaga,
      solicitante: usuarioLogado?.nome || "",
      indicados: indicadosPayload,
    });
    toast.success("Requisição enviada com sucesso!");
    onSuccess?.();
    setIndicados([emptyIndicado()]);
    setForm({
      headcount: "", orcamento: "", tipoVaga: "",
      unidade: "", cargo: "", jornada: "", cargaHoraria: "",
      tipoContratacao: [], tipoContratacaoDetalhe: "", internoExterno: "", origemVaga: "", motivoOutros: "",
      matricula: "", nomeSubstituido: "", cargoSubstituido: "",
      salarioSubstituido: "", dataDesligamento: "",
      formacao: [], formacaoDetalhe: "", experiencia: "",
      conhecimentoInformatica: "", atividadesCargo: "", salarioVaga: "", desejaIndicar: "",
    });
  };

  const headcountOptions = ["Previsto", "Não Previsto"];
  const orcamentoOptions = ["Previsto", "Não Previsto"];
  const tipoVagaOptions = ["Aumento de Quadro", "Substituição", "Complemento de Quadro / Jornada"];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Classificação da Vaga */}
      <FormSection title="Classificação da Vaga" delay={0}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="field-label">Headcount</label>
            <Select value={form.headcount} onValueChange={(v) => update("headcount", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {headcountOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="field-label">Orçamento</label>
            <Select value={form.orcamento} onValueChange={(v) => update("orcamento", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {orcamentoOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="field-label">Tipo</label>
            <Select value={form.tipoVaga} onValueChange={(v) => update("tipoVaga", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipoVagaOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Especificação da Vaga */}
      <FormSection title="Especificação da Vaga" delay={80}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Unidade</label>
            {clientes.length > 0 ? (
              <Select
                value={form.unidade}
                onValueChange={(v) => update("unidade", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.filter((c) => c.tipo === "Cliente").map((c) => (
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Cadastre clientes primeiro"
                value={form.unidade}
                onChange={(e) => update("unidade", e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="field-label">Cargo</label>
            {cargos.length > 0 ? (
              <Popover open={cargoOpen} onOpenChange={setCargoOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={cargoOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !form.cargo && "text-muted-foreground")}>
                      {form.cargo
                        ? (() => {
                            const c = cargos.find((c) => c.id === form.cargo);
                            return c ? `${c.nome}${c.nivel ? ` — Nível ${c.nivel}` : ""}` : "Selecione o cargo";
                          })()
                        : "Selecione o cargo"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Buscar cargo..." />
                    <CommandList className="max-h-72">
                      <CommandEmpty>Nenhum cargo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {cargos.map((c) => {
                          const label = `${c.nome}${c.nivel ? ` — Nível ${c.nivel}` : ""}`;
                          return (
                            <CommandItem
                              key={c.id}
                              value={`${label} ${c.id}`}
                              onSelect={() => {
                                const salarioVigente = c.salarios?.length
                                  ? [...c.salarios].sort((a, b) => (b.dataBase || "").localeCompare(a.dataBase || ""))[0]
                                  : null;
                                setForm((prev) => ({
                                  ...prev,
                                  cargo: c.id,
                                  salarioVaga: salarioVigente?.valor || c.salario || "",
                                }));
                                setCargoOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.cargo === c.id ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <Input
                placeholder="Cadastre cargos primeiro"
                value={form.cargo}
                onChange={(e) => update("cargo", e.target.value)}
              />
            )}
          </div>
          {form.cargo && (() => {
            const cargoSel = cargos.find((c) => c.id === form.cargo);
            const salarioVigente = cargoSel?.salarios?.length
              ? [...cargoSel.salarios].sort((a, b) => (b.dataBase || "").localeCompare(a.dataBase || ""))[0]
              : null;
            const valor = salarioVigente?.valor || cargoSel?.salario;
            const dataBase = salarioVigente?.dataBase;
            return valor ? (
              <div>
                <label className="field-label">Salário do Cargo {dataBase ? `(Data Base: ${dataBase.split("-").reverse().join("/")})`  : ""}</label>
                <Input
                  readOnly
                  value={`R$ ${valor}`}
                  className="bg-muted/50"
                />
              </div>
            ) : null;
          })()}
        </div>
      </FormSection>

      {/* Jornada de Trabalho */}
      <FormSection title="Jornada de Trabalho" delay={80}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Jornada</label>
            <Select value={form.jornada} onValueChange={(v) => update("jornada", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a jornada" />
              </SelectTrigger>
              <SelectContent>
                {jornadaOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.jornada === "Diarista" && (
            <div>
              <label className="field-label">Carga Horária</label>
              <Input
                placeholder="Ex: 44h semanais"
                value={form.cargaHoraria}
                onChange={(e) => update("cargaHoraria", e.target.value)}
              />
            </div>
          )}
        </div>
      </FormSection>

      {/* Tipo de Contratação */}
      <FormSection title="Tipo de Contratação" delay={160}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Modalidade</label>
            <Select value={form.tipoContratacao[0] || ""} onValueChange={(v) => update("tipoContratacao", [v])}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a modalidade" />
              </SelectTrigger>
              <SelectContent>
                {contratacaoOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="field-label">Tipo de contratação</label>
            <Select value={form.tipoContratacaoDetalhe} onValueChange={(v) => update("tipoContratacaoDetalhe", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de contratação" />
              </SelectTrigger>
              <SelectContent>
                {tipoContratacaoOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="field-label">Recrutamento</label>
            <Select value={form.internoExterno} onValueChange={(v) => update("internoExterno", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {internoExternoOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {/* Origem da Vaga */}
      <FormSection title="Origem da Vaga" delay={240}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="field-label">Origem</label>
            <Select value={form.origemVaga} onValueChange={(v) => update("origemVaga", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                {origemOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.origemVaga === "Outros" && (
            <div>
              <label className="field-label">Especifique o motivo</label>
              <Input
                value={form.motivoOutros}
                onChange={(e) => update("motivoOutros", e.target.value)}
              />
            </div>
          )}
        </div>
      </FormSection>

      {/* Colaborador Substituído */}
      {!isAumentoQuadro && (
        <FormSection title="Informações do Colaborador Substituído" delay={320}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Matrícula</label>
              <Input value={form.matricula} onChange={(e) => update("matricula", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Nome</label>
              <Input value={form.nomeSubstituido} onChange={(e) => update("nomeSubstituido", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Cargo</label>
              <Input value={form.cargoSubstituido} onChange={(e) => update("cargoSubstituido", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Salário (R$)</label>
              <Input value={form.salarioSubstituido} onChange={(e) => update("salarioSubstituido", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Data de Desligamento</label>
              <Input
                type="date"
                value={form.dataDesligamento}
                onChange={(e) => update("dataDesligamento", e.target.value)}
              />
            </div>
          </div>
        </FormSection>
      )}

      {/* Qualificação da Vaga */}
      <FormSection title="Qualificação da Vaga" delay={400}>
        <div className="space-y-5">
          <div>
            <label className="field-label">Formação Acadêmica</label>
            <Select value={form.formacao[0] || ""} onValueChange={(v) => update("formacao", [v])}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a formação" />
              </SelectTrigger>
              <SelectContent>
                {formacaoOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(form.formacao.includes("Ensino Superior") ||
              form.formacao.includes("Curso Técnico") ||
              form.formacao.includes("Outros")) && (
              <div className="mt-3 max-w-md">
                <label className="field-label">Especifique</label>
                <Input
                  placeholder="Qual formação?"
                  value={form.formacaoDetalhe}
                  onChange={(e) => update("formacaoDetalhe", e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <label className="field-label">Tempo de Experiência</label>
            <Select value={form.experiencia} onValueChange={(v) => update("experiencia", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tempo de experiência" />
              </SelectTrigger>
              <SelectContent>
                {experienciaOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="field-label">Conhecimento em Informática</label>
            <Input
              placeholder="Descreva os conhecimentos necessários"
              value={form.conhecimentoInformatica}
              onChange={(e) => update("conhecimentoInformatica", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Atividades do Cargo */}
      <FormSection title="Atividades do Cargo" delay={480}>
        <Textarea
          rows={5}
          placeholder="Descreva as principais atividades e responsabilidades do cargo..."
          value={form.atividadesCargo}
          onChange={(e) => update("atividadesCargo", e.target.value)}
          className="resize-none"
        />
      </FormSection>

      {/* Indicação de Profissional */}
      <FormSection title="Indicação de Profissional" delay={540}>
        <div className="space-y-4">
          <div>
            <label className="field-label">Deseja indicar algum profissional?</label>
            <Select value={form.desejaIndicar} onValueChange={(v) => {
              update("desejaIndicar", v);
              if (v === "Não") setIndicados([emptyIndicado()]);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sim">Sim</SelectItem>
                <SelectItem value="Não">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.desejaIndicar === "Sim" && (
            <div className="space-y-4">
              {indicados.map((ind, idx) => (
                <div key={idx} className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Indicado {idx + 1}
                    </span>
                    {indicados.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 px-2"
                        onClick={() => setIndicados((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="field-label">Nome</label>
                      <Input
                        placeholder="Nome completo"
                        value={ind.nome}
                        onChange={(e) => {
                          const updated = [...indicados];
                          updated[idx] = { ...updated[idx], nome: e.target.value };
                          setIndicados(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="field-label">Telefone</label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={ind.telefone}
                        onChange={(e) => {
                          const updated = [...indicados];
                          updated[idx] = { ...updated[idx], telefone: e.target.value };
                          setIndicados(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="field-label">E-mail</label>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={ind.email}
                        onChange={(e) => {
                          const updated = [...indicados];
                          updated[idx] = { ...updated[idx], email: e.target.value };
                          setIndicados(updated);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="field-label">CPF</label>
                      <Input
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        maxLength={14}
                        value={ind.cpf}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                          const masked = d
                            .replace(/^(\d{3})(\d)/, "$1.$2")
                            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
                            .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
                          const updated = [...indicados];
                          updated[idx] = { ...updated[idx], cpf: masked };
                          setIndicados(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="field-label">Data de Nascimento</label>
                      <Input
                        type="date"
                        value={ind.dataNascimento}
                        onChange={(e) => {
                          const updated = [...indicados];
                          updated[idx] = { ...updated[idx], dataNascimento: e.target.value };
                          setIndicados(updated);
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Currículo</label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={(el) => { fileInputRefs.current[idx] = el; }}
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          const updated = [...indicados];
                          updated[idx] = { ...updated[idx], arquivo: file };
                          setIndicados(updated);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => fileInputRefs.current[idx]?.click()}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {ind.arquivo ? "Trocar arquivo" : "Anexar currículo"}
                      </Button>
                      {ind.arquivo && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {ind.arquivo.name}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">PDF, Word, JPG ou PNG</p>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setIndicados((prev) => [...prev, emptyIndicado()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar outro indicado
              </Button>
            </div>
          )}
        </div>
      </FormSection>

      {/* Submit */}
      <div
        className="flex justify-end gap-3 animate-fade-up pt-2"
        style={{ animationDelay: "560ms" }}
      >
        <Button type="button" variant="outline" size="lg" className="px-6 rounded-lg" onClick={() => setForm({
          headcount: "", orcamento: "", tipoVaga: "",
          unidade: "", cargo: "", jornada: "", cargaHoraria: "",
          tipoContratacao: [], tipoContratacaoDetalhe: "", internoExterno: "", origemVaga: "", motivoOutros: "",
          matricula: "", nomeSubstituido: "", cargoSubstituido: "",
          salarioSubstituido: "", dataDesligamento: "",
          formacao: [], formacaoDetalhe: "", experiencia: "",
          conhecimentoInformatica: "", atividadesCargo: "", salarioVaga: "", desejaIndicar: "",
        })}>
          Limpar
        </Button>
        <Button type="submit" size="lg" className="gap-2 px-8 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <Send className="h-4 w-4" />
          Enviar Requisição
        </Button>
      </div>
    </form>
  );
};

export default RequisicaoForm;