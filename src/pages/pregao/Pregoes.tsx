import { useState, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Gavel, Plus, MoreHorizontal, Eye, Edit, Trash2, PlayCircle, XCircle, Search, FileCheck2, Trophy, PauseCircle } from "lucide-react";
import { usePregao, type PregaoStatus } from "@/contexts/PregaoContext";
import { usePermissao } from "@/hooks/usePermissao";
import { formatNumeroAno } from "@/lib/formatNumero";
import { DoubleConfirmDelete } from "@/components/DoubleConfirmDelete";
import { toast } from "sonner";

function DeleteMenuItem({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true); }} className="text-red-600">
        <Trash2 className="h-4 w-4 mr-2" /> {label}
      </DropdownMenuItem>
      <DoubleConfirmDelete open={open} onOpenChange={setOpen} onConfirm={onConfirm} />
    </>
  );
}

const STATUS_COLORS: Record<PregaoStatus, string> = {
  Rascunho: "bg-gray-200 text-gray-800",
  Publicado: "bg-blue-100 text-blue-800",
  Credenciamento: "bg-indigo-100 text-indigo-800",
  Propostas: "bg-purple-100 text-purple-800",
  Disputa: "bg-amber-100 text-amber-900 animate-pulse",
  Habilitacao: "bg-orange-100 text-orange-800",
  Adjudicado: "bg-teal-100 text-teal-800",
  Homologado: "bg-green-100 text-green-800",
  Cancelado: "bg-red-100 text-red-800",
  Encerrado: "bg-slate-200 text-slate-800",
  Suspenso: "bg-yellow-100 text-yellow-900",
};

