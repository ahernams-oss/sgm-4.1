import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Normaliza texto para busca: minúsculo e sem acentos. */
const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface FuncOption {
  id: string;
  nome: string;
  matricula?: string | null;
  cpf?: string | null;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: FuncOption[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function FuncionarioCombobox({
  value, onChange, options, disabled, className, placeholder = "Selecione o funcionário",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.nome || placeholder}
          </span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,92vw)] p-0" align="start">
        <Command
          filter={(v, search) => {
            const terms = norm(search).split(/\s+/).filter(Boolean);
            const target = norm(v);
            return terms.every((t) => target.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nome, matrícula ou CPF..." className="h-9" />
          <CommandList className="max-h-72">
            <CommandEmpty>Nenhum funcionário encontrado.</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem value="__limpar__" onSelect={() => { onChange(""); setOpen(false); }}>
                  <X className="mr-2 h-4 w-4" /> Limpar seleção
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={`${options.length} funcionário(s)`}>
              {options.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`${f.nome} ${f.matricula || ""} ${f.cpf || ""}`}
                  onSelect={() => { onChange(f.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === f.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{f.nome}</span>
                  {(f.matricula || f.cpf) && (
                    <span className="ml-auto pl-2 text-[10px] text-muted-foreground">
                      {f.matricula || f.cpf}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
