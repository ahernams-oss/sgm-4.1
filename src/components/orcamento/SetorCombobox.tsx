import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Normaliza texto para busca: minúsculo e sem acentos. */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  className?: string;
}

export default function SetorCombobox({ value, onChange, options, disabled, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-8 w-full justify-between px-2 font-normal", className)}
        >
          <span className={cn("truncate text-xs", !value && "text-muted-foreground")}>
            {value || "Setor"}
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,90vw)] p-0" align="start">
        <Command
          filter={(v, search) => {
            const terms = norm(search).split(/\s+/).filter(Boolean);
            const target = norm(v);
            return terms.every(t => target.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar setor..." className="h-9" />
          <CommandList className="max-h-64">
            <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem value="__limpar__" onSelect={() => { onChange(""); setOpen(false); }}>
                  <X className="mr-2 h-4 w-4" /> Limpar seleção
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={`${options.length} setor(es)`}>
              {options.map(s => (
                <CommandItem key={s} value={s} onSelect={() => { onChange(s); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === s ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{s}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
