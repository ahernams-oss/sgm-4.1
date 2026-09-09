import { lerArquivoBase64 } from "@/lib/compressFile";
import React, { useState, useMemo, useEffect, ReactNode } from "react";
import { useColumnOrder } from "@/hooks/useColumnOrder";
import { SortableHeaderRow, SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import promocaoPendenteIcon from "@/assets/promocao-pendente.png";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { UserCheck, Trash2, Pencil, Search, Plus, ChevronDown, ChevronUp, Bus, Paperclip, Users, FileDown, HardHat, Stethoscope, TrendingUp, Clock, MoreHorizontal, ArrowRightLeft, FileClock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import TransferirClienteDialog from "@/components/TransferirClienteDialog";
import SolicitarPromocaoDialog from "@/components/SolicitarPromocaoDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFuncionarios, emptyFuncionarioForm, PassagemDiaria, Dependente, AnexoDependente, EpiItem, UniformeItem, NrFuncionario, tiposTransporte, grausParentesco } from "@/contexts/FuncionariosContext";
import { usePedidoCompra } from "@/contexts/PedidoCompraContext";
import { AnexosDocumentosTab } from "@/components/AnexosDocumentosTab";
import { ConselhoClasseSection } from "@/components/ConselhoClasseSection";
import { useCargos } from "@/contexts/CargosContext";
import { useAuth } from "@/contexts/AuthContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useMateriaisServicos } from "@/contexts/MateriaisServicosContext";
import { useCategoriasCompras } from "@/contexts/CategoriasComprasContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, FilterX, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isValidCPF } from "@/lib/validators";
import { gerarPdfFuncionario } from "@/lib/gerarPdfFuncionario";
import { gerarPdfEpi } from "@/lib/gerarPdfEpi";
import { gerarPdfUniforme } from "@/lib/gerarPdfUniforme";
import { ExamesPeriodicosTab } from "@/components/ExamesPeriodicosTab";
import { PromocoesTab } from "@/components/PromocoesTab";
import { NRsFuncionarioTab } from "@/components/NRsFuncionarioTab";
import { FeriasTab } from "@/components/FeriasTab";
import { usePermissao } from "@/hooks/usePermissao";


const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const STATUS_OPTIONS = ["Ativo", "Inativo", "Afastado", "Férias"] as const;
const SEXO_OPTIONS = ["Masculino", "Feminino", "Outro"];
const ESTADO_CIVIL_OPTIONS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const TIPO_CONTRATO_OPTIONS = ["CLT", "PJ", "Temporário", "Estágio", "Jovem Aprendiz"];
const TIPO_CONTA_OPTIONS = ["Corrente", "Poupança", "Salário"];
const CATEGORIA_CNH_OPTIONS = ["A", "B", "AB", "C", "D", "E", "ACC"];

const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-foreground/80">{label}{required && " *"}</Label>
    {children}
  </div>
);

const PassagemTab = ({ passagens, onChange }: { passagens: PassagemDiaria[]; onChange: (p: PassagemDiaria[]) => void }) => {
  const [novaPassagem, setNovaPassagem] = useState({ tipoTransporte: "" as string, itinerario: "", valorPassagem: "", quantidade: 1 });

  const addPassagem = () => {
    if (!novaPassagem.tipoTransporte || !novaPassagem.itinerario || !novaPassagem.valorPassagem) return;
    const valor = parseFloat(novaPassagem.valorPassagem.replace(",", ".")) || 0;
    const total = valor * novaPassagem.quantidade;
    const nova: PassagemDiaria = {
      id: crypto.randomUUID(),
      tipoTransporte: novaPassagem.tipoTransporte as any,
      itinerario: novaPassagem.itinerario,
      valorPassagem: novaPassagem.valorPassagem,
      quantidade: novaPassagem.quantidade,
      total,
    };
    onChange([...passagens, nova]);
    setNovaPassagem({ tipoTransporte: "", itinerario: "", valorPassagem: "", quantidade: 1 });
  };

  const removePassagem = (id: string) => onChange(passagens.filter((p) => p.id !== id));

  const totalGeral = passagens.reduce((acc, p) => acc + p.total, 0);

  // Agrupar por tipo de transporte
  const porTipo = passagens.reduce<Record<string, { passagens: PassagemDiaria[]; total: number }>>((acc, p) => {
    const key = p.tipoTransporte || "Outros";
    if (!acc[key]) acc[key] = { passagens: [], total: 0 };
    acc[key].passagens.push(p);
    acc[key].total += p.total;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <Field label="Tipo de Transporte">
          <Select value={novaPassagem.tipoTransporte} onValueChange={(v) => setNovaPassagem((p) => ({ ...p, tipoTransporte: v }))}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {tiposTransporte.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Itinerário">
          <Input value={novaPassagem.itinerario} onChange={(e) => setNovaPassagem((p) => ({ ...p, itinerario: e.target.value }))} placeholder="Ex: Casa → Trabalho" />
        </Field>
        <Field label="Valor da Passagem (R$)">
          <Input value={novaPassagem.valorPassagem} onChange={(e) => setNovaPassagem((p) => ({ ...p, valorPassagem: e.target.value }))} placeholder="Ex: 4,50" />
        </Field>
        <Field label="Quantidade">
          <Input type="number" min={1} value={novaPassagem.quantidade} onChange={(e) => setNovaPassagem((p) => ({ ...p, quantidade: parseInt(e.target.value) || 1 }))} />
        </Field>
        <Button type="button" onClick={addPassagem} className="shadow-md">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {passagens.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo Transporte</TableHead>
                <TableHead>Itinerário</TableHead>
                <TableHead>Valor Unit.</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(porTipo)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([tipo, grupo]) => (
                  <React.Fragment key={tipo}>
                    {grupo.passagens.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.tipoTransporte}</TableCell>
                        <TableCell>{p.itinerario}</TableCell>
                        <TableCell>R$ {parseFloat(p.valorPassagem.replace(",", ".")).toFixed(2).replace(".", ",")}</TableCell>
                        <TableCell>{p.quantidade}</TableCell>
                        <TableCell className="font-medium">R$ {p.total.toFixed(2).replace(".", ",")}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" type="button" onClick={() => removePassagem(p.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={4} className="text-xs font-semibold text-right">Subtotal ({tipo}):</TableCell>
                      <TableCell className="font-bold text-sm">R$ {grupo.total.toFixed(2).replace(".", ",")}</TableCell>
                      <TableCell />
                    </TableRow>
                  </React.Fragment>
                ))}
              <TableRow className="bg-primary/5">
                <TableCell colSpan={4} className="text-sm font-bold text-right">Total Geral:</TableCell>
                <TableCell className="font-bold text-base text-primary">R$ {totalGeral.toFixed(2).replace(".", ",")}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

const DependentesTab = ({ dependentes, onChange }: { dependentes: Dependente[]; onChange: (d: Dependente[]) => void }) => {
  const [novo, setNovo] = useState({ nome: "", cpf: "", dataNascimento: "", grauParentesco: "" });

  const addDependente = () => {
    if (!novo.nome.trim() || !novo.grauParentesco) { toast.error("Informe nome e grau de parentesco."); return; }
    onChange([...dependentes, { id: crypto.randomUUID(), ...novo, anexos: [] }]);
    setNovo({ nome: "", cpf: "", dataNascimento: "", grauParentesco: "" });
  };

  const removeDependente = (id: string) => onChange(dependentes.filter((d) => d.id !== id));

  const handleAnexo = async (depId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 5MB)."); return; }
    const base64 = await lerArquivoBase64(file);
    const anexo: AnexoDependente = { id: crypto.randomUUID(), nome: file.name, base64, tipo: file.type };
    onChange(dependentes.map((d) => d.id === depId ? { ...d, anexos: [...d.anexos, anexo] } : d));
  };

  const removeAnexo = (depId: string, anexoId: string) =>
    onChange(dependentes.map((d) => d.id === depId ? { ...d, anexos: d.anexos.filter((a) => a.id !== anexoId) } : d));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <Field label="Nome do Dependente">
          <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome completo" />
        </Field>
        <Field label="CPF">
          <Input value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} placeholder="000.000.000-00" />
        </Field>
        <Field label="Data de Nascimento">
          <Input type="date" value={novo.dataNascimento} onChange={(e) => setNovo({ ...novo, dataNascimento: e.target.value })} />
        </Field>
        <Field label="Grau de Parentesco">
          <Select value={novo.grauParentesco} onValueChange={(v) => setNovo({ ...novo, grauParentesco: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {grausParentesco.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Button type="button" onClick={addDependente} size="sm" className="h-10">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {dependentes.length > 0 && (
        <div className="space-y-3">
          {dependentes.map((dep) => (
            <div key={dep.id} className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="font-semibold text-foreground">{dep.nome}</span>
                  {dep.cpf && <span className="text-muted-foreground">CPF: {dep.cpf}</span>}
                  {dep.dataNascimento && <span className="text-muted-foreground">Nasc: {dep.dataNascimento.split("-").reverse().join("/")}</span>}
                  <Badge variant="secondary">{dep.grauParentesco}</Badge>
                  {dep.salarioFamilia && <Badge variant="outline">Salário-família</Badge>}
                  {dep.incapacidadeTrabalho && <Badge variant="outline">Incapacidade p/ trabalho</Badge>}
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeDependente(dep.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexar documento
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files?.[0]) handleAnexo(dep.id, e.target.files[0]); e.target.value = ""; }} />
                </label>
                {dep.anexos.map((a) => (
                  <div key={a.id} className="flex items-center gap-1 bg-background border border-border rounded px-2 py-1 text-xs">
                    <a href={a.base64} download={a.nome} className="text-primary hover:underline truncate max-w-[150px]">{a.nome}</a>
                    <button type="button" onClick={() => removeAnexo(dep.id, a.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MOTIVOS_EPI = [
  { codigo: "1", label: "Admissão" },
  { codigo: "2", label: "Reposição por desgaste" },
  { codigo: "3", label: "Reposição por perda" },
  { codigo: "4", label: "Mudança de função" },
  { codigo: "5", label: "Extravio" },
  { codigo: "6", label: "Demissão" },
];

const EpiTab = ({ epis, onChange, cargoId, funcionarioId, telefoneWhatsapp }: { epis: EpiItem[]; onChange: (e: EpiItem[]) => void; cargoId?: string; funcionarioId?: string; telefoneWhatsapp?: string }) => {
  const [novo, setNovo] = useState({ quantidade: 1, descricao: "", ca: "", dataEntrega: "", dataVencimento: "", motivo: "1" });
  const [epiPopoverOpen, setEpiPopoverOpen] = useState(false);
  const [contingenciaOpen, setContingenciaOpen] = useState(false);
  const [contingenciaFone, setContingenciaFone] = useState("");
  const [enviandoLink, setEnviandoLink] = useState(false);
  const { materiais } = useMateriaisServicos();
  const { grupos, subGrupos, classes } = useCategoriasCompras();
  const { pedidos } = usePedidoCompra();
  const { cargos } = useCargos();
  const { usuarioLogado } = useAuth();


  const cargoEpis = useMemo(() => {
    const cargo = cargos.find((c) => c.id === cargoId);
    return cargo?.episPadrao || [];
  }, [cargos, cargoId]);

  const materiaisGrupo04 = useMemo(() => {
    const grupo = grupos.find((g) => g.codigo === "04");
    if (!grupo) return [] as typeof materiais;
    const subIds = new Set(subGrupos.filter((s) => s.grupoId === grupo.id).map((s) => s.id));
    const classeIds = new Set(classes.filter((c) => subIds.has(c.subGrupoId)).map((c) => c.id));
    return materiais.filter((m) => classeIds.has(m.categoriaId));
  }, [materiais, grupos, subGrupos, classes]);

  const pedidosEPI = useMemo(() => {
    const epiMaterialIds = new Set(materiaisGrupo04.map((m) => m.id));
    return pedidos
      .filter((p) => p.itens.some((it) => epiMaterialIds.has(it.itemId)))
      .sort((a, b) => b.numero - a.numero);
  }, [pedidos, materiaisGrupo04]);

  // Auto-prefill EPIs from cargo when list is empty and cargo has episPadrao
  useEffect(() => {
    if (epis.length === 0 && cargoEpis.length > 0) {
      onChange(
        cargoEpis.map((e) => ({
          id: crypto.randomUUID(),
          quantidade: e.quantidade || 1,
          descricao: e.descricao,
          ca: e.ca || "",
          dataEntrega: "",
          dataVencimento: "",
          motivo: "1",
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargoId, cargoEpis.length]);

  const recarregarDoCargo = () => {
    if (cargoEpis.length === 0) { toast.error("Este cargo não possui EPIs cadastrados."); return; }
    const existentesDesc = new Set(epis.map((e) => e.descricao));
    const novosDoCargo = cargoEpis
      .filter((e) => !existentesDesc.has(e.descricao))
      .map((e) => ({
        id: crypto.randomUUID(),
        quantidade: e.quantidade || 1,
        descricao: e.descricao,
        ca: e.ca || "",
        dataEntrega: "",
        dataVencimento: "",
        motivo: "1",
      }));
    if (novosDoCargo.length === 0) { toast.info("Todos os EPIs do cargo já estão na lista."); return; }
    onChange([...epis, ...novosDoCargo]);
    toast.success(`${novosDoCargo.length} EPI(s) carregado(s) do cargo.`);
  };

  const updateEpi = (id: string, patch: Partial<EpiItem>) => {
    onChange(epis.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const addEpi = () => {
    if (!novo.descricao.trim()) { toast.error("Informe a descrição do EPI."); return; }
    onChange([...epis, { id: crypto.randomUUID(), ...novo }]);
    setNovo({ quantidade: 1, descricao: "", ca: "", dataEntrega: "", dataVencimento: "", motivo: "1" });
  };

  const removeEpi = (id: string) => onChange(epis.filter((e) => e.id !== id));

  const enviarLinkRecebimento = async (foneOverride?: string): Promise<boolean> => {
    if (!funcionarioId) { toast.error("Salve o funcionário antes de enviar o link."); return false; }
    const pendentes = epis.filter((e) => !e.dataEntrega);
    if (pendentes.length === 0) { toast.error("Não há EPIs pendentes de recebimento."); return false; }
    setEnviandoLink(true);
    try {
      const responsavel = usuarioLogado?.nome || "";
      const pendentesComResp = pendentes.map((e) => ({ ...e, responsavelDistribuicao: e.responsavelDistribuicao || responsavel }));
      const pendentesIds = new Set(pendentes.map((e) => e.id));
      const episAtualizados = epis.map((e) =>
        pendentesIds.has(e.id) ? { ...e, responsavelDistribuicao: e.responsavelDistribuicao || responsavel } : e
      );
      const destino = (foneOverride ?? telefoneWhatsapp ?? "").replace(/\D/g, "");
      const token = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 8);
      const { error } = await (supabase as any).from("epis_recebimentos").insert({
        funcionario_id: funcionarioId,
        token,
        epis_ids: pendentes.map((e) => e.id),
        epis_snapshot: pendentesComResp,
        telefone_envio: destino || null,
      });
      if (error) throw error;
      onChange(episAtualizados);
      await (supabase as any).from("funcionarios").update({ epis: episAtualizados }).eq("id", funcionarioId);
      const link = `${window.location.origin}/receber-epis/${token}`;
      const msg = `Olá! Você tem ${pendentes.length} EPI(s) a confirmar. Acesse o link seguro (válido por 7 dias) para confirmar o recebimento com reconhecimento facial: ${link}`;
      if (destino) {
        const { enviarPlugSend } = await import("@/lib/plugsend");
        const r = await enviarPlugSend(destino, msg);
        if (r.success) toast.success(foneOverride ? "Link enviado para o número de contingência." : "Link enviado por WhatsApp.");
        else toast.warning("Link gerado mas WhatsApp falhou. Copie manualmente.");
      } else {
        toast.info("Sem WhatsApp cadastrado. Link copiado.");
      }
      try { await navigator.clipboard.writeText(link); } catch {}
      return true;
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao gerar link: " + (e?.message || ""));
      return false;
    } finally {
      setEnviandoLink(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[80px_1fr_120px_150px_180px_auto] gap-3 items-end">
        <Field label="Quantidade">
          <Input type="number" min={1} value={novo.quantidade} onChange={(e) => setNovo({ ...novo, quantidade: parseInt(e.target.value) || 1 })} />
        </Field>
        <Field label="E.P.I" required>
          <Popover open={epiPopoverOpen} onOpenChange={setEpiPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={epiPopoverOpen} className="w-full justify-between font-normal h-10">
                <span className="truncate">{novo.descricao || "Selecionar EPI..."}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[480px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar EPI..." />
                <CommandList>
                  <CommandEmpty>Nenhum EPI encontrado no grupo 04.</CommandEmpty>
                  <CommandGroup>
                    {materiaisGrupo04.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.codigo} ${m.descricao}`}
                        onSelect={() => {
                          setNovo({ ...novo, descricao: m.descricao });
                          setEpiPopoverOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", novo.descricao === m.descricao ? "opacity-100" : "opacity-0")} />
                        {m.codigo} - {m.descricao}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="CA">
          <Input value={novo.ca} onChange={(e) => setNovo({ ...novo, ca: e.target.value })} placeholder="Nº do CA" />
        </Field>
        <Field label="Data de Vencimento">
          <Input type="date" value={novo.dataVencimento} onChange={(e) => setNovo({ ...novo, dataVencimento: e.target.value })} />
        </Field>
        <Field label="Motivo">
          <Select value={novo.motivo} onValueChange={(v) => setNovo({ ...novo, motivo: v })}>
            <SelectTrigger><SelectValue placeholder="Motivo" /></SelectTrigger>
            <SelectContent>
              {MOTIVOS_EPI.map((m) => (
                <SelectItem key={m.codigo} value={m.codigo}>{m.codigo} - {m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button type="button" onClick={addEpi} size="sm" className="h-10">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={recarregarDoCargo} disabled={!cargoId}>
          <HardHat className="h-4 w-4 mr-1" /> Recarregar EPIs do Cargo
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={!funcionarioId}
          onClick={() => enviarLinkRecebimento()}
        >
          Enviar link de recebimento
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!funcionarioId}
          onClick={() => { setContingenciaFone(""); setContingenciaOpen(true); }}
        >
          Enviar p/ nº de contingência
        </Button>
      </div>

      <Dialog open={contingenciaOpen} onOpenChange={setContingenciaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar link para número de contingência</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Número do WhatsApp (com DDD)" required>
              <Input
                value={contingenciaFone}
                onChange={(e) => setContingenciaFone(e.target.value)}
                placeholder="(21) 99999-9999"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Use quando não for possível enviar para o número do funcionário. O envio fica registrado no recebimento.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setContingenciaOpen(false)}>Cancelar</Button>
              <Button
                type="button"
                size="sm"
                disabled={enviandoLink}
                onClick={async () => {
                  const fone = contingenciaFone.replace(/\D/g, "");
                  if (fone.length < 10) { toast.error("Informe um número válido com DDD."); return; }
                  const ok = await enviarLinkRecebimento(contingenciaFone);
                  if (ok) setContingenciaOpen(false);
                }}
              >
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {epis.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Quant.</TableHead>
                <TableHead>E.P.I</TableHead>
                <TableHead className="w-40">CA</TableHead>
                <TableHead className="w-40">Data Entrega</TableHead>
                <TableHead className="w-40">Vencimento</TableHead>
                <TableHead className="w-40">Nº do pedido</TableHead>
                <TableHead className="w-52">Motivo</TableHead>
                <TableHead className="w-48">Responsável em distribuir</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epis.map((epi) => (
                <TableRow key={epi.id}>
                  <TableCell className="text-center">
                    <Input type="number" min={1} value={epi.quantidade}
                      onChange={(e) => updateEpi(epi.id, { quantidade: parseInt(e.target.value) || 1 })}
                      className="h-8 text-center" />
                  </TableCell>
                  <TableCell>{epi.descricao}</TableCell>
                  <TableCell>
                    <Input value={epi.ca || ""} onChange={(e) => updateEpi(epi.id, { ca: e.target.value })}
                      placeholder="Nº do CA" className="h-8" />
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {epi.dataEntrega ? (
                      <span title="Confirmado por reconhecimento facial">
                        {epi.dataEntrega.split("-").reverse().join("/")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">— pendente —</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={epi.dataVencimento || ""}
                      onChange={(e) => updateEpi(epi.id, { dataVencimento: e.target.value })} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="h-8 w-full justify-between font-normal px-2 text-xs">
                          {epi.pedido || "Nº do pedido"}
                          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar pedido EPI..." />
                          <CommandList>
                            <CommandEmpty className="py-2 px-2 text-sm">
                              <div className="text-muted-foreground">Nenhum pedido EPI encontrado.</div>
                            </CommandEmpty>
                            <CommandGroup>
                              {pedidosEPI.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={String(p.numero)}
                                  onSelect={() => updateEpi(epi.id, { pedido: String(p.numero) })}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", epi.pedido === String(p.numero) ? "opacity-100" : "opacity-0")} />
                                  OC-{String(p.numero).padStart(4, "0")}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Input
                      value={epi.pedido || ""}
                      onChange={(e) => updateEpi(epi.id, { pedido: e.target.value })}
                      placeholder="Nº manual"
                      className="h-7 mt-1 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={epi.motivo || ""} onValueChange={(v) => updateEpi(epi.id, { motivo: v })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Motivo" /></SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_EPI.map((m) => (
                          <SelectItem key={m.codigo} value={m.codigo}>{m.codigo} - {m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">
                    {epi.responsavelDistribuicao || <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  <TableCell>
                    <Button size="icon" variant="ghost" type="button" onClick={() => removeEpi(epi.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

const TAMANHOS_UNIFORME = ["PP", "P", "M", "G", "GG", "XG", "XXG", "36", "38", "40", "42", "44", "46", "48", "50"];

const UniformeTab = ({
  uniformes,
  onChange,
  tamanhoCamisa, tamanhoCalca, tamanhoCalcado, peso, altura,
  onSizeChange,
}: {
  uniformes: UniformeItem[];
  onChange: (u: UniformeItem[]) => void;
  tamanhoCamisa: string; tamanhoCalca: string; tamanhoCalcado: string; peso: string; altura: string;
  onSizeChange: (field: "tamanhoCamisa" | "tamanhoCalca" | "tamanhoCalcado" | "peso" | "altura", value: string) => void;
}) => {
  const [novo, setNovo] = useState({ quantidade: 1, descricao: "", tamanho: "", dataEntrega: "", dataVencimento: "" });
  const [popOpen, setPopOpen] = useState(false);
  const { materiais } = useMateriaisServicos();
  const { grupos, subGrupos, classes } = useCategoriasCompras();

  const materiaisUniforme = useMemo(() => {
    const grupo = grupos.find((g) => /uniforme/i.test(g.nome) || g.codigo === "05");
    if (!grupo) return [] as typeof materiais;
    const subIds = new Set(subGrupos.filter((s) => s.grupoId === grupo.id).map((s) => s.id));
    const classeIds = new Set(classes.filter((c) => subIds.has(c.subGrupoId)).map((c) => c.id));
    return materiais.filter((m) => classeIds.has(m.categoriaId));
  }, [materiais, grupos, subGrupos, classes]);

  const addItem = () => {
    if (!novo.descricao.trim()) { toast.error("Informe a descrição do uniforme."); return; }
    onChange([...uniformes, { id: crypto.randomUUID(), ...novo }]);
    setNovo({ quantidade: 1, descricao: "", tamanho: "", dataEntrega: "", dataVencimento: "" });
  };
  const removeItem = (id: string) => onChange(uniformes.filter((u) => u.id !== id));

  return (
    <div className="space-y-6">
      {/* Medidas/tamanhos de referência do funcionário */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Field label="Tam. Camisa">
          <Input value={tamanhoCamisa} onChange={(e) => onSizeChange("tamanhoCamisa", e.target.value)} placeholder="P, M, G..." />
        </Field>
        <Field label="Tam. Calça">
          <Input value={tamanhoCalca} onChange={(e) => onSizeChange("tamanhoCalca", e.target.value)} placeholder="38, 40, 42" />
        </Field>
        <Field label="Tam. Calçado">
          <Input value={tamanhoCalcado} onChange={(e) => onSizeChange("tamanhoCalcado", e.target.value)} placeholder="39, 40, 41" />
        </Field>
        <Field label="Peso (kg)">
          <Input value={peso} onChange={(e) => onSizeChange("peso", e.target.value)} placeholder="Ex: 75" />
        </Field>
        <Field label="Altura (cm)">
          <Input value={altura} onChange={(e) => onSizeChange("altura", e.target.value)} placeholder="Ex: 175" />
        </Field>
      </div>

      {/* Formulário de entrega */}
      <div className="grid grid-cols-1 lg:grid-cols-[80px_1fr_120px_150px_150px_auto] gap-3 items-end">
        <Field label="Quantidade">
          <Input type="number" min={1} value={novo.quantidade} onChange={(e) => setNovo({ ...novo, quantidade: parseInt(e.target.value) || 1 })} />
        </Field>
        <Field label="Uniforme" required>
          <Popover open={popOpen} onOpenChange={setPopOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={popOpen} className="w-full justify-between font-normal h-10">
                <span className="truncate">{novo.descricao || "Selecionar uniforme..."}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[480px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar uniforme..." />
                <CommandList>
                  <CommandEmpty>Nenhum uniforme encontrado.</CommandEmpty>
                  <CommandGroup>
                    {materiaisUniforme.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.codigo} ${m.descricao}`}
                        onSelect={() => {
                          setNovo({ ...novo, descricao: m.descricao });
                          setPopOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", novo.descricao === m.descricao ? "opacity-100" : "opacity-0")} />
                        {m.codigo} - {m.descricao}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>
        <Field label="Tamanho">
          <Select value={novo.tamanho || undefined} onValueChange={(v) => setNovo({ ...novo, tamanho: v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {TAMANHOS_UNIFORME.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Data de Entrega">
          <Input type="date" value={novo.dataEntrega} onChange={(e) => setNovo({ ...novo, dataEntrega: e.target.value })} />
        </Field>
        <Field label="Data de Vencimento">
          <Input type="date" value={novo.dataVencimento} onChange={(e) => setNovo({ ...novo, dataVencimento: e.target.value })} />
        </Field>
        <Button type="button" onClick={addItem} size="sm" className="h-10">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {uniformes.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Quant.</TableHead>
                <TableHead>Uniforme</TableHead>
                <TableHead className="w-24">Tamanho</TableHead>
                <TableHead className="w-32">Data Entrega</TableHead>
                <TableHead className="w-32">Vencimento</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniformes.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-center">{String(u.quantidade).padStart(2, "0")}</TableCell>
                  <TableCell>{u.descricao}</TableCell>
                  <TableCell className="text-center">{u.tamanho || "—"}</TableCell>
                  <TableCell className="text-center">{u.dataEntrega ? u.dataEntrega.split("-").reverse().join("/") : "—"}</TableCell>
                  <TableCell className="text-center">{u.dataVencimento ? u.dataVencimento.split("-").reverse().join("/") : "—"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" type="button" onClick={() => removeItem(u.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};



const Funcionarios = () => {
  const { funcionarios, addFuncionario, updateFuncionario, deleteFuncionario } = useFuncionarios();
  const { cargos } = useCargos();
  const { clientes } = useClientes();
  const { tem } = usePermissao();
  const podeCriar = tem("funcionarios.criar");
  const podeEditar = tem("funcionarios.editar");
  const podeExcluir = tem("funcionarios.excluir");
  const podeExportarPdf = tem("funcionarios.exportar_pdf");
  const podeTransferirCliente = tem("funcionarios.transferir_cliente");

  const [form, setForm] = useState(emptyFuncionarioForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"nome" | "cliente" | "cargo">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [transferir, setTransferir] = useState<{ id: string; nome: string; clienteId: string } | null>(null);
  const [promocaoAlvo, setPromocaoAlvo] = useState<{ id: string; nome: string; cargoId: string; salario: string; clienteId: string } | null>(null);

  const colDefs: Record<string, { label: string; className?: string }> = {
    nome: { label: "Nome" },
    cpf: { label: "CPF" },
    cargo: { label: "Cargo" },
    cliente: { label: "Cliente" },
    telefone: { label: "Telefone" },
    status: { label: "Status" },
    experiencia: { label: "Experiência" },
  };
  const { order: colOrder, setOrder: setColOrder } = useColumnOrder(
    "funcionarios.lista",
    ["nome", "cpf", "cargo", "cliente", "telefone", "status", "experiencia"]
  );

  const [promocoesPendentes, setPromocoesPendentes] = useState<Set<string>>(new Set());
  const [transferenciasAtrasadas, setTransferenciasAtrasadas] = useState<Set<string>>(new Set());
  const [transferenciasPendentes, setTransferenciasPendentes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const fetchPendentes = async () => {
      const { data, error } = await supabase
        .from("promocoes")
        .select("funcionario_id")
        .eq("status", "pendente");
      if (!active) return;
      if (!error && data) {
        setPromocoesPendentes(new Set(data.map((r: any) => r.funcionario_id)));
      }
    };
    fetchPendentes();
    const ch = supabase
      .channel("promocoes-pendentes")
      .on("postgres_changes", { event: "*", schema: "public", table: "promocoes" }, fetchPendentes)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchTransferencias = async () => {
      const { data, error } = await supabase
        .from("funcionario_transferencia_solicitacoes")
        .select("funcionario_id, solicitado_em")
        .eq("status", "pendente");
      if (!active) return;
      if (!error && data) {
        const atrasadas = new Set<string>();
        const pendentes = new Set<string>();
        const agora = Date.now();
        for (const row of data as any[]) {
          pendentes.add(row.funcionario_id);
          const horas = (agora - new Date(row.solicitado_em).getTime()) / 3600000;
          if (horas > 12) atrasadas.add(row.funcionario_id);
        }
        setTransferenciasAtrasadas(atrasadas);
        setTransferenciasPendentes(pendentes);
      }
    };
    fetchTransferencias();
    const ch = supabase
      .channel("transferencias-pendentes")
      .on("postgres_changes", { event: "*", schema: "public", table: "funcionario_transferencia_solicitacoes" }, fetchTransferencias)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm(emptyFuncionarioForm);
    setEditingId(null);
    setShowForm(false);
  };

  const buscarCep = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
        }));
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome.trim()) { toast.error("Informe o nome."); return; }
    if (!form.cpf.trim()) { toast.error("Informe o CPF."); return; }
    if (!isValidCPF(form.cpf)) { toast.error("CPF inválido. Verifique o número informado."); return; }
    if (!form.dataNascimento) { toast.error("Informe a data de nascimento."); return; }
    if (!form.cargoId) { toast.error("Selecione o cargo."); return; }

    if (editingId) {
      updateFuncionario(editingId, form);
      toast.success("Funcionário atualizado.");
    } else {
      addFuncionario(form);
      toast.success("Funcionário cadastrado.");
    }
    resetForm();
  };

  const handleEdit = (f: typeof funcionarios[0]) => {
    const { id, ...rest } = f;
    setForm({ ...emptyFuncionarioForm, ...rest });
    setEditingId(id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; }
    deleteFuncionario(id);
    if (editingId === id) resetForm();
    toast.success("Funcionário removido.");
  };
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  const getCargoNome = (cargoId: string) =>
    cargos.find((c) => c.id === cargoId)?.nome ?? "—";

  const getClienteNome = (clienteId: string) =>
    clientes.find((c) => c.id === clienteId)?.nome ?? "—";

  const filteredFuncionarios = useMemo(() => {
    let result = funcionarios;
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.nome.toLowerCase().includes(term) ||
          f.cpf.includes(term) ||
          f.email.toLowerCase().includes(term) ||
          getCargoNome(f.cargoId).toLowerCase().includes(term)
      );
    }
    if (filterStatus !== "todos") result = result.filter((f) => f.status === filterStatus);
    if (filterCliente !== "todos") result = result.filter((f) => f.clienteId === filterCliente);

    result = [...result].sort((a, b) => {
      let valueA = "";
      let valueB = "";
      if (sortBy === "nome") { valueA = a.nome; valueB = b.nome; }
      else if (sortBy === "cliente") { valueA = getClienteNome(a.clienteId); valueB = getClienteNome(b.clienteId); }
      else if (sortBy === "cargo") { valueA = getCargoNome(a.cargoId); valueB = getCargoNome(b.cargoId); }
      return sortDir === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    });

    return result;
  }, [funcionarios, search, filterStatus, filterCliente, sortBy, sortDir, cargos, clientes]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Ativo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      Inativo: "bg-muted text-muted-foreground",
      Afastado: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      Férias: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    };
    return <Badge className={`${map[status] || ""} text-xs font-medium`}>{status}</Badge>;
  };


  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-2 text-primary mb-1">
            <UserCheck className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Cadastro</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">Funcionários</h1>
              <p className="text-sm text-muted-foreground max-w-lg">
                Gerencie o cadastro completo de funcionários da empresa.
              </p>
            </div>
            {!showForm && podeCriar && (
              <Button onClick={() => setShowForm(true)} className="shadow-md">
                <Plus className="h-4 w-4 mr-1" /> Novo Funcionário
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-up">
            <Tabs defaultValue="pessoal" className="w-full">
              <TabsList className="mb-6 flex-wrap h-auto gap-1">
                <TabsTrigger value="pessoal">Dados Pessoais</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="profissional">Dados Profissionais</TabsTrigger>
                <TabsTrigger value="bancario">Dados Bancários</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="uniforme">Uniforme</TabsTrigger>
                <TabsTrigger value="passagem">Passagem</TabsTrigger>
                <TabsTrigger value="dependentes">Dependentes</TabsTrigger>
                <TabsTrigger value="epis">EPIs</TabsTrigger>
                <TabsTrigger value="nrs">NRs</TabsTrigger>
                <TabsTrigger value="exames">Exames Periódicos</TabsTrigger>
                <TabsTrigger value="ferias">Férias</TabsTrigger>
                <TabsTrigger value="promocoes">Promoções</TabsTrigger>
                <TabsTrigger value="anexos_docs">Anexos</TabsTrigger>
                <TabsTrigger value="pensao">Pensão / Emergência</TabsTrigger>
                <TabsTrigger value="observacoes">Observações</TabsTrigger>
              </TabsList>

              {/* DADOS PESSOAIS */}
              <TabsContent value="pessoal">
                {form.foto && (
                  <div className="mb-4 flex items-center gap-4">
                    <img src={form.foto} alt="Foto do funcionário" className="w-24 h-24 rounded-full object-cover border" />
                    <span className="text-xs text-muted-foreground">Foto enviada pelo colaborador via portal.</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field label="Nome Completo" required>
                    <Input value={form.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Nome completo" />
                  </Field>

                  <Field label="CPF" required>
                    <Input
                      value={form.cpf}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                        const masked = d
                          .replace(/^(\d{3})(\d)/, "$1.$2")
                          .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
                          .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
                        update("cpf", masked);
                      }}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="RG">
                    <Input value={form.rg} onChange={(e) => update("rg", e.target.value)} placeholder="RG" />
                  </Field>
                  <Field label="Órgão Emissor">
                    <Input value={form.orgaoEmissor} onChange={(e) => update("orgaoEmissor", e.target.value)} placeholder="SSP/RJ" />
                  </Field>
                  <Field label="Data de Nascimento" required>
                    <Input type="date" value={form.dataNascimento} onChange={(e) => update("dataNascimento", e.target.value)} />
                  </Field>
                  <Field label="Sexo">
                    <Select value={form.sexo} onValueChange={(v) => update("sexo", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {SEXO_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Estado Civil">
                    <Select value={form.estadoCivil} onValueChange={(v) => update("estadoCivil", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {ESTADO_CIVIL_OPTIONS.map((ec) => <SelectItem key={ec} value={ec}>{ec}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Nacionalidade">
                    <Input value={form.nacionalidade} onChange={(e) => update("nacionalidade", e.target.value)} />
                  </Field>
                  <Field label="Naturalidade">
                    <Input value={form.naturalidade} onChange={(e) => update("naturalidade", e.target.value)} placeholder="Cidade/UF" />
                  </Field>
                  <Field label="Nome da Mãe">
                    <Input value={form.nomeMae} onChange={(e) => update("nomeMae", e.target.value)} />
                  </Field>
                  <Field label="Nome do Pai">
                    <Input value={form.nomePai} onChange={(e) => update("nomePai", e.target.value)} />
                  </Field>
                  <Field label="Telefone">
                    <Input
                      value={form.telefone}
                      onChange={(e) => {
                        let v = e.target.value;
                        if (!v.startsWith("+55 ")) v = "+55 " + v.replace(/^\+55\s?/, "");
                        update("telefone", v);
                      }}
                      placeholder="+55 21 99999-9999"
                    />
                  </Field>
                   <Field label="Telefone WhatsApp">
                    <Input
                      value={form.telefoneWhatsapp}
                      onChange={(e) => {
                        let v = e.target.value;
                        if (!v.startsWith("+55 ")) v = "+55 " + v.replace(/^\+55\s?/, "");
                        update("telefoneWhatsapp", v);
                      }}
                      placeholder="+55 21 99999-9999"
                    />
                  </Field>
                  <Field label="E-mail">
                    <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@exemplo.com" />
                  </Field>
                  <Field label="Escolaridade">
                    <Input value={form.escolaridade || ""} onChange={(e) => update("escolaridade", e.target.value)} placeholder="Ex: Ensino Médio Completo" />
                  </Field>
                  <Field label="Curso / Formação">
                    <Input value={form.cursoFormacao || ""} onChange={(e) => update("cursoFormacao", e.target.value)} placeholder="Curso ou formação" />
                  </Field>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/80">PCD</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Checkbox checked={form.pcd} onCheckedChange={(v) => update("pcd", !!v)} />
                      <span className="text-sm text-foreground">Pessoa com deficiência</span>
                    </div>
                  </div>
                  {form.pcd && (
                    <Field label="Tipo de Deficiência">
                      <Input value={form.tipoPcd} onChange={(e) => update("tipoPcd", e.target.value)} placeholder="Tipo" />
                    </Field>
                  )}
                </div>
              </TabsContent>

              {/* ENDEREÇO */}
              <TabsContent value="endereco">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field label="CEP">
                    <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} onBlur={buscarCep} placeholder="00000-000" />
                  </Field>
                  <Field label="Logradouro">
                    <Input value={form.logradouro} onChange={(e) => update("logradouro", e.target.value)} />
                  </Field>
                  <Field label="Número">
                    <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} />
                  </Field>
                  <Field label="Complemento">
                    <Input value={form.complemento} onChange={(e) => update("complemento", e.target.value)} />
                  </Field>
                  <Field label="Bairro">
                    <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} />
                  </Field>
                  <Field label="Cidade">
                    <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} />
                  </Field>
                  <Field label="UF">
                    <Select value={form.uf} onValueChange={(v) => update("uf", v)}>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </TabsContent>

              {/* DADOS PROFISSIONAIS */}
              <TabsContent value="profissional">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field label="Cargo" required>
                    <Select value={form.cargoId} onValueChange={(v) => {
                      update("cargoId", v);
                      const cargo = cargos.find((c) => c.id === v);
                      if (cargo) {
                        const salarioAtual = cargo.salarios?.length
                          ? [...cargo.salarios].sort((a, b) => (b.dataBase || "").localeCompare(a.dataBase || ""))[0].valor
                          : cargo.salario || "";
                        if (salarioAtual) update("salario", salarioAtual);
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                      <SelectContent>
                        {cargos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cliente / Unidade">
                    <Select value={form.clienteId} onValueChange={(v) => update("clienteId", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {clientes.filter((c) => c.tipo === "Cliente").map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tipo de Contrato">
                    <Select value={form.tipoContrato} onValueChange={(v) => update("tipoContrato", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPO_CONTRATO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Data de Admissão">
                    <Input type="date" value={form.dataAdmissao} onChange={(e) => {
                      const val = e.target.value;
                      update("dataAdmissao", val);
                      if (val && !form.experienciaInicio) {
                        update("experienciaInicio", val);
                        const d = new Date(val);
                        d.setDate(d.getDate() + 45);
                        update("experienciaPrimeiraEtapa", d.toISOString().split("T")[0]);
                        const d2 = new Date(val);
                        d2.setDate(d2.getDate() + 90);
                        update("experienciaFim", d2.toISOString().split("T")[0]);
                      }
                    }} />
                  </Field>
                  <Field label="Data de Demissão">
                    <Input type="date" value={form.dataDemissao} onChange={(e) => update("dataDemissao", e.target.value)} />
                  </Field>
                  <Field label="Salário">
                    <Input value={form.salario} onChange={(e) => update("salario", e.target.value)} placeholder="R$ 0,00" />
                  </Field>
                  <Field label="Jornada de Trabalho">
                    <Select value={form.jornadaTrabalho} onValueChange={(v) => update("jornadaTrabalho", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione a jornada" /></SelectTrigger>
                      <SelectContent>
                        {["Diarista", "Plantão Diurno - PAR", "Plantão Diurno - ÍMPAR", "Plantão Noturno - PAR", "Plantão Noturno - ÍMPAR"].map((j) => (
                          <SelectItem key={j} value={j}>{j}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="CTPS">
                    <Input value={form.ctps} onChange={(e) => update("ctps", e.target.value)} />
                  </Field>
                  <Field label="Série CTPS">
                    <Input value={form.serieCtps} onChange={(e) => update("serieCtps", e.target.value)} />
                  </Field>
                  <Field label="PIS/PASEP">
                    <Input value={form.pis} onChange={(e) => update("pis", e.target.value)} />
                  </Field>
                  <Field label="Status">
                    <Select value={form.status} onValueChange={(v) => update("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <ConselhoClasseSection
                  conselhoClasse={form.conselhoClasse}
                  conselhoNumero={form.conselhoNumero}
                  conselhoDataExpedicao={form.conselhoDataExpedicao}
                  conselhoUf={form.conselhoUf}
                  conselhoAnexos={form.conselhoAnexos}
                  onChange={(f, v) => update(f as any, v)}
                />

                {/* PERÍODO DE EXPERIÊNCIA */}
                {form.tipoContrato === "CLT" && (
                  <div className="mt-6 p-4 border border-border rounded-lg bg-muted/20">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Período de Experiência (45+45 dias)
                    </h3>
                    {(() => {
                      const hoje = new Date();
                      const fim1 = form.experienciaPrimeiraEtapa ? new Date(form.experienciaPrimeiraEtapa) : null;
                      const fimFinal = form.experienciaFim ? new Date(form.experienciaFim) : null;
                      let statusExp = "";
                      let statusClass = "";
                      if (fimFinal && hoje > fimFinal) {
                        statusExp = "Experiência concluída";
                        statusClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
                      } else if (fim1 && hoje > fim1 && form.experienciaRenovado) {
                        const dias = fimFinal ? Math.ceil((fimFinal.getTime() - hoje.getTime()) / 86400000) : 0;
                        statusExp = `2ª etapa – ${dias} dias restantes`;
                        statusClass = dias <= 10 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
                      } else if (fim1 && hoje <= fim1) {
                        const dias = Math.ceil((fim1.getTime() - hoje.getTime()) / 86400000);
                        statusExp = `1ª etapa – ${dias} dias restantes`;
                        statusClass = dias <= 10 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";
                      } else if (fim1 && hoje > fim1 && !form.experienciaRenovado) {
                        statusExp = "Aguardando renovação";
                        statusClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
                      }
                      return (
                        <>
                          {statusExp && (
                            <Badge className={`${statusClass} text-xs font-medium mb-4`}>{statusExp}</Badge>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Field label="Início da Experiência">
                              <Input type="date" value={form.experienciaInicio} onChange={(e) => {
                                const val = e.target.value;
                                update("experienciaInicio", val);
                                if (val) {
                                  const d = new Date(val);
                                  d.setDate(d.getDate() + 45);
                                  update("experienciaPrimeiraEtapa", d.toISOString().split("T")[0]);
                                  const d2 = new Date(val);
                                  d2.setDate(d2.getDate() + 90);
                                  update("experienciaFim", d2.toISOString().split("T")[0]);
                                }
                              }} />
                            </Field>
                            <Field label="Fim 1ª Etapa (45 dias)">
                              <Input type="date" value={form.experienciaPrimeiraEtapa} onChange={(e) => update("experienciaPrimeiraEtapa", e.target.value)} />
                            </Field>
                            <Field label="Fim 2ª Etapa (90 dias)">
                              <Input type="date" value={form.experienciaFim} onChange={(e) => update("experienciaFim", e.target.value)} />
                            </Field>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold text-foreground/80">Renovação</Label>
                              <div className="flex items-center gap-3 h-10">
                                <Checkbox checked={form.experienciaRenovado} onCheckedChange={(v) => update("experienciaRenovado", !!v)} />
                                <span className="text-sm text-foreground">Renovado por +45 dias</span>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </TabsContent>

              {/* DADOS BANCÁRIOS */}
              <TabsContent value="bancario">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field label="Banco">
                    <Input value={form.banco} onChange={(e) => update("banco", e.target.value)} placeholder="Nome do banco" />
                  </Field>
                  <Field label="Agência">
                    <Input value={form.agencia} onChange={(e) => update("agencia", e.target.value)} />
                  </Field>
                  <Field label="Conta">
                    <Input value={form.conta} onChange={(e) => update("conta", e.target.value)} />
                  </Field>
                  <Field label="Tipo de Conta">
                    <Select value={form.tipoConta} onValueChange={(v) => update("tipoConta", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPO_CONTA_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Chave PIX">
                    <Input value={form.chavePix} onChange={(e) => update("chavePix", e.target.value)} placeholder="CPF, e-mail, telefone ou aleatória" />
                  </Field>
                </div>
              </TabsContent>

              {/* DOCUMENTOS */}
              <TabsContent value="documentos">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Field label="Título de Eleitor">
                    <Input value={form.tituloEleitor} onChange={(e) => update("tituloEleitor", e.target.value)} />
                  </Field>
                  <Field label="Zona Eleitoral">
                    <Input value={form.zonaEleitoral} onChange={(e) => update("zonaEleitoral", e.target.value)} />
                  </Field>
                  <Field label="Seção Eleitoral">
                    <Input value={form.secaoEleitoral} onChange={(e) => update("secaoEleitoral", e.target.value)} />
                  </Field>
                  <Field label="CNH">
                    <Input value={form.cnh} onChange={(e) => update("cnh", e.target.value)} />
                  </Field>
                  <Field label="Categoria CNH">
                    <Select value={form.categoriaCnh} onValueChange={(v) => update("categoriaCnh", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIA_CNH_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Validade CNH">
                    <Input type="date" value={form.validadeCnh} onChange={(e) => update("validadeCnh", e.target.value)} />
                  </Field>
                  <Field label="Certificado de Reservista">
                    <Input value={form.certificadoReservista} onChange={(e) => update("certificadoReservista", e.target.value)} />
                  </Field>
                </div>
              </TabsContent>

              {/* UNIFORME */}
              <TabsContent value="uniforme">
                <UniformeTab
                  uniformes={form.uniformes || []}
                  onChange={(u) => update("uniformes", u as any)}
                  tamanhoCamisa={form.tamanhoCamisa}
                  tamanhoCalca={form.tamanhoCalca}
                  tamanhoCalcado={form.tamanhoCalcado}
                  peso={form.peso}
                  altura={form.altura}
                  onSizeChange={(field, value) => update(field, value)}
                />
              </TabsContent>

              {/* PASSAGEM */}
              <TabsContent value="passagem">
                <PassagemTab passagens={form.passagens || []} onChange={(p) => update("passagens", p as any)} />
              </TabsContent>

              {/* DEPENDENTES */}
              <TabsContent value="dependentes">
                <DependentesTab dependentes={form.dependentes || []} onChange={(d) => update("dependentes", d as any)} />
              </TabsContent>

              {/* EPIs */}
              <TabsContent value="epis">
                <EpiTab epis={form.epis || []} onChange={(e) => update("epis", e as any)} cargoId={form.cargoId} funcionarioId={editingId || undefined} telefoneWhatsapp={form.telefoneWhatsapp} />
              </TabsContent>

              {/* NRs */}
              <TabsContent value="nrs">
                <NRsFuncionarioTab
                  nrs={form.nrs || []}
                  onChange={(nrs) => update("nrs", nrs)}
                />
              </TabsContent>

              {/* EXAMES PERIÓDICOS */}
              <TabsContent value="exames">
                <ExamesPeriodicosTab
                  funcionarioId={editingId || ""}
                  funcionarioNome={form.nome}
                  funcionarioTelefone={form.telefone}
                  funcionarioEmail={form.email}
                />
              </TabsContent>

              {/* FÉRIAS */}
              <TabsContent value="ferias">
                <FeriasTab
                  funcionarioId={editingId || ""}
                  funcionarioNome={form.nome}
                  dataAdmissao={form.dataAdmissao}
                />
              </TabsContent>


              {/* PROMOÇÕES */}
              <TabsContent value="promocoes">
                <PromocoesTab
                  funcionarioId={editingId || ""}
                  cargoAtualId={form.cargoId}
                  salarioAtual={form.salario}
                  clienteAtualId={form.clienteId}
                  onPromover={(dados) => {
                    update("cargoId", dados.cargoId);
                    update("salario", dados.salario);
                    update("clienteId", dados.clienteId);
                  }}
                />
              </TabsContent>

              {/* ANEXOS DOCUMENTOS */}
              <TabsContent value="anexos_docs">
                <AnexosDocumentosTab
                  anexos={form.anexosDocumentos}
                  onChange={(a) => update("anexosDocumentos", a)}
                  funcionarioId={editingId || undefined}
                />
              </TabsContent>

              {/* PENSÃO / CONTATOS DE EMERGÊNCIA */}
              <TabsContent value="pensao">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Contatos de Emergência</h3>
                    {(form.contatosEmergencia || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum contato informado.</p>
                    ) : (
                      <div className="space-y-2">
                        {(form.contatosEmergencia || []).map((ct: any, i: number) => (
                          <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 border rounded-md p-3">
                            <Field label="Nome"><Input value={ct.nome || ""} onChange={(e) => {
                              const arr = [...(form.contatosEmergencia || [])]; arr[i] = { ...arr[i], nome: e.target.value }; update("contatosEmergencia", arr as any);
                            }} /></Field>
                            <Field label="Parentesco"><Input value={ct.parentesco || ""} onChange={(e) => {
                              const arr = [...(form.contatosEmergencia || [])]; arr[i] = { ...arr[i], parentesco: e.target.value }; update("contatosEmergencia", arr as any);
                            }} /></Field>
                            <Field label="Telefone"><Input value={ct.telefone || ""} onChange={(e) => {
                              const arr = [...(form.contatosEmergencia || [])]; arr[i] = { ...arr[i], telefone: e.target.value }; update("contatosEmergencia", arr as any);
                            }} /></Field>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" className="mt-2"
                      onClick={() => update("contatosEmergencia", ([...(form.contatosEmergencia || []), { nome: "", parentesco: "", telefone: "" }]) as any)}>
                      Adicionar contato
                    </Button>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">Pensão Alimentícia</h3>
                    {!form.pensaoAlimenticia?.possui ? (
                      <p className="text-sm text-muted-foreground">Sem desconto de pensão alimentícia informado na ficha.</p>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div><span className="text-muted-foreground text-xs">Processo/documento</span><p>{form.pensaoAlimenticia.processo || "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">Percentual/valor</span><p>{form.pensaoAlimenticia.percentualOuValor || "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">Conta bancária</span><p>{form.pensaoAlimenticia.contaBancaria || "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">Início do desconto</span><p>{form.pensaoAlimenticia.dataInicio || "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">Término do desconto</span><p>{form.pensaoAlimenticia.dataTermino || "—"}</p></div>
                          <div><span className="text-muted-foreground text-xs">Empresa anterior descontava</span><p>{form.pensaoAlimenticia.empresaAnteriorDescontava || "—"}</p></div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Alimentandos</span>
                          {(form.pensaoAlimenticia.beneficiarios || []).length === 0 ? (
                            <p>—</p>
                          ) : (
                            <div className="space-y-2 mt-1">
                              {(form.pensaoAlimenticia.beneficiarios || []).map((b: any, i: number) => (
                                <div key={i} className="border rounded-md p-2">
                                  <p className="font-medium">{b.nome || "—"} {b.cpf ? `— CPF ${b.cpf}` : ""}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Representante: {b.representanteNome || "—"} {b.representanteCpf ? `(${b.representanteCpf})` : ""} · Processo: {b.processo || "—"} · Percentual/valor: {b.percentualOuValor || "—"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {(form.pensaoAlimenticia.anexos || []).length > 0 && (
                          <div>
                            <span className="text-muted-foreground text-xs">Documentos anexados</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {(form.pensaoAlimenticia.anexos || []).map((a: any, i: number) => (
                                <a key={i} href={a.base64 || a.url} target="_blank" rel="noreferrer" download={a.nome} className="text-primary underline text-xs">
                                  {a.nome || `Documento ${i + 1}`}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {form.pensaoAlimenticia.observacoes && (
                          <div><span className="text-muted-foreground text-xs">Observações</span><p>{form.pensaoAlimenticia.observacoes}</p></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* OBSERVAÇÕES */}
              <TabsContent value="observacoes">
                <Field label="Observações">
                  <Textarea value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} rows={5} placeholder="Anotações gerais sobre o funcionário..." />
                </Field>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" className="shadow-md">{editingId ? "Salvar Alterações" : "Cadastrar Funcionário"}</Button>
            </div>
          </form>
        )}

        {/* TABELA */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Funcionários Cadastrados ({filteredFuncionarios.length})</h2>
            <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
              <div className="relative w-[29.25rem]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCliente} onValueChange={setFilterCliente}>
                <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Clientes</SelectItem>
                  {clientes.filter((c) => c.tipo === "Cliente").map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-9 w-[150px] text-xs border-primary/30"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="cliente">Unidade</SelectItem>
                  <SelectItem value="cargo">Cargo</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={sortBy ? "default" : "outline"}
                size="icon"
                className="h-9 w-9"
                onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
                title={sortDir === "asc" ? "Ordem crescente" : "Ordem decrescente"}
              >
                {sortDir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-xs"
                onClick={() => { setSearch(""); setFilterStatus("todos"); setFilterCliente("todos"); setSortBy("nome"); setSortDir("asc"); setPage(1); }}
                disabled={!search && filterStatus === "todos" && filterCliente === "todos" && sortBy === "nome" && sortDir === "asc"}
              >
                <FilterX className="h-3.5 w-3.5 mr-1.5" /> Limpar
              </Button>
            </div>
          </div>
          {filteredFuncionarios.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {funcionarios.length === 0 ? "Nenhum funcionário cadastrado." : "Nenhum resultado encontrado."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <SortableHeaderRow order={colOrder} onReorder={setColOrder}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {colOrder.map(key => {
                      const cd = colDefs[key];
                      return cd ? <SortableTableHead key={key} id={key} className={cd.className}>{cd.label}</SortableTableHead> : null;
                    })}
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginate(filteredFuncionarios, page, pageSize).paginated.map((f, idx) => {
                    const expBadge = (() => {
                      if (!f.experienciaFim) return null;
                      const hoje = new Date();
                      const fim = new Date(f.experienciaFim);
                      const fim1 = f.experienciaPrimeiraEtapa ? new Date(f.experienciaPrimeiraEtapa) : null;
                      if (hoje > fim) return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Concluída</Badge>;
                      const dias = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
                      if (fim1 && hoje > fim1 && f.experienciaRenovado) {
                        return <Badge className={`${dias <= 10 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"} text-[10px]`}>2ª etapa – {dias}d</Badge>;
                      }
                      if (fim1 && hoje <= fim1) {
                        const d1 = Math.ceil((fim1.getTime() - hoje.getTime()) / 86400000);
                        return <Badge className={`${d1 <= 10 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"} text-[10px]`}>1ª etapa – {d1}d</Badge>;
                      }
                      if (fim1 && hoje > fim1 && !f.experienciaRenovado) {
                        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">Aguard. renovação</Badge>;
                      }
                      return null;
                    })();
                    const cellMap: Record<string, ReactNode> = {
                      nome: (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{f.nome}</span>
                          {promocoesPendentes.has(f.id) && (
                            <img
                              src={promocaoPendenteIcon}
                              alt="Promoção pendente"
                              title="Solicitação de promoção pendente"
                              className="h-5 w-5 object-contain"
                            />
                          )}
                          {transferenciasPendentes.has(f.id) && (
                            <span title={transferenciasAtrasadas.has(f.id) ? "Transferência pendente há mais de 12h" : "Transferência pendente de autorização"}>
                              <FileClock className={`h-5 w-5 shrink-0 ${transferenciasAtrasadas.has(f.id) ? "text-red-600 animate-pulse" : "text-amber-600"}`} />
                            </span>
                          )}
                        </div>
                      ),
                      cpf: f.cpf || "—",
                      cargo: getCargoNome(f.cargoId),
                      cliente: f.clienteId ? getClienteNome(f.clienteId) : "—",
                      telefone: f.telefone,
                      status: statusBadge(f.status || "Ativo"),
                      experiencia: expBadge || "—",
                    };
                    return (
                    <TableRow key={f.id} className={idx % 2 === 1 ? "bg-gray-200/60 hover:bg-gray-200/80" : "bg-white hover:bg-gray-100/60"}>
                      {colOrder.map(key => <TableCell key={key} className={colDefs[key]?.className}>{cellMap[key]}</TableCell>)}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Ações">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {podeExportarPdf && <DropdownMenuItem onClick={() => gerarPdfFuncionario(f, { cargoNome: getCargoNome(f.cargoId), clienteNome: f.clienteId ? getClienteNome(f.clienteId) : "" })}>
                              <FileDown className="h-4 w-4 mr-2" /> Baixar PDF Ficha
                            </DropdownMenuItem>}
                            {podeExportarPdf && <DropdownMenuItem onClick={() => gerarPdfEpi(f, { cargoNome: getCargoNome(f.cargoId), clienteNome: f.clienteId ? getClienteNome(f.clienteId) : "" })}>
                              <HardHat className="h-4 w-4 mr-2" /> Baixar PDF EPI
                            </DropdownMenuItem>}
                            {podeExportarPdf && <DropdownMenuItem onClick={() => gerarPdfUniforme(f, { cargoNome: getCargoNome(f.cargoId), clienteNome: f.clienteId ? getClienteNome(f.clienteId) : "" })}>
                              <FileDown className="h-4 w-4 mr-2" /> Baixar PDF Uniforme
                            </DropdownMenuItem>}
                            {podeEditar && <DropdownMenuItem onClick={() => handleEdit(f)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => setTransferir({ id: f.id, nome: f.nome, clienteId: f.clienteId })}>
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> {podeTransferirCliente ? "Transferir Cliente/Unidade" : "Solicitar Transferência de Cliente/Unidade"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPromocaoAlvo({ id: f.id, nome: f.nome, cargoId: f.cargoId, salario: f.salario, clienteId: f.clienteId })}>
                              <TrendingUp className="h-4 w-4 mr-2" /> Solicitar Promoção
                            </DropdownMenuItem>
                            {podeExcluir && <DropdownMenuSeparator />}
                            {podeExcluir && <DropdownMenuItem onClick={() => requestDelete(f.id)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </SortableHeaderRow>
            </div>
          )}
          <PaginationControls currentPage={page} totalItems={filteredFuncionarios.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      </div>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
      {transferir && (
        <TransferirClienteDialog
          open={!!transferir}
          onOpenChange={(v) => !v && setTransferir(null)}
          funcionarioId={transferir.id}
          funcionarioNome={transferir.nome}
          clienteAtualId={transferir.clienteId}
          podeAutorizar={podeTransferirCliente}
        />
      )}
      {promocaoAlvo && (
        <SolicitarPromocaoDialog
          open={!!promocaoAlvo}
          onOpenChange={(v) => !v && setPromocaoAlvo(null)}
          funcionarioId={promocaoAlvo.id}
          funcionarioNome={promocaoAlvo.nome}
          cargoAtualId={promocaoAlvo.cargoId}
          salarioAtual={promocaoAlvo.salario}
          clienteAtualId={promocaoAlvo.clienteId}
        />
      )}
    </div>
  );
};

export default Funcionarios;
