import { useState, useMemo } from "react";
import { useEvidencias, Evidencia } from "@/contexts/EvidenciasContext";
import { useClientes } from "@/contexts/ClientesContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Edit, Trash2, FileText, Upload, Download, Eye, X, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls from "@/components/PaginationControls";
import { usePermissao } from "@/hooks/usePermissao";
import { toast } from "sonner";

const TIPOS = ["Operacional", "Qualidade", "Inspeção", "Treinamento", "Auditoria"];
const STATUS_LIST = ["Pendente", "Em Análise", "Aprovada", "Reprovada", "Em Revisão", "Encerrada"];

const statusColor = (s: string) => {
  switch (s) {
    case "Aprovada": return "bg-green-100 text-green-800 border-green-300";
    case "Pendente": return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "Em Análise": return "bg-blue-100 text-blue-800 border-blue-300";
    case "Reprovada": return "bg-red-100 text-red-800 border-red-300";
    case "Em Revisão": return "bg-orange-100 text-orange-800 border-orange-300";
    case "Encerrada": return "bg-gray-100 text-gray-800 border-gray-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const emptyForm = (): Partial<Evidencia> => ({
  titulo: "",
  descricao: "",
  tipo: "Operacional",
  processo_vinculado: "",
  centro_custo_id: "",
  centro_custo_nome: "",
  setor: "",
  data_fato_gerador: new Date().toISOString(),
  responsavel_registro: "",
  status: "Pendente",
  observacoes: "",
  palavras_chave: "",
  anexos: [],
  historico: [],
});

