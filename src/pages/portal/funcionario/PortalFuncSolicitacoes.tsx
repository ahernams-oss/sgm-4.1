import { useEffect, useRef, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall, fileToBase64 } from "@/lib/portalClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Paperclip, Download } from "lucide-react";

interface S {
  id: string;
  tipo: string;
  assunto: string;
  descricao: string | null;
  anexo_path: string | null;
  anexo_nome: string | null;
  status: string;
  resposta_rh: string | null;
  respondido_em: string | null;
  created_at: string;
}

const TIPOS = [
  { v: "declaracao", l: "Declaração de vínculo" },
  { v: "alteracao_cadastral", l: "Alteração cadastral" },
  { v: "atestado", l: "Envio de atestado" },
  { v: "vale_transporte", l: "Vale transporte" },
  { v: "outro", l: "Outro assunto" },
];

const badge: Record<string, string> = {
  aberta: "bg-amber-100 text-amber-800",
  em_analise: "bg-sky-100 text-sky-800",
  concluida: "bg-emerald-100 text-emerald-800",
  rejeitada: "bg-red-100 text-red-800",
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

export default function PortalFuncSolicitacoes() {
  const [list, setList] = useState<S[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("declaracao");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    portalCall<{ solicitacoes: S[] }>("func-solicitacoes-list")
      .then((r) => setList(r.solicitacoes))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const enviar = async () => {
    if (!assunto.trim()) { toast.error("Informe o assunto."); return; }
    setSaving(true);
    try {
      const payload: any = { tipo, assunto, descricao };
      const file = fileRef.current?.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) { toast.error("Anexo maior que 5MB."); setSaving(false); return; }
        payload.arquivo_base64 = await fileToBase64(file);
        payload.nome_arquivo = file.name;
        payload.content_type = file.type;
      }
      await portalCall("func-solicitacoes-criar", payload);
      toast.success("Solicitação enviada.");
      setOpen(false); setTipo("declaracao"); setAssunto(""); setDescricao("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const baixarAnexo = async (id: string) => {
    try {
      const { url } = await portalCall<{ url: string }>("func-solicitacao-anexo-url", { id });
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <PortalLayout requireTipo="funcionario">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Solicitações ao RH</h1>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nova solicitação</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && list.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Você ainda não abriu solicitações.</CardContent></Card>
      )}
      <div className="space-y-2">
        {list.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{s.assunto}</div>
                  <div className="text-xs text-muted-foreground">
                    {TIPOS.find((t) => t.v === s.tipo)?.l || s.tipo} · Aberta em {fmt(s.created_at)}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${badge[s.status] || "bg-slate-100"}`}>{s.status}</span>
              </div>
              {s.descricao && <div className="text-sm whitespace-pre-wrap">{s.descricao}</div>}
              {s.anexo_path && (
                <Button size="sm" variant="outline" onClick={() => baixarAnexo(s.id)}>
                  <Paperclip className="w-3 h-3 mr-1" />{s.anexo_nome || "Anexo"}
                  <Download className="w-3 h-3 ml-2" />
                </Button>
              )}
              {s.resposta_rh && (
                <div className="mt-2 p-3 rounded bg-muted/50 text-sm">
                  <div className="font-medium mb-1">Resposta do RH ({fmt(s.respondido_em)})</div>
                  <div className="whitespace-pre-wrap">{s.resposta_rh}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova solicitação ao RH</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Assunto</Label><Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex: Declaração para banco" /></div>
            <div><Label>Descrição</Label><Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
            <div><Label>Anexo (opcional, até 5MB)</Label><Input type="file" ref={fileRef} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={enviar} disabled={saving}>{saving ? "Enviando..." : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
