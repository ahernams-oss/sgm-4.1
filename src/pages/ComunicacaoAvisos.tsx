import { useMemo, useState } from "react";
import { useComunicacao } from "@/contexts/ComunicacaoContext";
import { useUsuarios } from "@/contexts/UsuariosContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { usePermissao } from "@/hooks/usePermissao";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { Plus, Eye, CheckCircle2, Trash2, Users, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const emptyAviso = { titulo: "", conteudo: "", prioridade: "Normal", destinatariosEmails: [] as string[], gruposIds: [] as string[] };
const emptyGrupo = { nome: "", descricao: "", membrosEmails: [] as string[] };

export default function ComunicacaoAvisos() {
  const { avisos, addAviso, deleteAviso, confirmarLeitura, grupos, addGrupo, updateGrupo, deleteGrupo } = useComunicacao();
  const { usuarios } = useUsuarios();
  const { usuarioLogado } = useAuth();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriar = tem("comunicacao_avisos.criar");
  const podeExcluir = tem("comunicacao_avisos.excluir");
  const deleteAv = useDoubleConfirmDelete();
  const deleteGr = useDoubleConfirmDelete();

  const [tab, setTab] = useState("avisos");

  // Aviso state
  const [avisoDialog, setAvisoDialog] = useState(false);
  const [avisoForm, setAvisoForm] = useState(emptyAviso);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [detailDialog, setDetailDialog] = useState<string | null>(null);

  // Grupo state
  const [grupoDialog, setGrupoDialog] = useState(false);
  const [grupoEditId, setGrupoEditId] = useState<string | null>(null);
  const [grupoForm, setGrupoForm] = useState(emptyGrupo);
  const [grupoSearch, setGrupoSearch] = useState("");

  const filtered = avisos.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.titulo.toLowerCase().includes(q) || a.conteudo.toLowerCase().includes(q);
  });
  const { paginated } = paginate(filtered, page, pageSize);

  const gruposFiltrados = grupos.filter(g => !grupoSearch.trim() || g.nome.toLowerCase().includes(grupoSearch.toLowerCase()));

  const avisoDetail = avisos.find(a => a.id === detailDialog);
  const jaLeu = (aviso: any) => aviso.leituras?.some((l: any) => l.usuarioEmail === usuarioLogado?.email);

  const prioridadeColor = (p: string) => {
    switch (p) {
      case "Urgente": return "bg-yellow-500 text-white";
      case "Crítica": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // ---- Aviso handlers ----
  const handleSalvarAviso = async () => {
    if (!podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!avisoForm.titulo.trim() || !avisoForm.conteudo.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }
    await addAviso({
      titulo: avisoForm.titulo,
      conteudo: avisoForm.conteudo,
      prioridade: avisoForm.prioridade,
      criado_por: usuarioLogado?.nome || "",
      destinatarios_emails: avisoForm.destinatariosEmails,
      grupos_ids: avisoForm.gruposIds,
    });
    setAvisoForm(emptyAviso);
    setAvisoDialog(false);
    const total = avisoForm.destinatariosEmails.length + avisoForm.gruposIds.length;
    toast({ title: total === 0 ? "Aviso publicado para todos os usuários" : `Aviso publicado para destinatários selecionados` });
  };

  const handleConfirmarLeitura = async (avisoId: string) => {
    await confirmarLeitura({
      aviso_id: avisoId,
      usuario_nome: usuarioLogado?.nome || "",
      usuario_email: usuarioLogado?.email || "",
    });
    toast({ title: "Leitura confirmada" });
  };

  const toggleEmail = (email: string) => {
    setAvisoForm(f => ({
      ...f,
      destinatariosEmails: f.destinatariosEmails.includes(email)
        ? f.destinatariosEmails.filter(e => e !== email)
        : [...f.destinatariosEmails, email],
    }));
  };

  const toggleGrupo = (id: string) => {
    setAvisoForm(f => ({
      ...f,
      gruposIds: f.gruposIds.includes(id) ? f.gruposIds.filter(x => x !== id) : [...f.gruposIds, id],
    }));
  };

  // ---- Grupo handlers ----
  const openNovoGrupo = () => { setGrupoEditId(null); setGrupoForm(emptyGrupo); setGrupoDialog(true); };
  const openEditGrupo = (id: string) => {
    const g = grupos.find(x => x.id === id);
    if (!g) return;
    setGrupoEditId(id);
    setGrupoForm({ nome: g.nome, descricao: g.descricao, membrosEmails: g.membrosEmails });
    setGrupoDialog(true);
  };

  const toggleMembroGrupo = (email: string) => {
    setGrupoForm(f => ({
      ...f,
      membrosEmails: f.membrosEmails.includes(email) ? f.membrosEmails.filter(e => e !== email) : [...f.membrosEmails, email],
    }));
  };

  const handleSalvarGrupo = async () => {
    if (!podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    if (!grupoForm.nome.trim()) { toast({ title: "Informe o nome do grupo", variant: "destructive" }); return; }
    if (grupoForm.membrosEmails.length === 0) { toast({ title: "Selecione ao menos 1 membro", variant: "destructive" }); return; }
    if (grupoEditId) {
      await updateGrupo(grupoEditId, {
        nome: grupoForm.nome, descricao: grupoForm.descricao, membros_emails: grupoForm.membrosEmails,
      });
      toast({ title: "Grupo atualizado" });
    } else {
      await addGrupo({
        nome: grupoForm.nome, descricao: grupoForm.descricao, membros_emails: grupoForm.membrosEmails,
        criado_por: usuarioLogado?.nome || "",
      });
      toast({ title: "Grupo criado" });
    }
    setGrupoDialog(false);
    setGrupoForm(emptyGrupo);
    setGrupoEditId(null);
  };

  // memo destinatários totais do aviso atual no form (para resumo)
  const totalDestinatariosForm = useMemo(() => {
    const emails = new Set(avisoForm.destinatariosEmails);
    avisoForm.gruposIds.forEach(gid => {
      grupos.find(g => g.id === gid)?.membrosEmails.forEach(e => emails.add(e));
    });
    return emails.size;
  }, [avisoForm, grupos]);

  return (
    <div className="space-y-4 pt-[15px] pl-0 pr-[10px]">
      <div className="flex items-center justify-between mx-[7px]">
        <h1 className="text-2xl font-bold">Avisos e Comunicados</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mx-[7px]">
        <TabsList>
          <TabsTrigger value="avisos">Avisos</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>

        {/* ============ AVISOS ============ */}
        <TabsContent value="avisos" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Buscar avisos..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="max-w-md" />
            {podeCriar && (
              <Button onClick={() => { setAvisoForm(emptyAviso); setAvisoDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo Aviso
              </Button>
            )}
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Leituras</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum aviso publicado</TableCell></TableRow>
                ) : paginated.map(a => {
                  const destCount = (a.destinatariosEmails?.length || 0) + (a.gruposIds?.length || 0);
                  const escopo = destCount === 0 ? "Todos" : `${a.destinatariosEmails?.length || 0} usu. + ${a.gruposIds?.length || 0} grupo(s)`;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.titulo}</TableCell>
                      <TableCell><Badge className={prioridadeColor(a.prioridade)}>{a.prioridade}</Badge></TableCell>
                      <TableCell className="text-xs">{escopo}</TableCell>
                      <TableCell>{a.criadoPor}</TableCell>
                      <TableCell>{a.createdAt ? format(new Date(a.createdAt), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{a.leituras.length}</Badge></TableCell>
                      <TableCell className="text-center">
                        {jaLeu(a) ? <Badge className="bg-green-100 text-green-800 border-green-300">Lido</Badge> : <Badge variant="destructive">Pendente</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setDetailDialog(a.id)} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                          {!jaLeu(a) && (
                            <Button size="icon" variant="ghost" onClick={() => handleConfirmarLeitura(a.id)} title="Confirmar leitura" className="text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {podeExcluir && (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteAv.requestDelete(a.id)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </TabsContent>

        {/* ============ GRUPOS ============ */}
        <TabsContent value="grupos" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Input placeholder="Buscar grupos..." value={grupoSearch} onChange={e => setGrupoSearch(e.target.value)} className="max-w-md" />
            {podeCriar && (
              <Button onClick={openNovoGrupo}>
                <Plus className="h-4 w-4 mr-2" /> Novo Grupo
              </Button>
            )}
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-center">Membros</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead className="w-28">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gruposFiltrados.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum grupo cadastrado</TableCell></TableRow>
                ) : gruposFiltrados.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" />{g.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{g.descricao || "-"}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline">{g.membrosEmails.length}</Badge></TableCell>
                    <TableCell>{g.criadoPor}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {podeCriar && (
                          <Button size="icon" variant="ghost" onClick={() => openEditGrupo(g.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        )}
                        {podeExcluir && (
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteGr.requestDelete(g.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Dialog Novo Aviso ===== */}
      <Dialog open={avisoDialog} onOpenChange={setAvisoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo Aviso</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={avisoForm.titulo} onChange={e => setAvisoForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea value={avisoForm.conteudo} onChange={e => setAvisoForm(f => ({ ...f, conteudo: e.target.value }))} rows={4} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={avisoForm.prioridade} onValueChange={v => setAvisoForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                  <SelectItem value="Crítica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center justify-between">
                  Grupos <span className="text-xs text-muted-foreground">{avisoForm.gruposIds.length} selecionado(s)</span>
                </Label>
                <div className="border rounded-md mt-1 max-h-44 overflow-y-auto p-2 space-y-1">
                  {grupos.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum grupo. Crie na aba Grupos.</p>
                  ) : grupos.map(g => (
                    <label key={g.id} className="flex items-center gap-2 text-sm hover:bg-muted rounded px-1 py-0.5 cursor-pointer">
                      <Checkbox checked={avisoForm.gruposIds.includes(g.id)} onCheckedChange={() => toggleGrupo(g.id)} />
                      <span>{g.nome}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{g.membrosEmails.length} membros</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="flex items-center justify-between">
                  Usuários <span className="text-xs text-muted-foreground">{avisoForm.destinatariosEmails.length} selecionado(s)</span>
                </Label>
                <div className="border rounded-md mt-1 max-h-44 overflow-y-auto p-2 space-y-1">
                  {usuarios.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-sm hover:bg-muted rounded px-1 py-0.5 cursor-pointer">
                      <Checkbox checked={avisoForm.destinatariosEmails.includes(u.email)} onCheckedChange={() => toggleEmail(u.email)} />
                      <span className="truncate">{u.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {avisoForm.destinatariosEmails.length === 0 && avisoForm.gruposIds.length === 0
                ? "Nenhum destinatário selecionado — o aviso será enviado para todos os usuários."
                : `Será entregue a aproximadamente ${totalDestinatariosForm} usuário(s).`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvisoDialog(false)}>Cancelar</Button>
            <Button onClick={handleSalvarAviso}>Publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog Detalhes Aviso ===== */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{avisoDetail?.titulo}</DialogTitle></DialogHeader>
          {avisoDetail && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Conteúdo</Label>
                <p className="text-sm whitespace-pre-wrap mt-1">{avisoDetail.conteudo}</p>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                <span>Criado por: {avisoDetail.criadoPor}</span>
                <span>Prioridade: {avisoDetail.prioridade}</span>
                <span>
                  Escopo: {(avisoDetail.destinatariosEmails?.length || 0) + (avisoDetail.gruposIds?.length || 0) === 0
                    ? "Todos os usuários"
                    : `${avisoDetail.destinatariosEmails?.length || 0} usuário(s) + ${avisoDetail.gruposIds?.length || 0} grupo(s)`}
                </span>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Confirmações de Leitura ({avisoDetail.leituras.length})</Label>
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                  {avisoDetail.leituras.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">Nenhuma confirmação</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Usuário</TableHead>
                          <TableHead className="text-xs">Data/Hora</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {avisoDetail.leituras.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs">{l.usuarioNome}</TableCell>
                            <TableCell className="text-xs">{l.lidoEm ? format(new Date(l.lidoEm), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
              {!jaLeu(avisoDetail) && (
                <Button className="w-full" onClick={() => { handleConfirmarLeitura(avisoDetail.id); setDetailDialog(null); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Leitura
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog Grupo ===== */}
      <Dialog open={grupoDialog} onOpenChange={setGrupoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{grupoEditId ? "Editar Grupo" : "Novo Grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={grupoForm.nome} onChange={e => setGrupoForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={grupoForm.descricao} onChange={e => setGrupoForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label className="flex items-center justify-between">
                Membros <span className="text-xs text-muted-foreground">{grupoForm.membrosEmails.length} selecionado(s)</span>
              </Label>
              <div className="border rounded-md mt-1 max-h-60 overflow-y-auto p-2 space-y-1">
                {usuarios.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm hover:bg-muted rounded px-1 py-0.5 cursor-pointer">
                    <Checkbox checked={grupoForm.membrosEmails.includes(u.email)} onCheckedChange={() => toggleMembroGrupo(u.email)} />
                    <span className="truncate">{u.nome}</span>
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoDialog(false)}>Cancelar</Button>
            <Button onClick={handleSalvarGrupo}>{grupoEditId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteAv.deleteId}
        onOpenChange={(open) => { if (!open) deleteAv.cancelDelete(); }}
        onConfirm={async () => {
          if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); deleteAv.cancelDelete(); return; }
          if (deleteAv.deleteId) {
            await deleteAviso(deleteAv.deleteId);
            deleteAv.cancelDelete();
            toast({ title: "Aviso excluído" });
          }
        }}
      />
      <DoubleConfirmDelete
        open={!!deleteGr.deleteId}
        onOpenChange={(open) => { if (!open) deleteGr.cancelDelete(); }}
        onConfirm={async () => {
          if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); deleteGr.cancelDelete(); return; }
          if (deleteGr.deleteId) {
            await deleteGrupo(deleteGr.deleteId);
            deleteGr.cancelDelete();
            toast({ title: "Grupo excluído" });
          }
        }}
      />
    </div>
  );
}
