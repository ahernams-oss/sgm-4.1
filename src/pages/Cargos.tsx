import { useState, useMemo, useRef } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { toast } from "sonner";
import { Briefcase, Plus, Trash2, Search, ChevronDown, ChevronUp, Pencil, Check, X, Upload, FileText, ExternalLink } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCargos, type SalarioDataBase, type AnexoCargo, type NrCargo, type EpiPadraoCargo } from "@/contexts/CargosContext";
import { useEpisCatalogo } from "@/contexts/EpisCatalogoContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { usePermissao } from "@/hooks/usePermissao";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const niveis = ["I", "II", "III", "IV", "V"] as const;

const emptyForm = { nome: "", descricao: "", nivel: "", missao: "", responsabilidades: "", perfilCompetencias: "", cbo: "" };

const Cargos = () => {
  const { cargos, addCargo, updateCargo, deleteCargo } = useCargos();
  const { epis: catalogoEpis } = useEpisCatalogo();
  const { tem } = usePermissao();
  const podeCriar = tem("cargos.criar");
  const podeEditar = tem("cargos.editar");
  const podeExcluir = tem("cargos.excluir");
  const podeSal = tem("cargos.gerenciar_salarios");
  const podeNrs = tem("cargos.gerenciar_nrs");
  const podeAnexos = tem("cargos.gerenciar_anexos");
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterNivel, setFilterNivel] = useState<string>("todos");
  const [expandedCargoId, setExpandedCargoId] = useState<string | null>(null);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  // Salário form state
  const [novoSalarioValor, setNovoSalarioValor] = useState<Record<string, string>>({});
  const [novoSalarioData, setNovoSalarioData] = useState<Record<string, string>>({});

  // Editing salário
  const [editingSalarioId, setEditingSalarioId] = useState<string | null>(null);
  const [editingSalarioValor, setEditingSalarioValor] = useState("");
  const [editingSalarioData, setEditingSalarioData] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // NRs state
  const [novoNrNumero, setNovoNrNumero] = useState<Record<string, string>>({});
  const [novoNrDescricao, setNovoNrDescricao] = useState<Record<string, string>>({});
  const [editingNrId, setEditingNrId] = useState<string | null>(null);
  const [editingNrNumero, setEditingNrNumero] = useState("");
  const [editingNrDescricao, setEditingNrDescricao] = useState("");

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.nome.trim()) {
      toast.error("Informe o nome do cargo.");
      return;
    }
    if (editingId) {
      updateCargo(editingId, form);
      toast.success("Cargo atualizado com sucesso!");
    } else {
      addCargo({ ...form, salario: "", dataBaseSalario: "", salarios: [], anexos: [], nrs: [], episPadrao: [] });
      toast.success("Cargo cadastrado com sucesso!");
    }
    resetForm();
  };

  const handleEdit = (cargo: typeof cargos[0]) => {
    setEditingId(cargo.id);
    setForm({
      nome: cargo.nome,
      descricao: cargo.descricao,
      nivel: cargo.nivel,
      missao: cargo.missao || "",
      responsabilidades: cargo.responsabilidades || "",
      perfilCompetencias: cargo.perfilCompetencias || "",
      cbo: cargo.cbo || "",
    });
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; }
    deleteCargo(id);
    toast.success("Cargo removido.");
    if (editingId === id) resetForm();
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  // Salários management
  const addSalario = (cargoId: string) => {
    const valor = (novoSalarioValor[cargoId] || "").trim();
    const dataBase = (novoSalarioData[cargoId] || "").trim();
    if (!valor) { toast.error("Informe o valor do salário."); return; }
    if (!dataBase) { toast.error("Informe a data base."); return; }
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    const novo: SalarioDataBase = { id: crypto.randomUUID(), valor, dataBase };
    updateCargo(cargoId, { salarios: [...(cargo.salarios || []), novo] });
    setNovoSalarioValor((prev) => ({ ...prev, [cargoId]: "" }));
    setNovoSalarioData((prev) => ({ ...prev, [cargoId]: "" }));
    toast.success("Salário adicionado!");
  };

  const deleteSalario = (cargoId: string, salarioId: string) => {
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    updateCargo(cargoId, { salarios: cargo.salarios.filter((s) => s.id !== salarioId) });
    toast.success("Salário removido.");
  };

  const startEditSalario = (sal: SalarioDataBase) => {
    setEditingSalarioId(sal.id);
    setEditingSalarioValor(sal.valor);
    setEditingSalarioData(sal.dataBase);
  };

  const confirmEditSalario = (cargoId: string, salarioId: string) => {
    if (!editingSalarioValor.trim()) { toast.error("Informe o valor."); return; }
    if (!editingSalarioData.trim()) { toast.error("Informe a data base."); return; }
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    updateCargo(cargoId, {
      salarios: cargo.salarios.map((s) =>
        s.id === salarioId ? { ...s, valor: editingSalarioValor.trim(), dataBase: editingSalarioData.trim() } : s
      ),
    });
    setEditingSalarioId(null);
    toast.success("Salário atualizado!");
  };

  const getSalarioAtual = (salarios: SalarioDataBase[]) => {
    if (!salarios || salarios.length === 0) return null;
    return [...salarios].sort((a, b) => (b.dataBase || "").localeCompare(a.dataBase || ""))[0];
  };

  const ACCEPTED_TYPES = ".docx,.doc,.pdf,.xlsx,.xls,.jpg,.jpeg,.png";
  const MAX_ANEXOS = 3;

  const handleUploadAnexo = async (cargoId: string, file: File) => {
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    if ((cargo.anexos || []).length >= MAX_ANEXOS) {
      toast.error(`Máximo de ${MAX_ANEXOS} anexos por cargo.`);
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const path = `${cargoId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("cargo-anexos").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar arquivo.");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("cargo-anexos").getPublicUrl(path);
    const anexo: AnexoCargo = { id: crypto.randomUUID(), nome: file.name, url: urlData.publicUrl, tipo: ext };
    updateCargo(cargoId, { anexos: [...(cargo.anexos || []), anexo] });
    toast.success("Arquivo anexado!");
    setUploading(false);
  };

  const handleDeleteAnexo = async (cargoId: string, anexo: AnexoCargo) => {
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    // Extract path from URL
    const urlParts = anexo.url.split("/cargo-anexos/");
    if (urlParts[1]) {
      await supabase.storage.from("cargo-anexos").remove([urlParts[1]]);
    }
    updateCargo(cargoId, { anexos: (cargo.anexos || []).filter((a) => a.id !== anexo.id) });
    toast.success("Anexo removido.");
  };

  // NRs management
  const addNr = (cargoId: string) => {
    const numero = (novoNrNumero[cargoId] || "").trim();
    const descricao = (novoNrDescricao[cargoId] || "").trim();
    if (!numero) { toast.error("Informe o número da NR."); return; }
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    const nr: NrCargo = { id: crypto.randomUUID(), numero, descricao };
    updateCargo(cargoId, { nrs: [...(cargo.nrs || []), nr] });
    setNovoNrNumero((prev) => ({ ...prev, [cargoId]: "" }));
    setNovoNrDescricao((prev) => ({ ...prev, [cargoId]: "" }));
    toast.success("NR adicionada!");
  };

  const deleteNr = (cargoId: string, nrId: string) => {
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    updateCargo(cargoId, { nrs: (cargo.nrs || []).filter((n) => n.id !== nrId) });
    toast.success("NR removida.");
  };

  const startEditNr = (nr: NrCargo) => {
    setEditingNrId(nr.id);
    setEditingNrNumero(nr.numero);
    setEditingNrDescricao(nr.descricao);
  };

  const confirmEditNr = (cargoId: string, nrId: string) => {
    if (!editingNrNumero.trim()) { toast.error("Informe o número da NR."); return; }
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    updateCargo(cargoId, {
      nrs: (cargo.nrs || []).map((n) => n.id === nrId ? { ...n, numero: editingNrNumero.trim(), descricao: editingNrDescricao.trim() } : n),
    });
    setEditingNrId(null);
    toast.success("NR atualizada!");
  };

  const nrFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const importNrs = (cargoId: string, file: File) => {
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);
    const reader = new FileReader();

    const processRows = (rows: string[][]) => {
      const newNrs: NrCargo[] = [];
      for (const row of rows) {
        const numero = String(row[0] || "").trim();
        if (!numero) continue;
        const descricao = String(row[1] || "").trim();
        newNrs.push({ id: crypto.randomUUID(), numero, descricao });
      }
      if (newNrs.length === 0) { toast.error("Nenhuma NR encontrada no arquivo."); return; }
      updateCargo(cargoId, { nrs: [...(cargo.nrs || []), ...newNrs] });
      toast.success(`${newNrs.length} NR(s) importada(s)!`);
    };

    if (isExcel) {
      reader.onload = async (e) => {
        try {
          const wb = (await getXLSX()).read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = (await getXLSX()).utils.sheet_to_json(ws, { header: 1 });
          processRows(rows);
        } catch { toast.error("Erro ao ler o arquivo Excel."); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const rows = lines.map((l) => l.includes(";") ? l.split(";") : l.includes("\t") ? l.split("\t") : [l, ""]);
        processRows(rows);
      };
      reader.readAsText(file);
    }
  };
  // EPIs Padrão state
  const [novoEpiCatalogoId, setNovoEpiCatalogoId] = useState<Record<string, string>>({});
  const [novoEpiQtd, setNovoEpiQtd] = useState<Record<string, string>>({});

  const addEpiPadrao = (cargoId: string) => {
    const epiId = novoEpiCatalogoId[cargoId];
    const qtd = parseInt(novoEpiQtd[cargoId] || "1", 10);
    if (!epiId) { toast.error("Selecione um EPI do catálogo."); return; }
    const epi = catalogoEpis.find((e) => e.id === epiId);
    if (!epi) { toast.error("EPI não encontrado."); return; }
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    if ((cargo.episPadrao || []).some((e) => e.epiCatalogoId === epiId)) {
      toast.error("Este EPI já está vinculado ao cargo."); return;
    }
    const novo: EpiPadraoCargo = {
      id: crypto.randomUUID(), epiCatalogoId: epi.id,
      descricao: epi.descricao, ca: epi.ca, quantidade: isNaN(qtd) || qtd < 1 ? 1 : qtd,
    };
    updateCargo(cargoId, { episPadrao: [...(cargo.episPadrao || []), novo] });
    setNovoEpiCatalogoId((p) => ({ ...p, [cargoId]: "" }));
    setNovoEpiQtd((p) => ({ ...p, [cargoId]: "" }));
    toast.success("EPI vinculado!");
  };

  const deleteEpiPadrao = (cargoId: string, epiId: string) => {
    const cargo = cargos.find((c) => c.id === cargoId);
    if (!cargo) return;
    updateCargo(cargoId, { episPadrao: (cargo.episPadrao || []).filter((e) => e.id !== epiId) });
    toast.success("EPI removido.");
  };


  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const resetPage = () => setPage(1);

  const filteredCargos = useMemo(() => {
    let result = cargos;
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.nome.toLowerCase().includes(term) ||
          c.descricao.toLowerCase().includes(term) ||
          c.salarios?.some((s) => s.valor.toLowerCase().includes(term))
      );
    }
    if (filterNivel !== "todos") {
      result = result.filter((c) => c.nivel === filterNivel);
    }
    return result;
  }, [cargos, search, filterNivel]);

  return (
    <div className="bg-background">
      <div className="container max-w-full mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Briefcase className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Cadastro</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">Cargos</h1>
          <p className="text-sm text-muted-foreground max-w-lg">
            Cadastre e gerencie os cargos disponíveis no sistema.
          </p>
        </div>

        <div
          className="section-card animate-fade-up mb-6"
          style={{ animationDelay: "80ms" }}
        >
          <button
            type="button"
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center justify-between w-full"
          >
            <h2 className="section-title mb-0">
              {editingId ? "Editar Cargo" : "Novo Cargo"}
            </h2>
            {formOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="field-label">Nome do Cargo</label>
              <Input placeholder="Ex: Eletricista de Alta" value={form.nome} onChange={(e) => update("nome", e.target.value)} />
            </div>
            <div>
              <label className="field-label">CBO</label>
              <Input placeholder="Ex: 7321-05" value={form.cbo} onChange={(e) => update("cbo", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Nível</label>
              <Select value={form.nivel} onValueChange={(v) => update("nivel", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {niveis.map((n) => (
                    <SelectItem key={n} value={n}>Nível {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4">
              <label className="field-label">Descrição</label>
              <Textarea placeholder="Breve descrição do cargo" value={form.descricao} onChange={(e) => update("descricao", e.target.value)} rows={2} className="min-h-[40px]" />
            </div>
            <div className="md:col-span-4">
              <label className="field-label">Missão do Cargo</label>
              <Textarea placeholder="Descreva a missão do cargo" value={form.missao} onChange={(e) => update("missao", e.target.value)} rows={3} className="min-h-[60px]" />
            </div>
            <div className="md:col-span-4">
              <label className="field-label">Responsabilidades do Cargo</label>
              <Textarea placeholder="Descreva as responsabilidades do cargo" value={form.responsabilidades} onChange={(e) => update("responsabilidades", e.target.value)} rows={4} className="min-h-[80px]" />
            </div>
            <div className="md:col-span-4">
              <label className="field-label">Perfil de Competências</label>
              <Textarea placeholder="Descreva o perfil de competências esperado" value={form.perfilCompetencias} onChange={(e) => update("perfilCompetencias", e.target.value)} rows={4} className="min-h-[80px]" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Os salários são gerenciados na listagem abaixo, vinculados à data base.
          </p>
          <div className="flex gap-2 mt-4">
            <Button type="submit" className="gap-2">
              <Plus className="h-4 w-4" />
              {editingId ? "Salvar Alterações" : "Adicionar Cargo"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
            )}
          </div>
        </form>
          )}
        </div>

        <div className="section-card animate-fade-up" style={{ animationDelay: "160ms" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="section-title mb-0">Cargos Cadastrados</h2>
            <div className="flex items-center gap-2">
              <Select value={filterNivel} onValueChange={(v) => { setFilterNivel(v); resetPage(); }}>
                <SelectTrigger className="h-9 w-[130px] text-xs">
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Níveis</SelectItem>
                  {niveis.map((n) => (
                    <SelectItem key={n} value={n}>Nível {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar cargos..." value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} className="pl-9 h-9" />
              </div>
            </div>
          </div>
          {filteredCargos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {cargos.length === 0 ? "Nenhum cargo cadastrado ainda." : "Nenhum resultado encontrado."}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {paginate(filteredCargos, page, pageSize).paginated.map((cargo) => {
                const salarioAtual = getSalarioAtual(cargo.salarios);
                return (
                  <div key={cargo.id} className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                        <p className="text-sm font-medium text-foreground truncate">{cargo.nome}</p>
                        <div>
                          {cargo.nivel && (
                            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Nível {cargo.nivel}
                            </span>
                          )}
                        </div>
                        <div>
                          {salarioAtual ? (
                            <p className="text-sm text-muted-foreground tabular-nums">R$ {salarioAtual.valor}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                        <div>
                          {salarioAtual?.dataBase ? (
                            <p className="text-xs text-muted-foreground">
                              Base: {new Date(salarioAtual.dataBase + "T00:00:00").toLocaleDateString("pt-BR")}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setExpandedCargoId(expandedCargoId === cargo.id ? null : cargo.id)}
                          title="Histórico de salários"
                          className="text-xs gap-1"
                        >
                          {expandedCargoId === cargo.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Salários e EPIs
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(cargo)} className="text-xs">Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => requestDelete(cargo.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {expandedCargoId === cargo.id && (
                      <>
                        {/* Salários */}
                        <div className="mt-3 ml-4 border-l-2 border-muted pl-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Histórico de Salários
                          </h4>
                          <div className="flex gap-2 mb-3">
                            <Input
                              placeholder="Valor (ex: 2.511,98)"
                              value={novoSalarioValor[cargo.id] || ""}
                              onChange={(e) => setNovoSalarioValor((prev) => ({ ...prev, [cargo.id]: e.target.value }))}
                              className="flex-1 h-8 text-sm"
                            />
                            <Input
                              type="date"
                              value={novoSalarioData[cargo.id] || ""}
                              onChange={(e) => setNovoSalarioData((prev) => ({ ...prev, [cargo.id]: e.target.value }))}
                              className="w-40 h-8 text-sm"
                            />
                            <Button type="button" size="sm" onClick={() => addSalario(cargo.id)} className="gap-1 shrink-0 h-8 text-xs">
                              <Plus className="h-3 w-3" /> Adicionar
                            </Button>
                          </div>

                          {(!cargo.salarios || cargo.salarios.length === 0) ? (
                            <p className="text-xs text-muted-foreground text-center py-3">Nenhum salário cadastrado.</p>
                          ) : (
                            <div className="divide-y divide-border rounded border border-border">
                              {[...cargo.salarios].sort((a, b) => (b.dataBase || "").localeCompare(a.dataBase || "")).map((sal) => (
                                <div key={sal.id} className="flex items-center justify-between px-3 py-2">
                                  {editingSalarioId === sal.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <Input
                                        value={editingSalarioValor}
                                        onChange={(e) => setEditingSalarioValor(e.target.value)}
                                        className="h-7 text-sm flex-1"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmEditSalario(cargo.id, sal.id); } if (e.key === "Escape") setEditingSalarioId(null); }}
                                      />
                                      <Input
                                        type="date"
                                        value={editingSalarioData}
                                        onChange={(e) => setEditingSalarioData(e.target.value)}
                                        className="h-7 text-sm w-40"
                                      />
                                      <Button type="button" variant="ghost" size="sm" onClick={() => confirmEditSalario(cargo.id, sal.id)} className="h-7 w-7 p-0 text-emerald-600">
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingSalarioId(null)} className="h-7 w-7 p-0">
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium tabular-nums">R$ {sal.valor}</span>
                                        {sal.dataBase && (
                                          <Badge variant="outline" className="text-[10px]">
                                            {new Date(sal.dataBase + "T00:00:00").toLocaleDateString("pt-BR")}
                                          </Badge>
                                        )}
                                        {sal.id === getSalarioAtual(cargo.salarios)?.id && (
                                          <Badge variant="default" className="text-[9px]">Atual</Badge>
                                        )}
                                      </div>
                                      <div className="flex gap-1">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => startEditSalario(sal)} className="h-7" title="Editar">
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => deleteSalario(cargo.id, sal.id)} className="text-destructive hover:text-destructive h-7">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Anexos */}
                        <div className="mt-4 ml-4 border-l-2 border-muted pl-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            {`Anexos (${(cargo.anexos || []).length}/${MAX_ANEXOS})`}
                          </h4>
                          {(cargo.anexos || []).length < MAX_ANEXOS && (
                            <div className="mb-3">
                              <input
                                type="file"
                                accept={ACCEPTED_TYPES}
                                className="hidden"
                                ref={(el) => { if (expandedCargoId === cargo.id) fileInputRef.current = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadAnexo(cargo.id, file);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                type="button" variant="outline" size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="gap-1 text-xs"
                              >
                                <Upload className="h-3 w-3" />
                                {uploading ? "Enviando..." : "Anexar Documento"}
                              </Button>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Word, PDF, Excel, JPG ou PNG
                              </p>
                            </div>
                          )}
                          {(!cargo.anexos || cargo.anexos.length === 0) ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum anexo.</p>
                          ) : (
                            <div className="divide-y divide-border rounded border border-border">
                              {cargo.anexos.map((anexo) => (
                                <div key={anexo.id} className="flex items-center justify-between px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs truncate">{anexo.nome}</span>
                                    <Badge variant="outline" className="text-[9px] shrink-0">{anexo.tipo.toUpperCase()}</Badge>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button type="button" variant="ghost" size="sm" asChild className="h-7">
                                      <a href={anexo.url} target="_blank" rel="noopener noreferrer" title="Abrir">
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteAnexo(cargo.id, anexo)} className="text-destructive hover:text-destructive h-7">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* NRs Necessárias */}
                        <div className="mt-4 ml-4 border-l-2 border-muted pl-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            NRs Necessárias ({(cargo.nrs || []).length})
                          </h4>
                          <div className="flex gap-2 mb-3">
                            <Input
                              placeholder="NR (ex: NR-10, NR-35)"
                              value={novoNrNumero[cargo.id] || ""}
                              onChange={(e) => setNovoNrNumero((prev) => ({ ...prev, [cargo.id]: e.target.value }))}
                              className="w-32 h-8 text-sm"
                            />
                            <Input
                              placeholder="Descrição / Características"
                              value={novoNrDescricao[cargo.id] || ""}
                              onChange={(e) => setNovoNrDescricao((prev) => ({ ...prev, [cargo.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNr(cargo.id); } }}
                              className="flex-1 h-8 text-sm"
                            />
                            <Button type="button" size="sm" onClick={() => addNr(cargo.id)} className="gap-1 shrink-0 h-8 text-xs">
                              <Plus className="h-3 w-3" /> Adicionar
                            </Button>
                            <input
                              type="file"
                              accept=".txt,.xlsx,.xls"
                              className="hidden"
                              ref={(el) => { nrFileInputRefs.current[cargo.id] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) importNrs(cargo.id, file);
                                e.target.value = "";
                              }}
                            />
                            <Button
                              type="button" variant="outline" size="sm"
                              onClick={() => nrFileInputRefs.current[cargo.id]?.click()}
                              className="gap-1 shrink-0 h-8 text-xs"
                              title="Importar NRs de arquivo TXT ou Excel (coluna 1: NR, coluna 2: descrição)"
                            >
                              <Upload className="h-3 w-3" /> Importar
                            </Button>
                          </div>
                          {(!cargo.nrs || cargo.nrs.length === 0) ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhuma NR cadastrada.</p>
                          ) : (
                            <div className="divide-y divide-border rounded border border-border">
                              {cargo.nrs.map((nr) => (
                                <div key={nr.id} className="flex items-center justify-between px-3 py-2">
                                  {editingNrId === nr.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <Input
                                        value={editingNrNumero}
                                        onChange={(e) => setEditingNrNumero(e.target.value)}
                                        className="h-7 text-sm w-28"
                                        autoFocus
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmEditNr(cargo.id, nr.id); } if (e.key === "Escape") setEditingNrId(null); }}
                                      />
                                      <Input
                                        value={editingNrDescricao}
                                        onChange={(e) => setEditingNrDescricao(e.target.value)}
                                        className="h-7 text-sm flex-1"
                                        placeholder="Descrição"
                                      />
                                      <Button type="button" variant="ghost" size="sm" onClick={() => confirmEditNr(cargo.id, nr.id)} className="h-7 w-7 p-0 text-emerald-600">
                                        <Check className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingNrId(null)} className="h-7 w-7 p-0">
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Badge variant="default" className="text-[10px] shrink-0">{nr.numero}</Badge>
                                        <span className="text-xs text-muted-foreground truncate">{nr.descricao || "—"}</span>
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => startEditNr(nr)} className="h-7" title="Editar">
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => deleteNr(cargo.id, nr.id)} className="text-destructive hover:text-destructive h-7">
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* EPIs Padrão */}
                        <div className="mt-4 ml-4 border-l-2 border-muted pl-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            EPIs Necessários ({(cargo.episPadrao || []).length})
                          </h4>
                          <div className="flex gap-2 mb-3">
                            <Select
                              value={novoEpiCatalogoId[cargo.id] || undefined}
                              onValueChange={(v) => setNovoEpiCatalogoId((p) => ({ ...p, [cargo.id]: v }))}
                            >
                              <SelectTrigger className="flex-1 h-8 text-sm">
                                <SelectValue placeholder={catalogoEpis.length === 0 ? "Cadastre EPIs em Catálogo de EPIs" : "Selecione um EPI do catálogo"} />
                              </SelectTrigger>
                              <SelectContent>
                                {catalogoEpis.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.descricao}{e.ca ? ` (CA ${e.ca})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number" min={1}
                              placeholder="Qtd"
                              value={novoEpiQtd[cargo.id] || ""}
                              onChange={(e) => setNovoEpiQtd((p) => ({ ...p, [cargo.id]: e.target.value }))}
                              className="w-20 h-8 text-sm"
                            />
                            <Button type="button" size="sm" onClick={() => addEpiPadrao(cargo.id)} className="gap-1 shrink-0 h-8 text-xs">
                              <Plus className="h-3 w-3" /> Adicionar
                            </Button>
                          </div>
                          {(!cargo.episPadrao || cargo.episPadrao.length === 0) ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum EPI vinculado a este cargo.</p>
                          ) : (
                            <div className="divide-y divide-border rounded border border-border">
                              {cargo.episPadrao.map((epi) => (
                                <div key={epi.id} className="flex items-center justify-between px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Badge variant="default" className="text-[10px] shrink-0">{String(epi.quantidade).padStart(2, "0")}</Badge>
                                    <span className="text-xs font-medium truncate">{epi.descricao}</span>
                                    {epi.ca && <Badge variant="outline" className="text-[9px] shrink-0">CA {epi.ca}</Badge>}
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => deleteEpiPadrao(cargo.id, epi.id)} className="text-destructive hover:text-destructive h-7">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>

                    )}
                  </div>
                );
              })}
            </div>
           )}
          <PaginationControls currentPage={page} totalItems={filteredCargos.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      </div>
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
};

export default Cargos;