export default function EvidenciasPage() {
  const { evidencias, loading, addEvidencia, updateEvidencia, deleteEvidencia, uploadAnexo } = useEvidencias();
  const { clientes } = useClientes();
  const { usuarioLogado } = useAuth();

  const { tem } = usePermissao();
  const podeCriar = tem("evidencias.criar");
  const podeEditar = tem("evidencias.editar");
  const podeExcluir = tem("evidencias.excluir");
  const podeAnexos = tem("evidencias.gerenciar_anexos");

  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evidencia | null>(null);
  const [viewing, setViewing] = useState<Evidencia | null>(null);
  const [form, setForm] = useState<Partial<Evidencia>>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const centrosCusto = useMemo(() => clientes.filter((c) => c.tipo === "Cliente"), [clientes]);

  const filtered = useMemo(() => {
    return evidencias.filter((e) => {
      const matchSearch =
        !search ||
        e.titulo.toLowerCase().includes(search.toLowerCase()) ||
        e.descricao?.toLowerCase().includes(search.toLowerCase()) ||
        e.palavras_chave?.toLowerCase().includes(search.toLowerCase()) ||
        String(e.numero).includes(search);
      const matchTipo = filterTipo === "Todos" || e.tipo === filterTipo;
      const matchStatus = filterStatus === "Todos" || e.status === filterStatus;
      return matchSearch && matchTipo && matchStatus;
    });
  }, [evidencias, search, filterTipo, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleOpen = (ev?: Evidencia) => {
    if (ev) {
      setEditing(ev);
      setForm({ ...ev });
    } else {
      setEditing(null);
      setForm({ ...emptyForm(), responsavel_registro: usuarioLogado?.nome || "" });
    }
    setDialogOpen(true);
  };

  const handleView = (ev: Evidencia) => {
    setViewing(ev);
    setViewDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!form.titulo?.trim()) {
      return;
    }

    const now = new Date().toISOString();
    const historicoEntry = {
      acao: editing ? "Alteração" : "Criação",
      usuario: usuarioLogado?.nome || "Sistema",
      data: now,
      detalhes: editing ? "Registro atualizado" : "Registro criado",
    };

    const historico = [...(form.historico || []), historicoEntry];

    if (editing) {
      await updateEvidencia(editing.id, { ...form, historico });
    } else {
      await addEvidencia({ ...form, data_registro: now, historico });
    }
    setDialogOpen(false);
    setForm(emptyForm());
    setEditing(null);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!podeAnexos) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!files || !editing) return;
    setUploading(true);
    const newAnexos = [...(form.anexos || [])];

    for (const file of Array.from(files)) {
      const url = await uploadAnexo(file, editing.id);
      if (url) {
        newAnexos.push({
          nome: file.name,
          url,
          tipo: file.type,
          tamanho: file.size,
          data_upload: new Date().toISOString(),
          usuario: usuarioLogado?.nome || "",
        });
      }
    }

    setForm((prev) => ({ ...prev, anexos: newAnexos }));
    setUploading(false);
  };

  const removeAnexo = (index: number) => {
    const newAnexos = [...(form.anexos || [])];
    newAnexos.splice(index, 1);
    setForm((prev) => ({ ...prev, anexos: newAnexos }));
  };

  const handleStatusChange = async (ev: Evidencia, newStatus: string) => {
    if (!podeEditar) { toast.error("Você não possui permissão para esta ação."); return; }
    const historicoEntry = {
      acao: "Alteração de Status",
      usuario: usuarioLogado?.nome || "Sistema",
      data: new Date().toISOString(),
      detalhes: `Status alterado de "${ev.status}" para "${newStatus}"`,
    };
    await updateEvidencia(ev.id, {
      status: newStatus,
      historico: [...(ev.historico || []), historicoEntry],
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro de Evidências</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro, rastreabilidade e controle de evidências documentais e operacionais
          </p>
        </div>
        {podeCriar && (
          <Button onClick={() => handleOpen()} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Evidência
          </Button>
        )}
      </div>

      {/* Resumo cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {STATUS_LIST.map((s) => {
          const count = evidencias.filter((e) => e.status === s).length;
          return (
            <Card key={s} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setFilterStatus(s); setPage(1); }}>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{s}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descrição, palavras-chave ou número..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os Tipos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os Status</SelectItem>
            {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">Nº</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Data Fato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Anexos</TableHead>
              <TableHead className="w-[130px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma evidência encontrada.</TableCell></TableRow>
            ) : (
              paginated.map((ev) => (
                <TableRow key={ev.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono font-bold">{ev.numero}</TableCell>
                  <TableCell className="font-medium max-w-[250px] truncate">{ev.titulo}</TableCell>
                  <TableCell><Badge variant="outline">{ev.tipo}</Badge></TableCell>
                  <TableCell className="text-sm">{ev.centro_custo_nome || "—"}</TableCell>
                  <TableCell className="text-sm">{ev.responsavel_registro || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {ev.data_fato_gerador ? format(new Date(ev.data_fato_gerador), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(ev.status)}>{ev.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {(ev.anexos || []).length > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <FileText className="h-3 w-3" /> {ev.anexos.length}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleView(ev)} title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {podeEditar && <Button size="icon" variant="ghost" onClick={() => handleOpen(ev)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>}
                      {podeExcluir && <Button size="icon" variant="ghost" onClick={() => setDeleteId(ev.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        onConfirm={() => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); setDeleteId(null); return; } if (deleteId) deleteEvidencia(deleteId); setDeleteId(null); }}
      />

      {/* Dialog cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Evidência" : "Nova Evidência"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Título *</Label>
                <Input value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título da evidência" />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao || ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição detalhada..." rows={3} />
              </div>
              <div>
                <Label>Tipo/Categoria</Label>
                <Select value={form.tipo || "Operacional"} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status || "Pendente"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select
                  value={form.centro_custo_id || "none"}
                  onValueChange={(v) => {
                    const cc = centrosCusto.find((c) => c.id === v);
                    setForm({ ...form, centro_custo_id: v === "none" ? "" : v, centro_custo_nome: cc?.nome || "" });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {centrosCusto.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor/Departamento</Label>
                <Input value={form.setor || ""} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Ex: Engenharia, Qualidade..." />
              </div>
              <div>
                <Label>Processo Vinculado</Label>
                <Input value={form.processo_vinculado || ""} onChange={(e) => setForm({ ...form, processo_vinculado: e.target.value })} placeholder="Ex: OS-001, Contrato XYZ..." />
              </div>
              <div>
                <Label>Data do Fato Gerador</Label>
                <Input
                  type="datetime-local"
                  value={form.data_fato_gerador ? format(new Date(form.data_fato_gerador), "yyyy-MM-dd'T'HH:mm") : ""}
                  onChange={(e) => setForm({ ...form, data_fato_gerador: new Date(e.target.value).toISOString() })}
                />
              </div>
              <div>
                <Label>Responsável pelo Registro</Label>
                <Input value={form.responsavel_registro || ""} onChange={(e) => setForm({ ...form, responsavel_registro: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Palavras-chave (separadas por vírgula)</Label>
                <Input value={form.palavras_chave || ""} onChange={(e) => setForm({ ...form, palavras_chave: e.target.value })} placeholder="Ex: inspeção, qualidade, obra-01..." />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
              </div>
            </div>

            {/* Anexos */}
            {editing && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Anexos
                </Label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    <div className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/80">
                      <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Adicionar Arquivo"}
                    </div>
                  </label>
                </div>
                {(form.anexos || []).length > 0 && (
                  <div className="space-y-1">
                    {form.anexos!.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{a.nome}</span>
                        <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          <Download className="h-4 w-4" />
                        </a>
                        <button onClick={() => removeAnexo(i)} className="text-destructive hover:text-destructive/80">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!editing && (
                  <p className="text-xs text-muted-foreground">Salve a evidência primeiro para poder anexar arquivos.</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.titulo?.trim()}>
                {editing ? "Salvar Alterações" : "Registrar Evidência"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog visualização */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evidência #{viewing?.numero} — {viewing?.titulo}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <Tabs defaultValue="detalhes">
              <TabsList>
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="anexos">Anexos ({(viewing.anexos || []).length})</TabsTrigger>
                <TabsTrigger value="historico">Histórico ({(viewing.historico || []).length})</TabsTrigger>
              </TabsList>
              <TabsContent value="detalhes" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="font-semibold">Tipo:</span> {viewing.tipo}</div>
                  <div><span className="font-semibold">Status:</span> <Badge className={statusColor(viewing.status)}>{viewing.status}</Badge></div>
                  <div><span className="font-semibold">Centro de Custo:</span> {viewing.centro_custo_nome || "—"}</div>
                  <div><span className="font-semibold">Setor:</span> {viewing.setor || "—"}</div>
                  <div><span className="font-semibold">Processo Vinculado:</span> {viewing.processo_vinculado || "—"}</div>
                  <div><span className="font-semibold">Responsável:</span> {viewing.responsavel_registro || "—"}</div>
                  <div><span className="font-semibold">Data Fato Gerador:</span> {viewing.data_fato_gerador ? format(new Date(viewing.data_fato_gerador), "dd/MM/yyyy HH:mm") : "—"}</div>
                  <div><span className="font-semibold">Data Registro:</span> {viewing.data_registro ? format(new Date(viewing.data_registro), "dd/MM/yyyy HH:mm") : "—"}</div>
                </div>
                <div>
                  <span className="font-semibold text-sm">Descrição:</span>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{viewing.descricao || "—"}</p>
                </div>
                <div>
                  <span className="font-semibold text-sm">Observações:</span>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{viewing.observacoes || "—"}</p>
                </div>
                {viewing.palavras_chave && (
                  <div>
                    <span className="font-semibold text-sm">Palavras-chave:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {viewing.palavras_chave.split(",").map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{kw.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alterar status rápido */}
                <div className="pt-3 border-t">
                  <Label className="text-sm font-semibold">Alterar Status</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {STATUS_LIST.filter((s) => s !== viewing.status).map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await handleStatusChange(viewing, s);
                          setViewing({ ...viewing, status: s });
                        }}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="anexos" className="mt-4">
                {(viewing.anexos || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum anexo registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {viewing.anexos.map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.data_upload ? format(new Date(a.data_upload), "dd/MM/yyyy HH:mm") : ""} • {a.usuario || ""}
                          </p>
                        </div>
                        <a href={a.url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="gap-1">
                            <Download className="h-3 w-3" /> Baixar
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="historico" className="mt-4">
                {(viewing.historico || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum histórico.</p>
                ) : (
                  <div className="space-y-2">
                    {[...viewing.historico].reverse().map((h: any, i: number) => (
                      <div key={i} className="flex gap-3 p-3 bg-muted rounded-lg text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{h.acao}</p>
                          <p className="text-muted-foreground">{h.detalhes}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground shrink-0">
                          <p>{h.usuario}</p>
                          <p>{h.data ? format(new Date(h.data), "dd/MM/yyyy HH:mm") : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