export default function Pregoes() {
  const nav = useNavigate();
  const { pregoes, itens, participantes, deletePregao, publicarPregao, cancelarPregao, suspenderPregao, retomarPregao, loading } = usePregao();
  const { tem } = usePermissao();
  const podeCriar = tem("pregao.criar");
  const podePregoeiro = tem("pregao.pregoeiro");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const filtered = useMemo(() => {
    return pregoes.filter(p => {
      const s = search.toLowerCase();
      const matchS = !s || p.objeto.toLowerCase().includes(s) || String(p.numero).includes(s);
      const matchST = statusFilter === "todos" || p.status === statusFilter;
      return matchS && matchST;
    });
  }, [pregoes, search, statusFilter]);

  const handleDelete = async (id: string) => {
    const ok = await deletePregao(id);
    if (!ok) toast.error("Apenas pregões em Rascunho podem ser excluídos. Use 'Cancelar' para os demais.");
  };

  const handlePublicar = async (id: string) => {
    const itensDoPregao = itens.filter(i => i.pregaoId === id);
    if (itensDoPregao.length === 0) {
      toast.error("Adicione pelo menos um item antes de publicar.");
      return;
    }
    const ok = await publicarPregao(id);
    if (ok) toast.success("Pregão publicado e credenciamento aberto.");
  };

  const handleCancelar = async (id: string) => {
    const motivo = window.prompt("Informe o motivo do cancelamento:");
    if (!motivo) return;
    const ok = await cancelarPregao(id, motivo);
    if (ok) toast.success("Pregão cancelado.");
  };

  const handleSuspender = async (id: string) => {
    const motivo = window.prompt("Informe o motivo da suspensão:");
    if (!motivo) return;
    const ok = await suspenderPregao(id, motivo);
    if (ok) toast.success("Pregão suspenso.");
  };

  const handleRetomar = async (id: string) => {
    if (!window.confirm("Deseja retomar este pregão?")) return;
    const ok = await retomarPregao(id);
    if (ok) toast.success("Pregão retomado.");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary"><Gavel className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-semibold">Pregão Eletrônico</h1>
            <p className="text-sm text-muted-foreground">Crie e conduza pregões com seus fornecedores</p>
          </div>
        </div>
        {podeCriar && (
          <Button onClick={() => nav("/compras/pregao/novo")} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" /> Novo Pregão
          </Button>
        )}
      </div>

      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pregões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por objeto ou número..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {(["Rascunho","Publicado","Credenciamento","Propostas","Disputa","Habilitacao","Adjudicado","Homologado","Suspenso","Cancelado","Encerrado"] as PregaoStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Objeto</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-center">Participantes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum pregão encontrado.</TableCell></TableRow>
              )}
              {filtered.map((p, idx) => {
                const qtdItens = itens.filter(i => i.pregaoId === p.id).length;
                const qtdPart = participantes.filter(pt => pt.pregaoId === p.id).length;
                return (
                  <TableRow key={p.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <TableCell className="font-mono">{formatNumeroAno(p.numero, p.createdAt)}</TableCell>
                    <TableCell className="max-w-[400px] truncate">{p.objeto || <span className="text-muted-foreground italic">Sem objeto</span>}</TableCell>
                    <TableCell>{p.modalidade}</TableCell>
                    <TableCell className="text-center">{qtdItens}</TableCell>
                    <TableCell className="text-center">{qtdPart}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[p.status]} variant="outline">{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => nav(`/compras/pregao/${p.id}`)}>
                            <Edit className="h-4 w-4 mr-2" /> {p.status === "Rascunho" ? "Editar" : "Visualizar"}
                          </DropdownMenuItem>
                          {podePregoeiro && (p.status === "Publicado" || p.status === "Credenciamento" || p.status === "Propostas" || p.status === "Disputa") && (
                            <DropdownMenuItem onClick={() => nav(`/compras/pregao/${p.id}/sala`)}>
                              <Eye className="h-4 w-4 mr-2" /> Sala de Disputa
                            </DropdownMenuItem>
                          )}
                          {podePregoeiro && (p.status === "Encerrado" || p.status === "Habilitacao" || p.status === "Adjudicado" || p.status === "Homologado") && (
                            <DropdownMenuItem onClick={() => nav(`/compras/pregao/${p.id}/habilitacao`)}>
                              <FileCheck2 className="h-4 w-4 mr-2" /> Habilitação / Adjudicação
                            </DropdownMenuItem>
                          )}
                          {(p.resultadoPublico || p.status === "Homologado") && (
                            <DropdownMenuItem onClick={() => nav(`/compras/pregao/${p.id}/resultado`)}>
                              <Trophy className="h-4 w-4 mr-2" /> Resultado Público
                            </DropdownMenuItem>)}
                          {podeCriar && p.status === "Rascunho" && (
                            <DropdownMenuItem onClick={() => handlePublicar(p.id)}>
                              <PlayCircle className="h-4 w-4 mr-2" /> Publicar
                            </DropdownMenuItem>
                          )}
                          {podePregoeiro && p.status !== "Rascunho" && p.status !== "Cancelado" && p.status !== "Encerrado" && p.status !== "Homologado" && p.status !== "Suspenso" && (
                            <DropdownMenuItem onClick={() => handleSuspender(p.id)} className="text-yellow-700">
                              <PauseCircle className="h-4 w-4 mr-2" /> Suspender
                            </DropdownMenuItem>
                          )}
                          {podePregoeiro && p.status === "Suspenso" && (
                            <DropdownMenuItem onClick={() => handleRetomar(p.id)}>
                              <PlayCircle className="h-4 w-4 mr-2" /> Retomar
                            </DropdownMenuItem>
                          )}
                          {podePregoeiro && p.status !== "Rascunho" && p.status !== "Cancelado" && p.status !== "Encerrado" && p.status !== "Homologado" && (
                            <DropdownMenuItem onClick={() => handleCancelar(p.id)} className="text-red-600">
                              <XCircle className="h-4 w-4 mr-2" /> Cancelar
                            </DropdownMenuItem>
                          )}
                          {podeCriar && p.status === "Rascunho" && (
                            <DeleteMenuItem onConfirm={() => handleDelete(p.id)} label="Excluir" />
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
