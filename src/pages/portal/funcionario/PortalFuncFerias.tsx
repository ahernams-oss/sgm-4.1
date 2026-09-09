import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

interface F {
  id: string;
  periodo_aquisitivo_inicio: string;
  periodo_aquisitivo_fim: string;
  data_limite_concessao: string;
  dias_direito: number;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  dias_gozados: number | null;
  dias_abonados: number | null;
  status: string;
  observacoes: string | null;
}

const fmt = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const statusColor: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-700",
  solicitada: "bg-amber-100 text-amber-800",
  aprovada: "bg-emerald-100 text-emerald-800",
  gozada: "bg-emerald-100 text-emerald-800",
  paga: "bg-emerald-100 text-emerald-800",
  vencida: "bg-red-100 text-red-800",
};

export default function PortalFuncFerias() {
  const [list, setList] = useState<F[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selId, setSelId] = useState<string>("");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [abon, setAbon] = useState("0");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    portalCall<{ ferias: F[] }>("func-ferias-list")
      .then((r) => setList(r.ferias))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const abrir = (id?: string) => {
    setSelId(id || "");
    setIni(""); setFim(""); setAbon("0"); setObs("");
    setOpen(true);
  };

  const salvar = async () => {
    if (!ini || !fim) { toast.error("Informe as datas."); return; }
    setSaving(true);
    try {
      await portalCall("func-ferias-solicitar", {
        id: selId, data_inicio_gozo: ini, data_fim_gozo: fim,
        dias_abonados: Number(abon || 0), observacoes: obs,
      });
      toast.success("Solicitação enviada ao RH.");
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <PortalLayout requireTipo="funcionario">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Férias</h1>
        <Button onClick={() => abrir()}><CalendarPlus className="w-4 h-4 mr-1" />Solicitar</Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && list.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum período de férias registrado.</CardContent></Card>
      )}
      <div className="space-y-2">
        {list.map((f) => (
          <Card key={f.id}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium">
                  Aquisitivo {fmt(f.periodo_aquisitivo_inicio)} — {fmt(f.periodo_aquisitivo_fim)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Limite concessão: {fmt(f.data_limite_concessao)} · Dias direito: {f.dias_direito}
                </div>
                {f.data_inicio_gozo && (
                  <div className="text-sm">
                    Gozo: {fmt(f.data_inicio_gozo)} → {fmt(f.data_fim_gozo)}
                    {f.dias_abonados ? ` · ${f.dias_abonados} abonados` : ""}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${statusColor[f.status] || "bg-slate-100 text-slate-700"}`}>
                  {f.status}
                </span>
                {["pendente", "vencida"].includes(f.status) && (
                  <Button size="sm" variant="outline" onClick={() => abrir(f.id)}>Solicitar gozo</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar Férias</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início</Label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
            <div><Label>Dias de abono (opcional)</Label><Input type="number" min={0} max={10} value={abon} onChange={(e) => setAbon(e.target.value)} /></div>
          </div>
          <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Enviando..." : "Enviar solicitação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
