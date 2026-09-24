import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.\-/\s]/g, "");

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; extra?: string }[];
  allLabel?: string;
  className?: string;
  placeholder?: string;
}

export function SearchableFilter({ value, onChange, options, allLabel = "Todos", className, placeholder = "Buscar..." }: Props) {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.value === value);
  const all = [{ value: "todos", label: allLabel }, ...options];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={cn("h-9 justify-between text-xs font-normal", className)}>
          <span className="truncate">{sel ? sel.label : allLabel}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command filter={(v, search) => (norm(v).includes(norm(search)) ? 1 : 0)}>
          <CommandInput placeholder={placeholder} className="text-xs" />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {all.map(o => (
                <CommandItem key={o.value} value={`${o.label} ${o.extra ?? ""} ${o.value === "todos" ? "" : o.value}`}
                  onSelect={() => { onChange(o.value); setOpen(false); }} className="text-xs">
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
