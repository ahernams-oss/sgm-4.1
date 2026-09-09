import { useState, useCallback, useRef } from "react";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";
import { Plus, Trash2, X, ChevronDown, ChevronUp, Upload, Pencil, Check, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LocalCliente, Pavimento, Setor } from "@/contexts/ClientesContext";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";

import type * as XLSXTypes from "xlsx";
const getXLSX = async () => await import("xlsx");

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const emptyLocal: Omit<LocalCliente, "id"> = {
  descricao: "", cep: "", bairro: "", logradouro: "", numero: "", complemento: "",
  uf: "", cidade: "", latitude: "", longitude: "", areaTotal: "", areaConstruida: "",
  contato: "", telContato: "", relLinha1: "", relLinha2: "", relLinha3: "", relLinha4: "",
  pavimentos: [],
};

interface LocaisSectionProps {
  locais: LocalCliente[];
  onChange: (locais: LocalCliente[]) => void;
}

export default function LocaisSection({ locais, onChange }: LocaisSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLocal, setNewLocal] = useState<Omit<LocalCliente, "id">>(emptyLocal);
  const [novoPavimento, setNovoPavimento] = useState<Record<string, string>>({});
  const [novoSetor, setNovoSetor] = useState<Record<string, string>>({});
  const emptySetorExtras = { ocupantesFixos: "", ocupantesFlutuantes: "", largura: "", comprimento: "", altura: "", critico: false };
  const [novoSetorExtras, setNovoSetorExtras] = useState<Record<string, typeof emptySetorExtras>>({});
  const [expandedPavId, setExpandedPavId] = useState<string | null>(null);
  const [editingPavId, setEditingPavId] = useState<string | null>(null);
  const [editingPavDesc, setEditingPavDesc] = useState("");
  const [editingSetorId, setEditingSetorId] = useState<string | null>(null);
  const [editingSetorDesc, setEditingSetorDesc] = useState("");
  const [editingSetorExtras, setEditingSetorExtras] = useState<typeof emptySetorExtras>(emptySetorExtras);
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const handleDelete = (id: string) => {
    onChange(locais.filter((l) => l.id !== id));
    toast.success("Local removido.");
  };
  const handleConfirmDelete = () => { if (deleteId) handleDelete(deleteId); };

  const updateField = (field: keyof Omit<LocalCliente, "id">, value: string) =>
    setNewLocal((prev) => ({ ...prev, [field]: value }));

  const buscarCep = useCallback(async (cep: string, setter: (field: string, value: string) => void) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado."); return; }
      setter("logradouro", data.logradouro || "");
      setter("bairro", data.bairro || "");
      setter("cidade", data.localidade || "");
      setter("uf", data.uf || "");
    } catch { toast.error("Erro ao buscar CEP."); }
  }, []);

  const handleAdd = () => {
    if (!newLocal.descricao.trim()) { toast.error("Informe a descrição do local."); return; }
    const local: LocalCliente = { id: crypto.randomUUID(), ...newLocal };
    onChange([...locais, local]);
    setNewLocal(emptyLocal);
    setAdding(false);
    toast.success("Local adicionado!");
  };


  const handleUpdateLocal = (id: string, field: keyof Omit<LocalCliente, "id">, value: string) => {
    onChange(locais.map((l) => l.id === id ? { ...l, [field]: value } : l));
  };

  const addPavimento = (localId: string) => {
    const desc = (novoPavimento[localId] || "").trim();
    if (!desc) { toast.error("Informe o nome do pavimento."); return; }
    const pav: Pavimento = { id: crypto.randomUUID(), descricao: desc, ativo: true, setores: [] };
    onChange(locais.map((l) => l.id === localId ? { ...l, pavimentos: [...(l.pavimentos || []), pav] } : l));
    setNovoPavimento((prev) => ({ ...prev, [localId]: "" }));
    toast.success("Pavimento adicionado!");
  };

  const deletePavimento = (localId: string, pavId: string) => {
    onChange(locais.map((l) => l.id === localId ? { ...l, pavimentos: (l.pavimentos || []).filter((p) => p.id !== pavId) } : l));
    toast.success("Pavimento removido.");
  };

  const togglePavimento = (localId: string, pavId: string) => {
    onChange(locais.map((l) => l.id === localId ? {
      ...l, pavimentos: (l.pavimentos || []).map((p) => p.id === pavId ? { ...p, ativo: !p.ativo } : p)
    } : l));
  };

  const updatePavimentos = (localId: string, updater: (pavs: Pavimento[]) => Pavimento[]) => {
    onChange(locais.map((l) => l.id === localId ? { ...l, pavimentos: updater(l.pavimentos || []) } : l));
  };

  const addSetor = (localId: string, pavId: string) => {
    const desc = (novoSetor[pavId] || "").trim();
    if (!desc) { toast.error("Informe o nome do setor."); return; }
    const extras = novoSetorExtras[pavId] || emptySetorExtras;
    const setor: Setor = { id: crypto.randomUUID(), descricao: desc, ativo: true, ...extras };
    updatePavimentos(localId, (pavs) => pavs.map((p) => p.id === pavId ? { ...p, setores: [...(p.setores || []), setor] } : p));
    setNovoSetor((prev) => ({ ...prev, [pavId]: "" }));
    setNovoSetorExtras((prev) => ({ ...prev, [pavId]: emptySetorExtras }));
    toast.success("Setor adicionado!");
  };

  const deleteSetor = (localId: string, pavId: string, setorId: string) => {
    updatePavimentos(localId, (pavs) => pavs.map((p) => p.id === pavId ? { ...p, setores: (p.setores || []).filter((s) => s.id !== setorId) } : p));
    toast.success("Setor removido.");
  };

  const toggleSetor = (localId: string, pavId: string, setorId: string) => {
    updatePavimentos(localId, (pavs) => pavs.map((p) => p.id === pavId ? { ...p, setores: (p.setores || []).map((s) => s.id === setorId ? { ...s, ativo: !s.ativo } : s) } : p));
  };

  const startEditPavimento = (pav: Pavimento) => {
    setEditingPavId(pav.id);
    setEditingPavDesc(pav.descricao);
  };

  const confirmEditPavimento = (localId: string, pavId: string) => {
    if (!editingPavDesc.trim()) { toast.error("Informe o nome do pavimento."); return; }
    updatePavimentos(localId, (pavs) => pavs.map((p) => p.id === pavId ? { ...p, descricao: editingPavDesc.trim() } : p));
    setEditingPavId(null);
    toast.success("Pavimento atualizado!");
  };

  const startEditSetor = (setor: Setor) => {
    setEditingSetorId(setor.id);
    setEditingSetorDesc(setor.descricao);
    setEditingSetorExtras({
      ocupantesFixos: setor.ocupantesFixos || "",
      ocupantesFlutuantes: setor.ocupantesFlutuantes || "",
      largura: setor.largura || "",
      comprimento: setor.comprimento || "",
      altura: setor.altura || "",
      critico: setor.critico || false,
    });
  };

  const confirmEditSetor = (localId: string, pavId: string, setorId: string) => {
    if (!editingSetorDesc.trim()) { toast.error("Informe o nome do setor."); return; }
    updatePavimentos(localId, (pavs) => pavs.map((p) => p.id === pavId ? { ...p, setores: (p.setores || []).map((s) => s.id === setorId ? { ...s, descricao: editingSetorDesc.trim(), ...editingSetorExtras } : s) } : p));
    setEditingSetorId(null);
    toast.success("Setor atualizado!");
  };

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const importSetores = (localId: string, pavId: string, file: File) => {
    const reader = new FileReader();
    const isExcel = /\.(xlsx?|xls)$/i.test(file.name);

    const parseNames = (values: string[]) => {
      const names = values
        .map((v) => String(v || "").trim())
        .filter((v, i) => {
          if (!v) return false;
          // Pula linha de cabeçalho comuns
          const lower = v.toLowerCase();
          if (i === 0 && ["setor", "nome", "nome_do_setor", "descrição", "descricao"].includes(lower)) return false;
          return true;
        });
      return names;
    };

    if (isExcel) {
      reader.onload = async (e) => {
        try {
          const wb = (await getXLSX()).read(e.target?.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: string[][] = (await getXLSX()).utils.sheet_to_json(ws, { header: 1 });
          const names = parseNames(rows.flat());
          if (names.length === 0) { toast.error("Nenhum setor encontrado no arquivo."); return; }
          const newSetores: Setor[] = names.map((n) => ({ id: crypto.randomUUID(), descricao: n, ativo: true }));
          updatePavimentos(localId, (pavs) => pavs.map((p) => p.id === pavId ? { ...p, setores: [...(p.setores || []), ...newSetores] } : p));
          toast.success(`${newSetores.length} setor(es) importado(s)!`);
        } catch { toast.error("Erro ao ler o arquivo Excel."); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/);
        const names = parseNames(lines);
        if (names.length === 0) { toast.error("Nenhum setor encontrado no arquivo."); return; }
        const newSetores: Setor[] = names.map((n) => ({ id: crypto.randomUUID(), descricao: n, ativo: true }));
        updatePavimentos(localId, (pavs) => pavs.map((p) => p.id === pavId ? { ...p, setores: [...(p.setores || []), ...newSetores] } : p));
        toast.success(`${newSetores.length} setor(es) importado(s)!`);
      };
      reader.readAsText(file);
    }
  };

  const downloadTemplate = async () => {
    const ws = (await getXLSX()).utils.aoa_to_sheet([
      ["Setor"],
      ["Recepção"],
      ["Sala 101"],
      ["Sala 102"],
      ["Copa"],
      ["Banheiro"],
    ]);
    ws["!cols"] = [{ wch: 30 }];
    const wb = (await getXLSX()).utils.book_new();
    (await getXLSX()).utils.book_append_sheet(wb, ws, "Modelo Setores");
    (await getXLSX()).writeFile(wb, "modelo_setores.xlsx", { compression: true });
    toast.success("Modelo de importação baixado!");
  };

  const renderFields = (
    data: Omit<LocalCliente, "id">,
    onFieldChange: (field: keyof Omit<LocalCliente, "id">, value: string) => void,
    onCepBlur: () => void
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      <div className="md:col-span-2">
        <label className="field-label">Descrição *</label>
        <Input value={data.descricao} onChange={(e) => onFieldChange("descricao", e.target.value)} placeholder="Ex: Sede, Filial Centro" />
      </div>
      <div>
        <label className="field-label">CEP</label>
        <Input value={data.cep} onChange={(e) => onFieldChange("cep", e.target.value)} onBlur={onCepBlur} placeholder="00000-000" />
      </div>
      <div>
        <label className="field-label">Logradouro</label>
        <Input value={data.logradouro} onChange={(e) => onFieldChange("logradouro", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Nº</label>
        <Input value={data.numero} onChange={(e) => onFieldChange("numero", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Complemento</label>
        <Input value={data.complemento} onChange={(e) => onFieldChange("complemento", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Bairro</label>
        <Input value={data.bairro} onChange={(e) => onFieldChange("bairro", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Cidade</label>
        <Input value={data.cidade} onChange={(e) => onFieldChange("cidade", e.target.value)} />
      </div>
      <div>
        <label className="field-label">UF</label>
        <Select value={data.uf} onValueChange={(v) => onFieldChange("uf", v)}>
          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>{UF_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <label className="field-label">Latitude</label>
        <Input value={data.latitude} onChange={(e) => onFieldChange("latitude", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Longitude</label>
        <Input value={data.longitude} onChange={(e) => onFieldChange("longitude", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Área Total (m²)</label>
        <Input value={data.areaTotal} onChange={(e) => onFieldChange("areaTotal", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Área Construída (m²)</label>
        <Input value={data.areaConstruida} onChange={(e) => onFieldChange("areaConstruida", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Contato</label>
        <Input value={data.contato} onChange={(e) => onFieldChange("contato", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Tel. Contato</label>
        <Input value={data.telContato} onChange={(e) => onFieldChange("telContato", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Rel. Linha 1</label>
        <Input value={data.relLinha1} onChange={(e) => onFieldChange("relLinha1", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Rel. Linha 2</label>
        <Input value={data.relLinha2} onChange={(e) => onFieldChange("relLinha2", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Rel. Linha 3</label>
        <Input value={data.relLinha3} onChange={(e) => onFieldChange("relLinha3", e.target.value)} />
      </div>
      <div>
        <label className="field-label">Rel. Linha 4</label>
        <Input value={data.relLinha4} onChange={(e) => onFieldChange("relLinha4", e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="section-card animate-fade-up mb-6" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">Locais do Cliente</h2>
        {!adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar Local
          </Button>
        )}
      </div>

      {adding && (
        <div className="border border-border rounded-lg p-4 mb-4 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Novo Local</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setNewLocal(emptyLocal); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {renderFields(newLocal, updateField, () => buscarCep(newLocal.cep, updateField))}
          <div className="mt-4">
            <Button type="button" size="sm" onClick={handleAdd} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Salvar Local
            </Button>
          </div>
        </div>
      )}

      {locais.length === 0 && !adding ? (
        <p className="text-center text-sm text-muted-foreground py-6">Nenhum local cadastrado.</p>
      ) : (
        <div className="divide-y divide-border">
          {locais.map((local) => (
            <div key={local.id} className="py-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  onClick={() => setExpandedId(expandedId === local.id ? null : local.id)}
                >
                  {expandedId === local.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {local.descricao}
                  {local.cidade && <span className="text-muted-foreground font-normal text-xs">— {local.cidade}/{local.uf}</span>}
                </button>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === local.id ? null : local.id)} title="Editar local">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => requestDelete(local.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {expandedId === local.id && (
                <>
                  {renderFields(
                    local,
                    (field, value) => handleUpdateLocal(local.id, field, value),
                    () => buscarCep(local.cep, (field, value) => handleUpdateLocal(local.id, field as keyof Omit<LocalCliente, "id">, value))
                  )}

                  {/* Pavimentos */}
                  <div className="mt-6 border-t border-border pt-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pavimentos</h4>
                    
                    <div className="flex gap-2 mb-3">
                      <Input
                        placeholder="Nome do pavimento (ex: Térreo, 1º Andar)"
                        value={novoPavimento[local.id] || ""}
                        onChange={(e) => setNovoPavimento((prev) => ({ ...prev, [local.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPavimento(local.id); } }}
                        className="flex-1"
                      />
                      <Button type="button" size="sm" onClick={() => addPavimento(local.id)} className="gap-1 shrink-0">
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </Button>
                    </div>

                    {(!local.pavimentos || local.pavimentos.length === 0) ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhum pavimento cadastrado.</p>
                    ) : (
                      <div className="divide-y divide-border rounded-lg border border-border">
                        {local.pavimentos.map((pav) => (
                          <div key={pav.id}>
                            <div className="flex items-center justify-between px-3 py-2">
                              <div className="flex items-center gap-2">
                                {editingPavId === pav.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editingPavDesc}
                                      onChange={(e) => setEditingPavDesc(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmEditPavimento(local.id, pav.id); } if (e.key === "Escape") setEditingPavId(null); }}
                                      className="h-7 text-sm w-48"
                                      autoFocus
                                    />
                                    <Button type="button" variant="ghost" size="sm" onClick={() => confirmEditPavimento(local.id, pav.id)} className="h-7 w-7 p-0 text-emerald-600">
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPavId(null)} className="h-7 w-7 p-0">
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
                                    onClick={() => setExpandedPavId(expandedPavId === pav.id ? null : pav.id)}
                                  >
                                    {expandedPavId === pav.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    <span className={pav.ativo ? "text-foreground" : "text-muted-foreground line-through"}>
                                      {pav.descricao}
                                    </span>
                                  </button>
                                )}
                                <Badge variant={pav.ativo ? "default" : "secondary"} className="text-[10px]">
                                  {pav.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                                {(pav.setores?.length || 0) > 0 && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Layers className="h-3 w-3" /> {pav.setores.length}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="sm" onClick={() => startEditPavimento(pav)} className="text-xs" title="Editar pavimento">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button" variant="ghost" size="sm"
                                  onClick={() => togglePavimento(local.id, pav.id)}
                                  className={pav.ativo ? "text-destructive hover:text-destructive text-xs" : "text-emerald-600 hover:text-emerald-700 text-xs"}
                                >
                                  {pav.ativo ? "Desativar" : "Ativar"}
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => deletePavimento(local.id, pav.id)} className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Setores do pavimento */}
                            {expandedPavId === pav.id && (
                              <div className="px-4 pb-3 ml-4 border-l-2 border-muted">
                                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <Layers className="h-3 w-3" /> Setores
                                </h5>
                                <div className="flex gap-2 mb-2">
                                  <Input
                                    placeholder="Nome do setor (ex: Recepção, Sala 101)"
                                    value={novoSetor[pav.id] || ""}
                                    onChange={(e) => setNovoSetor((prev) => ({ ...prev, [pav.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSetor(local.id, pav.id); } }}
                                    className="flex-1 h-8 text-sm"
                                  />
                                  <div className="flex items-center gap-2 shrink-0 border rounded-md px-2 h-8 bg-background">
                                    <Checkbox
                                      id={`critico-novo-${pav.id}`}
                                      checked={(novoSetorExtras[pav.id] || emptySetorExtras).critico}
                                      onCheckedChange={(checked) => setNovoSetorExtras((prev) => ({
                                        ...prev,
                                        [pav.id]: { ...(prev[pav.id] || emptySetorExtras), critico: checked === true },
                                      }))}
                                    />
                                    <Label htmlFor={`critico-novo-${pav.id}`} className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">Crítico</Label>
                                  </div>
                                  <Button type="button" size="sm" onClick={() => addSetor(local.id, pav.id)} className="gap-1 shrink-0 h-8 text-xs">
                                    <Plus className="h-3 w-3" /> Adicionar
                                  </Button>
                                  <input
                                    type="file"
                                    accept=".txt,.xlsx,.xls"
                                    className="hidden"
                                    ref={(el) => { fileInputRefs.current[pav.id] = el; }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) importSetores(local.id, pav.id, file);
                                      e.target.value = "";
                                    }}
                                  />
                                  <Button
                                    type="button" variant="outline" size="sm"
                                    onClick={downloadTemplate}
                                    className="gap-1 shrink-0 h-8 text-xs"
                                    title="Baixar modelo de importação"
                                  >
                                    <FileSpreadsheet className="h-3 w-3" /> Modelo
                                  </Button>
                                  <Button
                                    type="button" variant="outline" size="sm"
                                    onClick={() => fileInputRefs.current[pav.id]?.click()}
                                    className="gap-1 shrink-0 h-8 text-xs"
                                    title="Importar setores de arquivo TXT ou Excel"
                                  >
                                    <Upload className="h-3 w-3" /> Importar
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                                  {([
                                    ["ocupantesFixos", "Ocupantes Fixos"],
                                    ["ocupantesFlutuantes", "Ocupantes Flutuantes"],
                                    ["largura", "Largura (m)"],
                                    ["comprimento", "Comprimento (m)"],
                                    ["altura", "Altura (m)"],
                                  ] as const).map(([field, label]) => (
                                    <div key={field} className="space-y-0.5">
                                      <Label className="text-[10px] text-muted-foreground">{label}</Label>
                                      <Input
                                        type="number" min="0" step="any"
                                        placeholder={label}
                                        value={(novoSetorExtras[pav.id] || emptySetorExtras)[field]}
                                        onChange={(e) => setNovoSetorExtras((prev) => ({
                                          ...prev,
                                          [pav.id]: { ...(prev[pav.id] || emptySetorExtras), [field]: e.target.value },
                                        }))}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                  ))}
                                </div>
                                {(!pav.setores || pav.setores.length === 0) ? (
                                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum setor cadastrado.</p>
                                ) : (
                                  <div className="divide-y divide-border rounded border border-border">
                                    {pav.setores.map((setor) => (
                                      <div key={setor.id} className="flex items-center justify-between px-2 py-1.5">
                                        <div className="flex items-center gap-2">
                                          {editingSetorId === setor.id ? (
                                            <div className="flex-1 space-y-1.5">
                                              <div className="flex items-center gap-1">
                                                <Input
                                                  value={editingSetorDesc}
                                                  onChange={(e) => setEditingSetorDesc(e.target.value)}
                                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmEditSetor(local.id, pav.id, setor.id); } if (e.key === "Escape") setEditingSetorId(null); }}
                                                  className="h-6 text-xs w-40"
                                                  autoFocus
                                                />
                                                <div className="flex items-center gap-1.5 border rounded-md px-1.5 h-6 bg-background">
                                                  <Checkbox
                                                    id={`critico-edit-${setor.id}`}
                                                    checked={editingSetorExtras.critico}
                                                    onCheckedChange={(checked) => setEditingSetorExtras((prev) => ({ ...prev, critico: checked === true }))}
                                                  />
                                                  <Label htmlFor={`critico-edit-${setor.id}`} className="text-[10px] text-muted-foreground cursor-pointer whitespace-nowrap">Crítico</Label>
                                                </div>
                                                <Button type="button" variant="ghost" size="sm" onClick={() => confirmEditSetor(local.id, pav.id, setor.id)} className="h-6 w-6 p-0 text-emerald-600">
                                                  <Check className="h-3 w-3" />
                                                </Button>
                                                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingSetorId(null)} className="h-6 w-6 p-0">
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                              <div className="grid grid-cols-2 md:grid-cols-5 gap-1 items-center">
                                                {([
                                                  ["ocupantesFixos", "Ocupantes Fixos"],
                                                  ["ocupantesFlutuantes", "Ocupantes Flutuantes"],
                                                  ["largura", "Largura (m)"],
                                                  ["comprimento", "Comprimento (m)"],
                                                  ["altura", "Altura (m)"],
                                                ] as const).map(([field, label]) => (
                                                  <Input
                                                    key={field} type="number" min="0" step="any"
                                                    placeholder={label} title={label}
                                                    value={editingSetorExtras[field]}
                                                    onChange={(e) => setEditingSetorExtras((prev) => ({ ...prev, [field]: e.target.value }))}
                                                    className="h-6 text-xs"
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className={`text-xs ${setor.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                              {setor.descricao}
                                            </span>
                                          )}
                                          {setor.critico && (
                                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                                              Crítico
                                            </Badge>
                                          )}
                                          <Badge variant={setor.ativo ? "default" : "secondary"} className="text-[9px] px-1.5 py-0">
                                            {setor.ativo ? "Ativo" : "Inativo"}
                                          </Badge>
                                        </div>
                                        <div className="flex gap-1">
                                          <Button type="button" variant="ghost" size="sm" onClick={() => startEditSetor(setor)} className="h-6" title="Editar setor">
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            type="button" variant="ghost" size="sm"
                                            onClick={() => toggleSetor(local.id, pav.id, setor.id)}
                                            className={`h-6 text-[10px] ${setor.ativo ? "text-destructive hover:text-destructive" : "text-emerald-600 hover:text-emerald-700"}`}
                                          >
                                            {setor.ativo ? "Desativar" : "Ativar"}
                                          </Button>
                                          <Button type="button" variant="ghost" size="sm" onClick={() => deleteSetor(local.id, pav.id, setor.id)} className="text-destructive hover:text-destructive h-6">
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <DoubleConfirmDelete open={!!deleteId} onOpenChange={(open) => !open && cancelDelete()} onConfirm={handleConfirmDelete} />
    </div>
  );
}
