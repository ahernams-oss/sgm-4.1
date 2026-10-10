import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Download, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Cliente } from "@/contexts/ClientesContext";
import type { Empresa } from "@/contexts/EmpresaContext";
import { criarOrdemServicoVazia } from "@/lib/ordemServicoVazia";
import { visualizarPdfOrdemServicoVazia } from "@/lib/gerarPdfOrdemServico";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function OrdemServicoVaziaDialog({ empresa, clientes, clienteInicialId, buttonClassName }: { empresa: Empresa; clientes: Cliente[]; clienteInicialId?: string; buttonClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState("nenhum");
  const [buscaOpen, setBuscaOpen] = useState(false);
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
        <Button variant="outline" size="icon" className={buttonClassName} aria-label="Visualizar O.S. em branco" onClick={() => { setClienteId(clienteInicialId || "nenhum"); setOpen(true); }}>
          <Eye className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Visualizar O.S. em branco</TooltipContent>
    </Tooltip>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[90dvh] max-w-5xl flex-col">
        <DialogHeader><DialogTitle>Ordem de Serviço em branco</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Popover open={buscaOpen} onOpenChange={setBuscaOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={buscaOpen} aria-label="Cabeçalho do cliente" className="min-w-0 flex-1 justify-between font-normal">
                <span className="truncate">{clienteId === "nenhum" ? "Sem cabeçalho de cliente" : clientes.find(c => c.id === clienteId)?.nome || "Selecione o cliente"}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar cliente…" />
                <CommandList>
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="Sem cabeçalho de cliente" onSelect={() => { setClienteId("nenhum"); setBuscaOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", clienteId === "nenhum" ? "opacity-100" : "opacity-0")} />
                      Sem cabeçalho de cliente
                    </CommandItem>
                    {clientes.map(c => (
                      <CommandItem key={c.id} value={c.nome} onSelect={() => { setClienteId(c.id); setBuscaOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", clienteId === c.id ? "opacity-100" : "opacity-0")} />
                        {c.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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