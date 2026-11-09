import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function BuscaSelect({ value, onValueChange, options, placeholder = "Selecione...", disabled, label }: {
  value: string; onValueChange: (id: string) => void; options: { id: string; descricao: string }[];
  placeholder?: string; disabled?: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const selected = options.find(o => o.id === value);
  const resultados = useMemo(() => {
    const termos = norm(busca).split(/\s+/).filter(Boolean);
    return options.filter(o => { const t = norm(o.descricao || ""); return termos.every(x => t.includes(x)); });
  }, [options, busca]);
  return (
    <Popover open={open} onOpenChange={n => { setOpen(n); setBusca(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label={label} disabled={disabled} className="h-auto min-h-10 w-full justify-between gap-2 text-left font-normal">
          <span className={cn("min-w-0 whitespace-normal break-words", !selected && "text-muted-foreground")}>{selected?.descricao || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0 pointer-events-auto">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Digite para buscar..." value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {resultados.map(o => (
                <CommandItem key={o.id} value={o.id} onSelect={() => { onValueChange(o.id); setOpen(false); }} className="gap-2">
                  <Check className={cn("h-4 w-4 shrink-0", o.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="whitespace-normal break-words">{o.descricao}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{resultados.length} de {options.length}</div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
