import { useEffect, useState } from "react";
import PortalLayout from "@/components/portal/PortalLayout";
import { portalCall } from "@/lib/portalClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, Loader2, PenLine, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import AssinaturaHoleriteDialog from "@/components/portal/AssinaturaHoleriteDialog";

interface H { id: string; tipo: string; competencia_mes: number; competencia_ano: number; descricao?: string; disponibilizado_em: string; assinado_em?: string | null; assinatura_hash?: string | null; }
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const TIPO_LABEL: Record<string,string> = { folha: "Holerite Mensal", "13o": "13º Salário", ferias: "Férias", rescisao: "Rescisão", outros: "Outros" };

export default function PortalHolerites() {
  const [list, setList] = useState<H[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [assinar, setAssinar] = useState<H | null>(null);


  useEffect(() => {
    portalCall<{ holerites: H[] }>("list-holerites")
      .then((r) => setList(r.holerites))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const blobDoHolerite = async (id: string) => {
    const { url } = await portalCall<{ url: string }>("download-holerite", { id });
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Não foi possível obter o arquivo.");
    return URL.createObjectURL(await resp.blob());
  };

  const download = async (h: H) => {
    setBusy(h.id + "d");
    try {
      const href = await blobDoHolerite(h.id);
      const a = document.createElement("a");
      a.href = href;
      a.download = `holerite-${String(h.competencia_mes).padStart(2, "0")}-${h.competencia_ano}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 30000);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const imprimir = async (h: H) => {
    setBusy(h.id + "p");
    try {
      const href = await blobDoHolerite(h.id);
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.src = href;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(href, "_blank");
        }
      };
      document.body.appendChild(frame);
      setTimeout(() => { URL.revokeObjectURL(href); frame.remove(); }, 60000);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <PortalLayout requireTipo="funcionario">
      <h1 className="text-2xl font-semibold mb-4">Holerites e Comprovantes</h1>
      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && list.length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum documento disponível ainda.</CardContent></Card>
      )}
      <div className="space-y-2">
        {list.map((h) => (
          <Card key={h.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {TIPO_LABEL[h.tipo] ?? h.tipo}
                  {h.assinado_em && (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Assinado
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {MESES[h.competencia_mes - 1]}/{h.competencia_ano}
                  {h.descricao && ` — ${h.descricao}`}
                </div>
                {h.assinado_em && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Assinado em {new Date(h.assinado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {h.assinatura_hash && ` — SHA-256: ${h.assinatura_hash.slice(0, 16)}...`}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!h.assinado_em && (
                  <Button size="sm" variant="secondary" onClick={() => setAssinar(h)}>
                    <PenLine className="w-4 h-4 mr-1" />Assinar
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busy === h.id + "p"} onClick={() => imprimir(h)}>
                  {busy === h.id + "p" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Printer className="w-4 h-4 mr-1" />}Imprimir
                </Button>
                <Button size="sm" disabled={busy === h.id + "d"} onClick={() => download(h)}>
                  {busy === h.id + "d" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}Baixar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <AssinaturaHoleriteDialog
        open={!!assinar}
        onOpenChange={(v) => !v && setAssinar(null)}
        holeriteId={assinar?.id ?? null}
        competencia={assinar ? `${MESES[assinar.competencia_mes - 1]}/${assinar.competencia_ano}` : undefined}
        onAssinado={(id, assinadoEm) =>
          setList((prev) => prev.map((x) => (x.id === id ? { ...x, assinado_em: assinadoEm } : x)))
        }
      />
    </PortalLayout>
  );

}
