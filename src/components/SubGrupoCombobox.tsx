import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SubGrupoOption { id: string; codigo: string; nome: string; grupoCodigo: string; grupoNome: string; }

export default function SubGrupoCombobox({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: SubGrupoOption[] }) {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {sel ? (
            <span className="truncate">{sel.grupoCodigo}.{sel.codigo} - {sel.nome} <span className="text-muted-foreground">({sel.grupoNome})</span></span>
          ) : <span className="text-muted-foreground">Selecione o subgrupo</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(v, search) => (v.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Buscar por código, subgrupo ou grupo..." />
          <CommandList>
            <CommandEmpty>Nenhum subgrupo encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem
                  key={o.id}
                  value={`${o.grupoCodigo}.${o.codigo} ${o.nome} ${o.grupoCodigo} ${o.grupoNome}`}
                  onSelect={() => { onChange(o.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    <span className="font-medium">{o.grupoCodigo}.{o.codigo}</span> - {o.nome}
                    <span className="text-muted-foreground"> · Grupo {o.grupoCodigo} - {o.grupoNome}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
