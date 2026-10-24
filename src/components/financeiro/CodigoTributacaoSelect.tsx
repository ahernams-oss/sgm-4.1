import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { correspondeCodigoTributacao } from "@/lib/buscaCodigoTributacao";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onValueChange: (codigo: string) => void;
  options: { codigo: string; descricao: string }[];
  label: string;
  placeholder: string;
}

export default function CodigoTributacaoSelect({ value, onValueChange, options, label, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const selected = options.find(item => item.codigo === value);
  const resultados = options.filter(item => correspondeCodigoTributacao(item, busca));
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); setBusca(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} className="h-auto min-h-10 w-full justify-between gap-2 text-left font-normal">
          <span className="min-w-0 whitespace-normal break-words">{selected ? `${selected.codigo} — ${selected.descricao}` : value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0 pointer-events-auto">
        <Command shouldFilter={false}>
          <CommandInput aria-label={`Buscar ${label.toLowerCase()}`} placeholder="Buscar por código ou descrição..." value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum código encontrado.</CommandEmpty>
            <CommandGroup>
              {resultados.map(item => (
                <CommandItem key={item.codigo} value={item.codigo} onSelect={() => { onValueChange(item.codigo); setOpen(false); setBusca(""); }} className="items-start gap-2 py-2">
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === item.codigo ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono shrink-0">{item.codigo}</span>
                  <span className="min-w-0 whitespace-normal break-words">{item.descricao}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{resultados.length} de {options.length} códigos</div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}