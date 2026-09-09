import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Megaphone, Check } from "lucide-react";

interface A {
  id: string;
  titulo: string;
  conteudo: string;
  prioridade: string | null;
  criado_por: string | null;
  created_at: string;
  lido_em: string | null;
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const pcolor: Record<string, string> = {
  alta: "bg-red-100 text-red-800",
  media: "bg-amber-100 text-amber-800",
  baixa: "bg-slate-100 text-slate-700",
};

export default function PortalFuncAvisos() {
  const [list, setList] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    portalCall<{ avisos: A[] }>("func-avisos-list")
      .then((r) => setList(r.avisos))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const marcarLida = async (id: string) => {
    try {
      await portalCall("func-aviso-marcar-lida", { id });
      setList((prev) => prev.map((a) => (a.id === id ? { ...a, lido_em: new Date().toISOString() } : a)));
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <PortalLayout requireTipo="funcionario">
      <h1 className="text-2xl font-semibold mb-4 flex items-center gap-2">
        <Megaphone className="w-6 h-6" /> Avisos
      </h1>
      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && list.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum aviso no momento.</CardContent></Card>
      )}
      <div className="space-y-2">
        {list.map((a) => (
          <Card key={a.id} className={a.lido_em ? "" : "border-primary/40"}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {a.titulo}
                    {!a.lido_em && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">Novo</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.criado_por || "Comunicado interno"} · {fmt(a.created_at)}
                  </div>
                </div>
                {a.prioridade && (
                  <span className={`text-xs px-2 py-1 rounded ${pcolor[a.prioridade] || "bg-slate-100"}`}>
                    {a.prioridade}
                  </span>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">{a.conteudo}</div>
              {!a.lido_em && (
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => marcarLida(a.id)}>
                    <Check className="w-3 h-3 mr-1" /> Marcar como lido
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalLayout>
  );
}
