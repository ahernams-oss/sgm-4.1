import { useState, useMemo } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { toast } from "sonner";
import { Users, Trash2, Search, MessageCircle, MoreVertical, MapPin, FileText, Plus, ChevronDown, ChevronUp, Truck, DollarSign, FileBarChart, Landmark } from "lucide-react";
import RelatorioClienteFornecedorDialog from "@/components/RelatorioClienteFornecedorDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClientes, type Cliente, type Contrato } from "@/contexts/ClientesContext";
import { useI0 } from "@/contexts/I0Context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ClienteForm, { emptyForm, type FormData } from "@/components/ClienteForm";
import LocaisSection from "@/components/LocaisSection";
import LocaisEntregaSection from "@/components/LocaisEntregaSection";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ImportClientesFornecedores from "@/components/ImportClientesFornecedores";
import FaturamentoSection from "@/components/FaturamentoSection";
import EmpenhoSection from "@/components/EmpenhoSection";

import { usePermissao } from "@/hooks/usePermissao";

const FaturamentoView = () => {
  const { clientes, updateCliente } = useClientes();
  const [searchFat, setSearchFat] = useState("");
  const [openContratoId, setOpenContratoId] = useState<string | null>(null);
  const [openClienteId, setOpenClienteId] = useState<string | null>(null);

  const apenasClientes = useMemo(() => clientes.filter(c => c.tipo === "Cliente"), [clientes]);

  const clientesComContratos = useMemo(() => {
    const list = apenasClientes.filter(c => (c.contratos || []).length > 0);
    if (!searchFat.trim()) return list;
    const term = searchFat.toLowerCase();
    return list.filter(c =>
      c.nome.toLowerCase().includes(term) ||
      c.nomeFantasia?.toLowerCase().includes(term) ||
      (c.contratos || []).some(ct => ct.numero.toLowerCase().includes(term) || ct.descricao?.toLowerCase().includes(term))
    );
  }, [apenasClientes, searchFat]);

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-2 text-primary mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Financeiro</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">Faturamento</h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Selecione o contrato para gerenciar o faturamento.
          </p>
        </div>

        <div className="section-card animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Clientes e Contratos</h2>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar cliente ou contrato..."
                value={searchFat}
                onChange={(e) => setSearchFat(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {clientesComContratos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhum cliente com contratos cadastrados.
            </p>
          ) : (
            <div className="space-y-3">
              {clientesComContratos.map(cliente => (
                <div key={cliente.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">{cliente.nome}</p>
                    {cliente.cnpj && <p className="text-xs text-muted-foreground">{cliente.cnpj}</p>}
                  </div>
                  <div className="divide-y divide-border">
                    {(cliente.contratos || []).map(ct => {
                      const isOpen = openContratoId === ct.id && openClienteId === cliente.id;
                      return (
                        <div key={ct.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isOpen) { setOpenContratoId(null); setOpenClienteId(null); }
                              else { setOpenContratoId(ct.id); setOpenClienteId(cliente.id); }
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <DollarSign className="h-4 w-4 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">Contrato {ct.numero}</p>
                                <p className="text-xs text-muted-foreground truncate">{ct.descricao || "Sem descrição"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {(ct.faturamentos || []).length} lançamento(s)
                              </span>
                              {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4">
                              <FaturamentoSection
                                faturamentos={ct.faturamentos || []}
                                onChange={(faturamentos) => {
                                  const contratos = (cliente.contratos || []).map(c => c.id === ct.id ? { ...c, faturamentos } : c);
                                  return updateCliente(cliente.id, { contratos });
                                }}
                                contratoNumero={ct.numero}
                                cliente={cliente}
                                contrato={ct}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Clientes = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const [formOpen, setFormOpen] = useState(true);
  const { items: i0Items } = useI0();
  const { clientes, addCliente, updateCliente, deleteCliente } = useClientes();
  const { tem } = usePermissao();
  const podeCriar = tem("clientes.criar");
  const podeEditar = tem("clientes.editar");
  const podeExcluir = tem("clientes.excluir");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<FormData | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [locaisClienteId, setLocaisClienteId] = useState<string | null>(null);
   const [locaisEntregaClienteId, setLocaisEntregaClienteId] = useState<string | null>(null);
   const [contratosClienteId, setContratosClienteId] = useState<string | null>(null);
  const emptyContrato = { numero: "", numeroProcesso: "", descricao: "", dataInicio: "", dataFim: "", bdi: "", descontoLicitacao: "", valorBase: "", valorBase2: "", valorBase3: "", maoDeObraMensal: "", maoDeObraAnual: "", maoDeObraContratual: "", mesSco: "", anoSco: "", valorContrato: "", inss: "", pis: "", cofins: "", csll: "", irrf: "", iss: "", cbs: "", ibs: "", meta1: "", meta2: "", meta3: "" };
  const [contratoForm, setContratoForm] = useState(emptyContrato);
  const [contratoErrors, setContratoErrors] = useState<{ cbs?: string; ibs?: string; descontoLicitacao?: string }>({});
  const [editingContratoId, setEditingContratoId] = useState<string | null>(null);
  const [faturamentoContratoId, setFaturamentoContratoId] = useState<string | null>(null);
  const [empenhoContratoId, setEmpenhoContratoId] = useState<string | null>(null);


  const validarPercentual = (valor: string, nome: string): string | undefined => {
    if (!valor.trim()) return undefined;
    const num = Number(valor.replace(",", "."));
    if (Number.isNaN(num)) return `${nome} deve ser um número.`;
    if (num < 0 || num > 100) return `${nome} deve estar entre 0 e 100.`;
    return undefined;
  };

  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const { deleteId: deleteContratoId, requestDelete: requestDeleteContrato, cancelDelete: cancelDeleteContrato } = useDoubleConfirmDelete();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);

  const toggleOne = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
    for (const id of selectedIds) await deleteCliente(id);
    toast.success(`${selectedIds.length} cliente(s) removido(s).`);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const handleBulkWhatsApp = async () => {
    const alvos = clientes.filter(c => selectedIds.includes(c.id) && c.telefones?.length);
    if (alvos.length === 0) { toast.error("Nenhum selecionado tem telefone."); return; }
    toast.loading(`Enviando para ${alvos.length} cliente(s)...`, { id: "bulk-wpp" });
    let ok = 0;
    for (const c of alvos) {
      const msg = `Olá ${c.contato || c.nome}! Aqui é da equipe de RH.`;
      for (const tel of c.telefones) {
        const r = await enviarWhatsApp(tel, msg);
        if (r.success) ok++;
      }
    }
    toast.success(`${ok} mensagem(ns) enviada(s).`, { id: "bulk-wpp" });
  };

  const i0Meses = useMemo(() => [...new Set(i0Items.map(i => i.mes))].sort((a, b) => a - b), [i0Items]);
  const i0Anos = useMemo(() => [...new Set(i0Items.map(i => i.ano))].sort((a, b) => a - b), [i0Items]);



  const handleSubmit = (data: FormData, id: string | null) => {
    if (id ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!data.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    const fullData = {
      ...data,
      tipo: "Cliente" as const,
      informacoesFinanceiras: id ? (clientes.find(c => c.id === id)?.informacoesFinanceiras || []) : [],
      locais: id ? (clientes.find(c => c.id === id)?.locais || []) : [],
      locaisEntrega: id ? (clientes.find(c => c.id === id)?.locaisEntrega || []) : [],
      contratos: id ? (clientes.find(c => c.id === id)?.contratos || []) : [],
    };
    if (id) {
      updateCliente(id, fullData);
      toast.success("Cliente atualizado com sucesso!");
    } else {
      addCliente(fullData);
      toast.success("Cliente cadastrado com sucesso!");
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingData(undefined);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingId(cliente.id);
    const { id, informacoesFinanceiras, locais, locaisEntrega, ...rest } = cliente;
    setEditingData(rest as FormData);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; }
    deleteCliente(id);
    toast.success("Cliente removido.");
    if (editingId === id) resetForm();
  };

  const handleConfirmDelete = () => {
    if (deleteId) handleDelete(deleteId);
  };

  const handleEnviarWhatsApp = async (cliente: Cliente) => {
    if (!cliente.telefones || cliente.telefones.length === 0) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    const mensagem = `Olá ${cliente.contato || cliente.nome}! Aqui é da equipe de RH.`;
    toast.loading("Enviando mensagens...", { id: "whatsapp-send" });
    let successCount = 0;
    for (const tel of cliente.telefones) {
      const result = await enviarWhatsApp(tel, mensagem);
      if (result.success) successCount++;
    }
    if (successCount === cliente.telefones.length) {
      toast.success(`Mensagem enviada para ${successCount} número(s)!`, { id: "whatsapp-send" });
    } else {
      toast.error(`Enviada para ${successCount}/${cliente.telefones.length} números.`, { id: "whatsapp-send" });
    }
  };

  const apenasClientes = useMemo(() => clientes.filter((c) => c.tipo === "Cliente"), [clientes]);

  const filteredClientes = useMemo(() => {
    if (!search.trim()) return apenasClientes;
    const term = search.toLowerCase();
    return apenasClientes.filter(
      (c) =>
        String(c.codigo ?? "").includes(term) ||
        c.nome.toLowerCase().includes(term) ||
        c.nomeFantasia?.toLowerCase().includes(term) ||
        c.cnpj.toLowerCase().includes(term) ||
        c.contato.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.cidade?.toLowerCase().includes(term) ||
        c.telefones.some((t) => t.toLowerCase().includes(term))
    );
  }, [apenasClientes, search]);

  if (tab === "faturamento") return <FaturamentoView />;

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Cadastro</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">Clientes</h1>
              <p className="text-sm text-muted-foreground max-w-lg">
                Cadastre e gerencie os clientes do sistema.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setRelatorioOpen(true)} className="gap-2">
                <FileBarChart className="h-4 w-4" /> Relatório
              </Button>
              <ImportClientesFornecedores tipo="Cliente" />
            </div>
          </div>
        </div>

        {(podeCriar || (editingId && podeEditar)) && (
        <div className="section-card animate-fade-up mb-6" style={{ animationDelay: "80ms" }}>
          <button
            type="button"
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center justify-between w-full"
          >
            <h2 className="section-title mb-0">{editingId ? "Editar Cliente" : "Novo Cliente"}</h2>
            {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {formOpen && (
            <div className="mt-4">
              <ClienteForm
                key={editingId || "new"}
                editingId={editingId}
                initialData={editingData}
                onSubmit={handleSubmit}
                onCancel={resetForm}
                tipoFixo="Cliente"
                embedded
              />
            </div>
          )}
        </div>
        )}

        <div className="section-card animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Clientes Cadastrados</h2>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar clientes..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9"
              />
            </div>
          </div>
          {filteredClientes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {apenasClientes.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum resultado encontrado."}
            </p>
          ) : (
            <>
              {(() => {
                const pageItems = paginate(filteredClientes, page, pageSize).paginated;
                const pageIds = pageItems.map(c => c.id);
                const allChecked = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
                const someChecked = pageIds.some(id => selectedIds.includes(id));
                return (
                  <div className="flex items-center justify-between gap-3 px-1 py-2 mb-1 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? "indeterminate" : false}
                        onCheckedChange={(v) => {
                          if (v) setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
                          else setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : "Selecionar página"}
                      </span>
                    </div>
                    {selectedIds.length > 0 && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={handleBulkWhatsApp} className="text-emerald-600 hover:text-emerald-700">
                          <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setBulkDeleteOpen(true)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Limpar</Button>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="divide-y divide-border">
                {paginate(filteredClientes, page, pageSize).paginated.map((cliente) => (
                  <div key={cliente.id} className="flex items-center justify-between py-3 gap-4">
                    <Checkbox
                      checked={selectedIds.includes(cliente.id)}
                      onCheckedChange={() => toggleOne(cliente.id)}
                    />
                    <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1">
                      <p className="text-sm font-semibold text-primary tabular-nums">Nº {cliente.codigo ?? "—"}</p>
                      <p className="text-sm font-medium text-foreground truncate">{cliente.nome}</p>
                      <p className="text-sm text-muted-foreground truncate tabular-nums">{cliente.cnpj || "—"}</p>
                      <p className="text-sm text-muted-foreground truncate">{cliente.contato || "—"}</p>
                      <p className="text-sm text-muted-foreground truncate">{cliente.cidade ? `${cliente.cidade}/${cliente.uf}` : "—"}</p>
                    </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleEnviarWhatsApp(cliente)} className="text-emerald-600 hover:text-emerald-700" title="Enviar WhatsApp">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setContratosClienteId(contratosClienteId === cliente.id ? null : cliente.id);
                        setContratoForm(emptyContrato);
                        setEditingContratoId(null);
                      }}
                      className="text-xs gap-1"
                    >
                      <FileText className="h-3.5 w-3.5" /> Contratos
                    </Button>
                    {podeEditar && <Button variant="ghost" size="sm" onClick={() => handleEdit(cliente)} className="text-xs">Editar</Button>}
                    {podeExcluir && <Button variant="ghost" size="sm" onClick={() => requestDelete(cliente.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocaisClienteId(locaisClienteId === cliente.id ? null : cliente.id)}>
                            <MapPin className="mr-2 h-4 w-4" />
                            Locais
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setContratosClienteId(contratosClienteId === cliente.id ? null : cliente.id);
                            setContratoForm(emptyContrato);
                            setEditingContratoId(null);
                          }}>
                            <FileText className="mr-2 h-4 w-4" />
                            Contratos
                          </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => {
                             setLocaisEntregaClienteId(locaisEntregaClienteId === cliente.id ? null : cliente.id);
                           }}>
                             <Truck className="mr-2 h-4 w-4" />
                             Locais de Entrega
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
          <PaginationControls currentPage={page} totalItems={filteredClientes.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>

        {locaisClienteId && (
          <LocaisSection
            locais={clientes.find((c) => c.id === locaisClienteId)?.locais || []}
            onChange={(locais) => updateCliente(locaisClienteId, { locais })}
          />
         )}

        {locaisEntregaClienteId && (() => {
          const cliente = clientes.find(c => c.id === locaisEntregaClienteId);
          if (!cliente) return null;
          return (
            <LocaisEntregaSection
              locais={cliente.locaisEntrega || []}
              onChange={(locaisEntrega) => updateCliente(locaisEntregaClienteId, { locaisEntrega })}
              clienteNome={cliente.nome}
            />
          );
        })()}

        {contratosClienteId && (() => {
          const cliente = clientes.find(c => c.id === contratosClienteId);
          if (!cliente) return null;
          const contratos = cliente.contratos || [];

          const handleSaveContrato = () => {
            if (!contratoForm.numero.trim()) { toast.error("Informe o número do contrato."); return; }
            const cbsError = validarPercentual(contratoForm.cbs, "CBS");
            const ibsError = validarPercentual(contratoForm.ibs, "IBS");
            const descontoLicitacaoError = validarPercentual(contratoForm.descontoLicitacao, "Desconto Licitação");
            setContratoErrors({ cbs: cbsError, ibs: ibsError, descontoLicitacao: descontoLicitacaoError });
            if (cbsError || ibsError || descontoLicitacaoError) { toast.error("Corrija os campos de porcentagem antes de salvar."); return; }
            if (editingContratoId) {
              const updated = contratos.map(ct => ct.id === editingContratoId ? { ...ct, ...contratoForm } : ct);
              updateCliente(contratosClienteId, { contratos: updated });
              toast.success("Contrato atualizado!");
            } else {
              const novo: Contrato = { id: crypto.randomUUID(), ...contratoForm, faturamentos: [] };
              updateCliente(contratosClienteId, { contratos: [...contratos, novo] });
              toast.success("Contrato adicionado!");
            }
            setContratoForm(emptyContrato);
            setContratoErrors({});
            setEditingContratoId(null);
          };

          const handleEditContrato = (ct: Contrato) => {
            setEditingContratoId(ct.id);
            const { id, ...rest } = ct;
            setContratoForm({ ...emptyContrato, ...rest, numeroProcesso: rest.numeroProcesso || "" });
            setContratoErrors({});
          };

          const handleDeleteContrato = (ctId: string) => {
            updateCliente(contratosClienteId, { contratos: contratos.filter(ct => ct.id !== ctId) });
            toast.success("Contrato removido.");
            if (editingContratoId === ctId) { setContratoForm(emptyContrato); setEditingContratoId(null); }
          };

          return (
            <div className="section-card animate-fade-up mt-6">
              <h2 className="section-title mb-4">Contratos — {cliente.nome}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <Input placeholder="Número do Contrato *" value={contratoForm.numero} onChange={e => setContratoForm(p => ({ ...p, numero: e.target.value }))} />
                <Input placeholder="Número do Processo" value={contratoForm.numeroProcesso} onChange={e => setContratoForm(p => ({ ...p, numeroProcesso: e.target.value }))} className="sm:col-span-2" />
                <Input placeholder="Descrição" value={contratoForm.descricao} onChange={e => setContratoForm(p => ({ ...p, descricao: e.target.value }))} className="sm:col-span-2 md:col-span-3" />
                <Input type="date" placeholder="Data Início" value={contratoForm.dataInicio} onChange={e => setContratoForm(p => ({ ...p, dataInicio: e.target.value }))} />
                <Input type="date" placeholder="Data Fim" value={contratoForm.dataFim} onChange={e => setContratoForm(p => ({ ...p, dataFim: e.target.value }))} />
                <Input placeholder="BDI" value={contratoForm.bdi} onChange={e => setContratoForm(p => ({ ...p, bdi: e.target.value }))} />
                <div className="md:col-start-3">
                  <Input type="number" step="0.01" placeholder="Desconto Licitação (%)" value={contratoForm.descontoLicitacao} onChange={e => { setContratoForm(p => ({ ...p, descontoLicitacao: e.target.value })); setContratoErrors(prev => ({ ...prev, descontoLicitacao: validarPercentual(e.target.value, "Desconto Licitação") })); }} />
                  {contratoErrors.descontoLicitacao && <p className="text-xs text-destructive mt-1">{contratoErrors.descontoLicitacao}</p>}
                </div>
                <Input placeholder="VTM Mensal" value={contratoForm.valorBase} onChange={e => setContratoForm(p => ({ ...p, valorBase: e.target.value }))} />
                <Input placeholder="VTM Anual" value={contratoForm.valorBase2} onChange={e => setContratoForm(p => ({ ...p, valorBase2: e.target.value }))} />
                <Input placeholder="VTM Contratual" value={contratoForm.valorBase3} onChange={e => setContratoForm(p => ({ ...p, valorBase3: e.target.value }))} />
                <Input placeholder="Mão de Obra Mensal" value={contratoForm.maoDeObraMensal} onChange={e => setContratoForm(p => ({ ...p, maoDeObraMensal: e.target.value }))} />
                <Input placeholder="Mão de Obra Anual" value={contratoForm.maoDeObraAnual} onChange={e => setContratoForm(p => ({ ...p, maoDeObraAnual: e.target.value }))} />
                <Input placeholder="Mão de Obra Contratual" value={contratoForm.maoDeObraContratual} onChange={e => setContratoForm(p => ({ ...p, maoDeObraContratual: e.target.value }))} />
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Mês SCO</label>
                  <Select value={contratoForm.mesSco} onValueChange={v => setContratoForm(p => ({ ...p, mesSco: v }))}>
                    <SelectTrigger><SelectValue placeholder="Mês SCO" /></SelectTrigger>
                    <SelectContent>
                      {i0Meses.map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Ano SCO</label>
                  <Select value={contratoForm.anoSco} onValueChange={v => setContratoForm(p => ({ ...p, anoSco: v }))}>
                    <SelectTrigger><SelectValue placeholder="Ano SCO" /></SelectTrigger>
                    <SelectContent>
                      {i0Anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input type="number" step="0.01" placeholder="Valor do Contrato (R$)" value={contratoForm.valorContrato} onChange={e => setContratoForm(p => ({ ...p, valorContrato: e.target.value }))} className="sm:col-span-2 md:col-span-3" />
                <Input type="number" step="0.01" placeholder="INSS (%)" value={contratoForm.inss} onChange={e => setContratoForm(p => ({ ...p, inss: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="PIS (%)" value={contratoForm.pis} onChange={e => setContratoForm(p => ({ ...p, pis: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="COFINS (%)" value={contratoForm.cofins} onChange={e => setContratoForm(p => ({ ...p, cofins: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="CSLL (%)" value={contratoForm.csll} onChange={e => setContratoForm(p => ({ ...p, csll: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="IRRF (%)" value={contratoForm.irrf} onChange={e => setContratoForm(p => ({ ...p, irrf: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="ISS (%)" value={contratoForm.iss} onChange={e => setContratoForm(p => ({ ...p, iss: e.target.value }))} />
                <div>
                  <Input type="number" step="0.01" placeholder="CBS (%)" value={contratoForm.cbs} onChange={e => { setContratoForm(p => ({ ...p, cbs: e.target.value })); setContratoErrors(prev => ({ ...prev, cbs: validarPercentual(e.target.value, "CBS") })); }} />
                  {contratoErrors.cbs && <p className="text-xs text-destructive mt-1">{contratoErrors.cbs}</p>}
                </div>
                <div>
                  <Input type="number" step="0.01" placeholder="IBS (%)" value={contratoForm.ibs} onChange={e => { setContratoForm(p => ({ ...p, ibs: e.target.value })); setContratoErrors(prev => ({ ...prev, ibs: validarPercentual(e.target.value, "IBS") })); }} />
                  {contratoErrors.ibs && <p className="text-xs text-destructive mt-1">{contratoErrors.ibs}</p>}
                </div>
                <Input type="number" step="0.01" placeholder="Meta 1 (R$)" value={contratoForm.meta1} onChange={e => setContratoForm(p => ({ ...p, meta1: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="Meta 2 (R$)" value={contratoForm.meta2} onChange={e => setContratoForm(p => ({ ...p, meta2: e.target.value }))} />
                <Input type="number" step="0.01" placeholder="Meta 3 (R$)" value={contratoForm.meta3} onChange={e => setContratoForm(p => ({ ...p, meta3: e.target.value }))} />
              </div>

              <div className="flex gap-2 mb-4">
                <Button size="sm" onClick={handleSaveContrato}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {editingContratoId ? "Salvar Alterações" : "Adicionar Contrato"}
                </Button>
                {editingContratoId && (
                  <Button size="sm" variant="outline" onClick={() => { setContratoForm(emptyContrato); setEditingContratoId(null); }}>
                    Cancelar
                  </Button>
                )}
              </div>

              {contratos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato cadastrado.</p>
              ) : (
                <div className="divide-y divide-border">
                  {contratos.map(ct => (
                    <div key={ct.id}>
                      <div className="py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                          <div>
                            <p className="font-medium text-foreground">{ct.numero}</p>
                            {ct.numeroProcesso && <p className="text-xs text-muted-foreground">Proc: {ct.numeroProcesso}</p>}
                          </div>
                          <p className="text-muted-foreground truncate sm:col-span-2">{ct.descricao || "—"}</p>
                          <p className="text-muted-foreground tabular-nums">
                            {ct.dataInicio ? new Date(ct.dataInicio + "T00:00:00").toLocaleDateString("pt-BR") : "—"} a {ct.dataFim ? new Date(ct.dataFim + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                          </p>
                          <p className="text-muted-foreground">BDI: {ct.bdi || "—"}</p>
                          <p className="text-muted-foreground">Desconto Licitação: {ct.descontoLicitacao ? `${ct.descontoLicitacao}%` : "—"}</p>
                          <p className="text-muted-foreground">VTM Mensal: {ct.valorBase || "—"}</p>
                          <p className="text-muted-foreground">VTM Anual: {ct.valorBase2 || "—"}</p>
                          <p className="text-muted-foreground">VTM Contratual: {ct.valorBase3 || "—"}</p>
                          <p className="text-muted-foreground">Mão de Obra Mensal: {ct.maoDeObraMensal || "—"}</p>
                          <p className="text-muted-foreground">Mão de Obra Anual: {ct.maoDeObraAnual || "—"}</p>
                          <p className="text-muted-foreground">Mão de Obra Contratual: {ct.maoDeObraContratual || "—"}</p>
                          <p className="text-muted-foreground">Mês SCO: {ct.mesSco || "—"}</p>
                          <p className="text-muted-foreground">Ano SCO: {ct.anoSco || "—"}</p>
                          <p className="text-muted-foreground">Valor Contrato: {ct.valorContrato || "—"}</p>
                          <p className="text-muted-foreground">INSS: {ct.inss ? `${ct.inss}%` : "—"}</p>
                          <p className="text-muted-foreground">PIS: {ct.pis ? `${ct.pis}%` : "—"}</p>
                          <p className="text-muted-foreground">COFINS: {ct.cofins ? `${ct.cofins}%` : "—"}</p>
                          <p className="text-muted-foreground">CSLL: {ct.csll ? `${ct.csll}%` : "—"}</p>
                          <p className="text-muted-foreground">IRRF: {ct.irrf ? `${ct.irrf}%` : "—"}</p>
                          <p className="text-muted-foreground">ISS: {ct.iss ? `${ct.iss}%` : "—"}</p>
                          <p className="text-muted-foreground">CBS: {(ct as any).cbs ? `${(ct as any).cbs}%` : "—"}</p>
                          <p className="text-muted-foreground">IBS: {(ct as any).ibs ? `${(ct as any).ibs}%` : "—"}</p>
                          <p className="text-muted-foreground">Meta 1: {ct.meta1 ? `R$ ${ct.meta1}` : "—"}</p>
                          <p className="text-muted-foreground">Meta 2: {ct.meta2 ? `R$ ${ct.meta2}` : "—"}</p>
                          <p className="text-muted-foreground">Meta 3: {ct.meta3 ? `R$ ${ct.meta3}` : "—"}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="outline" size="sm" type="button" onClick={() => setEmpenhoContratoId(empenhoContratoId === ct.id ? null : ct.id)} className="text-xs gap-1" title="Empenhos">
                            <Landmark className="h-3.5 w-3.5" /> Empenho
                          </Button>
                          <Button variant="outline" size="sm" type="button" onClick={() => setFaturamentoContratoId(faturamentoContratoId === ct.id ? null : ct.id)} className="text-xs gap-1" title="Gerenciar Faturamento">
                            <DollarSign className="h-3.5 w-3.5" /> Gerenciar Faturamento
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditContrato(ct)} className="text-xs">Editar</Button>
                          <Button variant="ghost" size="sm" onClick={() => requestDeleteContrato(ct.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {empenhoContratoId === ct.id && (
                        <EmpenhoSection
                          empenhos={ct.empenhos || []}
                          contratoNumero={ct.numero}
                          onChange={(empenhos) => {
                            const updated = contratos.map(c => c.id === ct.id ? { ...c, empenhos } : c);
                            return updateCliente(contratosClienteId!, { contratos: updated });
                          }}
                        />
                      )}
                      {faturamentoContratoId === ct.id && (
                        <FaturamentoSection
                          faturamentos={ct.faturamentos || []}
                          onChange={(faturamentos) => {
                            const updated = contratos.map(c => c.id === ct.id ? { ...c, faturamentos } : c);
                            return updateCliente(contratosClienteId!, { contratos: updated });
                          }}
                          contratoNumero={ct.numero}
                          cliente={cliente}
                          contrato={ct}
                        />
                      )}

                    </div>
                  ))}
                </div>
              )}
              <DoubleConfirmDelete open={!!deleteContratoId} onOpenChange={(open) => !open && cancelDeleteContrato()} onConfirm={() => { if (deleteContratoId) { handleDeleteContrato(deleteContratoId); cancelDeleteContrato(); } }} />
            </div>
          );
        })()}
      </div>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
      <DoubleConfirmDelete open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} onConfirm={handleBulkDelete} />
      <RelatorioClienteFornecedorDialog
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        tipo="Cliente"
        todos={apenasClientes}
        filtrados={filteredClientes}
        selecionados={apenasClientes.filter(c => selectedIds.includes(c.id))}
      />
    </div>
  );
};

export default Clientes;
