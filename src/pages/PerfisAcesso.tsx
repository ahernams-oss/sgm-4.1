import { useState, useMemo } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { KeyRound, Trash2, Pencil, Search, Copy, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  usePerfisAcesso,
  MODULOS_SISTEMA,
  ALL_MODULE_KEYS,
  ALL_PERMISSION_KEYS,
  Permissoes,
} from "@/contexts/PerfisAcessoContext";
import { toast } from "sonner";
import { usePermissao } from "@/hooks/usePermissao";

const emptyForm = { nome: "", descricao: "", permissoes: {} as Permissoes };

const PerfisAcesso = () => {
  const { perfis, addPerfil, updatePerfil, deletePerfil } = usePerfisAcesso();
  const { tem } = usePermissao();
  const podeCriar = tem("perfis_acesso.criar");
  const podeEditar = tem("perfis_acesso.editar");
  const podeExcluir = tem("perfis_acesso.excluir");
  const podeDuplicar = tem("perfis_acesso.duplicar");

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const togglePermissao = (key: string) => {
    setForm(prev => ({
      ...prev,
      permissoes: { ...prev.permissoes, [key]: !prev.permissoes[key] },
    }));
  };

  const toggleModule = (moduleKey: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
  };

  const getModuleAllKeys = (mod: typeof MODULOS_SISTEMA[0]["modulos"][0]) => [
    mod.key,
    ...(mod.acoes?.map(a => a.key) ?? []),
    ...(mod.statusTransicoes?.map(s => s.key) ?? []),
    ...(mod.flags?.map(f => f.key) ?? []),
  ];

  const toggleModuleAll = (mod: typeof MODULOS_SISTEMA[0]["modulos"][0]) => {
    const keys = getModuleAllKeys(mod);
    const allChecked = keys.every(k => form.permissoes[k]);
    setForm(prev => {
      const updated = { ...prev.permissoes };
      keys.forEach(k => { updated[k] = !allChecked; });
      return { ...prev, permissoes: updated };
    });
  };

  const toggleGrupo = (grupo: typeof MODULOS_SISTEMA[0]) => {
    const keys = grupo.modulos.flatMap(getModuleAllKeys);
    const allChecked = keys.every(k => form.permissoes[k]);
    setForm(prev => {
      const updated = { ...prev.permissoes };
      keys.forEach(k => { updated[k] = !allChecked; });
      return { ...prev, permissoes: updated };
    });
  };

  const toggleAll = () => {
    const allChecked = ALL_PERMISSION_KEYS.every(k => form.permissoes[k]);
    setForm(prev => {
      const updated = { ...prev.permissoes };
      ALL_PERMISSION_KEYS.forEach(k => { updated[k] = !allChecked; });
      return { ...prev, permissoes: updated };
    });
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    MODULOS_SISTEMA.forEach(g => g.modulos.forEach(m => { all[m.key] = true; }));
    setExpandedModules(all);
    setCollapsedGroups({});
  };
  const collapseAll = () => {
    setExpandedModules({});
    const allG: Record<string, boolean> = {};
    MODULOS_SISTEMA.forEach(g => { allG[g.grupo] = true; });
    setCollapsedGroups(allG);
  };
  const toggleGrupoCollapse = (grupo: string) =>
    setCollapsedGroups(prev => ({ ...prev, [grupo]: !prev[grupo] }));

  const matchesSearch = (text: string) =>
    !permSearch.trim() || text.toLowerCase().includes(permSearch.toLowerCase());

  const filteredModulos = useMemo(() => {
    if (!permSearch.trim()) return MODULOS_SISTEMA;
    return MODULOS_SISTEMA
      .map(g => ({
        ...g,
        modulos: g.modulos.filter(m => {
          if (matchesSearch(m.label)) return true;
          const sub = [
            ...(m.acoes ?? []),
            ...(m.statusTransicoes ?? []),
            ...(m.flags ?? []),
          ];
          return sub.some(s => matchesSearch(s.label));
        }),
      }))
      .filter(g => g.modulos.length > 0);
  }, [permSearch]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setExpandedModules({});
    setCollapsedGroups({});
    setPermSearch("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome.trim()) { toast.error("Informe o nome do perfil."); return; }
    if (editingId) {
      await updatePerfil(editingId, form);
      toast.success("Perfil atualizado.");
    } else {
      await addPerfil(form);
      toast.success("Perfil cadastrado.");
    }
    resetForm();
  };

  const handleEdit = (p: typeof perfis[0]) => {
    setForm({ nome: p.nome, descricao: p.descricao, permissoes: { ...p.permissoes } });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDuplicate = (p: typeof perfis[0]) => {
    if (!podeDuplicar && !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    const ok = window.confirm(
      `Deseja criar uma CÓPIA do perfil "${p.nome}"?\n\nIsso irá criar um NOVO perfil. Se você quer apenas editar o perfil existente, clique em Cancelar e use o botão de Editar (ícone de lápis).`
    );
    if (!ok) return;
    setForm({ nome: `${p.nome} (cópia)`, descricao: p.descricao, permissoes: { ...p.permissoes } });
    setEditingId(null);
    setShowForm(true);
    toast.info("Perfil duplicado. Edite e salve.");
  };

  const handleDelete = async (id: string) => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; }
    await deletePerfil(id);
    if (editingId === id) resetForm();
    toast.success("Perfil removido.");
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  const countPermissoes = (perms: Permissoes) =>
    ALL_PERMISSION_KEYS.filter(k => perms[k]).length;

  const filteredPerfis = useMemo(() => {
    if (!search.trim()) return perfis;
    const term = search.toLowerCase();
    return perfis.filter(p =>
      p.nome.toLowerCase().includes(term) || p.descricao.toLowerCase().includes(term)
    );
  }, [perfis, search]);

  const allChecked = ALL_PERMISSION_KEYS.every(k => form.permissoes[k]);

  const renderPermissionCheckbox = (item: { key: string; label: string }, variant: "acao" | "status" | "flag") => {
    const checked = !!form.permissoes[item.key];
    const colorMap = {
      acao: checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30",
      status: checked ? "border-amber-500 bg-amber-500/5" : "border-border hover:border-muted-foreground/30",
      flag: checked ? "border-emerald-500 bg-emerald-500/5" : "border-border hover:border-muted-foreground/30",
    };
    return (
      <label
        key={item.key}
        className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs cursor-pointer transition-all ${colorMap[variant]}`}
      >
        <Checkbox checked={checked} onCheckedChange={() => togglePermissao(item.key)} className="h-3.5 w-3.5" />
        <span className="text-foreground">{item.label}</span>
      </label>
    );
  };

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-2 text-primary mb-1">
            <KeyRound className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Administração</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground mb-1">Perfis de Acesso</h1>
              <p className="text-sm text-muted-foreground max-w-lg">
                Configure perfis com permissões granulares por módulo, ações, status e flags.
              </p>
            </div>
            {!showForm && podeCriar && (
              <Button onClick={() => setShowForm(true)} className="shadow-md">Novo Perfil</Button>
            )}
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm animate-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Nome do Perfil *</Label>
                <Input
                  value={form.nome}
                  onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Administrador, Comprador, Operacional"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição opcional do perfil"
                />
              </div>
            </div>

            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Permissões</h3>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {ALL_PERMISSION_KEYS.filter(k => form.permissoes[k]).length}/{ALL_PERMISSION_KEYS.length}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-primary" /><span className="text-[10px] text-muted-foreground">Ações</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-amber-500" /><span className="text-[10px] text-muted-foreground">Status</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-[10px] text-muted-foreground">Flags</span></div>
                  <Button type="button" variant="outline" size="sm" onClick={expandAll} className="h-7 text-xs gap-1"><ChevronsUpDown className="h-3 w-3" />Expandir tudo</Button>
                  <Button type="button" variant="outline" size="sm" onClick={collapseAll} className="h-7 text-xs gap-1"><ChevronsDownUp className="h-3 w-3" />Recolher tudo</Button>
                  <div className="flex items-center gap-2 ml-1">
                    <Switch checked={allChecked} onCheckedChange={toggleAll} />
                    <span className="text-xs text-muted-foreground">{allChecked ? "Desmarcar todos" : "Marcar todos"}</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={permSearch}
                  onChange={e => setPermSearch(e.target.value)}
                  placeholder="Buscar módulo, ação, status ou flag..."
                  className="pl-9 pr-9 h-9"
                />
                {permSearch && (
                  <button type="button" onClick={() => setPermSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {filteredModulos.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8 border border-dashed rounded-lg">
                  Nenhum módulo encontrado para "{permSearch}".
                </div>
              )}
              {filteredModulos.map(grupo => {
                const grupoKeys = grupo.modulos.flatMap(getModuleAllKeys);
                const allGrupoChecked = grupoKeys.every(k => form.permissoes[k]);
                const someGrupoChecked = grupoKeys.some(k => form.permissoes[k]);

                const isGrupoCollapsed = !!collapsedGroups[grupo.grupo] && !permSearch.trim();

                return (
                  <div key={grupo.grupo} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allGrupoChecked}
                          className={someGrupoChecked && !allGrupoChecked ? "opacity-60" : ""}
                          onCheckedChange={() => toggleGrupo(grupo)}
                        />
                        <button
                          type="button"
                          onClick={() => toggleGrupoCollapse(grupo.grupo)}
                          className="flex items-center gap-1.5 hover:opacity-80"
                        >
                          {isGrupoCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          <h4 className="text-sm font-semibold text-foreground">{grupo.grupo}</h4>
                        </button>
                        <span className="text-[10px] text-muted-foreground">
                          ({grupoKeys.filter(k => form.permissoes[k]).length}/{grupoKeys.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGrupo(grupo)}
                        className="text-xs text-primary hover:underline"
                      >
                        {allGrupoChecked ? "Desmarcar grupo" : "Marcar grupo"}
                      </button>
                    </div>

                    {!isGrupoCollapsed && <div className="divide-y divide-border">
                      {grupo.modulos.map(mod => {
                        const modKeys = getModuleAllKeys(mod);
                        const allModChecked = modKeys.every(k => form.permissoes[k]);
                        const hasDetails = (mod.acoes?.length ?? 0) > 0 || (mod.statusTransicoes?.length ?? 0) > 0 || (mod.flags?.length ?? 0) > 0;
                        const isExpanded = !!expandedModules[mod.key];

                        return (
                          <div key={mod.key} className="bg-card">
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <Checkbox
                                checked={!!form.permissoes[mod.key]}
                                onCheckedChange={() => {
                                  if (!form.permissoes[mod.key]) {
                                    // When enabling module access, just toggle the module key
                                    togglePermissao(mod.key);
                                  } else {
                                    // When disabling, disable module and all sub-permissions
                                    toggleModuleAll(mod);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="flex items-center gap-1.5 flex-1 text-left"
                                onClick={() => hasDetails && toggleModule(mod.key)}
                              >
                                <span className="text-sm font-medium text-foreground">{mod.label}</span>
                                {hasDetails && (
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    ({modKeys.filter(k => form.permissoes[k]).length}/{modKeys.length})
                                  </span>
                                )}
                              </button>
                              {hasDetails && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleModuleAll(mod)}
                                    className="text-[10px] text-primary hover:underline"
                                  >
                                    {allModChecked ? "Desmarcar" : "Marcar tudo"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleModule(mod.key)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                </div>
                              )}
                            </div>

                            {hasDetails && isExpanded && (
                              <div className="px-4 pb-3 pl-10 space-y-3">
                                {mod.acoes && mod.acoes.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ações</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                                      {mod.acoes.map(a => renderPermissionCheckbox(a, "acao"))}
                                    </div>
                                  </div>
                                )}
                                {mod.statusTransicoes && mod.statusTransicoes.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Transições de Status</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                                      {mod.statusTransicoes.map(s => renderPermissionCheckbox(s, "status"))}
                                    </div>
                                  </div>
                                )}
                                {mod.flags && mod.flags.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Flags / Opções</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                                      {mod.flags.map(f => renderPermissionCheckbox(f, "flag"))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" className="shadow-md">
                {editingId ? "Salvar Alterações" : "Cadastrar Perfil"}
              </Button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Perfis Cadastrados</h2>
            <div className="relative w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar perfis..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" />
            </div>
          </div>
          {filteredPerfis.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {perfis.length === 0 ? "Nenhum perfil cadastrado." : "Nenhum resultado encontrado."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Permissões</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginate(filteredPerfis, page, pageSize).paginated.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{p.descricao || "—"}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {countPermissoes(p.permissoes)}/{ALL_PERMISSION_KEYS.length}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {podeEditar && (
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(p)} className="h-8 w-8 text-primary hover:text-primary" title="Editar perfil">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(podeDuplicar || podeCriar) && (
                          <Button size="icon" variant="ghost" onClick={() => handleDuplicate(p)} className="h-8 w-8 text-muted-foreground" title="Duplicar (criar cópia como novo perfil)">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {podeExcluir && (
                          <Button size="icon" variant="ghost" onClick={() => requestDelete(p.id)} className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir perfil">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <PaginationControls currentPage={page} totalItems={filteredPerfis.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      </div>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
};

export default PerfisAcesso;
