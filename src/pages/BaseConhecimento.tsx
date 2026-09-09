import { useMemo, useState } from "react";
import { useKnowledgeBase, KbArtigo, KbFaq, KbAnexo } from "@/contexts/KnowledgeBaseContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEquipamentos } from "@/contexts/EquipamentosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import {
  BookOpen, Search, Plus, Edit, Trash2, Eye, Paperclip, X, FileText,
  HelpCircle, Tag, Wrench, ExternalLink, BotMessageSquare, Upload,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { usePermissao } from "@/hooks/usePermissao";

const STATUS_OPCOES = ["rascunho", "publicado", "arquivado"] as const;

function statusColor(s: string) {
  switch (s) {
    case "publicado": return "bg-green-100 text-green-800 border-green-300";
    case "rascunho": return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "arquivado": return "bg-gray-100 text-gray-800 border-gray-300";
    default: return "bg-muted";
  }
}

const emptyArtigo = (): Partial<KbArtigo> => ({
  titulo: "",
  resumo: "",
  conteudo: "",
  categoria_id: null,
  categoria_nome: "",
  tags: [],
  anexos: [],
  status: "publicado",
});

const emptyFaq = (): Partial<KbFaq> => ({
  pergunta: "",
  resposta: "",
  categoria_id: null,
  categoria_nome: "",
  tags: [],
  ordem: 0,
});

export default function BaseConhecimentoPage() {
  const {
    categorias, artigos, faqs, vinculosEquip, loading,
    addArtigo, updateArtigo, deleteArtigo, incrementarVisualizacao,
    addFaq, updateFaq, deleteFaq,
    addCategoria, deleteCategoria,
    setVinculosEquipamento, uploadAnexo,
  } = useKnowledgeBase();
  const { usuarioLogado } = useAuth();
  const { equipamentos } = useEquipamentos();
  const { tem } = usePermissao();
  const podeCriar = tem("base_conhecimento.criar_artigo") || tem("base_conhecimento.criar_faq");
  const podeEditar = tem("base_conhecimento.editar_artigo") || tem("base_conhecimento.editar_faq");
  const podeExcluir = tem("base_conhecimento.excluir_artigo") || tem("base_conhecimento.excluir_faq");
  const podeAnexar = tem("base_conhecimento.gerenciar_anexos");
  const podeCategorias = tem("base_conhecimento.gerenciar_categorias");

  const [tab, setTab] = useState<"artigos" | "faq" | "categorias">("artigos");
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("todos");

  // Artigo form
  const [artigoOpen, setArtigoOpen] = useState(false);
  const [artigoForm, setArtigoForm] = useState<Partial<KbArtigo>>(emptyArtigo());
  const [artigoEditId, setArtigoEditId] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [equipsSel, setEquipsSel] = useState<{ id: string; descricao: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  // Visualização
  const [viewArtigo, setViewArtigo] = useState<KbArtigo | null>(null);

  // FAQ form
  const [faqOpen, setFaqOpen] = useState(false);
  const [faqForm, setFaqForm] = useState<Partial<KbFaq>>(emptyFaq());
  const [faqEditId, setFaqEditId] = useState<string | null>(null);

  // Categoria form
  const [novaCat, setNovaCat] = useState({ nome: "", cor: "#673ab7", icone: "BookOpen", descricao: "" });

  // Delete confirmation
  const [delArtigo, setDelArtigo] = useState<KbArtigo | null>(null);
  const [delFaq, setDelFaq] = useState<KbFaq | null>(null);
  const [delCat, setDelCat] = useState<{ id: string; nome: string } | null>(null);

  const filteredArtigos = useMemo(() => {
    return artigos.filter((a) => {
      if (filterStatus !== "todos" && a.status !== filterStatus) return false;
      if (filterCategoria !== "todas" && a.categoria_id !== filterCategoria) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        a.titulo.toLowerCase().includes(s) ||
        a.resumo.toLowerCase().includes(s) ||
        a.conteudo.toLowerCase().includes(s) ||
        a.tags.some((t) => t.toLowerCase().includes(s)) ||
        a.categoria_nome.toLowerCase().includes(s)
      );
    });
  }, [artigos, search, filterCategoria, filterStatus]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter((f) => {
      if (filterCategoria !== "todas" && f.categoria_id !== filterCategoria) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        f.pergunta.toLowerCase().includes(s) ||
        f.resposta.toLowerCase().includes(s) ||
        f.tags.some((t) => t.toLowerCase().includes(s))
      );
    });
  }, [faqs, search, filterCategoria]);

  // ====== Handlers ======
  const openNovoArtigo = () => {
    setArtigoForm(emptyArtigo());
    setArtigoEditId(null);
    setTagsInput("");
    setEquipsSel([]);
    setArtigoOpen(true);
  };

  const openEditArtigo = (a: KbArtigo) => {
    setArtigoForm({ ...a });
    setArtigoEditId(a.id);
    setTagsInput(a.tags.join(", "));
    const vins = vinculosEquip
      .filter((v) => v.artigo_id === a.id)
      .map((v) => ({ id: v.equipamento_id, descricao: v.equipamento_descricao }));
    setEquipsSel(vins);
    setArtigoOpen(true);
  };

  const handleUploadAnexo = async (file: File) => {
    if (!podeAnexar) { toast.error("Você não possui permissão para esta ação."); return; }
    setUploading(true);
    const anexo = await uploadAnexo(file);
    setUploading(false);
    if (anexo) {
      setArtigoForm((f) => ({ ...f, anexos: [...(f.anexos ?? []), anexo] }));
      toast.success("Anexo enviado");
    }
  };

  const removerAnexo = (idx: number) => {
    setArtigoForm((f) => ({ ...f, anexos: (f.anexos ?? []).filter((_, i) => i !== idx) }));
  };

  const salvarArtigo = async () => {
    if (artigoEditId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!artigoForm.titulo?.trim()) { toast.error("Título obrigatório"); return; }
    const cat = categorias.find((c) => c.id === artigoForm.categoria_id);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      titulo: artigoForm.titulo!,
      resumo: artigoForm.resumo ?? "",
      conteudo: artigoForm.conteudo ?? "",
      categoria_id: artigoForm.categoria_id ?? null,
      categoria_nome: cat?.nome ?? "",
      tags,
      anexos: artigoForm.anexos ?? [],
      autor_email: usuarioLogado?.email ?? "",
      autor_nome: usuarioLogado?.nome ?? "",
      status: (artigoForm.status as any) ?? "publicado",
    };

    if (artigoEditId) {
      await updateArtigo(artigoEditId, payload);
      await setVinculosEquipamento(artigoEditId, equipsSel);
      toast.success("Artigo atualizado");
    } else {
      const novo = await addArtigo(payload as any);
      if (novo) await setVinculosEquipamento(novo.id, equipsSel);
      toast.success("Artigo criado");
    }
    setArtigoOpen(false);
  };

  const openNovoFaq = () => {
    setFaqForm(emptyFaq());
    setFaqEditId(null);
    setFaqOpen(true);
  };
  const openEditFaq = (f: KbFaq) => {
    setFaqForm({ ...f });
    setFaqEditId(f.id);
    setFaqOpen(true);
  };
  const salvarFaq = async () => {
    if (faqEditId ? !podeEditar : !podeCriar) { toast.error("Você não possui permissão para esta ação."); return; }
    if (!faqForm.pergunta?.trim() || !faqForm.resposta?.trim()) {
      toast.error("Pergunta e resposta são obrigatórias"); return;
    }
    const cat = categorias.find((c) => c.id === faqForm.categoria_id);
    const payload = {
      pergunta: faqForm.pergunta!,
      resposta: faqForm.resposta!,
      categoria_id: faqForm.categoria_id ?? null,
      categoria_nome: cat?.nome ?? "",
      tags: faqForm.tags ?? [],
      ordem: faqForm.ordem ?? 0,
    };
    if (faqEditId) {
      await updateFaq(faqEditId, payload);
      toast.success("FAQ atualizada");
    } else {
      await addFaq(payload as any);
      toast.success("FAQ criada");
    }
    setFaqOpen(false);
  };

  const abrirVisualizacao = async (a: KbArtigo) => {
    setViewArtigo(a);
    incrementarVisualizacao(a.id, a.visualizacoes).catch(() => {});
  };

  // ====== Render ======
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-semibold">Base de Conhecimento</h1>
            <p className="text-sm text-muted-foreground">
              Procedimentos, manuais e soluções para a equipe de manutenção
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === "artigos" && podeCriar && (
            <Button onClick={openNovoArtigo}>
              <Plus className="h-4 w-4 mr-1" /> Novo artigo
            </Button>
          )}
          {tab === "faq" && podeCriar && (
            <Button onClick={openNovoFaq}>
              <Plus className="h-4 w-4 mr-1" /> Nova FAQ
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Artigos publicados</p>
          <p className="text-2xl font-bold">{artigos.filter((a) => a.status === "publicado").length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Rascunhos</p>
          <p className="text-2xl font-bold">{artigos.filter((a) => a.status === "rascunho").length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">FAQs</p>
          <p className="text-2xl font-bold">{faqs.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Categorias</p>
          <p className="text-2xl font-bold">{categorias.length}</p>
        </CardContent></Card>
      </div>

      {/* Banner Duda */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <BotMessageSquare className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm">
            Em caso de dúvidas, pergunte à <strong>Duda</strong> — ela consulta toda esta base e responde com base nos artigos e FAQs publicados.
          </p>
          <a href="/chat-duda" className="ml-auto">
            <Button size="sm" variant="outline"><BotMessageSquare className="h-4 w-4 mr-1" /> Abrir Duda</Button>
          </a>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, conteúdo, tag..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="w-48">
            <Label className="text-xs">Categoria</Label>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tab === "artigos" && (
            <div className="w-44">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {STATUS_OPCOES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="artigos"><FileText className="h-4 w-4 mr-1" />Artigos</TabsTrigger>
          <TabsTrigger value="faq"><HelpCircle className="h-4 w-4 mr-1" />FAQ</TabsTrigger>
          <TabsTrigger value="categorias"><Tag className="h-4 w-4 mr-1" />Categorias</TabsTrigger>
        </TabsList>

        {/* ===== Artigos ===== */}
        <TabsContent value="artigos" className="mt-4">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && filteredArtigos.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nenhum artigo encontrado.
            </CardContent></Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArtigos.map((a) => {
              const equips = vinculosEquip.filter((v) => v.artigo_id === a.id);
              return (
                <Card key={a.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">{a.titulo}</CardTitle>
                      <Badge className={statusColor(a.status)} variant="outline">{a.status}</Badge>
                    </div>
                    {a.categoria_nome && (
                      <Badge variant="secondary" className="w-fit text-xs">{a.categoria_nome}</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {a.resumo && <p className="text-sm text-muted-foreground line-clamp-3">{a.resumo}</p>}
                    {a.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                      </div>
                    )}
                    {equips.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Wrench className="h-3 w-3" />
                        {equips.length} equipamento(s)
                      </div>
                    )}
                    {a.anexos.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {a.anexos.length} anexo(s)
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {a.visualizacoes}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => abrirVisualizacao(a)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {podeEditar && (
                          <Button size="sm" variant="ghost" onClick={() => openEditArtigo(a)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {podeExcluir && (
                          <Button size="sm" variant="ghost" onClick={() => setDelArtigo(a)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== FAQ ===== */}
        <TabsContent value="faq" className="mt-4">
          {filteredFaqs.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma FAQ cadastrada.
            </CardContent></Card>
          )}
          <Accordion type="single" collapsible className="space-y-2">
            {filteredFaqs.map((f) => (
              <AccordionItem key={f.id} value={f.id} className="border rounded-lg px-4 bg-card">
                <div className="flex items-center justify-between gap-2">
                  <AccordionTrigger className="flex-1 text-left">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{f.pergunta}</span>
                      {f.categoria_nome && (
                        <Badge variant="secondary" className="text-xs mt-1">{f.categoria_nome}</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <div className="flex gap-1 mr-2">
                    {podeEditar && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditFaq(f); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {podeExcluir && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDelFaq(f); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <AccordionContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert pt-2">
                    <ReactMarkdown>{f.resposta}</ReactMarkdown>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* ===== Categorias ===== */}
        <TabsContent value="categorias" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nova categoria</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input placeholder="Nome" value={novaCat.nome}
                onChange={(e) => setNovaCat({ ...novaCat, nome: e.target.value })} />
              <Input placeholder="Descrição" value={novaCat.descricao}
                onChange={(e) => setNovaCat({ ...novaCat, descricao: e.target.value })} />
              <Input type="color" value={novaCat.cor}
                onChange={(e) => setNovaCat({ ...novaCat, cor: e.target.value })} />
              <Button onClick={async () => {
                if (!podeCategorias) { toast.error("Você não possui permissão para esta ação."); return; }
                if (!novaCat.nome.trim()) { toast.error("Nome obrigatório"); return; }
                await addCategoria({ ...novaCat, ordem: categorias.length + 1 });
                setNovaCat({ nome: "", cor: "#673ab7", icone: "BookOpen", descricao: "" });
                toast.success("Categoria criada");
              }} disabled={!podeCategorias}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categorias.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg" style={{ background: c.cor }} />
                    <div>
                      <p className="font-medium">{c.nome}</p>
                      {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                    </div>
                  </div>
                  {podeCategorias && (
                    <Button variant="ghost" size="sm" onClick={() => setDelCat({ id: c.id, nome: c.nome })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Dialog Artigo ===== */}
      <Dialog open={artigoOpen} onOpenChange={setArtigoOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{artigoEditId ? "Editar artigo" : "Novo artigo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={artigoForm.titulo ?? ""} onChange={(e) => setArtigoForm({ ...artigoForm, titulo: e.target.value })} />
            </div>
            <div>
              <Label>Resumo</Label>
              <Textarea rows={2} value={artigoForm.resumo ?? ""} onChange={(e) => setArtigoForm({ ...artigoForm, resumo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={artigoForm.categoria_id ?? "none"}
                  onValueChange={(v) => setArtigoForm({ ...artigoForm, categoria_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem categoria —</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={artigoForm.status ?? "publicado"}
                  onValueChange={(v) => setArtigoForm({ ...artigoForm, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Conteúdo (suporta Markdown)</Label>
              <Textarea
                rows={12}
                value={artigoForm.conteudo ?? ""}
                onChange={(e) => setArtigoForm({ ...artigoForm, conteudo: e.target.value })}
                placeholder="Descreva o procedimento, passo a passo, dicas técnicas..."
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="ex: split, filtro, limpeza" />
            </div>

            {/* Equipamentos vinculados */}
            <div>
              <Label className="flex items-center gap-1"><Wrench className="h-4 w-4" /> Equipamentos vinculados</Label>
              <Select value="" onValueChange={(v) => {
                if (!v) return;
                const eq = equipamentos.find((e) => e.id === v);
                if (!eq || equipsSel.find((s) => s.id === v)) return;
                setEquipsSel([...equipsSel, { id: v, descricao: `${eq.equipamento || ""} ${eq.modelo || ""} ${eq.tag ? "(" + eq.tag + ")" : ""}`.trim() }]);
              }}>
                <SelectTrigger><SelectValue placeholder="Adicionar equipamento..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {equipamentos.slice(0, 200).map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.equipamento} {e.tag ? `(${e.tag})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {equipsSel.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {equipsSel.map((eq) => (
                    <Badge key={eq.id} variant="secondary" className="gap-1">
                      {eq.descricao}
                      <button onClick={() => setEquipsSel(equipsSel.filter((s) => s.id !== eq.id))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Anexos */}
            <div>
              <Label className="flex items-center gap-1"><Paperclip className="h-4 w-4" /> Anexos (PDF, fotos, vídeos)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,image/*,video/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAnexo(f);
                    e.target.value = "";
                  }}
                />
                {uploading && <span className="text-xs text-muted-foreground">Enviando...</span>}
              </div>
              {(artigoForm.anexos ?? []).length > 0 && (
                <div className="space-y-1 mt-2">
                  {(artigoForm.anexos ?? []).map((an, i) => (
                    <div key={i} className="flex items-center justify-between border rounded p-2 text-sm">
                      <a href={an.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                        <Paperclip className="h-3 w-3" /> {an.nome}
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => removerAnexo(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArtigoOpen(false)}>Cancelar</Button>
            <Button onClick={salvarArtigo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog Visualizar Artigo ===== */}
      <Dialog open={!!viewArtigo} onOpenChange={(o) => !o && setViewArtigo(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewArtigo && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-serif">{viewArtigo.titulo}</DialogTitle>
                <div className="flex flex-wrap gap-1 pt-2">
                  {viewArtigo.categoria_nome && <Badge variant="secondary">{viewArtigo.categoria_nome}</Badge>}
                  {viewArtigo.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
              </DialogHeader>
              {viewArtigo.resumo && (
                <p className="text-muted-foreground italic border-l-4 border-primary/30 pl-3">{viewArtigo.resumo}</p>
              )}
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{viewArtigo.conteudo}</ReactMarkdown>
              </div>
              {viewArtigo.anexos.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-sm font-semibold mb-2">Anexos</p>
                  <div className="space-y-1">
                    {viewArtigo.anexos.map((an, i) => (
                      <a key={i} href={an.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline">
                        <Paperclip className="h-3 w-3" /> {an.nome} <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground border-t pt-2">
                Por {viewArtigo.autor_nome || "—"} • {viewArtigo.visualizacoes} visualizações
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog FAQ ===== */}
      <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{faqEditId ? "Editar FAQ" : "Nova FAQ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Pergunta *</Label>
              <Input value={faqForm.pergunta ?? ""} onChange={(e) => setFaqForm({ ...faqForm, pergunta: e.target.value })} />
            </div>
            <div>
              <Label>Resposta * (Markdown)</Label>
              <Textarea rows={8} value={faqForm.resposta ?? ""} onChange={(e) => setFaqForm({ ...faqForm, resposta: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={faqForm.categoria_id ?? "none"}
                onValueChange={(v) => setFaqForm({ ...faqForm, categoria_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem categoria —</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqOpen(false)}>Cancelar</Button>
            <Button onClick={salvarFaq}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmações de exclusão */}
      {delArtigo && (
        <DoubleConfirmDelete
          open={!!delArtigo}
          onOpenChange={(o) => !o && setDelArtigo(null)}
          onConfirm={async () => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; } await deleteArtigo(delArtigo.id); toast.success("Artigo removido"); setDelArtigo(null); }}
        />
      )}
      {delFaq && (
        <DoubleConfirmDelete
          open={!!delFaq}
          onOpenChange={(o) => !o && setDelFaq(null)}
          onConfirm={async () => { if (!podeExcluir) { toast.error("Você não possui permissão para esta ação."); return; } await deleteFaq(delFaq.id); toast.success("FAQ removida"); setDelFaq(null); }}
        />
      )}
      {delCat && (
        <DoubleConfirmDelete
          open={!!delCat}
          onOpenChange={(o) => !o && setDelCat(null)}
          onConfirm={async () => { if (!podeCategorias) { toast.error("Você não possui permissão para esta ação."); return; } await deleteCategoria(delCat.id); toast.success("Categoria removida"); setDelCat(null); }}
        />
      )}
    </div>
  );
}
