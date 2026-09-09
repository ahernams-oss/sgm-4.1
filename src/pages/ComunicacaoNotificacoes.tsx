import { useState } from "react";
import { useComunicacao } from "@/contexts/ComunicacaoContext";
import { useUsuarios } from "@/contexts/UsuariosContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { usePermissao } from "@/hooks/usePermissao";
import { DoubleConfirmDelete, useDoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { Plus, Bell, CheckCircle2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ComunicacaoNotificacoes() {
  const { notificacoes, addNotificacao, marcarNotificacaoLida, deleteNotificacao } = useComunicacao();
  const { usuarios } = useUsuarios();
  const { usuarioLogado } = useAuth();
  const { toast } = useToast();
  const { tem } = usePermissao();
  const podeCriar = tem("comunicacao_notificacoes.criar");
  const podeExcluir = tem("comunicacao_notificacoes.excluir");
  const podeMarcarLida = tem("comunicacao_notificacoes.marcar_lida");
  const { deleteId, requestDelete, cancelDelete } = useDoubleConfirmDelete();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
  const [filterLida, setFilterLida] = useState("all");
  const [form, setForm] = useState({ destinatarioId: "", titulo: "", descricao: "", tipo: "tarefa" });

  const filtered = notificacoes.filter(n => {
    if (filterLida === "lida" && !n.lida) return false;
    if (filterLida === "pendente" && n.lida) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return n.titulo.toLowerCase().includes(q) || n.destinatarioNome.toLowerCase().includes(q);
  });

  const { paginated, totalPages } = paginate(filtered, page, pageSize);

  const handleSalvar = async () => {
    if (!podeCriar) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); return; }
    const dest = usuarios.find(u => u.id === form.destinatarioId);
    if (!dest || !form.titulo.trim()) {
      toast({ title: "Preencha destinatário e título", variant: "destructive" });
      return;
    }
    await addNotificacao({
      destinatario_nome: dest.nome,
      destinatario_email: dest.email,
      titulo: form.titulo,
      descricao: form.descricao,
      tipo: form.tipo,
      criado_por: usuarioLogado?.nome || "",
    });
    setForm({ destinatarioId: "", titulo: "", descricao: "", tipo: "tarefa" });
    setDialogOpen(false);
    toast({ title: "Notificação enviada!" });
  };

  return (
    <div className="space-y-4 pt-[15px] pl-0 pr-[10px]">
      <div className="flex items-center justify-between mx-[7px]">
        <h1 className="text-2xl font-bold">Notificações de Tarefas</h1>
        {podeCriar && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova Notificação
          </Button>
        )}
      </div>

      <div className="flex gap-4 mx-[7px]">
        <Input
          placeholder="Buscar..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="max-w-md"
        />
        <Select value={filterLida} onValueChange={v => { setFilterLida(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="lida">Lidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg mx-[7px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Enviado por</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma notificação
                </TableCell>
              </TableRow>
            ) : paginated.map(n => (
              <TableRow key={n.id}>
                <TableCell>
                  <div>
                    <span className="font-medium text-sm">{n.titulo}</span>
                    {n.descricao && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{n.descricao}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{n.tipo === "tarefa" ? "Tarefa" : n.tipo === "lembrete" ? "Lembrete" : n.tipo}</Badge>
                </TableCell>
                <TableCell>{n.destinatarioNome}</TableCell>
                <TableCell>{n.criadoPor}</TableCell>
                <TableCell>
                  {n.createdAt ? format(new Date(n.createdAt), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {n.lida ? (
                    <Badge className="bg-green-100 text-green-800 border-green-300">Lida</Badge>
                  ) : (
                    <Badge variant="destructive">Pendente</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!n.lida && n.destinatarioEmail === usuarioLogado?.email && podeMarcarLida && (
                      <Button size="icon" variant="ghost" className="text-green-600" onClick={() => { marcarNotificacaoLida(n.id); toast({ title: "Marcada como lida" }); }}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    {podeExcluir && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => requestDelete(n.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Notificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Destinatário</Label>
              <Select value={form.destinatarioId} onValueChange={v => setForm(f => ({ ...f, destinatarioId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {usuarios.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tarefa">Tarefa</SelectItem>
                  <SelectItem value="lembrete">Lembrete</SelectItem>
                  <SelectItem value="informacao">Informação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDelete
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) cancelDelete(); }}
        onConfirm={async () => {
          if (!podeExcluir) { toast({ title: "Você não possui permissão para esta ação.", variant: "destructive" }); cancelDelete(); return; }
          if (deleteId) {
            await deleteNotificacao(deleteId);
            cancelDelete();
            toast({ title: "Notificação excluída" });
          }
        }}
      />
    </div>
  );
}
