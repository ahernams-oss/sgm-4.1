import { useEffect, useMemo, useState } from "react";
import { portalCall } from "@/lib/portalClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Paperclip, RefreshCw, MessageSquare } from "lucide-react";

interface S {
  id: string;
  funcionario_id: string;
  funcionario_nome: string | null;
  cpf: string;
  tipo: string;
  assunto: string;
  descricao: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  status: string;
  resposta_rh: string | null;
  respondido_em: string | null;
  respondido_por: string | null;
  created_at: string;
}

const TIPOS: Record<string, string> = {
  declaracao: "Declaração de vínculo",
  alteracao_cadastral: "Alteração cadastral",
  atestado: "Envio de atestado",
  vale_transporte: "Vale transporte",
  outro: "Outro assunto",
};

const STATUS = [
  { v: "aberta", l: "Aberta" },
  { v: "em_analise", l: "Em análise" },
  { v: "concluida", l: "Concluída" },
  { v: "rejeitada", l: "Rejeitada" },
];

const badge: Record<string, string> = {
  aberta: "bg-amber-100 text-amber-800",
  em_analise: "bg-sky-100 text-sky-800",
  concluida: "bg-emerald-100 text-emerald-800",
  rejeitada: "bg-red-100 text-red-800",
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export default function SolicitacoesPortalRH() {
  const { user } = useAuth() as any;
  const [list, setList] = useState<S[]>([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<S | null>(null);
  const [resposta, setResposta] = useState("");
  const [novoStatus, setNovoStatus] = useState("concluida");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    portalCall<{ solicitacoes: S[] }>("admin-solicitacoes-list")
      .then((r) => setList(r.solicitacoes || []))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return list.filter((s) => {
      if (fStatus !== "todos" && s.status !== fStatus) return false;
      if (fTipo !== "todos" && s.tipo !== fTipo) return false;
      if (t && !`${s.funcionario_nome ?? ""} ${s.cpf} ${s.assunto}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [list, fStatus, fTipo, busca]);

  const kpis = useMemo(() => ({
    abertas: list.filter((s) => s.status === "aberta").length,
    analise: list.filter((s) => s.status === "em_analise").length,
    concluidas: list.filter((s) => s.status === "concluida").length,
    total: list.length,
  }), [list]);

  const abrir = (s: S) => {
    setSel(s);
    setResposta(s.resposta_rh || "");
    setNovoStatus(s.status === "aberta" ? "em_analise" : s.status);
  };

  const salvar = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      await portalCall("admin-solicitacao-responder", {
        id: sel.id,
        status: novoStatus,
        resposta_rh: resposta || null,
        respondido_por: user?.nome || user?.email || "RH",
      });
      toast.success("Solicitação atualizada.");
      setSel(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const baixarAnexo = async (id: string) => {
    try {
      const { url } = await portalCall<{ url: string }>("admin-solicitacao-anexo-url", { id });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Solicitações do Portal (RH)</h1>
          <p className="text-sm text-muted-foreground">Solicitações enviadas pelos colaboradores no Portal do Funcionário.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Atualizar</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Abertas", v: kpis.abertas },
          { l: "Em análise", v: kpis.analise },
          { l: "Concluídas", v: kpis.concluidas },
          { l: "Total", v: kpis.total },
        ].map((k) => (
          <Card key={k.l}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold">{k.v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="p-4 grid gap-3 md:grid-cols-3">
        <div>
          <Label>Buscar</Label>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, CPF ou assunto" />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(TIPOS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Aberta em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!loading && filtrada.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma solicitação encontrada.</TableCell></TableRow>
            )}
            {filtrada.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.funcionario_nome || "—"}</div>
                  <div className="text-xs text-muted-foreground">{s.cpf}</div>
                </TableCell>
                <TableCell>{TIPOS[s.tipo] || s.tipo}</TableCell>
                <TableCell>{s.assunto}</TableCell>
                <TableCell>{fmt(s.created_at)}</TableCell>
                <TableCell><span className={`text-xs px-2 py-1 rounded ${badge[s.status] || "bg-slate-100"}`}>{s.status}</span></TableCell>
                <TableCell className="text-right space-x-2">
                  {s.anexo_path && (
                    <Button size="sm" variant="outline" onClick={() => baixarAnexo(s.id)}><Paperclip className="w-3 h-3" /></Button>
                  )}
                  <Button size="sm" onClick={() => abrir(s)}><MessageSquare className="w-3 h-3 mr-1" />Tratar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sel?.assunto}</DialogTitle></DialogHeader>
          {sel && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {sel.funcionario_nome} · {TIPOS[sel.tipo] || sel.tipo} · {fmt(sel.created_at)}
              </div>
              {sel.descricao && <div className="p-3 rounded bg-muted/50 text-sm whitespace-pre-wrap">{sel.descricao}</div>}
              {sel.anexo_path && (
                <Button size="sm" variant="outline" onClick={() => baixarAnexo(sel.id)}>
                  <Paperclip className="w-3 h-3 mr-1" />{sel.anexo_nome || "Anexo"}
                </Button>
              )}
              <div>
                <Label>Status</Label>
                <Select value={novoStatus} onValueChange={setNovoStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resposta ao colaborador</Label>
                <Textarea rows={4} value={resposta} onChange={(e) => setResposta(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSel(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
