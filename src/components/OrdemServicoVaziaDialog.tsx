import { useEffect, useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Cliente } from "@/contexts/ClientesContext";
import type { Empresa } from "@/contexts/EmpresaContext";
import { criarOrdemServicoVazia } from "@/lib/ordemServicoVazia";
import { visualizarPdfOrdemServicoVazia } from "@/lib/gerarPdfOrdemServico";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function OrdemServicoVaziaDialog({ empresa, clientes, clienteInicialId }: { empresa: Empresa; clientes: Cliente[]; clienteInicialId?: string }) {
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState("nenhum");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl = "";
    setLoading(true);
    setUrl("");
    visualizarPdfOrdemServicoVazia({
      os: criarOrdemServicoVazia(), empresa,
      cliente: clientes.find(c => c.id === clienteId),
    }).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {
      if (!cancelled) toast.error("Não foi possível visualizar a O.S. em branco.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, clienteId, empresa, clientes]);

  return <>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Visualizar O.S. em branco" onClick={() => { setClienteId(clienteInicialId || "nenhum"); setOpen(true); }}>
          <Eye className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Visualizar O.S. em branco</TooltipContent>
    </Tooltip>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[90dvh] max-w-5xl flex-col">
        <DialogHeader><DialogTitle>Ordem de Serviço em branco</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="min-w-0 flex-1" aria-label="Cabeçalho do cliente"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Sem cabeçalho de cliente</SelectItem>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" disabled={!url || loading} asChild>
            <a href={url || undefined} download="OS_em_branco.pdf" aria-disabled={!url || loading} onClick={e => { if (!url || loading) e.preventDefault(); }}>
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </a>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted">
          {loading ? <div className="flex h-full items-center justify-center" role="status"><Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" /> Gerando visualização…</div>
            : url ? <iframe title="Visualização da Ordem de Serviço em branco" src={url} className="h-full w-full border-0" />
            : <div className="flex h-full items-center justify-center text-muted-foreground">Visualização indisponível.</div>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}