import { useState, useMemo } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { toast } from "sonner";
import { Truck, Trash2, Search, MessageCircle, ChevronDown, ChevronUp, FileBarChart, KeyRound, Copy, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import RelatorioClienteFornecedorDialog from "@/components/RelatorioClienteFornecedorDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClientes, type Cliente } from "@/contexts/ClientesContext";
import ClienteForm, { emptyForm, type FormData } from "@/components/ClienteForm";
import ImportClientesFornecedores from "@/components/ImportClientesFornecedores";
import DadosBancariosTab from "@/components/DadosBancariosTab";
import LinhasFornecimentoTab from "@/components/LinhasFornecimentoTab";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissao } from "@/hooks/usePermissao";

const Fornecedores = () => {
  const { clientes, addCliente, updateCliente, deleteCliente } = useClientes();
  const { tem } = usePermissao();
  const podeCriar = tem("fornecedores.criar");
  const podeEditar = tem("fornecedores.editar");
  const podeExcluir = tem("fornecedores.excluir");
  const [formOpen, setFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<FormData | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();
  const [activeTab, setActiveTab] = useState("cadastro");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [senhaDialog, setSenhaDialog] = useState<{ fornecedor: Cliente; senha: string } | null>(null);
  const [gerandoSenhaId, setGerandoSenhaId] = useState<string | null>(null);

  const portalUrl = `${window.location.origin}/portal-fornecedor`;

  const handleGerarSenha = async (f: Cliente) => {
    setGerandoSenhaId(f.id);
    try {
      const { data, error } = await supabase.functions.invoke("fornecedor-set-senha", {
        body: { fornecedorId: f.id },
      });
      if (error || !data?.senha) {
        toast.error("Erro ao gerar senha do portal.");
        return;
      }
      setSenhaDialog({ fornecedor: f, senha: data.senha });
    } finally {
      setGerandoSenhaId(null);
    }
  };

  const enviarSenhaWhatsApp = async () => {
    if (!senhaDialog) return;
    const { fornecedor: f, senha } = senhaDialog;
    const tel = f.telefonesWhatsapp || f.telefones?.[0];
    if (!tel) { toast.error("Fornecedor sem WhatsApp cadastrado."); return; }
    const msg = `Olá ${f.contato || f.nome}!\n\nSeu acesso ao Portal do Fornecedor está liberado.\n\n🔗 ${portalUrl}\nE-mail: ${f.email}\nSenha: ${senha}\n\nLá você poderá visualizar cotações e ordens de compra.`;
    toast.loading("Enviando WhatsApp...", { id: "wpp-senha" });
    const r = await enviarWhatsApp(tel, msg);
    if (r.success) toast.success("Senha enviada por WhatsApp!", { id: "wpp-senha" });
    else toast.error("Falha ao enviar WhatsApp.", { id: "wpp-senha" });
  };

  const enviarSenhaEmail = async () => {
    if (!senhaDialog) return;
    const { fornecedor: f, senha } = senhaDialog;
    if (!f.email) { toast.error("Fornecedor sem e-mail cadastrado."); return; }
    toast.loading("Enviando e-mail...", { id: "eml-senha" });
    try {
      const { error } = await supabase.functions.invoke("send-email-senha-temporaria", {
        body: {
          recipientEmail: f.email,
          idempotencyKey: `portal-fornecedor-${f.id}-${Date.now()}`,
          templateData: {
            nomeUsuario: f.contato || f.nome,
            senhaTemporaria: senha,
            nomeEmpresa: "LASANT CONSTRUÇÕES",
            portalUrl,
          },
        },
      });
      if (error) throw error;
      toast.success("Senha enviada por e-mail!", { id: "eml-senha" });
    } catch {
      toast.error("Falha ao enviar e-mail.", { id: "eml-senha" });
    }
  };

  const copiarSenha = () => {
    if (!senhaDialog) return;
    navigator.clipboard.writeText(senhaDialog.senha);
    toast.success("Senha copiada!");
  };

  const toggleOne = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBulkDelete = async () => {
    for (const id of selectedIds) await deleteCliente(id);
    toast.success(`${selectedIds.length} fornecedor(es) removido(s).`);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const handleBulkWhatsApp = async () => {
    const alvos = clientes.filter(c => selectedIds.includes(c.id) && c.telefones?.length);
    if (alvos.length === 0) { toast.error("Nenhum selecionado tem telefone."); return; }
    toast.loading(`Enviando para ${alvos.length} fornecedor(es)...`, { id: "bulk-wpp-f" });
    let ok = 0;
    for (const c of alvos) {
      const msg = `Olá ${c.contato || c.nome}!`;
      for (const tel of c.telefones) {
        const r = await enviarWhatsApp(tel, msg);
        if (r.success) ok++;
      }
    }
    toast.success(`${ok} mensagem(ns) enviada(s).`, { id: "bulk-wpp-f" });
  };

  const fornecedores = useMemo(() => clientes.filter((c) => c.tipo === "Fornecedor"), [clientes]);

  const editingFornecedor = useMemo(
    () => (editingId ? clientes.find((c) => c.id === editingId) : null),
    [editingId, clientes]
  );

  const handleSubmit = (data: FormData, id: string | null) => {
    if (id ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!data.nome.trim()) {
      toast.error("Informe o nome do fornecedor.");
      return;
    }
    const fullData = {
      ...data,
      tipo: "Fornecedor" as const,
      informacoesFinanceiras: id ? (clientes.find(c => c.id === id)?.informacoesFinanceiras || []) : [],
      locais: id ? (clientes.find(c => c.id === id)?.locais || []) : [],
      locaisEntrega: id ? (clientes.find(c => c.id === id)?.locaisEntrega || []) : [],
      contratos: id ? (clientes.find(c => c.id === id)?.contratos || []) : [],
      linhasFornecimento: id ? (clientes.find(c => c.id === id)?.linhasFornecimento || []) : [],
    };

    if (id) {
      updateCliente(id, fullData);
      toast.success("Fornecedor atualizado com sucesso!");
    } else {
      addCliente(fullData);
      toast.success("Fornecedor cadastrado com sucesso!");
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingData(undefined);
    setActiveTab("cadastro");
  };

  const handleEdit = (fornecedor: Cliente) => {
    setEditingId(fornecedor.id);
    const { id, informacoesFinanceiras, locais, locaisEntrega, linhasFornecimento, ...rest } = fornecedor;
    setEditingData(rest as FormData);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; }
    deleteCliente(id);
    toast.success("Fornecedor removido.");
    if (editingId === id) resetForm();
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  const handleEnviarWhatsApp = async (fornecedor: Cliente) => {
    if (!fornecedor.telefones || fornecedor.telefones.length === 0) {
      toast.error("Fornecedor sem telefone cadastrado.");
      return;
    }
    const mensagem = `Olá ${fornecedor.contato || fornecedor.nome}! Aqui é da equipe de RH.`;
    toast.loading("Enviando mensagens...", { id: "whatsapp-send" });
    let successCount = 0;
    for (const tel of fornecedor.telefones) {
      const result = await enviarWhatsApp(tel, mensagem);
      if (result.success) successCount++;
    }
    if (successCount === fornecedor.telefones.length) {
      toast.success(`Mensagem enviada para ${successCount} número(s)!`, { id: "whatsapp-send" });
    } else {
      toast.error(`Enviada para ${successCount}/${fornecedor.telefones.length} números.`, { id: "whatsapp-send" });
    }
  };

  const handleDadosBancariosChange = (dados: any[]) => {
    if (!editingId) return;
    updateCliente(editingId, { informacoesFinanceiras: dados });
  };

  const handleLinhasFornecimentoChange = async (linhas: any[]) => {
    if (!editingId) return;
    const ok = await updateCliente(editingId, { linhasFornecimento: linhas });
    if (!ok) toast.error("Erro ao salvar linhas de fornecimento.");
  };


  const filteredFornecedores = useMemo(() => {
    if (!search.trim()) return fornecedores;
    const term = search.toLowerCase();
    return fornecedores.filter(
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
  }, [fornecedores, search]);

  const defaultData: FormData = { ...emptyForm, tipo: "Fornecedor" };

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Truck className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Cadastro</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">Fornecedores</h1>
              <p className="text-sm text-muted-foreground max-w-lg">
                Cadastre e gerencie os fornecedores do sistema.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setRelatorioOpen(true)} className="gap-2">
                <FileBarChart className="h-4 w-4" /> Relatório
              </Button>
              {tem("fornecedores.importar") && <ImportClientesFornecedores tipo="Fornecedor" />}
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
            <h2 className="section-title mb-0">{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
            {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {formOpen && (
            <div className="mt-4">
              {editingId ? (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                    <TabsTrigger value="dados-bancarios">Dados Bancários</TabsTrigger>
                    <TabsTrigger value="linhas-fornecimento">Linhas de Fornecimento</TabsTrigger>
                  </TabsList>
                  <TabsContent value="cadastro" className="mt-4">
                    <ClienteForm
                      key={editingId}
                      editingId={editingId}
                      initialData={editingData || defaultData}
                      onSubmit={handleSubmit}
                      onCancel={resetForm}
                      tipoFixo="Fornecedor"
                      embedded
                    />
                  </TabsContent>
                  <TabsContent value="dados-bancarios" className="mt-4">
                    <DadosBancariosTab
                      dados={editingFornecedor?.informacoesFinanceiras || []}
                      onChange={handleDadosBancariosChange}
                    />
                  </TabsContent>
                  <TabsContent value="linhas-fornecimento" className="mt-4">
                    <LinhasFornecimentoTab
                      linhas={editingFornecedor?.linhasFornecimento || []}
                      onChange={handleLinhasFornecimentoChange}
                    />
                  </TabsContent>
                </Tabs>

              ) : (
                <ClienteForm
                  key="new"
                  editingId={null}
                  initialData={defaultData}
                  onSubmit={handleSubmit}
                  onCancel={resetForm}
                  tipoFixo="Fornecedor"
                  embedded
                />
              )}
            </div>
          )}
        </div>
        )}


        <div className="section-card animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Fornecedores Cadastrados</h2>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar fornecedores..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9"
              />
            </div>
          </div>
          {filteredFornecedores.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {fornecedores.length === 0 ? "Nenhum fornecedor cadastrado ainda." : "Nenhum resultado encontrado."}
            </p>
          ) : (
            <>
              {(() => {
                const pageItems = paginate(filteredFornecedores, page, pageSize).paginated;
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
                {paginate(filteredFornecedores, page, pageSize).paginated.map((fornecedor) => (
                  <div key={fornecedor.id} className="flex items-center justify-between py-3 gap-4">
                    <Checkbox
                      checked={selectedIds.includes(fornecedor.id)}
                      onCheckedChange={() => toggleOne(fornecedor.id)}
                    />
                    <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1">
                      <p className="text-sm font-semibold text-primary tabular-nums">Nº {fornecedor.codigo ?? "—"}</p>
                      <p className="text-sm font-medium text-foreground truncate">{fornecedor.nome}</p>
                      <p className="text-sm text-muted-foreground truncate tabular-nums">{fornecedor.cnpj || "—"}</p>
                      <p className="text-sm text-muted-foreground truncate">{fornecedor.contato || "—"}</p>
                      <p className="text-sm text-muted-foreground truncate">{fornecedor.cidade ? `${fornecedor.cidade}/${fornecedor.uf}` : "—"}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => handleGerarSenha(fornecedor)} disabled={gerandoSenhaId === fornecedor.id} className="text-primary" title="Gerar senha do Portal do Fornecedor">
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEnviarWhatsApp(fornecedor)} className="text-emerald-600 hover:text-emerald-700" title="Enviar WhatsApp">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                      {podeEditar && <Button variant="ghost" size="sm" onClick={() => handleEdit(fornecedor)} className="text-xs">Editar</Button>}
                      {podeExcluir && <Button variant="ghost" size="sm" onClick={() => requestDelete(fornecedor.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <PaginationControls currentPage={page} totalItems={filteredFornecedores.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      </div>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
      <DoubleConfirmDelete open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} onConfirm={handleBulkDelete} />
      <RelatorioClienteFornecedorDialog
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        tipo="Fornecedor"
        todos={fornecedores}
        filtrados={filteredFornecedores}
        selecionados={fornecedores.filter(f => selectedIds.includes(f.id))}
      />
      <Dialog open={!!senhaDialog} onOpenChange={(o) => !o && setSenhaDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha do Portal do Fornecedor</DialogTitle>
            <DialogDescription>
              Nova senha gerada para <strong>{senhaDialog?.fornecedor.nome}</strong>. Anote, copie ou envie agora — ela não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">URL de acesso</p>
              <code className="block bg-muted p-2 rounded text-xs break-all">{portalUrl}</code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">E-mail (login)</p>
              <code className="block bg-muted p-2 rounded text-xs">{senhaDialog?.fornecedor.email || "— sem e-mail —"}</code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Senha</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">{senhaDialog?.senha}</code>
                <Button size="sm" variant="outline" onClick={copiarSenha}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={enviarSenhaEmail}><Mail className="h-4 w-4 mr-2" /> Enviar por E-mail</Button>
            <Button onClick={enviarSenhaWhatsApp} className="bg-emerald-600 hover:bg-emerald-700"><MessageCircle className="h-4 w-4 mr-2" /> Enviar por WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Fornecedores;
