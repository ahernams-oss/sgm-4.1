import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { MODULOS_DISPONIVEIS, acaoLabel, moduloLabel, diffSimples } from "@/lib/auditoria";
import PaginationControls, { paginate } from "@/components/PaginationControls";
import { Eye, RefreshCw, Filter } from "lucide-react";

type Registro = {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  modulo: string;
  acao: string;
  entidade_id: string | null;
  entidade_descricao: string | null;
  dados_antes: any;
  dados_depois: any;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const fmtDt = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")}, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const acaoBadge = (a: string) => {
  if (a === "insert") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Criação</Badge>;
  if (a === "update") return <Badge className="bg-amber-600 hover:bg-amber-600">Edição</Badge>;
  if (a === "delete") return <Badge variant="destructive">Exclusão</Badge>;
  return <Badge variant="secondary">{acaoLabel(a)}</Badge>;
};

const formatValor = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
};

export default function Auditoria() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [total, setTotal] = useState(0);
  const [resumo, setResumo] = useState({ insert: 0, update: 0, delete: 0 });

  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("todos");
  const [filtroAcao, setFiltroAcao] = useState("todos");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detalhe, setDetalhe] = useState<Registro | null>(null);
  const [origem, setOrigem] = useState<"atual" | "historico">("atual");

  const carregar = async (opts?: { page?: number; busca?: string }) => {
    const p = opts?.page ?? page;
    const b = opts?.busca ?? buscaAplicada;
    setLoading(true);
    const { data, error } = await (supabase as any).functions.invoke("audit-read", {
      body: { dataIni, dataFim, page: p, pageSize, modulo: filtroModulo, acao: filtroAcao, busca: b, origem },
    });
    if (!error && data?.ok) {
      setRegistros(data.data || []);
      setTotal(data.total ?? 0);
      if (data.resumo) setResumo(data.resumo);

    }
    setLoading(false);
  };

  // Carrega o registro completo (com snapshots) apenas ao abrir o detalhe.
  const abrirDetalhe = async (r: Registro) => {
    setDetalhe(r);
    const { data, error } = await (supabase as any).functions.invoke("audit-read", { body: { id: r.id, origem } });
    if (!error && data?.ok && data.data) setDetalhe(data.data as Registro);
  };

  // Recarrega ao mudar página, tamanho de página ou filtros de módulo/ação.
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [page, pageSize, filtroModulo, filtroAcao, origem]);

  // Debounce da busca (aplica no servidor).
  useEffect(() => {
    const t = setTimeout(() => {
      if (busca !== buscaAplicada) {
        setBuscaAplicada(busca);
        setPage(1);
        carregar({ page: 1, busca });
      }
    }, 400);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [busca]);

  const paginated = registros;

  const diff = useMemo(() => {
    if (!detalhe) return [];
    if (detalhe.acao === "update") return diffSimples(detalhe.dados_antes, detalhe.dados_depois);
    return [];
  }, [detalhe]);


  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Auditoria do Sistema</h1>
          <p className="text-sm text-muted-foreground">Registro de criações, edições e exclusões em todos os módulos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={origem === "atual" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => { setOrigem("atual"); setPage(1); }}
            >
              Últimos 15 dias
            </Button>
            <Button
              variant={origem === "historico" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => { setOrigem("historico"); setPage(1); }}
            >
              Histórico arquivado
            </Button>
          </div>
        <Button variant="outline" onClick={() => carregar()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de eventos", value: total, color: "text-foreground" },
          { label: "Criações", value: resumo.insert, color: "text-emerald-600" },
          { label: "Edições", value: resumo.update, color: "text-amber-600" },
          { label: "Exclusões", value: resumo.delete, color: "text-destructive" },
        ].map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className={`text-2xl font-semibold tabular-nums ${k.color}`}>{k.value}</div>
          </CardContent></Card>
        ))}
      </div>


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Input placeholder="Buscar usuário, descrição..." value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} className="md:col-span-2" />
          <Select value={filtroModulo} onValueChange={(v) => { setFiltroModulo(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="todos">Todos os módulos</SelectItem>
              {MODULOS_DISPONIVEIS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroAcao} onValueChange={(v) => { setFiltroAcao(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as ações</SelectItem>
              <SelectItem value="insert">Criações</SelectItem>
              <SelectItem value="update">Edições</SelectItem>
              <SelectItem value="delete">Exclusões</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} title="Data inicial" />
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Data final" />
          <div className="md:col-span-6 flex gap-2">
            <Button size="sm" onClick={() => { setPage(1); carregar(); }}>Aplicar período</Button>
            <Button size="sm" variant="ghost" onClick={() => { setBusca(""); setFiltroModulo("todos"); setFiltroAcao("todos"); setDataIni(""); setDataFim(""); setPage(1); carregar(); }}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{total} evento(s)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Registro afetado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums whitespace-nowrap">{fmtDt(r.created_at)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.usuario_nome || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.usuario_email || ""}</div>
                  </TableCell>
                  <TableCell>{moduloLabel(r.modulo)}</TableCell>
                  <TableCell>{acaoBadge(r.acao)}</TableCell>
                  <TableCell className="max-w-md truncate" title={r.entidade_descricao || ""}>
                    {r.entidade_descricao || <span className="text-muted-foreground">(sem descrição)</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => abrirDetalhe(r)} title="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {loading ? "Carregando..." : "Nenhum evento registrado."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls currentPage={page} totalItems={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </CardContent>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <ScrollArea className="max-h-[70vh] pr-3">
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Data/Hora:</span> {fmtDt(detalhe.created_at)}</div>
                  <div><span className="text-muted-foreground">Ação:</span> {acaoBadge(detalhe.acao)}</div>
                  <div><span className="text-muted-foreground">Usuário:</span> {detalhe.usuario_nome || "—"}</div>
                  <div><span className="text-muted-foreground">E-mail:</span> {detalhe.usuario_email || "—"}</div>
                  <div><span className="text-muted-foreground">Módulo:</span> {moduloLabel(detalhe.modulo)}</div>
                  <div><span className="text-muted-foreground">ID do registro:</span> <code className="text-xs">{detalhe.entidade_id || "—"}</code></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span> {detalhe.entidade_descricao || "—"}</div>
                </div>

                {detalhe.acao === "update" && diff.length > 0 && (
                  <div>
                    <div className="font-semibold mb-1">Campos alterados ({diff.length})</div>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/4">Campo</TableHead>
                            <TableHead>De</TableHead>
                            <TableHead>Para</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diff.map((d) => (
                            <TableRow key={d.campo}>
                              <TableCell className="font-mono text-xs align-top">{d.campo}</TableCell>
                              <TableCell className="align-top"><pre className="whitespace-pre-wrap text-xs bg-red-50 p-1 rounded">{formatValor(d.de)}</pre></TableCell>
                              <TableCell className="align-top"><pre className="whitespace-pre-wrap text-xs bg-emerald-50 p-1 rounded">{formatValor(d.para)}</pre></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {detalhe.acao === "insert" && detalhe.dados_depois && (
                  <div>
                    <div className="font-semibold mb-1">Dados criados</div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(detalhe.dados_depois, null, 2)}</pre>
                  </div>
                )}

                {detalhe.acao === "delete" && detalhe.dados_antes && (
                  <div>
                    <div className="font-semibold mb-1">Dados excluídos</div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(detalhe.dados_antes, null, 2)}</pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
