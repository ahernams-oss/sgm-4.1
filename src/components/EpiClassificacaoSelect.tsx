import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { normalizarClassificacaoEpi } from "@/lib/epiClassificacao";
import { cn } from "@/lib/utils";

export default function EpiClassificacaoSelect({ id, label, value, options, onChange, onCreate, canCreate }: {
  id: string; label: string; value: string; options: string[];
  onChange: (value: string) => void; onCreate: (value: string) => void; canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = normalizarClassificacaoEpi(search);
  const filtered = options.filter(option => normalizarClassificacaoEpi(option).includes(query));
  const canAdd = canCreate && query && !options.some(option => normalizarClassificacaoEpi(option) === query);
  const select = (next: string) => { onChange(next); setOpen(false); setSearch(""); };
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} className="w-full min-w-0 justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || `Selecione ${label.toLowerCase()}`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={canCreate ? `Buscar ou cadastrar ${label.toLowerCase()}...` : `Buscar ${label.toLowerCase()}...`} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
            <CommandGroup>
              {filtered.map(option => <CommandItem key={option} value={option} onSelect={() => select(option)}>
                <Check className={cn("mr-2 h-4 w-4 shrink-0", value === option ? "opacity-100" : "opacity-0")} />
                <span className="break-words">{option}</span>
              </CommandItem>)}
            </CommandGroup>
          </CommandList>
          {(canAdd || value) && <div className="border-t border-border p-1">
            {canAdd && <Button type="button" variant="ghost" className="w-full h-auto justify-start gap-2 whitespace-normal text-left" onClick={() => { const next = search.trim(); onCreate(next); select(next); }}>
              <Plus className="h-4 w-4 shrink-0" />Cadastrar “{search.trim()}”
            </Button>}
            {value && <Button type="button" variant="ghost" className="w-full justify-start gap-2" onClick={() => select("")}><X className="h-4 w-4" />Limpar seleção</Button>}
          </div>}
        </Command>
      </PopoverContent>
    </Popover>
  );
}