import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { correspondeTomador, type TomadorBusca } from "@/lib/buscaTomador";
import { cn } from "@/lib/utils";

export default function TomadorSelect({ value, onValueChange, options }: {
  value: string; onValueChange: (id: string) => void; options: TomadorBusca[];
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const selected = options.find(item => item.id === value);
  const resultados = useMemo(() => options.filter(item => correspondeTomador(item, busca))
    .sort((a, b) => (a.nome || a.nomeFantasia || "").localeCompare(b.nome || b.nomeFantasia || "", "pt-BR")), [options, busca]);
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); setBusca(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label="Cliente / Tomador" aria-expanded={open} className="h-auto min-h-10 w-full justify-between gap-2 text-left font-normal">
          <span className="min-w-0 whitespace-normal break-words">{selected ? `${selected.nome || selected.nomeFantasia} — ${selected.cnpj || selected.cpf || "—"}` : "Selecione o tomador..."}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0 pointer-events-auto">
        <Command shouldFilter={false}>
          <CommandInput aria-label="Buscar tomador" placeholder="Buscar por nome, CPF ou CNPJ..." value={busca} onValueChange={setBusca} />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum tomador encontrado.</CommandEmpty>
            <CommandGroup>
              {resultados.map(item => (
                <CommandItem key={item.id} value={item.id} onSelect={() => { onValueChange(item.id); setOpen(false); setBusca(""); }} className="items-start gap-2 py-2">
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0", item.id === value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words">{item.nome || item.nomeFantasia}</span>
                    <span className="block text-xs text-muted-foreground">{item.cnpj || item.cpf || "—"}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{resultados.length} de {options.length} tomadores</div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}